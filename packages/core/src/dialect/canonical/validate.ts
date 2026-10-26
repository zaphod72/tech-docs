import type { Parent, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';

import {
  ADMONITION_ALIASES,
  ADMONITION_KINDS,
  CONTAINER_DIRECTIVES,
  LEAF_DIRECTIVES,
  type AdmonitionKind,
  type Diagnostic,
} from '../../types/directives.js';
import { DialectParseError, UnsupportedDirectiveError } from '../../types/index.js';
import { groupTabs, nodeLine, parseCodeRefAttributes } from './directives.js';
import { asEsm, asJsxElement, importSources } from './mdxNodes.js';

const CONTAINER_SET = new Set<string>(CONTAINER_DIRECTIVES);
const STRAY_FENCE_RE = /^:{3,}\s*$/;
const LEAF_SET = new Set<string>(LEAF_DIRECTIVES);
const ADMONITION_SET = new Set<string>(ADMONITION_KINDS);

export function isAdmonitionName(name: string): boolean {
  return ADMONITION_SET.has(name) || name in ADMONITION_ALIASES;
}

export function canonicalAdmonitionKind(name: string): AdmonitionKind | undefined {
  if (ADMONITION_SET.has(name)) return name as AdmonitionKind;
  return ADMONITION_ALIASES[name];
}

function where(filePath: string, line: number | undefined): string {
  return `${filePath}${line === undefined ? '' : `:${line}`}`;
}

/**
 * Validates the canonical directive vocabulary (plan §6.2) and rewrites admonition aliases
 * (`caution` → `warning`) in place. Unknown container/leaf directives throw
 * `UnsupportedDirectiveError`; structural misuse (`::tab` outside `:::tabs`, bad code-ref
 * attributes) throws `DialectParseError`. Text directives and residual JSX only warn.
 */
export function validateCanonicalTree(tree: Root, filePath: string, lineOffset = 0): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const visit = (parent: Parent, insideTabs: boolean) => {
    for (const child of parent.children) {
      const line = nodeLine(child, lineOffset);

      if (child.type === 'containerDirective') {
        if (!CONTAINER_SET.has(child.name)) {
          throw new UnsupportedDirectiveError(
            `${where(filePath, line)}: unsupported container directive ":::${child.name}"`,
          );
        }
        const alias = ADMONITION_ALIASES[child.name];
        if (alias) child.name = alias;
        if (child.name === 'tabs') {
          groupTabs(child, filePath, lineOffset); // throws on structural errors
          visit(child, true);
        } else {
          visit(child, false);
        }
        continue;
      }

      if (child.type === 'leafDirective') {
        if (!LEAF_SET.has(child.name)) {
          throw new UnsupportedDirectiveError(`${where(filePath, line)}: unsupported leaf directive "::${child.name}"`);
        }
        if (child.name === 'tab' && !insideTabs) {
          throw new DialectParseError(`${where(filePath, line)}: ::tab must appear inside a :::tabs block`);
        }
        if (child.name === 'code-ref') {
          parseCodeRefAttributes(child.attributes ?? undefined, filePath, line); // throws on bad attributes
        }
        continue;
      }

      if (child.type === 'paragraph') {
        const only = child.children.length === 1 ? child.children[0] : undefined;
        if (only && only.type === 'text' && STRAY_FENCE_RE.test(only.value)) {
          diagnostics.push({
            level: 'warn',
            message:
              'stray ":::" fence — nested containers need a longer outer fence (e.g. "::::details" around ":::tip")',
            line,
          });
        }
      }

      if (child.type === 'textDirective') {
        diagnostics.push({
          level: 'warn',
          message: `text directive ":${child.name}" has no canonical meaning and is passed through`,
          line,
        });
        continue;
      }

      const esm = asEsm(child);
      if (esm) {
        diagnostics.push({
          level: 'warn',
          message: `ESM statement (${importSources(esm).join(', ') || 'non-import'}) is not canonical and is passed through`,
          line,
        });
        continue;
      }

      const jsx = asJsxElement(child);
      if (jsx) {
        diagnostics.push({
          level: 'warn',
          message: `JSX element <${jsx.name ?? 'fragment'}> is not canonical and is passed through`,
          line,
        });
      }

      if ('children' in child && Array.isArray((child as Parent).children)) {
        // `::tab` is only valid as a direct child of `:::tabs`; anything deeper is not "inside tabs".
        visit(child, false);
      }
    }
  };

  visit(tree, false);
  return diagnostics;
}

/** Text of the first level-1 heading, used to synthesise a missing `title`. */
export function firstHeadingText(tree: Root): string | undefined {
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 1) {
      const text = toString(node).trim();
      return text === '' ? undefined : text;
    }
  }
  return undefined;
}
