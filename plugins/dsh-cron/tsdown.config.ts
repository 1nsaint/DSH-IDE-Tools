import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.ts'

export default defineConfig([
  {
    entry: {
      index: 'lib/types/index.js',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    // DIY shared helper lives outside the package; keep the relative import for runtime mount.
    external: [/register-rpc-channel\.js$/],
  },
  clientBundle(),
])
