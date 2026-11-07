// Finds Blender and runs the model script. Usage: npm run model [-- keyboard,preview]
// Set BLENDER to the executable to override discovery.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'build_gmk67.py')

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER
  if (process.platform === 'win32') {
    const root = 'C:/Program Files/Blender Foundation'
    if (existsSync(root)) {
      const newest = readdirSync(root)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .at(-1)
      if (newest) return join(root, newest, 'blender.exe')
    }
  }
  return 'blender'
}

const result = spawnSync(
  findBlender(),
  ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script],
  {
    stdio: 'inherit',
    env: { ...process.env, GMK_ONLY: process.argv[2] ?? '' },
  },
)

if (result.error) {
  console.error(`Could not start Blender: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
