import { useId, useState, type ReactNode } from 'react'
import {
  CASE_COLOURS,
  COLOURWAYS,
  KEYCAP_COLOURS,
  KNOBS,
  LEGEND_COLOURS,
  PLATES,
  PROFILES,
  SWITCHES,
  SWITCH_TYPES,
  byId,
} from '../data/options'
import { matchColourway, useConfig } from '../state/config'
import { SECTIONS, useStage, type Section } from '../state/stage'
import { Pills, Specs, Swatches } from './controls'

const ZONES = [
  { id: 'alpha', name: 'Alphas' },
  { id: 'mod', name: 'Mods' },
  { id: 'accent', name: 'Accents' },
  { id: 'legend', name: 'Legends' },
] as const

type Zone = (typeof ZONES)[number]['id']

const TITLES: Record<Section, string> = {
  case: 'Case',
  keycaps: 'Keycaps',
  switches: 'Switches',
  plate: 'Plate',
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
    <Folder id="keycaps" value={byId(PROFILES, config.profile).name}>
      <Pills
        label="Profile"
        options={PROFILES}
        value={config.profile}
        onChange={(id) => update({ profile: id })}
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

const FOLDERS: Record<Section, () => ReactNode> = {
  case: CaseFolder,
  keycaps: KeycapsFolder,
  switches: SwitchesFolder,
  plate: PlateFolder,
}

export function Folders() {
  return (
    <div className="folders">
      {SECTIONS.map((id) => {
        const Content = FOLDERS[id]
        return <Content key={id} />
      })}
    </div>
  )
}
