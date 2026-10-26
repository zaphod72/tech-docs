import type { RootContent } from 'mdast';

import type { CanonicalFrontmatter, TabsGroup } from '../../types/directives.js';
import { makeContainerDirective } from '../canonical/directives.js';
import type { AdapterContext, DialectAdapter } from './context.js';
import { detailsBlock, orderKeys, splitCanonicalFrontmatter, tabsBlock } from './jsx.js';

export const STARLIGHT_TABS_IMPORT = "import { Tabs, TabItem } from '@astrojs/starlight/components';";

/** Starlight asides support only note | tip | caution | danger. */
const STARLIGHT_ASIDE: Readonly<Record<string, string>> = {
  note: 'note',
  info: 'note',
  tip: 'tip',
  warning: 'caution',
  danger: 'danger',
};

function humanizeFileName(filePath: string): string | undefined {
  const base = filePath
    .split('/')
    .pop()
    ?.replace(/\.(mdx?|markdown)$/i, '');
  if (!base) return undefined;
  const words = base.replace(/[-_]+/g, ' ').trim();
  return words === '' ? undefined : words.charAt(0).toUpperCase() + words.slice(1);
}

/** Starlight 0.42 (`@astrojs/starlight`): native asides, component tabs, `sidebar: {}` frontmatter. */
export class StarlightDialectAdapter implements DialectAdapter {
  readonly target = 'starlight' as const;

  admonition(kind: string, title: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[] {
    const aside = STARLIGHT_ASIDE[kind] ?? 'note';
    if (aside !== kind) {
      ctx.diagnostics.push({ level: 'info', message: `admonition "${kind}" rendered as Starlight aside "${aside}"` });
    }
    return [makeContainerDirective(aside, title, undefined, children)];
  }

  tabs(group: TabsGroup, ctx: AdapterContext): RootContent[] {
    ctx.imports.add(STARLIGHT_TABS_IMPORT);
    return tabsBlock(group, { groupAttr: 'syncKey', valueAttr: false }, ctx);
  }

  details(summary: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[] {
    return detailsBlock(summary, children, ctx);
  }

  mapFrontmatter(frontmatter: CanonicalFrontmatter, ctx: AdapterContext): Record<string, unknown> {
    const { known, rest } = splitCanonicalFrontmatter(frontmatter);

    let title = known.title;
    if (title === undefined || title === '') {
      title = ctx.firstHeading ?? humanizeFileName(ctx.filePath);
      if (title === undefined) {
        ctx.diagnostics.push({
          level: 'error',
          message: 'Starlight requires frontmatter `title` and none could be synthesised',
        });
      } else {
        ctx.diagnostics.push({ level: 'info', message: `Starlight \`title\` synthesised as "${title}"` });
      }
    }

    const sidebar: Record<string, unknown> = {
      ...(typeof rest.sidebar === 'object' && rest.sidebar !== null ? (rest.sidebar as Record<string, unknown>) : {}),
    };
    if (known.sidebarLabel !== undefined) sidebar.label = known.sidebarLabel;
    if (known.sidebarOrder !== undefined) sidebar.order = known.sidebarOrder;
    delete rest.sidebar;

    if (known.tags !== undefined) {
      ctx.diagnostics.push({
        level: 'warn',
        message: 'Starlight has no native `tags` frontmatter; key passed through',
      });
    }

    // Starlight slugs are relative to the docs root; Docusaurus-style absolute slugs lose the leading slash.
    const slug = typeof known.slug === 'string' ? known.slug.replace(/^\/+/, '') : known.slug;

    const mapped: Record<string, unknown> = {
      title,
      description: known.description,
      slug,
      sidebar: Object.keys(sidebar).length > 0 ? orderKeys(sidebar, ['label', 'order']) : undefined,
      draft: known.draft,
      tags: known.tags,
      ...rest,
    };
    return orderKeys(mapped, ['title', 'description', 'slug', 'sidebar', 'draft', 'tags']);
  }
}
