import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { FrontmatterValidationError } from '../../types/index.js';

export interface SplitDocument {
  /** Parsed YAML object, or `undefined` when the document has no frontmatter block. */
  frontmatter: Record<string, unknown> | undefined;
  /** Markdown body with the frontmatter block removed. */
  body: string;
  /** Number of lines occupied by the frontmatter block (0 when absent); add to body line numbers. */
  bodyLineOffset: number;
}

// `---` on the very first line, any content, `---` on its own line (or at EOF).
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?---[ \t]*(?:\r?\n|$)/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Splits a leading YAML frontmatter block off a markdown document.
 * Handled outside the remark pipeline [D20] so the mdast never carries `yaml` nodes.
 */
export function splitFrontmatter(raw: string): SplitDocument {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    return { frontmatter: undefined, body: raw, bodyLineOffset: 0 };
  }

  const yamlSource = match[1] ?? '';
  let parsed: unknown;
  try {
    parsed = yamlSource.trim() === '' ? {} : parseYaml(yamlSource);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new FrontmatterValidationError(`Invalid YAML frontmatter: ${message}`);
  }
  if (parsed === null || parsed === undefined) {
    parsed = {};
  }
  if (!isPlainObject(parsed)) {
    throw new FrontmatterValidationError('Frontmatter must be a YAML mapping (key: value pairs)');
  }

  const block = match[0];
  const bodyLineOffset = block.split(/\r?\n/).length - (block.endsWith('\n') ? 1 : 0);
  return { frontmatter: parsed, body: raw.slice(block.length), bodyLineOffset };
}

/** Serialises a frontmatter object as a `---` block. Returns `''` for an empty object. */
export function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
  if (Object.keys(frontmatter).length === 0) {
    return '';
  }
  // lineWidth: 0 disables line folding so long titles/descriptions stay on one line (stable diffs).
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 });
  return `---\n${yaml}---\n`;
}

/** Rebuilds an object with `order` keys first (in that order), then the remaining keys in original order. */
export function orderKeys(source: Record<string, unknown>, order: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of order) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  for (const [key, value] of Object.entries(source)) {
    if (!(key in out) && value !== undefined) out[key] = value;
  }
  return out;
}

/** Returns the first non-empty value among the given keys and deletes all of them from `source`. */
export function takeKey<T = unknown>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  let found: unknown;
  for (const key of keys) {
    if (found === undefined && source[key] !== undefined) {
      found = source[key];
    }
    delete source[key];
  }
  return found as T | undefined;
}
