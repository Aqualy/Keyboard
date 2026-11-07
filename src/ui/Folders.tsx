import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BRIGHTNESS,
  CABLES,
  CASE_COLOURS,
  DESK_MATS,
  COLOURWAYS,
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
import { matchColourway, useConfig } from '../state/config'
import { SECTIONS, useStage, type Section } from '../state/stage'
import { Pills, Specs, Swatches } from './controls'
import { SwitchCutaway } from './SwitchCutaway'

const ZONES = [
  { id: 'alpha', name: 'Alphas' },
  { id: 'mod', name: 'Mods' },
  { id: 'accent', name: 'Accents' },
  { id: 'legend', name: 'Legends' },
] as const

type Zone = (typeof ZONES)[number]['id']

const TITLES: Record<Section, string> = {
  layout: 'Layout',
  case: 'Case',
  keycaps: 'Keycaps',
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

function CaseFolder() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const applyColourway = useConfig((state) => state.applyColourway)
  return (
    <Folder id="case" value={byId(CASE_COLOURS, config.case).name}>
      <Pills
        label="Colourway"
        options={COLOURWAYS}
        value={matchColourway(config)}
        onChange={applyColourway}
      />
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
    </Folder>
  )
}

function KeycapsFolder() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const [zone, setZone] = useState<Zone>('alpha')
  return (
    <Folder
      id="keycaps"
      value={`${byId(PROFILES, config.profile).name} ${byId(FINISHES, config.finish).name}`}
    >
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
      <Pills label="Colour" options={ZONES} value={zone} onChange={setZone} />
      {zone === 'legend' ? (
        <Swatches
          label="Legend colour"
          options={LEGEND_COLOURS}
          value={config.legend}
          onChange={(id) => update({ legend: id })}
        />
      ) : (
        <Swatches
          label={`${ZONES.find((item) => item.id === zone)?.name} colour`}
          options={KEYCAP_COLOURS}
          value={config[zone]}
          onChange={(id) => update({ [zone]: id })}
        />
      )}
    </Folder>
  )
}

function SwitchesFolder() {
  const selected = useConfig((state) => byId(SWITCHES, state.config.switch))
  const update = useConfig((state) => state.update)
  return (
    <Folder id="switches" value={selected.name}>
      <Pills
        label="Type"
        options={SWITCH_TYPES}
        value={selected.type}
        onChange={(type) => {
          const first = SWITCHES.find((option) => option.type === type)
          if (first) update({ switch: first.id })
        }}
      />
      <Pills
        label="Switch"
        options={SWITCHES.filter((option) => option.type === selected.type)}
        value={selected.id}
        onChange={(id) => update({ switch: id })}
      />
      <Specs rows={selected.specs} />
      <SwitchCutaway className="cutaway-folder" />
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
  case: CaseFolder,
  keycaps: KeycapsFolder,
  switches: SwitchesFolder,
  plate: PlateFolder,
  lighting: LightingFolder,
  desk: DeskFolder,
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
