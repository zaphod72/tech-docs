import type { RootContent } from 'mdast';

import type { CanonicalFrontmatter, Diagnostic, TabsGroup } from '../../types/directives.js';
import type { EngineDialect } from '../../types/index.js';

export interface AdapterContext {
  /** Canonical relative path (may be '' when unknown). */
  filePath: string;
  /** Path label for diagnostics (`'<canonical>'` when `filePath` is empty). */
  displayPath: string;
  lineOffset: number;
  diagnostics: Diagnostic[];
  /** Import statements the adapter needs prepended to the output (deduplicated, sorted at assembly). */
  imports: Set<string>;
  /** Text of the first H1, for synthesising a missing `title`. */
  firstHeading: string | undefined;
  /** Serialises already-transformed block nodes to a markdown fragment. */
  stringifyNodes(nodes: RootContent[]): string;
}

/** Per-engine rendering of canonical constructs. Each method returns the replacement block nodes. */
export interface DialectAdapter {
  readonly target: EngineDialect;
  admonition(kind: string, title: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[];
  tabs(group: TabsGroup, ctx: AdapterContext): RootContent[];
  details(summary: string | undefined, children: RootContent[], ctx: AdapterContext): RootContent[];
  mapFrontmatter(frontmatter: CanonicalFrontmatter, ctx: AdapterContext): Record<string, unknown>;
}
