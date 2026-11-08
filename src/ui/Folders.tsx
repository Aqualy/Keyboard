import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BRIGHTNESS,
  CABLES,
  CASE_COLOURS,
  DESK_MATS,
  PRESETS,
  FINISHES,
  KEYCAP_COLOURS,
  KNOBS,
  LEGEND_COLOURS,
  PLATES,
  PROFILES,
  RGB_COLOURS,
  RGB_EFFECTS,
  SWITCHES,
  SWITCH_TYPES,
  byId,
  hasLightColour,
} from '../data/options'
import { SIZES, STANDARDS } from '../data/layout'
import { REGIONS } from '../data/regions'
import { KEYSETS } from '../data/keysets'
import { matchPreset, useConfig } from '../state/config'
import { SECTIONS, useStage, type Section } from '../state/stage'
import { Pills, Specs, Swatches } from './controls'
import { ArrowIcon } from './icons'

const ZONES = [
  { id: 'alpha', name: 'Alphas' },
  { id: 'mod', name: 'Mods' },
  { id: 'accent', name: 'Accents' },
  { id: 'legend', name: 'Legends' },
] as const

type Zone = (typeof ZONES)[number]['id']

const TITLES: Record<Section, string> = {
  layout: 'Layout',
  style: 'Style',
  switches: 'Switches',
  plate: 'Plate',
  lighting: 'Lighting',
  desk: 'Desk',
}

interface FolderProps {
  id: Section
  /** The current choice, shown on the tab so the whole build reads without opening folders. */
  value: string
  children: ReactNode
}

/** A tab along the bottom edge. Only one folder is open, and its part stays solid on the board. */
function Folder({ id, value, children }: FolderProps) {
  const open = useStage((state) => state.section === id)
  const setSection = useStage((state) => state.setSection)
  const bodyId = useId()
  return (
    <div className="folder" data-open={open}>
      <button
        type="button"
        className="folder-tab"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setSection(id)}
      >
        <span className="folder-title">{TITLES[id]}</span>{' '}
        <span className="folder-value">{value}</span>
      </button>
      <div id={bodyId} className="folder-body" role="region" aria-label={TITLES[id]} hidden={!open}>
        {children}
      </div>
    </div>
  )
}

function LayoutFolder() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const size = byId(SIZES, config.size).name
  const region = byId(REGIONS, config.region).name
  return (
    <Folder id="layout" value={`${size} ${region}`}>
      <Pills
        label="Size"
        options={SIZES}
        value={config.size}
        onChange={(id) => update({ size: id })}
      />
      <Pills
        label="Standard"
        options={STANDARDS}
        value={config.standard}
        onChange={(id) => update({ standard: id })}
      />
      <Pills
        label="Legends"
        wide
        options={REGIONS.filter((option) => option.standard === config.standard)}
        value={config.region}
        onChange={(id) => update({ region: id })}
      />
    </Folder>
  )
}

/** The case and the keycaps together, since presets set both at once. */
function StyleFolder() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const applyPreset = useConfig((state) => state.applyPreset)
  const [zone, setZone] = useState<Zone>('alpha')
  const preset = matchPreset(config)
  const inSet = config.keyset !== 'none'
  return (
    <Folder id="style" value={PRESETS.find((option) => option.id === preset)?.name ?? 'Custom'}>
      <Pills label="Preset" options={PRESETS} value={preset} onChange={applyPreset} />
      <Swatches
        label="Case colour"
        options={CASE_COLOURS}
        value={config.case}
        onChange={(id) => update({ case: id })}
      />
      <Pills
        label="Knob"
        options={KNOBS}
        value={config.knob}
        onChange={(id) => update({ knob: id })}
      />
      <Pills
        label="Profile"
        options={PROFILES}
        value={config.profile}
        onChange={(id) => update({ profile: id })}
      />
      <Pills
        label="Material"
        options={FINISHES}
        value={config.finish}
        onChange={(id) => update({ finish: id })}
      />
      <Pills
        label="Keycap set"
        options={KEYSETS}
        value={config.keyset}
        onChange={(id) => update({ keyset: id })}
      />
      <Pills label="Colour" options={ZONES} value={zone} onChange={setZone} />
      {/* While a set is on, no single colour is chosen; picking one starts a mix of one's own. */}
      {zone === 'legend' ? (
        <Swatches
          label="Legend colour"
          options={LEGEND_COLOURS}
          value={inSet ? '' : config.legend}
          onChange={(id) => update({ legend: id })}
        />
      ) : (
        <Swatches
          label={`${ZONES.find((item) => item.id === zone)?.name} colour`}
          options={KEYCAP_COLOURS}
          value={inSet ? '' : config[zone]}
          onChange={(id) => update({ [zone]: id })}
        />
      )}
    </Folder>
  )
}

/** Holds the current switch on the left half, so the next pick can be heard against it. */
function CompareButton() {
  const chosen = useConfig((state) => state.config.switch)
  const compare = useStage((state) => state.compare)
  const setCompare = useStage((state) => state.setCompare)
  return (
    <button
      type="button"
      className="label-action"
      aria-label={compare ? 'Stop comparing' : 'Compare switches'}
      title={compare ? undefined : 'Keep this switch on the left half and pick another'}
      onClick={() => setCompare(compare ? null : chosen)}
    >
      {compare ? 'Stop' : 'Compare'}
    </button>
  )
}

function SwitchesFolder() {
  const selected = useConfig((state) => byId(SWITCHES, state.config.switch))
  const update = useConfig((state) => state.update)
  const compare = useStage((state) => state.compare)
  const value = compare ? `${byId(SWITCHES, compare).name} vs ${selected.name}` : selected.name
  return (
    <Folder id="switches" value={value}>
      <Pills
        label="Type"
        options={SWITCH_TYPES}
        value={selected.type}
        onChange={(type) => {
          const first = SWITCHES.find((option) => option.type === type)
          if (first) update({ switch: first.id })
        }}
      />
      <div className="with-action">
        <Pills
          label={compare ? `Right half · left is ${byId(SWITCHES, compare).name}` : 'Switch'}
          options={SWITCHES.filter((option) => option.type === selected.type)}
          value={selected.id}
          onChange={(id) => update({ switch: id })}
        />
        <CompareButton />
      </div>
      <Specs rows={selected.specs} />
    </Folder>
  )
}

function PlateFolder() {
  const plate = useConfig((state) => byId(PLATES, state.config.plate))
  const update = useConfig((state) => state.update)
  return (
    <Folder id="plate" value={plate.name}>
      <Pills
        label="Plate"
        options={PLATES}
        value={plate.id}
        onChange={(id) => update({ plate: id })}
      />
      <Specs rows={plate.specs} />
    </Folder>
  )
}

function LightingFolder() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const on = config.rgb !== 'off'
  return (
    <Folder id="lighting" value={byId(RGB_EFFECTS, config.rgb).name}>
      <Pills
        label="Effect"
        wide
        options={RGB_EFFECTS}
        value={config.rgb}
        onChange={(id) => update({ rgb: id })}
      />
      {hasLightColour(config.rgb) && (
        <Swatches
          label="Light colour"
          options={RGB_COLOURS}
          value={config.rgbColour}
          onChange={(id) => update({ rgbColour: id })}
        />
      )}
      {on && (
        <Pills
          label="Brightness"
          options={BRIGHTNESS}
          value={config.brightness}
          onChange={(id) => update({ brightness: id })}
        />
      )}
    </Folder>
  )
}

function DeskFolder() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const cable = byId(CABLES, config.cable)
  const mat = byId(DESK_MATS, config.mat)
  const parts = [config.cable !== 'none' && 'Cable', config.mat !== 'none' && 'Mat'].filter(Boolean)
  return (
    <Folder id="desk" value={parts.length ? parts.join(' + ') : 'None'}>
      <Pills
        label="Coiled cable"
        options={CABLES}
        value={cable.id}
        onChange={(id) => update({ cable: id })}
      />
      <Pills
        label="Desk mat"
        options={DESK_MATS}
        value={mat.id}
        onChange={(id) => update({ mat: id })}
      />
    </Folder>
  )
}

const FOLDERS: Record<Section, () => ReactNode> = {
  layout: LayoutFolder,
  style: StyleFolder,
  switches: SwitchesFolder,
  plate: PlateFolder,
  lighting: LightingFolder,
  desk: DeskFolder,
}

/**
 * The narrow strip the side menu folds into on wide screens. It names each folder, so it reads as
 * a menu, and keeps Test in reach. Hovering it folds the menu out; a click opens that folder.
 * It repeats controls the menu already has, so it stays out of the tab order and the
 * accessibility tree; keyboard users reach the full menu directly.
 */
export function FolderRail() {
  const section = useStage((state) => state.section)
  const setSection = useStage((state) => state.setSection)
  const setMode = useStage((state) => state.setMode)
  return (
    <nav className="rail" aria-hidden="true">
      {/* First, as Test leads the full menu too. */}
      <button
        type="button"
        tabIndex={-1}
        className="rail-test"
        title="Test"
        onClick={() => setMode('test')}
      >
        <ArrowIcon />
      </button>
      {SECTIONS.map((id) => (
        <button
          key={id}
          type="button"
          tabIndex={-1}
          className="rail-item"
          data-open={id === section}
          onClick={() => setSection(id)}
        >
          {TITLES[id]}
        </button>
      ))}
    </nav>
  )
}

export function Folders() {
  return (
    <div className="folders" style={{ '--folder-count': SECTIONS.length } as CSSProperties}>
      {SECTIONS.map((id) => {
        const Content = FOLDERS[id]
        return <Content key={id} />
      })}
    </div>
  )
}
