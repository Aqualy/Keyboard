// Measures every switch recording set with ffmpeg and writes src/audio/loudness.json.
// Loudness is EBU R128 integrated loudness (LUFS) of the row presses and the release,
// played back to back, which is what typing mostly sounds like. Peak is the highest
// sample of any recording in the set, so the playback gain can be kept from clipping.
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = 'public/sounds'
const round = (value) => Math.round(value * 10) / 10

/** Joins the files into one stream, runs the filter on it, and returns ffmpeg's report. */
function measure(files, filter) {
  const inputs = files.flatMap((file) => ['-i', file])
  const chain = `concat=n=${files.length}:v=0:a=1,${filter}`
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', ...inputs, '-filter_complex', chain, '-f', 'null', '-'],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr ?? result.error}`)
  return result.stderr
}

const loudness = {}
for (const id of readdirSync(root).sort()) {
  const folder = join(root, id)
  if (!statSync(folder).isDirectory()) continue
  const all = ['press', 'release'].flatMap((edge) =>
    readdirSync(join(folder, edge)).map((file) => join(folder, edge, file)),
  )
  const typing = all.filter((file) => file.includes('GENERIC'))

  // Looped, so the set is long enough for the 400 ms measuring blocks.
  const summary = measure(typing, 'aloop=loop=3:size=2e6,ebur128').split('Summary:')[1] ?? ''
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1])
  const peak = Number(/max_volume:\s+(-?[\d.]+) dB/.exec(measure(all, 'volumedetect'))?.[1])
  if (!Number.isFinite(lufs) || !Number.isFinite(peak)) throw new Error(`Could not measure ${id}`)
  loudness[id] = { lufs: round(lufs), peak: round(peak) }
  console.log(`${id.padEnd(11)} ${round(lufs)} LUFS, peak ${round(peak)} dBFS`)
}

writeFileSync('src/audio/loudness.json', `${JSON.stringify(loudness, null, 2)}\n`)
