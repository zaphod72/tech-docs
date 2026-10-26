import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createDialectCompiler } from '../../src/dialect';
import type { EngineDialect } from '../../src/types';

// Golden fixtures encode the plan §6.3 dialect mapping table. Each case directory holds the
// canonical input and one expected output per target; expected files were reviewed line by line
// against the table and are the contract — never regenerate them blindly from the implementation.
const CASES_DIR = fileURLToPath(new URL('../fixtures/dialect/cases', import.meta.url));
const TARGETS: readonly EngineDialect[] = ['mdx', 'docusaurus', 'starlight'];
const CASES = readdirSync(CASES_DIR).sort();

const compiler = createDialectCompiler();

describe('compiles canonical markdown to each engine dialect (golden fixtures)', () => {
  it('covers the six planned fixture cases', () => {
    expect(CASES).toEqual(['admonitions', 'code-ref', 'details-nested', 'frontmatter', 'plain', 'tabs']);
  });

  describe.each(CASES)('%s', (name) => {
    const rawContent = readFileSync(join(CASES_DIR, name, 'canonical.md'), 'utf8');

    it.each(TARGETS)('matches expected %s output byte-for-byte', (target) => {
      const expected = readFileSync(join(CASES_DIR, name, `expected.${target}.mdx`), 'utf8');
      const result = compiler.compileCanonicalMarkdown({ filePath: `${name}.md`, rawContent }, target);
      expect(result.compiledContent).toBe(expected);
      expect(result.target).toBe(target);
      expect(result.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    });

    it.each(TARGETS)('is idempotent through normalize → compile for %s', (target) => {
      const once = compiler.compileCanonicalMarkdown({ filePath: `${name}.md`, rawContent }, target).compiledContent;
      const canonical = compiler.normalizeToCanonical(once, target, `${name}.md`);
      const twice = compiler.compileCanonicalMarkdown(canonical, target).compiledContent;
      expect(twice).toBe(once);
    });
  });
});

describe('synthesized imports and exported frontmatter per target', () => {
  const rawContent = readFileSync(join(CASES_DIR, 'tabs', 'canonical.md'), 'utf8');

  it('mdx: no imports (components supplied by the runner)', () => {
    expect(compiler.compileCanonicalMarkdown({ filePath: 'tabs.md', rawContent }, 'mdx').synthesizedImports).toEqual(
      [],
    );
  });

  it('docusaurus: @theme Tabs + TabItem imports, once, in that order', () => {
    expect(
      compiler.compileCanonicalMarkdown({ filePath: 'tabs.md', rawContent }, 'docusaurus').synthesizedImports,
    ).toEqual(["import Tabs from '@theme/Tabs';", "import TabItem from '@theme/TabItem';"]);
  });

  it('starlight: single named import from @astrojs/starlight/components', () => {
    expect(
      compiler.compileCanonicalMarkdown({ filePath: 'tabs.md', rawContent }, 'starlight').synthesizedImports,
    ).toEqual(["import { Tabs, TabItem } from '@astrojs/starlight/components';"]);
  });

  it('maps canonical frontmatter keys per engine', () => {
    const fm = readFileSync(join(CASES_DIR, 'frontmatter', 'canonical.md'), 'utf8');
    const input = { filePath: 'install.md', rawContent: fm };
    expect(compiler.compileCanonicalMarkdown(input, 'docusaurus').exportedFrontmatter).toEqual({
      title: 'Install the CLI',
      description: 'Get doc-sync running locally.',
      sidebar_label: 'Install',
      sidebar_position: 2,
      slug: '/install',
      tags: ['setup', 'cli'],
      draft: false,
      custom_key: 'passthrough',
    });
    expect(compiler.compileCanonicalMarkdown(input, 'starlight').exportedFrontmatter).toEqual({
      title: 'Install the CLI',
      description: 'Get doc-sync running locally.',
      slug: 'install',
      sidebar: { label: 'Install', order: 2 },
      draft: false,
      tags: ['setup', 'cli'],
      custom_key: 'passthrough',
    });
    expect(compiler.compileCanonicalMarkdown(input, 'mdx').exportedFrontmatter).toEqual({
      title: 'Install the CLI',
      description: 'Get doc-sync running locally.',
      sidebarLabel: 'Install',
      sidebarOrder: 2,
      slug: '/install',
      tags: ['setup', 'cli'],
      draft: false,
      custom_key: 'passthrough',
    });
  });
});
