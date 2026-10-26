import type { Root } from 'mdast';
import { describe, expect, it } from 'vitest';

import { normalizeTree } from '../../src/dialect/canonical/normalize';
import { stringifyTree } from '../../src/dialect/canonical/processor';
import type { Diagnostic } from '../../src/types/directives';

// Node shapes are the upstream mdast-util-mdx-jsx / mdast-util-mdxjs-esm definitions, built by hand
// so the normaliser is verified independently of the remark-mdx parser.
const attr = (name: string, value: string | null = null) => ({ type: 'mdxJsxAttribute', name, value });
const jsx = (name: string, attributes: unknown[], children: unknown[] = []) => ({
  type: 'mdxJsxFlowElement',
  name,
  attributes,
  children,
});
const esm = (value: string) => ({ type: 'mdxjsEsm', value });
const para = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', value: text }] });

function run(children: unknown[], source: 'docusaurus' | 'starlight' | 'mdx' = 'docusaurus') {
  const tree = { type: 'root', children } as unknown as Root;
  const diagnostics: Diagnostic[] = [];
  normalizeTree(tree, source, { filePath: 'd.md', lineOffset: 0, diagnostics });
  return { out: stringifyTree(tree), diagnostics };
}

describe('normalizeTree rewrites engine JSX into canonical directives', () => {
  it('drops engine imports and keeps foreign ones', () => {
    const { out } = run([
      esm("import Tabs from '@theme/Tabs';"),
      esm("import { Aside } from '@astrojs/starlight/components';"),
      para('x'),
    ]);
    expect(out).toBe('x\n');
  });

  it('converts Docusaurus <Tabs groupId>/<TabItem value label default>', () => {
    const { out } = run([
      jsx(
        'Tabs',
        [attr('groupId', 'pm')],
        [
          jsx(
            'TabItem',
            [attr('value', 'npm'), attr('label', 'npm'), attr('default')],
            [{ type: 'code', lang: 'bash', value: 'npm install' }],
          ),
          jsx('TabItem', [attr('value', 'yarn-classic'), attr('label', 'Yarn')], [para('Use yarn.')]),
        ],
      ),
    ]);
    expect(out).toBe(
      ':::tabs{group="pm"}\n::tab[npm]\n\n```bash\nnpm install\n```\n\n::tab[Yarn]{value="yarn-classic"}\n\nUse yarn.\n:::\n',
    );
  });

  it('converts Starlight <Tabs syncKey>/<TabItem label>', () => {
    const { out } = run(
      [jsx('Tabs', [attr('syncKey', 'pm')], [jsx('TabItem', [attr('label', 'npm')], [para('a')])])],
      'starlight',
    );
    expect(out).toBe(':::tabs{group="pm"}\n::tab[npm]\n\na\n:::\n');
  });

  it('reads attribute values given as string-literal expressions', () => {
    const { out } = run([
      jsx(
        'Tabs',
        [],
        [
          jsx(
            'TabItem',
            [
              {
                type: 'mdxJsxAttribute',
                name: 'label',
                value: { type: 'mdxJsxAttributeValueExpression', value: '"Lit"' },
              },
            ],
            [para('a')],
          ),
        ],
      ),
    ]);
    expect(out).toContain('::tab[Lit]');
  });

  it('warns on and drops non-TabItem children of <Tabs>', () => {
    const { out, diagnostics } = run([
      jsx('Tabs', [], [para('stray'), jsx('TabItem', [attr('label', 'A')], [para('a')])]),
    ]);
    expect(out).toBe(':::tabs\n::tab[A]\n\na\n:::\n');
    expect(diagnostics.map((d) => d.level)).toEqual(['warn']);
  });

  it('converts <Admonition type title> and <Aside type title>', () => {
    expect(run([jsx('Admonition', [attr('type', 'tip'), attr('title', 'Custom')], [para('body')])]).out).toBe(
      ':::tip[Custom]\nbody\n:::\n',
    );
    expect(run([jsx('Aside', [attr('type', 'caution')], [para('body')])], 'starlight').out).toBe(
      ':::warning\nbody\n:::\n',
    );
    expect(run([jsx('Aside', [], [para('body')])], 'starlight').out).toBe(':::note\nbody\n:::\n');
  });

  it('warns and falls back to note for an unknown admonition type', () => {
    const { out, diagnostics } = run([jsx('Aside', [attr('type', 'weird')], [para('body')])], 'starlight');
    expect(out).toBe(':::note\nbody\n:::\n');
    expect(diagnostics[0].message).toContain('no canonical admonition kind');
  });

  it('converts <details> with a flow <summary>', () => {
    const { out } = run([jsx('details', [], [jsx('summary', [], [{ type: 'text', value: 'More' }]), para('Hidden.')])]);
    expect(out).toBe(':::details[More]\nHidden.\n:::\n');
  });

  it('converts <details> with an inline <summary> inside a paragraph', () => {
    const summary = {
      type: 'paragraph',
      children: [
        { type: 'mdxJsxTextElement', name: 'summary', attributes: [], children: [{ type: 'text', value: 'More' }] },
      ],
    };
    const { out } = run([jsx('details', [], [summary, para('Hidden.')])]);
    expect(out).toBe(':::details[More]\nHidden.\n:::\n');
  });

  it('unwraps a <TabItem> outside <Tabs> with a warning', () => {
    const { out, diagnostics } = run([jsx('TabItem', [attr('label', 'x')], [para('loose')])]);
    expect(out).toBe('loose\n');
    expect(diagnostics[0].message).toContain('outside <Tabs>');
  });

  it('handles nesting: tabs inside an admonition', () => {
    const { out } = run([
      jsx('Admonition', [attr('type', 'note')], [jsx('Tabs', [], [jsx('TabItem', [attr('label', 'A')], [para('a')])])]),
    ]);
    // mdast-util-directive lengthens the outer fence automatically.
    expect(out).toBe('::::note\n:::tabs\n::tab[A]\n\na\n:::\n::::\n');
  });
});
