import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * The host compresses scripts but sends .glb files as they are, so the build gzips them in place
 * (about 60% smaller). `fetchModel` in src/scene/assets.ts recognises the gzip header and unzips them.
 */
function gzipModels(): Plugin {
  let outDir = 'dist'
  return {
    name: 'gzip-models',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const dir = join(outDir, 'models')
      for (const name of readdirSync(dir).filter((file) => file.endsWith('.glb'))) {
        const file = join(dir, name)
        writeFileSync(file, gzipSync(readFileSync(file), { level: 9 }))
      }
    },
  }
}

/**
 * A hash of everything in public/models. Model URLs carry it (`assetUrl` in src/scene/assets.ts), so new
 * code never meets a stale model from the CDN, which keeps files for five minutes after a deploy.
 */
function modelsVersion() {
  const hash = createHash('sha256')
  for (const name of readdirSync('public/models').sort()) {
    hash.update(name).update(readFileSync(join('public/models', name)))
  }
  return hash.digest('hex').slice(0, 10)
}

export default defineConfig({
  define: { __MODELS_VERSION__: JSON.stringify(modelsVersion()) },
  plugins: [react(), gzipModels()],
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    restoreMocks: true,
  },
})
