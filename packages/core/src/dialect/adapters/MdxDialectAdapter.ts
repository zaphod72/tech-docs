import type { RootContent } from 'mdast';

import type { CanonicalFrontmatter, TabsGroup } from '../../types/directives.js';
import type { AdapterContext, DialectAdapter } from './context.js';
import { detailsBlock, jsxContainer, orderKeys, splitCanonicalFrontmatter, tabsBlock } from './jsx.js';

/**
 * Plain MDX target (runners/mdx). Components are provided by the host through the MDX
 * `components` map, so no imports are synthesised — the output is engine-neutral MDX.
 * Component contract consumed by U7: <Admonition type title>, <Tabs groupId>, <TabItem value label>.
 */
export class MdxDialectAdapter implements DialectAdapter {
  readonly target = 'mdx' as const;

  admonition(kind: string, title: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[] {
    return jsxContainer('Admonition', { type: kind, title }, children, ctx);
  }

  tabs(group: TabsGroup, ctx: AdapterContext): RootContent[] {
    return tabsBlock(group, { groupAttr: 'groupId', valueAttr: true }, ctx);
  }

  details(summary: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[] {
    return detailsBlock(summary, children, ctx);
  }

  mapFrontmatter(frontmatter: CanonicalFrontmatter): Record<string, unknown> {
    const { known, rest } = splitCanonicalFrontmatter(frontmatter);
    return orderKeys({ ...known, ...rest }, [
      'title',
      'description',
      'sidebarLabel',
      'sidebarOrder',
      'slug',
      'tags',
      'draft',
    ]);
  }
}
