// Finds Blender and runs the model script. Usage: npm run model [-- keyboard,preview]
// Board tasks (keyboard, shadow, preview) run once per layout in src/data/layouts. Set
// GMK_LAYOUT=65-iso to build one layout. Set BLENDER to the executable to override discovery.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compressModel } from '../compress-models.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'build_gmk67.py')
const layoutsDir = join(here, '../../src/data/layouts')
const modelsDir = join(here, '../../public/models')

const BOARD_TASKS = new Set(['keyboard', 'shadow', 'preview'])
const DEFAULT_TASKS = ['keyboard', 'switch', 'keycaps', 'environment', 'shadow']

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

function run(tasks, layout) {
  const result = spawnSync(
    findBlender(),
    ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script],
    {
      stdio: 'inherit',
      env: { ...process.env, GMK_ONLY: tasks.join(','), GMK_LAYOUT: layout ?? '' },
    },
  )
  if (result.error) {
    console.error(`Could not start Blender: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const tasks = process.argv[2] ? process.argv[2].split(',') : DEFAULT_TASKS
const shared = tasks.filter((task) => !BOARD_TASKS.has(task))
const board = tasks.filter((task) => BOARD_TASKS.has(task))
const layouts = process.env.GMK_LAYOUT
  ? [process.env.GMK_LAYOUT]
  : readdirSync(layoutsDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''))

if (shared.length) run(shared)
if (board.length) {
  for (const layout of layouts) {
    console.log(`=== ${layout}`)
    run(board, layout)
  }
}

// Blender exports plain glTF; every new model is compressed with meshopt. Compressed ones are skipped.
for (const file of readdirSync(modelsDir).filter((name) => name.endsWith('.glb'))) {
  await compressModel(join(modelsDir, file))
}
