import type { Parent, Root, RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';

import { CANONICAL_FRONTMATTER_KEYS, type CanonicalFrontmatter, type Diagnostic } from '../../types/directives.js';
import type { EngineDialect } from '../../types/index.js';
import { isDocusaurusModule, isStarlightModule } from './detect.js';
import { makeContainerDirective, makeLeafDirective, nodeLine, slugify } from './directives.js';
import { orderKeys, takeKey } from './frontmatter.js';
import { asEsm, asJsxFlowElement, importSources, jsxAttr, type MdxJsxElement } from './mdxNodes.js';
import { canonicalAdmonitionKind } from './validate.js';

export interface NormalizeContext {
  filePath: string;
  lineOffset: number;
  diagnostics: Diagnostic[];
}

// Docusaurus' legacy `:::note Title` form is not valid directive syntax; rewrite to `:::note[Title]`.
const LEGACY_TITLE_RE = /^(:::+)([a-zA-Z][\w-]*)[ \t]+([^[{\s][^\n]*?)[ \t]*$/gm;

/** Pre-parse textual fix-ups that are unambiguous for every source dialect. */
export function preNormalizeBody(body: string): string {
  return body.replace(LEGACY_TITLE_RE, (_m, fence: string, name: string, title: string) => `${fence}${name}[${title}]`);
}

function summaryText(children: RootContent[]): { summary: string | undefined; rest: RootContent[] } {
  const [first, ...rest] = children;
  if (!first) return { summary: undefined, rest: [] };
  const flow = asJsxFlowElement(first);
  if (flow && flow.name === 'summary') {
    return { summary: toString(first).trim() || undefined, rest };
  }
  if (first.type === 'paragraph' && first.children.length === 1) {
    const only = first.children[0] as unknown as MdxJsxElement;
    if (only.type === 'mdxJsxTextElement' && only.name === 'summary') {
      return { summary: toString(only).trim() || undefined, rest };
    }
  }
  return { summary: undefined, rest: children };
}

function jsxToDirective(node: MdxJsxElement, ctx: NormalizeContext): RootContent[] | undefined {
  const children = node.children as RootContent[];
  const line = nodeLine(node, ctx.lineOffset);

  switch (node.name) {
    case 'Tabs': {
      const group = jsxAttr(node, 'groupId') ?? jsxAttr(node, 'syncKey');
      const out: RootContent[] = [];
      let count = 0;
      for (const child of children) {
        const item = asJsxFlowElement(child);
        if (item && item.name === 'TabItem') {
          count += 1;
          const label = jsxAttr(item, 'label') ?? jsxAttr(item, 'value') ?? `Tab ${count}`;
          const explicit = jsxAttr(item, 'value');
          const value = explicit !== undefined && explicit !== '' && explicit !== slugify(label) ? explicit : undefined;
          out.push(makeLeafDirective('tab', label, { value }), ...(item.children as RootContent[]));
        } else {
          ctx.diagnostics.push({
            level: 'warn',
            message: `<Tabs> child <${item ? item.name : child.type}> is not a <TabItem>; dropped`,
            line: nodeLine(child, ctx.lineOffset),
          });
        }
      }
      return [makeContainerDirective('tabs', undefined, { group }, out)];
    }
    case 'Aside':
    case 'Admonition': {
      const type = jsxAttr(node, 'type') ?? 'note';
      const kind = canonicalAdmonitionKind(type);
      if (!kind) {
        ctx.diagnostics.push({
          level: 'warn',
          message: `<${node.name} type="${type}"> has no canonical admonition kind; using note`,
          line,
        });
      }
      return [makeContainerDirective(kind ?? 'note', jsxAttr(node, 'title'), undefined, children)];
    }
    case 'details': {
      const { summary, rest } = summaryText(children);
      return [makeContainerDirective('details', summary, undefined, rest)];
    }
    case 'TabItem':
      ctx.diagnostics.push({ level: 'warn', message: '<TabItem> outside <Tabs>; unwrapped', line });
      return children;
    default:
      return undefined;
  }
}

function isEngineImport(source: string): boolean {
  return isDocusaurusModule(source) || isStarlightModule(source);
}

/**
 * Rewrites engine-specific JSX/imports into canonical directives, in place.
 * Unknown JSX and non-engine imports are kept (the validator reports them as warnings).
 */
export function normalizeTree(tree: Root, _source: EngineDialect, ctx: NormalizeContext): void {
  const walk = (parent: Parent) => {
    const next: RootContent[] = [];
    for (const child of parent.children) {
      const esm = asEsm(child);
      if (esm) {
        const sources = importSources(esm);
        if (sources.length > 0 && sources.every(isEngineImport)) {
          continue; // engine component imports are implied by the target dialect
        }
        next.push(child);
        continue;
      }
      const jsx = asJsxFlowElement(child);
      if (jsx && jsx.name === 'Tabs') {
        // Keep <TabItem> wrappers intact for the <Tabs> conversion below; only normalise their contents.
        for (const item of jsx.children) {
          const el = asJsxFlowElement(item as RootContent);
          if (el && el.name === 'TabItem') walk(el as unknown as Parent);
        }
      } else if ('children' in child && Array.isArray((child as Parent).children)) {
        walk(child);
      }
      if (jsx) {
        const replacement = jsxToDirective(jsx, ctx);
        if (replacement) {
          next.push(...replacement);
          continue;
        }
      }
      next.push(child);
    }
    parent.children = next;
  };
  walk(tree);
}

/** Maps engine frontmatter keys back to canonical ones (plan §6.3, reversed). */
export function normalizeFrontmatter(
  frontmatter: Record<string, unknown> | undefined,
  source: EngineDialect,
): CanonicalFrontmatter | undefined {
  if (!frontmatter) return undefined;
  const fm: Record<string, unknown> = { ...frontmatter };
  const out: CanonicalFrontmatter = {};

  if (source === 'docusaurus') {
    const label = takeKey<string>(fm, 'sidebar_label');
    const order = takeKey<number>(fm, 'sidebar_position');
    if (label !== undefined) out.sidebarLabel = label;
    if (order !== undefined) out.sidebarOrder = order;
  } else if (source === 'starlight') {
    const sidebar = fm.sidebar;
    if (typeof sidebar === 'object' && sidebar !== null && !Array.isArray(sidebar)) {
      const rest = { ...(sidebar as Record<string, unknown>) };
      const label = takeKey<string>(rest, 'label');
      const order = takeKey<number>(rest, 'order');
      if (label !== undefined) out.sidebarLabel = label;
      if (order !== undefined) out.sidebarOrder = order;
      if (Object.keys(rest).length === 0) delete fm.sidebar;
      else fm.sidebar = rest;
    }
  }

  for (const key of ['title', 'description', 'slug', 'tags', 'draft'] as const) {
    const value = takeKey(fm, key);
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return orderKeys({ ...out, ...fm }, CANONICAL_FRONTMATTER_KEYS);
}
