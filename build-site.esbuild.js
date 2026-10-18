import * as esb from "esbuild";

await esb.build({
    entryPoints: ['website/src/index.ts'],
    bundle: true,
    minify: true,
    sourcemap: false,
    platform: 'browser',
    target: ['chrome58'],
    outfile: undefined,
    outdir: 'website/static/js'
}).catch(() => process.exit(1));