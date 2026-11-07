import { useId, type ReactNode } from 'react'
import type { SpecRow, Swatch } from '../data/options'

interface Option {
  id: string
  name: string
}

interface ChoiceProps<T extends Option> {
  label: string
  options: readonly T[]
  value: string | undefined
  onChange: (id: T['id']) => void
}

/** Native radios underneath, for keyboard and screen reader support. */
export function Pills<T extends Option>({ label, options, value, onChange }: ChoiceProps<T>) {
  const name = useId()
  return (
    <fieldset className="choice">
      <legend className="label">{label}</legend>
      <div className="pills">
        {options.map((option) => (
          <label key={option.id} className="pill">
            <input
              type="radio"
              name={name}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
            />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Swatches<T extends Swatch>({ label, options, value, onChange }: ChoiceProps<T>) {
  const name = useId()
  return (
    <fieldset className="choice">
      <legend className="label">{label}</legend>
      <div className="swatches">
        {options.map((option) => (
          <label key={option.id} className="swatch" title={option.name}>
            <input
              type="radio"
              name={name}
              aria-label={option.name}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
            />
            <span style={{ background: option.hex }} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Specs({ rows }: { rows: readonly SpecRow[] }) {
  return (
    <dl className="specs">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      {children}
    </section>
  )
}
