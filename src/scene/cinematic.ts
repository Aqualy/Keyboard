import type { Layout } from '../data/layout'

type Vec3 = [number, number, number]

export interface CinematicShot {
  /** Camera and target at the start of the shot, then at its end. */
  from: { position: Vec3; target: Vec3 }
  to: { position: Vec3; target: Vec3 }
}

/** Seconds per shot, including the dip to black at each end. */
export const SHOT_SECONDS = 7
/** Seconds of the fade out of and back into each shot. */
export const FADE_SECONDS = 0.7

const scaleBy = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1], v[2] * s]

/**
 * The loop of slow camera moves, framed for the 65% board and stretched for wider ones. Units
 * are cm, with the board's centre at the origin and its back toward -z.
 */
export function cinematicShots(layout: Layout): CinematicShot[] {
  const s = Math.max(1, layout.case.width / 32.5)
  const knob: Vec3 = [layout.knob.x, 2.2, -layout.knob.y]
  const port: Vec3 = [-layout.case.width / 2 + 2.55, 1, -layout.case.depth / 2]
  const shot = (from: [Vec3, Vec3], to: [Vec3, Vec3]): CinematicShot => ({
    from: { position: scaleBy(from[0], s), target: scaleBy(from[1], s) },
    to: { position: scaleBy(to[0], s), target: scaleBy(to[1], s) },
  })
  const around = (centre: Vec3, offset: Vec3): Vec3 => [
    centre[0] + offset[0],
    centre[1] + offset[1],
    centre[2] + offset[2],
  ]
  return [
    // A low glide across the front, level with the keycaps.
    shot(
      [
        [-20, 6, 58],
        [-8, 1.2, 0],
      ],
      [
        [20, 8, 58],
        [8, 1.2, 0],
      ],
    ),
    // Close in on the knob, turning around it.
    {
      from: { position: around(knob, [24, 14, 20]), target: knob },
      to: { position: around(knob, [-6, 17, 27]), target: knob },
    },
    // Straight down, drifting along the rows.
    shot(
      [
        [-10, 130, 6],
        [-10, 0, 0],
      ],
      [
        [10, 130, 6],
        [10, 0, 0],
      ],
    ),
    // A macro pass along the rows, from low at the side.
    shot(
      [
        [-34, 9, 30],
        [-6, 1.5, -1],
      ],
      [
        [-18, 11, 36],
        [10, 1.5, -1],
      ],
    ),
    // A high orbit over the whole board.
    shot(
      [
        [85, 70, 85],
        [0, 1, 0],
      ],
      [
        [-85, 70, 85],
        [0, 1, 0],
      ],
    ),
    // Low along the back, past the port and its cable.
    {
      from: { position: around(port, [-30, 10, -46]), target: around(port, [6, 0, 0]) },
      to: { position: around(port, [12, 14, -52]), target: around(port, [8, 0, 0]) },
    },
  ]
}

const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

/**
 * Where the camera is `seconds` into the loop, and how dark the fade to black is. With
 * `still`, each shot holds its midpoint, for visitors who ask for less motion.
 */
export function cinematicFrame(shots: CinematicShot[], seconds: number, still = false) {
  const index = Math.floor(seconds / SHOT_SECONDS) % shots.length
  const local = seconds % SHOT_SECONDS
  const t = still ? 0.5 : ease(local / SHOT_SECONDS)
  const { from, to } = shots[index]
  const mix = (a: Vec3, b: Vec3): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
  const edge = Math.min(local, SHOT_SECONDS - local)
  const fade = 1 - Math.min(1, edge / FADE_SECONDS)
  return {
    index,
    position: mix(from.position, to.position),
    target: mix(from.target, to.target),
    fade,
  }
}
