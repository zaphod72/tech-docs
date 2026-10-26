import type { Root, RootContent } from 'mdast';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import { DialectParseError } from '../../types/index.js';

/**
 * Fixed serializer settings so output is byte-stable across runs (plan U2 item 6).
 * Changing any of these changes every golden fixture — treat as part of the contract.
 */
export const STRINGIFY_OPTIONS = {
  bullet: '-',
  bulletOther: '*',
  emphasis: '_',
  strong: '*',
  fences: true,
  rule: '-',
  listItemIndent: 'one',
  incrementListMarker: true,
  resourceLink: false,
} as const;

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMdx)
    .use(remarkDirective)
    .use(remarkStringify, STRINGIFY_OPTIONS)
    .freeze();
}

let processor: ReturnType<typeof buildProcessor> | undefined;

function getProcessor() {
  processor ??= buildProcessor();
  return processor;
}

interface PositionedError {
  line?: number | null;
  place?: { line?: number; start?: { line?: number } } | null;
  reason?: string;
}

function errorLine(error: unknown): number | undefined {
  const e = error as PositionedError;
  if (typeof e.line === 'number') return e.line;
  const place = e.place;
  if (place && typeof place.line === 'number') return place.line;
  if (place?.start && typeof place.start.line === 'number') return place.start.line;
  return undefined;
}

/**
 * Parses a markdown/MDX body into mdast. `lineOffset` is added to error line numbers so they
 * refer to the full document (frontmatter included).
 */
export function parseMarkdown(body: string, filePath: string, lineOffset = 0): Root {
  try {
    return getProcessor().parse(body);
  } catch (error) {
    const line = errorLine(error);
    const where = line === undefined ? '' : `:${line + lineOffset}`;
    const reason = (error as PositionedError).reason ?? (error instanceof Error ? error.message : String(error));
    throw new DialectParseError(`${filePath}${where}: ${reason}`);
  }
}

export function stringifyTree(tree: Root): string {
  return String(getProcessor().stringify(tree));
}

/** Serialises a list of block nodes as a standalone markdown fragment (no trailing newline). */
export function stringifyNodes(nodes: RootContent[]): string {
  if (nodes.length === 0) return '';
  return stringifyTree({ type: 'root', children: nodes }).replace(/\n+$/, '');
}
