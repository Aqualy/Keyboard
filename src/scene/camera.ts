export const STAGE_CAMERA = { fov: 15, near: 1, far: 900, position: [0, 62, 95] } as const

const HALF_TAN = Math.tan(((STAGE_CAMERA.fov / 2) * Math.PI) / 180)

/** Distance at which a box of the given size fits a viewport of this aspect ratio. */
export const fitDistance = (width: number, height: number, aspect: number) =>
  Math.max(width / (2 * HALF_TAN * aspect), height / (2 * HALF_TAN))
