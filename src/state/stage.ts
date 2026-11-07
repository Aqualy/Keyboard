import { create } from 'zustand'

export type StageMode = 'configure' | 'exploded' | 'test'

/** The open folder in the configurator. One part of the keyboard is edited at a time. */
export const SECTIONS = ['case', 'keycaps', 'switches', 'plate', 'lighting'] as const
export type Section = (typeof SECTIONS)[number]

export interface PartHover {
  label: string
  x: number
  y: number
}

interface StageStore {
  mode: StageMode
  section: Section
  ready: boolean
  soundOn: boolean
  /** Set after the first orbit, which retires the 360° hint. */
  hasOrbited: boolean
  /** Bumped to send the camera home. */
  resetRequest: number
  hoveredPart: PartHover | null
  /** The camera stands down while the knob is being turned. */
  knobActive: boolean
  setKnobActive: (knobActive: boolean) => void
  setMode: (mode: StageMode) => void
  setSection: (section: Section) => void
  setReady: () => void
  toggleSound: () => void
  markOrbited: () => void
  resetView: () => void
  setHoveredPart: (part: PartHover | null) => void
}

export const useStage = create<StageStore>((set) => ({
  mode: 'configure',
  section: 'case',
  ready: false,
  soundOn: true,
  hasOrbited: false,
  resetRequest: 0,
  hoveredPart: null,
  knobActive: false,
  setKnobActive: (knobActive) => set({ knobActive }),
  setMode: (mode) => set({ mode, hoveredPart: null }),
  setSection: (section) => set({ section }),
  setReady: () => set({ ready: true }),
  toggleSound: () => set((state) => ({ soundOn: !state.soundOn })),
  markOrbited: () => set({ hasOrbited: true }),
  resetView: () => set((state) => ({ resetRequest: state.resetRequest + 1 })),
  setHoveredPart: (hoveredPart) => set({ hoveredPart }),
}))

/** The room goes dark while lighting is being configured, so the LEDs can be seen. */
export const isDark = (state: Pick<StageStore, 'mode' | 'section'>) =>
  state.mode === 'configure' && state.section === 'lighting'
