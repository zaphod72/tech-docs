import { describe, expect, it } from 'vitest';

import { createDialectCompiler } from '../../src/dialect';
import { DialectParseError, FrontmatterValidationError, UnsupportedDirectiveError } from '../../src/types';

const compiler = createDialectCompiler();
const compile = (rawContent: string, target: 'mdx' | 'docusaurus' | 'starlight' = 'mdx', filePath = 'doc.md') =>
  compiler.compileCanonicalMarkdown({ filePath, rawContent }, target);

describe('rejects invalid canonical markdown with typed errors and document line numbers', () => {
  it('throws UnsupportedDirectiveError for an unknown container directive', () => {
    expect(() => compile(':::card\nx\n:::\n')).toThrow(UnsupportedDirectiveError);
    expect(() => compile(':::card\nx\n:::\n')).toThrow('doc.md:1: unsupported container directive ":::card"');
  });

  it('throws UnsupportedDirectiveError for an unknown leaf directive', () => {
    expect(() => compile('::youtube{id="x"}\n')).toThrow(UnsupportedDirectiveError);
  });

  it('reports lines relative to the full document, including the frontmatter block', () => {
    expect(() => compile('---\ntitle: T\n---\n\n:::bogus\nx\n:::\n')).toThrow(
      'doc.md:5: unsupported container directive',
    );
  });

  it('throws DialectParseError for ::tab outside :::tabs', () => {
    expect(() => compile('::tab[x]\n')).toThrow(DialectParseError);
    expect(() => compile('::tab[x]\n')).toThrow('::tab must appear inside a :::tabs block');
  });

  it('throws DialectParseError for content before the first ::tab', () => {
    expect(() => compile(':::tabs\nstray\n::tab[x]\nok\n:::\n')).toThrow(DialectParseError);
  });

  it('throws DialectParseError for a :::tabs block without tabs', () => {
    expect(() => compile(':::tabs\n:::\n')).toThrow('contains no ::tab directives');
  });

  it('throws DialectParseError for a code-ref with two selectors', () => {
    expect(() => compile('::code-ref{file="a.ts" symbol="x" region="y"}\n')).toThrow(DialectParseError);
  });

  it('throws DialectParseError for a code-ref without file', () => {
    expect(() => compile('::code-ref{symbol="x"}\n')).toThrow('requires a file="..." attribute');
  });

  it('throws FrontmatterValidationError for malformed YAML', () => {
    expect(() => compile('---\ntitle: [unclosed\n---\nx\n')).toThrow(FrontmatterValidationError);
  });

  it('throws FrontmatterValidationError for non-mapping YAML', () => {
    expect(() => compile('---\n- a\n---\nx\n')).toThrow('must be a YAML mapping');
  });

  it('throws DialectParseError for invalid JSX in the body', () => {
    expect(() => compile('Text\n\n<Unclosed\n')).toThrow(DialectParseError);
  });
});

describe('emits diagnostics instead of failing for recoverable issues', () => {
  it('warns on an unbound ::code-ref and drops it', () => {
    const r = compile('::code-ref{file="src/x.ts" symbol="fn"}\n\nAfter.\n');
    expect(r.compiledContent).toBe('After.\n');
    expect(r.diagnostics).toEqual([
      { level: 'warn', message: 'unbound ::code-ref{file="src/x.ts"} has no snippet; run `doc-sync bind`', line: 1 },
    ]);
  });

  it('warns on a stray ::: fence (nesting without a longer outer fence)', () => {
    const r = compile(':::note\nx\n:::\n:::\n');
    expect(r.diagnostics.map((d) => [d.level, d.line])).toEqual([['warn', 4]]);
    expect(r.diagnostics[0].message).toContain('::::details');
  });

  it('warns on residual JSX and ESM in canonical input but passes them through', () => {
    const r = compile('import X from \'x\';\n\n<Custom prop="1" />\n', 'docusaurus');
    expect(r.diagnostics.map((d) => d.level)).toEqual(['warn', 'warn']);
    expect(r.compiledContent).toContain('<Custom');
    expect(r.compiledContent).toContain("import X from 'x';");
  });

  it('warns on text directives and leaves them untouched', () => {
    const r = compile('Call :fn[x] here.\n');
    expect(r.diagnostics[0].level).toBe('warn');
    expect(r.compiledContent).toBe('Call :fn[x] here.\n');
  });
});

describe('Starlight title requirement', () => {
  it('synthesises title from the first H1 with an info diagnostic', () => {
    const r = compile('# Hello World\n\ntext\n', 'starlight');
    expect(r.exportedFrontmatter).toEqual({ title: 'Hello World' });
    expect(r.compiledContent.startsWith('---\ntitle: Hello World\n---\n')).toBe(true);
    expect(r.diagnostics).toEqual([{ level: 'info', message: 'Starlight `title` synthesised as "Hello World"' }]);
  });

  it('falls back to a humanised file name when there is no H1', () => {
    expect(compile('text\n', 'starlight', 'guides/getting-started.md').exportedFrontmatter).toEqual({
      title: 'Getting started',
    });
  });

  it('emits an error diagnostic when no title can be synthesised', () => {
    const r = compile('text\n', 'starlight', '');
    expect(r.diagnostics).toEqual([
      { level: 'error', message: 'Starlight requires frontmatter `title` and none could be synthesised' },
    ]);
  });

  it('keeps an explicit title without diagnostics', () => {
    expect(compile('---\ntitle: Given\n---\n# Other\n', 'starlight').diagnostics).toEqual([]);
  });

  it('strips the leading slash from absolute slugs', () => {
    expect(compile('---\ntitle: T\nslug: /a/b\n---\nx\n', 'starlight').exportedFrontmatter.slug).toBe('a/b');
  });
});

describe('frontmatter handling', () => {
  it('lets input.frontmatter override the embedded block', () => {
    const r = compiler.compileCanonicalMarkdown(
      { filePath: 'a.md', rawContent: '---\ntitle: Old\nkeep: 1\n---\nx\n', frontmatter: { title: 'New' } },
      'mdx',
    );
    expect(r.exportedFrontmatter).toEqual({ title: 'New', keep: 1 });
  });

  it('emits no frontmatter block for an empty object', () => {
    expect(compile('x\n', 'docusaurus').compiledContent).toBe('x\n');
    expect(compile('', 'docusaurus').compiledContent).toBe('');
  });

  it('emits a frontmatter-only document', () => {
    expect(compile('---\ntitle: T\n---\n', 'docusaurus').compiledContent).toBe('---\ntitle: T\n---\n');
  });

  it('orders known keys first and keeps pass-through keys in source order', () => {
    const out = compile('---\nzeta: 1\ntitle: T\nalpha: 2\n---\nx\n', 'docusaurus').compiledContent;
    expect(out).toBe('---\ntitle: T\nzeta: 1\nalpha: 2\n---\n\nx\n');
  });
});

describe('tabs', () => {
  it('slugifies labels into values, de-duplicates, and honours explicit value=', () => {
    const out = compile(
      ':::tabs\n::tab[C++]\na\n::tab[C++]\nb\n::tab[Très bien!]{value="tb"}\nc\n:::\n',
    ).compiledContent;
    expect(out).toContain('<TabItem value="c" label="C++">');
    expect(out).toContain('<TabItem value="c-2" label="C++">');
    expect(out).toContain('<TabItem value="tb" label="Très bien!">');
  });

  it('escapes quotes in labels', () => {
    const out = compile(':::tabs\n::tab[Say "hi"]\na\n:::\n').compiledContent;
    expect(out).toContain('label="Say &quot;hi&quot;"');
  });
});

describe('code-ref snippet decoration', () => {
  it('adds lang from the directive and title from file', () => {
    const out = compile(
      '::code-ref{file="src/a.ts" symbol="x" lang="ts"}\n\n```\nconst a = 1;\n```\n',
      'docusaurus',
    ).compiledContent;
    expect(out).toBe('```ts title="src/a.ts"\nconst a = 1;\n```\n');
  });

  it('prefers the directive title attribute', () => {
    const out = compile('::code-ref{file="src/a.ts" symbol="x" title="Example"}\n\n```ts\n1\n```\n').compiledContent;
    expect(out).toBe('```ts title="Example"\n1\n```\n');
  });

  it('never overrides an existing title= in fence meta and keeps other meta', () => {
    const out = compile(
      '::code-ref{file="src/a.ts" symbol="x"}\n\n```ts title="keep.ts" showLineNumbers\n1\n```\n',
    ).compiledContent;
    expect(out).toBe('```ts title="keep.ts" showLineNumbers\n1\n```\n');
  });
});

describe('normalizeToCanonical', () => {
  it('records the file path on the canonical input (D10)', () => {
    expect(compiler.normalizeToCanonical('# T\n', 'mdx', 'guides/t.md').filePath).toBe('guides/t.md');
    expect(compiler.normalizeToCanonical('# T\n').filePath).toBe('');
  });

  it('rewrites the legacy Docusaurus ":::note Title" form', () => {
    expect(compiler.normalizeToCanonical(':::note Legacy Title\nbody\n:::\n', 'docusaurus').rawContent).toBe(
      ':::note[Legacy Title]\nbody\n:::\n',
    );
  });

  it('rewrites the caution alias to warning', () => {
    expect(compiler.normalizeToCanonical(':::caution\nx\n:::\n', 'starlight').rawContent).toBe(':::warning\nx\n:::\n');
  });

  it('maps Docusaurus frontmatter keys to canonical ones and keeps the rest', () => {
    const r = compiler.normalizeToCanonicalDetailed(
      '---\nid: intro\nsidebar_position: 3\nsidebar_label: Intro\ntitle: Intro\n---\n# Intro\n',
      undefined,
      'intro.md',
    );
    expect(r.sourceDialect).toBe('docusaurus');
    expect(r.input.frontmatter).toEqual({ title: 'Intro', sidebarLabel: 'Intro', sidebarOrder: 3, id: 'intro' });
  });

  it('maps Starlight sidebar.{label,order} and keeps other sidebar keys', () => {
    const r = compiler.normalizeToCanonicalDetailed(
      '---\ntitle: Intro\nsidebar:\n  order: 3\n  label: Intro\n  badge: new\n---\nx\n',
      undefined,
      'intro.md',
    );
    expect(r.sourceDialect).toBe('starlight');
    expect(r.input.frontmatter).toEqual({
      title: 'Intro',
      sidebarLabel: 'Intro',
      sidebarOrder: 3,
      sidebar: { badge: 'new' },
    });
  });

  it('treats plain markdown as mdx when nothing indicates an engine', () => {
    expect(compiler.normalizeToCanonicalDetailed('# Hi\n\ntext\n').sourceDialect).toBe('mdx');
  });
});
