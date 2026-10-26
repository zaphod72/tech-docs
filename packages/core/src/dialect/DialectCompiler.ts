import type { CanonicalFrontmatter, Diagnostic } from '../types/directives.js';
import type { CanonicalDocInput, DialectCompileResult, DialectCompiler, EngineDialect } from '../types/index.js';
import type { AdapterContext, DialectAdapter } from './adapters/context.js';
import { DocusaurusDialectAdapter } from './adapters/DocusaurusDialectAdapter.js';
import { MdxDialectAdapter } from './adapters/MdxDialectAdapter.js';
import { StarlightDialectAdapter } from './adapters/StarlightDialectAdapter.js';
import { detectSourceDialect } from './canonical/detect.js';
import { serializeFrontmatter, splitFrontmatter } from './canonical/frontmatter.js';
import { normalizeFrontmatter, normalizeTree, preNormalizeBody } from './canonical/normalize.js';
import { parseMarkdown, stringifyNodes, stringifyTree } from './canonical/processor.js';
import { firstHeadingText, validateCanonicalTree } from './canonical/validate.js';
import { applyCodeRefs, transformDirectives } from './transform.js';

export interface NormalizeResult {
  input: CanonicalDocInput;
  /** Dialect the source was treated as (the hint, or the detected one). */
  sourceDialect: EngineDialect;
  diagnostics: Diagnostic[];
}

export type AdapterRegistry = Readonly<Record<EngineDialect, DialectAdapter>>;

export function defaultAdapters(): AdapterRegistry {
  return {
    mdx: new MdxDialectAdapter(),
    docusaurus: new DocusaurusDialectAdapter(),
    starlight: new StarlightDialectAdapter(),
  };
}

/**
 * Deep module: canonical markdown (plan §6) in, engine dialect out.
 * Interface: `DialectCompiler` (frozen). Seam: `DialectAdapter` × {mdx, docusaurus, starlight}.
 */
export class DefaultDialectCompiler implements DialectCompiler {
  constructor(private readonly adapters: AdapterRegistry = defaultAdapters()) {}

  normalizeToCanonical(rawMarkdown: string, sourceHint?: EngineDialect, filePath = ''): CanonicalDocInput {
    return this.normalizeToCanonicalDetailed(rawMarkdown, sourceHint, filePath).input;
  }

  /** Same as `normalizeToCanonical` but also returns the detected dialect and diagnostics (workbench use). */
  normalizeToCanonicalDetailed(rawMarkdown: string, sourceHint?: EngineDialect, filePath = ''): NormalizeResult {
    const diagnostics: Diagnostic[] = [];
    const split = splitFrontmatter(rawMarkdown);
    const body = preNormalizeBody(split.body);
    const tree = parseMarkdown(body, filePath, split.bodyLineOffset);

    const sourceDialect = sourceHint ?? detectSourceDialect(split.frontmatter, tree);
    normalizeTree(tree, sourceDialect, { filePath, lineOffset: split.bodyLineOffset, diagnostics });
    diagnostics.push(...validateCanonicalTree(tree, filePath, split.bodyLineOffset));

    const frontmatter = normalizeFrontmatter(split.frontmatter, sourceDialect);
    const rawContent = assemble(frontmatter ?? {}, [], stringifyTree(tree));
    const input: CanonicalDocInput = { filePath, rawContent };
    if (frontmatter !== undefined) input.frontmatter = frontmatter;
    return { input, sourceDialect, diagnostics };
  }

  compileCanonicalMarkdown(input: CanonicalDocInput, target: EngineDialect): DialectCompileResult {
    const adapter = this.adapters[target];
    const filePath = input.filePath;
    const displayPath = filePath || '<canonical>'; // for diagnostics only; never used to synthesise titles
    const split = splitFrontmatter(input.rawContent);
    // `input.frontmatter` (already-parsed, possibly edited by the caller) wins over the embedded block.
    const frontmatter: CanonicalFrontmatter = { ...(split.frontmatter ?? {}), ...(input.frontmatter ?? {}) };

    const tree = parseMarkdown(split.body, displayPath, split.bodyLineOffset);
    const diagnostics = validateCanonicalTree(tree, displayPath, split.bodyLineOffset);

    const ctx: AdapterContext = {
      filePath,
      displayPath,
      lineOffset: split.bodyLineOffset,
      diagnostics,
      imports: new Set<string>(),
      firstHeading: firstHeadingText(tree),
      stringifyNodes,
    };

    applyCodeRefs(tree, ctx);
    transformDirectives(tree, adapter, ctx);
    const exportedFrontmatter = adapter.mapFrontmatter(frontmatter, ctx);
    const synthesizedImports = [...ctx.imports]; // Set preserves first-insertion order

    return {
      target,
      compiledContent: assemble(exportedFrontmatter, synthesizedImports, stringifyTree(tree)),
      exportedFrontmatter,
      synthesizedImports,
      diagnostics,
    };
  }
}

function assemble(frontmatter: Record<string, unknown>, imports: string[], body: string): string {
  const parts: string[] = [];
  const fm = serializeFrontmatter(frontmatter);
  if (fm !== '') parts.push(fm);
  if (imports.length > 0) parts.push(`${imports.join('\n')}\n`);
  const trimmedBody = body.replace(/^\n+/, '').replace(/\n+$/, '');
  if (trimmedBody !== '') parts.push(`${trimmedBody}\n`);
  return parts.join('\n');
}

export function createDialectCompiler(adapters?: AdapterRegistry): DefaultDialectCompiler {
  return new DefaultDialectCompiler(adapters);
}
