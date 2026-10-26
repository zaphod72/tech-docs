// Public barrel for @tech-docs/core ("." export).
//
// Rules:
// - Append-only: each work unit adds its own `export * from './<module>/index.js'` line.
// - Node-only / native modules (persistence, jobs, git, preview) are NOT re-exported here;
//   they are published as package subpaths (`@tech-docs/core/persistence`, ...) so that the
//   `doc-sync` CLI and browser-adjacent code never pull better-sqlite3 into their import graph.

export * from './types/index.js';
export * from './styles/presets.js';
export * from './types/directives.js';
export * from './dialect/index.js';
