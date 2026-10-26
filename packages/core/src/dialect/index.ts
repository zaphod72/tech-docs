export { createDialectCompiler, DefaultDialectCompiler, defaultAdapters } from './DialectCompiler.js';
export type { AdapterRegistry, NormalizeResult } from './DialectCompiler.js';
export * from './adapters/index.js';
export { splitFrontmatter, serializeFrontmatter, orderKeys } from './canonical/frontmatter.js';
export { parseMarkdown, stringifyTree, stringifyNodes, STRINGIFY_OPTIONS } from './canonical/processor.js';
export { validateCanonicalTree, firstHeadingText } from './canonical/validate.js';
export { detectSourceDialect } from './canonical/detect.js';
export {
  findCodeRefs,
  parseCodeRefAttributes,
  groupTabs,
  directiveLabel,
  containerBody,
  makeContainerDirective,
  makeLeafDirective,
  slugify,
} from './canonical/directives.js';
export type { CodeRefOccurrence } from './canonical/directives.js';
