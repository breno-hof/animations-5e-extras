// Builds the installable module into dist/, laid out exactly as Foundry expects:
//   dist/module.json, scripts/, styles/, lang/, LICENSE, README.md
// The preset data (data/*.json) is bundled into the script.
// `--dev` adds source maps. Symlink dist/ to <Foundry data>/modules/more-dnd5e-animations to test.
//
// The script and stylesheet carry the version in their file name, so browsers
// and proxies never pair a cached old script with a new module.json.
import { cp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const dev = process.argv.includes('--dev');
const STATIC = ['styles', 'lang', 'LICENSE', 'README.md'];

const manifest = JSON.parse(await readFile('module.json', 'utf8'));
const script = `scripts/module-${manifest.version}.js`;
const style = `styles/more-dnd5e-animations-${manifest.version}.css`;

await rm('dist', { recursive: true, force: true });
await build({
  entryPoints: ['src/module.ts'],
  outfile: `dist/${script}`,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: !dev,
  sourcemap: dev,
  logLevel: 'info',
});
await Promise.all(STATIC.map((path) => cp(path, `dist/${path}`, { recursive: true })));
await rename('dist/styles/more-dnd5e-animations.css', `dist/${style}`);
await writeFile(
  'dist/module.json',
  `${JSON.stringify({ ...manifest, esmodules: [script], styles: [style] }, null, 2)}\n`,
);
