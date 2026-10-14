import * as esb from "esbuild";

await esb.build({
    entryPoints: ['website/src/index.ts'],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    platform: 'browser',
    target: ['chrome58'],
    outfile: 'website/static/js/app.js',
}).catch(() => process.exit(1));