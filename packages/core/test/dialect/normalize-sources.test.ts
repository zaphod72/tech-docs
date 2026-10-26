import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createDialectCompiler } from '../../src/dialect';

// Real engine sources (JSX + engine imports) normalised to canonical directives (plan §6.3, reversed).
const SOURCES = fileURLToPath(new URL('../fixtures/dialect/sources', import.meta.url));
const compiler = createDialectCompiler();

describe('normalises a Docusaurus source document', () => {
  const raw = readFileSync(join(SOURCES, 'docusaurus-source.mdx'), 'utf8');
  const result = compiler.normalizeToCanonicalDetailed(raw, undefined, 'install.mdx');

  it('detects the dialect from @theme imports and sidebar_* keys', () => {
    expect(result.sourceDialect).toBe('docusaurus');
  });

  it('drops engine imports', () => {
    expect(result.input.rawContent).not.toContain('@theme/');
    expect(result.input.rawContent).not.toContain('import ');
  });

  it('converts <Tabs>/<TabItem> into :::tabs with ::tab, keeping non-slug values', () => {
    expect(result.input.rawContent).toContain(':::tabs{group="pm"}');
    expect(result.input.rawContent).toContain('::tab[npm]');
    expect(result.input.rawContent).toContain('::tab[Yarn]{value="yarn-classic"}');
    expect(result.input.rawContent).toContain('npm install');
    expect(result.input.rawContent).toContain('Use yarn.');
  });

  it('converts <Admonition> and the legacy title syntax into canonical admonitions', () => {
    expect(result.input.rawContent).toContain(':::tip[Custom]\nComponent admonition.\n:::');
    expect(result.input.rawContent).toContain(':::note[Legacy title]\nOld Docusaurus title syntax.\n:::');
    expect(result.input.rawContent).toContain(':::warning\nDeprecated alias.\n:::');
  });

  it('converts <details>/<summary> into :::details', () => {
    expect(result.input.rawContent).toContain(':::details[More]\nHidden text.\n:::');
  });

  it('maps frontmatter and passes unknown keys through', () => {
    expect(result.input.frontmatter).toEqual({
      title: 'Install',
      sidebarLabel: 'Installing',
      sidebarOrder: 2,
      id: 'install',
      hide_table_of_contents: true,
    });
  });

  it('produces a canonical document that compiles back to Docusaurus without errors', () => {
    const out = compiler.compileCanonicalMarkdown(result.input, 'docusaurus');
    expect(out.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(out.synthesizedImports).toEqual([
      "import Tabs from '@theme/Tabs';",
      "import TabItem from '@theme/TabItem';",
    ]);
    expect(out.compiledContent).toContain('<TabItem value="yarn-classic" label="Yarn">');
  });
});

describe('normalises a Starlight source document', () => {
  const raw = readFileSync(join(SOURCES, 'starlight-source.mdx'), 'utf8');
  const result = compiler.normalizeToCanonicalDetailed(raw, undefined, 'install.mdx');

  it('detects the dialect from the components import and sidebar object', () => {
    expect(result.sourceDialect).toBe('starlight');
  });

  it('converts <Tabs syncKey>/<TabItem label> and <Aside> into directives', () => {
    expect(result.input.rawContent).toContain(':::tabs{group="pm"}');
    expect(result.input.rawContent).toContain('::tab[npm]');
    expect(result.input.rawContent).toContain('::tab[Yarn]');
    expect(result.input.rawContent).toContain(':::tip[Custom]\nComponent aside.\n:::');
    expect(result.input.rawContent).toContain(':::warning\nStarlight caution.\n:::');
    expect(result.input.rawContent).not.toContain('@astrojs/starlight');
  });

  it('maps sidebar.{order,label} and keeps sidebar.badge', () => {
    expect(result.input.frontmatter).toEqual({
      title: 'Install',
      description: 'How to install.',
      sidebarLabel: 'Installing',
      sidebarOrder: 2,
      sidebar: { badge: 'New' },
    });
  });

  it('compiles back to Starlight with the badge preserved under sidebar', () => {
    const out = compiler.compileCanonicalMarkdown(result.input, 'starlight');
    expect(out.exportedFrontmatter.sidebar).toEqual({ label: 'Installing', order: 2, badge: 'New' });
    expect(out.synthesizedImports).toEqual(["import { Tabs, TabItem } from '@astrojs/starlight/components';"]);
  });
});

describe('cross-engine conversion', () => {
  it('Docusaurus source → Starlight output', () => {
    const raw = readFileSync(join(SOURCES, 'docusaurus-source.mdx'), 'utf8');
    const canonical = compiler.normalizeToCanonical(raw, 'docusaurus', 'install.mdx');
    const out = compiler.compileCanonicalMarkdown(canonical, 'starlight');
    expect(out.compiledContent).toContain('<Tabs syncKey="pm">');
    expect(out.compiledContent).toContain('<TabItem label="Yarn">');
    expect(out.compiledContent).toContain(':::caution\nDeprecated alias.\n:::');
    expect(out.exportedFrontmatter).toMatchObject({ title: 'Install', sidebar: { label: 'Installing', order: 2 } });
  });
});
