import type { Code, Parent, Root, RootContent } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';

import type { AdapterContext, DialectAdapter } from './adapters/context.js';
import { containerBody, directiveLabel, findCodeRefs, groupTabs } from './canonical/directives.js';
import { isAdmonitionName } from './canonical/validate.js';

/**
 * Resolves every `::code-ref` directive (plan §6.2): the directive itself is dropped and the bound
 * snippet fence that follows it gets `title="<file>"` (and `lang`) meta. Identical for all engines —
 * Docusaurus and Starlight (Expressive Code) both honour `title=`; the MDX runner ignores it.
 * Unbound refs (no fence yet — `doc-sync bind` has not run) are dropped with a warning.
 */
export function applyCodeRefs(tree: Root, ctx: AdapterContext): void {
  const occurrences = findCodeRefs(tree, ctx.displayPath, ctx.lineOffset);
  // Reverse document order so earlier splices never shift later indices within the same parent.
  for (const { parent, index, ref, codeNode } of occurrences.reverse()) {
    if (codeNode) {
      decorateSnippet(codeNode, ref.file, ref.title, ref.lang);
    } else {
      ctx.diagnostics.push({
        level: 'warn',
        message: `unbound ::code-ref{file="${ref.file}"} has no snippet; run \`doc-sync bind\``,
        line: ref.line,
      });
    }
    parent.children.splice(index, 1);
  }
}

function decorateSnippet(code: Code, file: string, title: string | undefined, lang: string | undefined): void {
  if ((code.lang === null || code.lang === undefined || code.lang === '') && lang) {
    code.lang = lang;
  }
  const meta = code.meta ?? '';
  if (!/(?:^|\s)title=/.test(meta)) {
    const value = (title ?? file).replace(/"/g, '\\"');
    code.meta = meta.trim() === '' ? `title="${value}"` : `${meta.trim()} title="${value}"`;
  }
}

/**
 * Post-order rewrite of canonical container directives into engine constructs. Children are
 * transformed before their parent so nested constructs are already serialisable when an adapter
 * stringifies them into a JSX block.
 */
export function transformDirectives(tree: Root, adapter: DialectAdapter, ctx: AdapterContext): void {
  const walk = (parent: Parent) => {
    const next: RootContent[] = [];
    for (const child of parent.children) {
      if ('children' in child && Array.isArray((child as Parent).children)) {
        walk(child);
      }
      if (child.type === 'containerDirective') {
        next.push(...renderContainer(child, adapter, ctx));
      } else {
        next.push(child);
      }
    }
    parent.children = next;
  };
  walk(tree);
}

function renderContainer(node: ContainerDirective, adapter: DialectAdapter, ctx: AdapterContext): RootContent[] {
  if (node.name === 'tabs') {
    return adapter.tabs(groupTabs(node, ctx.displayPath, ctx.lineOffset), ctx);
  }
  if (node.name === 'details') {
    return adapter.details(directiveLabel(node), containerBody(node), ctx);
  }
  if (isAdmonitionName(node.name)) {
    return adapter.admonition(node.name, directiveLabel(node), containerBody(node), ctx);
  }
  // Unreachable after validateCanonicalTree; keep the node rather than silently dropping content.
  ctx.diagnostics.push({ level: 'error', message: `no renderer for directive ":::${node.name}"` });
  return [node];
}
