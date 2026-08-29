import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['speed-insights.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'dist/speed-insights.bundle.js',
  platform: 'browser',
});

console.log('✅ Speed Insights bundled successfully');
