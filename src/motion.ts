export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Scales an animation's duration to nothing for visitors who ask for less motion. */
export const motion = (seconds: number) => (prefersReducedMotion() ? 0 : seconds)
