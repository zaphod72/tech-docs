import type { Code, Paragraph, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { ContainerDirective, LeafDirective } from 'mdast-util-directive';
import { toString } from 'mdast-util-to-string';

import type { CodeRefDirective, CodeRefSelector, TabsGroup, TabSpec } from '../../types/directives.js';
import { DialectParseError } from '../../types/index.js';

export type Attributes = Record<string, string | null | undefined>;

export function nodeLine(
  node: { position?: { start?: { line?: number } } } | undefined,
  offset = 0,
): number | undefined {
  const line = node?.position?.start?.line;
  return typeof line === 'number' ? line + offset : undefined;
}

export function attr(node: { attributes?: Attributes | null }, name: string): string | undefined {
  const value = node.attributes?.[name];
  return value === null || value === undefined ? undefined : value;
}

function isLabelParagraph(node: RootContent): node is Paragraph {
  return node.type === 'paragraph' && (node.data as { directiveLabel?: boolean } | undefined)?.directiveLabel === true;
}

/** `:::note[Label]` → "Label"; `::tab[Label]` → "Label". Undefined when absent. */
export function directiveLabel(node: ContainerDirective | LeafDirective): string | undefined {
  if (node.type === 'leafDirective') {
    const text = toString(node).trim();
    return text === '' ? undefined : text;
  }
  const first = node.children[0];
  if (first && isLabelParagraph(first)) {
    const text = toString(first).trim();
    return text === '' ? undefined : text;
  }
  return undefined;
}

/** Children of a container directive without its label paragraph. */
export function containerBody(node: ContainerDirective): RootContent[] {
  const first = node.children[0];
  return first && isLabelParagraph(first) ? node.children.slice(1) : [...node.children];
}

function labelChildren(label: string | undefined): PhrasingContent[] {
  return label === undefined || label === '' ? [] : [{ type: 'text', value: label }];
}

function cleanAttributes(attributes: Attributes | undefined): Record<string, string> | undefined {
  if (!attributes) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

export function makeContainerDirective(
  name: string,
  label: string | undefined,
  attributes: Attributes | undefined,
  children: RootContent[],
): ContainerDirective {
  const kids: RootContent[] = [];
  if (label) {
    kids.push({ type: 'paragraph', data: { directiveLabel: true }, children: labelChildren(label) });
  }
  kids.push(...children);
  const node: ContainerDirective = {
    type: 'containerDirective',
    name,
    children: kids as ContainerDirective['children'],
  };
  const attrs = cleanAttributes(attributes);
  if (attrs) node.attributes = attrs;
  return node;
}

export function makeLeafDirective(
  name: string,
  label: string | undefined,
  attributes: Attributes | undefined,
): LeafDirective {
  const node: LeafDirective = { type: 'leafDirective', name, children: labelChildren(label) };
  const attrs = cleanAttributes(attributes);
  if (attrs) node.attributes = attrs;
  return node;
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Groups the children of a `:::tabs` container into tab specs.
 * Throws `DialectParseError` for content before the first `::tab` or a tabs block with no tabs.
 */
export function groupTabs(node: ContainerDirective, filePath: string, lineOffset = 0): TabsGroup {
  const tabs: TabSpec[] = [];
  const seen = new Map<string, number>();
  let current: TabSpec | undefined;

  for (const child of containerBody(node)) {
    if (child.type === 'leafDirective' && child.name === 'tab') {
      const label = directiveLabel(child) ?? `Tab ${tabs.length + 1}`;
      let value = attr(child, 'value') ?? slugify(label) ?? '';
      if (value === '') value = `tab-${tabs.length + 1}`;
      const count = seen.get(value) ?? 0;
      seen.set(value, count + 1);
      if (count > 0) value = `${value}-${count + 1}`;
      current = { label, value, children: [], line: nodeLine(child, lineOffset) };
      tabs.push(current);
      continue;
    }
    if (!current) {
      const line = nodeLine(child, lineOffset);
      throw new DialectParseError(
        `${filePath}${line === undefined ? '' : `:${line}`}: content inside :::tabs must follow a ::tab[Label] directive`,
      );
    }
    current.children.push(child);
  }

  if (tabs.length === 0) {
    const line = nodeLine(node, lineOffset);
    throw new DialectParseError(
      `${filePath}${line === undefined ? '' : `:${line}`}: :::tabs block contains no ::tab directives`,
    );
  }

  const group = attr(node, 'group');
  return { group, tabs, line: nodeLine(node, lineOffset) };
}

const LINES_RE = /^(\d+)-(\d+)$/;

/** Parses `::code-ref{...}` attributes. Exactly one selector (`symbol` | `region` | `lines`) or none (whole file). */
export function parseCodeRefAttributes(
  attributes: Attributes | undefined,
  filePath: string,
  line?: number,
): CodeRefDirective {
  const where = `${filePath}${line === undefined ? '' : `:${line}`}: ::code-ref`;
  const a = attributes ?? {};
  const get = (k: string) => (a[k] === null || a[k] === undefined || a[k] === '' ? undefined : String(a[k]));

  const file = get('file');
  if (!file) throw new DialectParseError(`${where} requires a file="..." attribute`);

  const symbol = get('symbol');
  const region = get('region');
  const lines = get('lines');
  const selectors = [symbol, region, lines].filter((v) => v !== undefined).length;
  if (selectors > 1) {
    throw new DialectParseError(`${where} accepts only one of symbol= | region= | lines=`);
  }

  let selector: CodeRefSelector;
  if (symbol !== undefined) {
    const indexRaw = get('index');
    const index = indexRaw === undefined ? undefined : Number.parseInt(indexRaw, 10);
    if (index !== undefined && (!Number.isInteger(index) || index < 1)) {
      throw new DialectParseError(`${where} index= must be a positive integer (1-based)`);
    }
    selector = index === undefined ? { kind: 'symbol', name: symbol } : { kind: 'symbol', name: symbol, index };
  } else if (region !== undefined) {
    selector = { kind: 'region', name: region };
  } else if (lines !== undefined) {
    const m = LINES_RE.exec(lines);
    const start = m ? Number.parseInt(m[1], 10) : Number.NaN;
    const end = m ? Number.parseInt(m[2], 10) : Number.NaN;
    if (!m || start < 1 || end < start) {
      throw new DialectParseError(`${where} lines= must be "<start>-<end>" with 1 <= start <= end`);
    }
    selector = { kind: 'lines', start, end };
  } else {
    selector = { kind: 'file' };
  }

  const ref: CodeRefDirective = { file, selector };
  const lang = get('lang');
  const title = get('title');
  const hash = get('hash');
  if (lang !== undefined) ref.lang = lang;
  if (title !== undefined) ref.title = title;
  if (hash !== undefined) ref.hash = hash;
  if (line !== undefined) ref.line = line;
  return ref;
}

export interface CodeRefOccurrence {
  parent: Parent;
  index: number;
  node: LeafDirective;
  ref: CodeRefDirective;
  /** Fenced code block immediately following the directive, if any (the bound snippet). */
  codeNode: Code | undefined;
}

/** Finds every `::code-ref` directive with its (optional) bound snippet. Shared with U3. */
export function findCodeRefs(tree: Root, filePath: string, lineOffset = 0): CodeRefOccurrence[] {
  const found: CodeRefOccurrence[] = [];
  const walk = (parent: Parent) => {
    parent.children.forEach((child, index) => {
      if (child.type === 'leafDirective' && child.name === 'code-ref') {
        const ref = parseCodeRefAttributes(child.attributes ?? undefined, filePath, nodeLine(child, lineOffset));
        const next = parent.children[index + 1];
        const codeNode = next && next.type === 'code' ? next : undefined;
        found.push({ parent, index, node: child, ref, codeNode });
      }
      if ('children' in child && Array.isArray((child as Parent).children)) {
        walk(child);
      }
    });
  };
  walk(tree);
  return found;
}
