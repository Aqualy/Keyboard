import { create } from 'zustand'
import type { SwitchId } from '../data/options'
import type { KeyHeat } from '../test/typing'

/** Cinematic is a hands-off loop of camera moves, with every control hidden. */
export type StageMode = 'configure' | 'exploded' | 'test' | 'cinematic'

/** The open folder in the configurator. One part of the keyboard is edited at a time. */
export const SECTIONS = ['layout', 'style', 'switches', 'plate', 'lighting', 'desk'] as const
export type Section = (typeof SECTIONS)[number]

/** One click of the knob changes the volume by this much. */
export const VOLUME_STEP = 0.05

/** The volume after turning the knob some clicks, positive for louder. */
export const stepVolume = (volume: number, clicks: number) =>
  Math.min(1, Math.max(0, Math.round((volume + clicks * VOLUME_STEP) * 20) / 20))

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
  /** The pointer is over the knob, so the wheel turns it instead of zooming. */
  knobHovered: boolean
  /** Volume of the switch sounds, set with the knob. */
  volume: number
  /** Where to show the volume while the knob turns, or null once it settles. */
  volumeLabel: { x: number; y: number } | null
  setKnobHovered: (knobHovered: boolean) => void
  /** Turns the volume by some clicks at a point on the stage. */
  turnVolume: (clicks: number, at: { x: number; y: number }) => void
  hideVolume: () => void
  /** Height of the controls over the bottom of the stage, in px, which the camera frames above. */
  stageInset: number
  /** Width of the controls down the left of the stage, in px, which the camera frames beside. */
  stageInsetLeft: number
  setStageInset: (stageInset: number, stageInsetLeft?: number) => void
  /** A switch held on the left half of the board, to hear against the chosen one on the right. */
  compare: SwitchId | null
  setCompare: (compare: SwitchId | null) => void
  /** A finished typing run, shown on the board as a heatmap. */
  heatmap: Record<string, KeyHeat> | null
  setHeatmap: (heatmap: Record<string, KeyHeat> | null) => void
  setKnobActive: (knobActive: boolean) => void
  setMode: (mode: StageMode) => void
  setSection: (section: Section) => void
  setReady: () => void
  toggleSound: () => void
  markOrbited: () => void
  /** Set by the first key pressed on the board, which retires the typing hint. */
  hasTyped: boolean
  markTyped: () => void
  /** The side panel folded away, leaving the stage to the board. */
  panelFolded: boolean
  togglePanel: () => void
  resetView: () => void
  setHoveredPart: (part: PartHover | null) => void
}

export const useStage = create<StageStore>((set) => ({
  mode: 'configure',
  section: 'style',
  ready: false,
  soundOn: true,
  hasOrbited: false,
  resetRequest: 0,
  hoveredPart: null,
  knobActive: false,
  knobHovered: false,
  volume: 0.8,
  volumeLabel: null,
  setKnobHovered: (knobHovered) => set({ knobHovered }),
  turnVolume: (clicks, at) =>
    set((state) => {
      const volume = stepVolume(state.volume, clicks)
      // Turning the knob up is a clear wish to hear the board, so it also unmutes.
      const soundOn = state.soundOn || (clicks > 0 && volume > 0)
      return { volume, soundOn, volumeLabel: at }
    }),
  hideVolume: () => set({ volumeLabel: null }),
  heatmap: null,
  compare: null,
  stageInset: 0,
  stageInsetLeft: 0,
  setStageInset: (stageInset, stageInsetLeft = 0) => set({ stageInset, stageInsetLeft }),
  setCompare: (compare) => set({ compare }),
  setHeatmap: (heatmap) => set({ heatmap }),
  setKnobActive: (knobActive) => set({ knobActive }),
  setMode: (mode) => set({ mode, hoveredPart: null, heatmap: null }),
  setSection: (section) => set({ section }),
  setReady: () => set({ ready: true }),
  toggleSound: () => set((state) => ({ soundOn: !state.soundOn })),
  markOrbited: () => set({ hasOrbited: true }),
  hasTyped: false,
  markTyped: () => set((state) => (state.hasTyped ? state : { hasTyped: true })),
  panelFolded: false,
  togglePanel: () => set((state) => ({ panelFolded: !state.panelFolded })),
  resetView: () => set((state) => ({ resetRequest: state.resetRequest + 1 })),
  setHoveredPart: (hoveredPart) => set({ hoveredPart }),
}))

/** The room goes dark while lighting is being configured, so the LEDs can be seen. */
export const isDark = (state: Pick<StageStore, 'mode' | 'section'>) =>
  (state.mode === 'configure' && state.section === 'lighting') || state.mode === 'cinematic'

/** Keys left of the board's centre play the compared switch, the rest play the chosen one. */
export const switchForKey = (x: number, chosen: SwitchId, compare: SwitchId | null) =>
  compare && x < 0 ? compare : chosen
