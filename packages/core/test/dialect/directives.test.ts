import { describe, expect, it } from 'vitest';

import { parseCodeRefAttributes, slugify, splitFrontmatter, serializeFrontmatter } from '../../src/dialect';
import { DialectParseError, FrontmatterValidationError } from '../../src/types';

describe('parseCodeRefAttributes', () => {
  it('parses a symbol selector with optional index', () => {
    expect(parseCodeRefAttributes({ file: 'a.ts', symbol: 'fn' }, 'd.md', 3)).toEqual({
      file: 'a.ts',
      selector: { kind: 'symbol', name: 'fn' },
      line: 3,
    });
    expect(parseCodeRefAttributes({ file: 'a.ts', symbol: 'fn', index: '2' }, 'd.md').selector).toEqual({
      kind: 'symbol',
      name: 'fn',
      index: 2,
    });
  });

  it('parses region, lines and whole-file selectors', () => {
    expect(parseCodeRefAttributes({ file: 'a.py', region: 'setup' }, 'd.md').selector).toEqual({
      kind: 'region',
      name: 'setup',
    });
    expect(parseCodeRefAttributes({ file: 'a.rs', lines: '10-20' }, 'd.md').selector).toEqual({
      kind: 'lines',
      start: 10,
      end: 20,
    });
    expect(parseCodeRefAttributes({ file: 'a.rs' }, 'd.md').selector).toEqual({ kind: 'file' });
  });

  it('keeps lang, title and hash', () => {
    expect(
      parseCodeRefAttributes({ file: 'a.ts', symbol: 'x', lang: 'ts', title: 'T', hash: 'sha256:ab' }, 'd.md'),
    ).toEqual({
      file: 'a.ts',
      selector: { kind: 'symbol', name: 'x' },
      lang: 'ts',
      title: 'T',
      hash: 'sha256:ab',
    });
  });

  it.each([
    [{ symbol: 'x' }, 'requires a file'],
    [{ file: 'a', symbol: 'x', lines: '1-2' }, 'only one of'],
    [{ file: 'a', lines: '5-2' }, 'lines= must be'],
    [{ file: 'a', lines: 'abc' }, 'lines= must be'],
    [{ file: 'a', symbol: 'x', index: '0' }, 'index= must be'],
  ])('rejects %j', (attrs, message) => {
    expect(() => parseCodeRefAttributes(attrs, 'd.md', 1)).toThrow(DialectParseError);
    expect(() => parseCodeRefAttributes(attrs, 'd.md', 1)).toThrow(message);
  });
});

describe('slugify', () => {
  it.each([
    ['npm', 'npm'],
    ['C++', 'c'],
    ['Très bien!', 'tres-bien'],
    ['  Hello   World ', 'hello-world'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('frontmatter split / serialize', () => {
  it('splits a block and reports the body line offset', () => {
    expect(splitFrontmatter('---\ntitle: T\n---\nbody\n')).toEqual({
      frontmatter: { title: 'T' },
      body: 'body\n',
      bodyLineOffset: 3,
    });
  });

  it('treats an empty block as an empty object', () => {
    expect(splitFrontmatter('---\n---\nbody\n')).toEqual({ frontmatter: {}, body: 'body\n', bodyLineOffset: 2 });
  });

  it('returns the whole document when there is no block', () => {
    expect(splitFrontmatter('# no fm\n')).toEqual({ frontmatter: undefined, body: '# no fm\n', bodyLineOffset: 0 });
  });

  it('does not treat a thematic break later in the document as frontmatter', () => {
    expect(splitFrontmatter('intro\n---\ntitle: x\n---\n').frontmatter).toBeUndefined();
  });

  it('throws FrontmatterValidationError on scalars and bad YAML', () => {
    expect(() => splitFrontmatter('---\njust a string\n---\n')).toThrow(FrontmatterValidationError);
    expect(() => splitFrontmatter('---\na: [\n---\n')).toThrow(FrontmatterValidationError);
  });

  it('serialises deterministically without line folding', () => {
    const long = 'x'.repeat(120);
    expect(serializeFrontmatter({ title: long, tags: ['a', 'b'] })).toBe(
      `---\ntitle: ${long}\ntags:\n  - a\n  - b\n---\n`,
    );
    expect(serializeFrontmatter({})).toBe('');
  });
});
