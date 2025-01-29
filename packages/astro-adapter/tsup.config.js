import { defineConfig } from 'tsup';


export default defineConfig({
    dts: true,
    outDir: 'dist',
    format: ['esm', 'cjs'],
    entry: ['src/index.ts'],
});
