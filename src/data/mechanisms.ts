import { SWITCHES, byId, type SwitchId } from './options'

export type Mechanism = 'linear' | 'tactile' | 'clicky' | 'dome' | 'buckling'

/** How a switch works inside. Most share the MX design; two are built differently. */
export function mechanismOf(id: SwitchId): Mechanism {
  if (id === 'topre') return 'dome'
  if (id === 'buckling') return 'buckling'
  return byId(SWITCHES, id).type
}

export const MECHANISM_TEXT: Record<Mechanism, string> = {
  linear: 'The stem slides straight down against the spring. No bump, no click.',
  tactile: 'A bump on the stem pushes the contact leaf aside, felt just before the key registers.',
  clicky: 'A click part snaps down past the contact, giving a bump and a sharp click.',
  dome: 'A rubber dome under the slider collapses, giving a soft, rounded bump.',
  buckling: 'The tall spring bends until it buckles and swings a hammer onto the contact.',
}
