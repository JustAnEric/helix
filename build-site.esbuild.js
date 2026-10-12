import * as esb from "esbuild";

await esbuild.build({
    entryPoints: ['website/src/index.ts'],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    platform: 'browser',
    target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
    outfile: 'website/static/app.js',
}).catch(() => process.exit(1));