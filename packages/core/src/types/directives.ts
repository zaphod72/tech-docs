// Canonical markdown vocabulary (plan §6) — additive types for U2/U3.
// The frozen contract lives in ./index.ts; nothing here changes it.

import type { RootContent } from 'mdast';

import type { DialectCompileResult } from './index.js';

export type Diagnostic = DialectCompileResult['diagnostics'][number];

/** Admonition kinds accepted in canonical markdown (`:::note`, `:::tip`, ...). */
export const ADMONITION_KINDS = ['note', 'tip', 'info', 'warning', 'danger'] as const;
export type AdmonitionKind = (typeof ADMONITION_KINDS)[number];

/** Aliases accepted on input and rewritten to a canonical kind. */
export const ADMONITION_ALIASES: Readonly<Record<string, AdmonitionKind>> = {
  caution: 'warning',
};

export const CONTAINER_DIRECTIVES = [
  ...ADMONITION_KINDS,
  ...Object.keys(ADMONITION_ALIASES),
  'tabs',
  'details',
] as const;
export const LEAF_DIRECTIVES = ['tab', 'code-ref'] as const;

export interface TabSpec {
  label: string;
  /** Stable identifier; explicit `{value=...}` or slugified label. */
  value: string;
  children: RootContent[];
  line?: number;
}

export interface TabsGroup {
  /** `:::tabs{group="pm"}` — Docusaurus `groupId`, Starlight `syncKey`. */
  group?: string;
  tabs: TabSpec[];
  line?: number;
}

export type CodeRefSelector =
  | { kind: 'symbol'; name: string; index?: number }
  | { kind: 'region'; name: string }
  | { kind: 'lines'; start: number; end: number }
  | { kind: 'file' };

/** Parsed `::code-ref{...}` leaf directive. U3 resolves it; U2 only validates and renders. */
export interface CodeRefDirective {
  file: string;
  selector: CodeRefSelector;
  lang?: string;
  title?: string;
  hash?: string;
  line?: number;
}

/** Canonical frontmatter keys. Unknown keys are passed through untouched. */
export interface CanonicalFrontmatter {
  title?: string;
  description?: string;
  sidebarLabel?: string;
  sidebarOrder?: number;
  slug?: string;
  tags?: string[];
  draft?: boolean;
  [key: string]: unknown;
}

export const CANONICAL_FRONTMATTER_KEYS = [
  'title',
  'description',
  'sidebarLabel',
  'sidebarOrder',
  'slug',
  'tags',
  'draft',
] as const;
