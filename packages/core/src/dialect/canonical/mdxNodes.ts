// Structural views of the mdast node types added by remark-mdx (mdast-util-mdx-jsx / mdast-util-mdxjs-esm).
// Declared locally so this module compiles with or without those type packages in the program;
// the shapes match the upstream definitions field-for-field. Helpers return `T | undefined`
// rather than acting as type predicates so narrowing never collapses `RootContent` to `never`
// when the augmenting types are absent.

export interface MdxJsxAttributeValueExpression {
  type: 'mdxJsxAttributeValueExpression';
  value: string;
}

export interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value?: string | MdxJsxAttributeValueExpression | null;
}

export interface MdxJsxExpressionAttribute {
  type: 'mdxJsxExpressionAttribute';
  value: string;
}

export interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>;
  children: unknown[];
  position?: { start?: { line?: number } };
}

export interface MdxjsEsm {
  type: 'mdxjsEsm';
  value: string;
  position?: { start?: { line?: number } };
}

type AnyNode = { type: string };

export function asJsxElement(node: AnyNode): MdxJsxElement | undefined {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
    ? (node as unknown as MdxJsxElement)
    : undefined;
}

export function asJsxFlowElement(node: AnyNode): MdxJsxElement | undefined {
  return node.type === 'mdxJsxFlowElement' ? (node as unknown as MdxJsxElement) : undefined;
}

export function asEsm(node: AnyNode): MdxjsEsm | undefined {
  return node.type === 'mdxjsEsm' ? (node as unknown as MdxjsEsm) : undefined;
}

/** String value of a JSX attribute (`label="x"`), `''` for boolean attributes (`default`), undefined if absent/expression. */
export function jsxAttr(node: MdxJsxElement, name: string): string | undefined {
  for (const a of node.attributes) {
    if (a.type !== 'mdxJsxAttribute' || a.name !== name) continue;
    if (a.value === null || a.value === undefined) return '';
    if (typeof a.value === 'string') return a.value;
    // `{...}` expression: only plain string literals are meaningful for our purposes.
    const m = /^\s*(['"`])([^'"`]*)\1\s*$/.exec(a.value.value);
    return m ? m[2] : undefined;
  }
  return undefined;
}

const IMPORT_SOURCE_RE = /\bfrom\s+(['"])([^'"]+)\1|^\s*import\s+(['"])([^'"]+)\3/gm;

/** Module specifiers imported by an ESM node (`import X from 'y'`, `import 'y'`). */
export function importSources(node: MdxjsEsm): string[] {
  const sources: string[] = [];
  for (const m of node.value.matchAll(IMPORT_SOURCE_RE)) {
    const source = m[2] ?? m[4];
    if (source) sources.push(source);
  }
  return sources;
}
