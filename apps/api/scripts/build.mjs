// Construit dist/index.js. Les packages @syndic/* exportent leurs sources TypeScript :
// ils sont intégrés au fichier produit, les autres dépendances restent dans node_modules.
import { readFileSync } from 'node:fs';

import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith('@syndic/'));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info',
});
