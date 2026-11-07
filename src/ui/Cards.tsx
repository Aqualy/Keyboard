import { useState } from 'react'
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
import { Card, Pills, Specs, Swatches } from './controls'

const ZONES = [
  { id: 'alpha', name: 'Alphas' },
  { id: 'mod', name: 'Mods' },
  { id: 'accent', name: 'Accents' },
  { id: 'legend', name: 'Legends' },
] as const

type Zone = (typeof ZONES)[number]['id']

function ColourwayCard() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const applyColourway = useConfig((state) => state.applyColourway)
  return (
    <Card title="Colourway">
      <Pills
        label="Colourway"
        options={COLOURWAYS}
        value={matchColourway(config)}
        onChange={applyColourway}
      />
      <Swatches
        label="Case"
        options={CASE_COLOURS}
        value={config.case}
        onChange={(id) => update({ case: id })}
      />
    </Card>
  )
}

function KeycapsCard() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  const [zone, setZone] = useState<Zone>('alpha')
  return (
    <Card title="Keycaps">
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
    </Card>
  )
}

function SwitchCard() {
  const selected = useConfig((state) => byId(SWITCHES, state.config.switch))
  const update = useConfig((state) => state.update)
  return (
    <Card title="Switch">
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
    </Card>
  )
}

function PlateKnobCard() {
  const config = useConfig((state) => state.config)
  const update = useConfig((state) => state.update)
  return (
    <Card title="Plate and knob">
      <Pills
        label="Plate"
        options={PLATES}
        value={config.plate}
        onChange={(id) => update({ plate: id })}
      />
      <Specs rows={byId(PLATES, config.plate).specs} />
      <Pills
        label="Knob"
        options={KNOBS}
        value={config.knob}
        onChange={(id) => update({ knob: id })}
      />
    </Card>
  )
}

export function Cards() {
  return (
    <div className="cards">
      <ColourwayCard />
      <KeycapsCard />
      <SwitchCard />
      <PlateKnobCard />
    </div>
  )
}
