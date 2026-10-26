// Regenerates expected.*.mdx for every case from the current compiler.
//
// Usage (from packages/core):  npx tsx test/fixtures/dialect/regenerate.mts
//
// The goldens are the contract (plan §6.3), not the implementation: after running this, review
// every diff against the mapping table before committing. Never run it to "make tests pass".
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDialectCompiler } from '../../../src/dialect/index.js';

const compiler = createDialectCompiler();
const root = fileURLToPath(new URL('./cases', import.meta.url));
for (const name of readdirSync(root).sort()) {
  const rawContent = readFileSync(join(root, name, 'canonical.md'), 'utf8');
  for (const target of ['mdx', 'docusaurus', 'starlight'] as const) {
    const result = compiler.compileCanonicalMarkdown({ filePath: `${name}.md`, rawContent }, target);
    writeFileSync(join(root, name, `expected.${target}.mdx`), result.compiledContent);
    const notable = result.diagnostics.filter((d) => d.level !== 'info');
    if (notable.length > 0)
      console.log(
        `${name}/${target}:`,
        notable.map((d) => `${d.level}@${d.line ?? '-'}: ${d.message}`),
      );
  }
}
