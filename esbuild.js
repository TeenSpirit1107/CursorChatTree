const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
});

if (watch) {
  ctx.then((c) => c.watch()).then(() => {
    console.log('Watching...');
  });
} else {
  ctx
    .then((c) => c.rebuild().then(() => c))
    .then((c) => {
      c.dispose();
      console.log('Build complete.');
    });
}
