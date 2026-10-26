import type { Root } from 'mdast';

import type { EngineDialect } from '../../types/index.js';
import { asEsm, asJsxElement, importSources } from './mdxNodes.js';

export const DOCUSAURUS_MODULE_PREFIXES = ['@theme/', '@docusaurus/', '@site/'];
export const STARLIGHT_MODULE_PREFIXES = ['@astrojs/starlight', 'astro:'];

export function isDocusaurusModule(source: string): boolean {
  return DOCUSAURUS_MODULE_PREFIXES.some((p) => source.startsWith(p));
}

export function isStarlightModule(source: string): boolean {
  return STARLIGHT_MODULE_PREFIXES.some((p) => source.startsWith(p));
}

/**
 * Heuristic source-dialect detection used when `normalizeToCanonical` gets no hint.
 * Evidence is scored so a single stray key cannot override strong import evidence.
 */
export function detectSourceDialect(frontmatter: Record<string, unknown> | undefined, tree: Root): EngineDialect {
  let docusaurus = 0;
  let starlight = 0;

  if (frontmatter) {
    if ('sidebar_position' in frontmatter || 'sidebar_label' in frontmatter || 'sidebar_class_name' in frontmatter) {
      docusaurus += 2;
    }
    if (
      'hide_table_of_contents' in frontmatter ||
      'pagination_next' in frontmatter ||
      'pagination_prev' in frontmatter
    ) {
      docusaurus += 1;
    }
    const sidebar = frontmatter.sidebar;
    if (typeof sidebar === 'object' && sidebar !== null && !Array.isArray(sidebar)) {
      starlight += 2;
    }
    if ('tableOfContents' in frontmatter || 'hero' in frontmatter || 'template' in frontmatter) {
      starlight += 1;
    }
  }

  for (const node of tree.children) {
    const esm = asEsm(node);
    if (esm) {
      for (const source of importSources(esm)) {
        if (isDocusaurusModule(source)) docusaurus += 3;
        if (isStarlightModule(source)) starlight += 3;
      }
      continue;
    }
    const jsx = asJsxElement(node);
    if (jsx) {
      if (jsx.name === 'Aside' || jsx.name === 'Steps' || jsx.name === 'Card' || jsx.name === 'CardGrid')
        starlight += 1;
      if (jsx.name === 'Admonition') docusaurus += 1;
    }
  }

  if (docusaurus === 0 && starlight === 0) return 'mdx';
  return docusaurus >= starlight ? 'docusaurus' : 'starlight';
}
