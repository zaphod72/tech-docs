import type { RootContent } from 'mdast';

import type { CanonicalFrontmatter, TabsGroup } from '../../types/directives.js';
import { makeContainerDirective } from '../canonical/directives.js';
import type { AdapterContext, DialectAdapter } from './context.js';
import { detailsBlock, orderKeys, splitCanonicalFrontmatter, tabsBlock } from './jsx.js';

export const DOCUSAURUS_TABS_IMPORTS = ["import Tabs from '@theme/Tabs';", "import TabItem from '@theme/TabItem';"];

/** Docusaurus 3 (`@docusaurus/preset-classic`): native admonition directives, `@theme` tabs. */
export class DocusaurusDialectAdapter implements DialectAdapter {
  readonly target = 'docusaurus' as const;

  admonition(kind: string, title: string | undefined, children: RootContent[]): RootContent[] {
    // note | tip | info | warning | danger are all native; `caution` was already aliased to warning.
    return [makeContainerDirective(kind, title, undefined, children)];
  }

  tabs(group: TabsGroup, ctx: AdapterContext): RootContent[] {
    for (const line of DOCUSAURUS_TABS_IMPORTS) ctx.imports.add(line);
    return tabsBlock(group, { groupAttr: 'groupId', valueAttr: true }, ctx);
  }

  details(summary: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[] {
    return detailsBlock(summary, children, ctx);
  }

  mapFrontmatter(frontmatter: CanonicalFrontmatter): Record<string, unknown> {
    const { known, rest } = splitCanonicalFrontmatter(frontmatter);
    const mapped: Record<string, unknown> = {
      title: known.title,
      description: known.description,
      sidebar_label: known.sidebarLabel,
      sidebar_position: known.sidebarOrder,
      slug: known.slug,
      tags: known.tags,
      draft: known.draft,
      ...rest,
    };
    return orderKeys(mapped, [
      'id',
      'title',
      'description',
      'sidebar_label',
      'sidebar_position',
      'slug',
      'tags',
      'draft',
    ]);
  }
}
