import type { Html, RootContent } from 'mdast';

import type { CanonicalFrontmatter, TabsGroup } from '../../types/directives.js';
import { orderKeys } from '../canonical/frontmatter.js';
import type { AdapterContext } from './context.js';

export { orderKeys };

export type JsxAttrs = Record<string, string | true | undefined>;

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openTag(name: string, attrs: JsxAttrs = {}): string {
  const parts = [name];
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    parts.push(value === true ? key : `${key}="${escapeAttr(value)}"`);
  }
  return `<${parts.join(' ')}>`;
}

/**
 * A JSX/HTML block emitted verbatim (mdast `html`). Markdown children are separated from the
 * tags by blank lines so MDX parses them as flow content (lists, fences, nested blocks all work).
 */
export function jsxBlock(name: string, attrs: JsxAttrs, innerMarkdown: string): Html {
  const inner = innerMarkdown.trim();
  const value =
    inner === '' ? `${openTag(name, attrs)}\n</${name}>` : `${openTag(name, attrs)}\n\n${inner}\n\n</${name}>`;
  return { type: 'html', value };
}

export function jsxContainer(
  name: string,
  attrs: JsxAttrs,
  children: RootContent[],
  ctx: AdapterContext,
): RootContent[] {
  return [jsxBlock(name, attrs, ctx.stringifyNodes(children))];
}

export interface TabsStyle {
  /** Attribute carrying the canonical `group` value (`groupId` for Docusaurus, `syncKey` for Starlight). */
  groupAttr: string;
  /** Whether `<TabItem>` carries a `value` attribute (Docusaurus/MDX) or only `label` (Starlight). */
  valueAttr: boolean;
}

/** `<Tabs>` / `<TabItem>` block shared by every engine; only attribute names differ. */
export function tabsBlock(group: TabsGroup, style: TabsStyle, ctx: AdapterContext): RootContent[] {
  const items = group.tabs.map((tab) => {
    const inner = ctx.stringifyNodes(tab.children);
    const open = openTag('TabItem', style.valueAttr ? { value: tab.value, label: tab.label } : { label: tab.label });
    return inner === '' ? `${open}\n</TabItem>` : `${open}\n\n${inner}\n\n</TabItem>`;
  });
  const open = openTag('Tabs', { [style.groupAttr]: group.group });
  return [{ type: 'html', value: `${open}\n${items.join('\n')}\n</Tabs>` }];
}

/** Plain `<details>`/`<summary>` — identical in every engine. */
export function detailsBlock(summary: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[] {
  const inner = ctx.stringifyNodes(children);
  const head = `<details>\n<summary>${escapeText(summary ?? 'Details')}</summary>`;
  const value = inner === '' ? `${head}\n</details>` : `${head}\n\n${inner}\n\n</details>`;
  return [{ type: 'html', value }];
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Splits canonical frontmatter into the known keys and the pass-through remainder. */
export function splitCanonicalFrontmatter(frontmatter: CanonicalFrontmatter): {
  known: CanonicalFrontmatter;
  rest: Record<string, unknown>;
} {
  const { title, description, sidebarLabel, sidebarOrder, slug, tags, draft, ...rest } = frontmatter;
  return { known: { title, description, sidebarLabel, sidebarOrder, slug, tags, draft }, rest };
}
