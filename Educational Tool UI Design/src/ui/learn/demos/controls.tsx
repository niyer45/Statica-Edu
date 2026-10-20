import { useId } from 'react'

// Shared controls for the Learn demonstrations (task 67 onward): a text readout of every value a
// drawing shows (LRN-09), a labelled slider, a radio choice and the one-line model note.

export function Readout({ rows }: { rows: readonly [string, string][] }) {
  return (
    <dl className="learn-readout">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="learn-slider">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value} ${unit}`} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>
        {value} {unit}
      </output>
    </div>
  )
}

export function Choice<T extends string | number>({ legend, options, value, onChange }: { legend: string; options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const name = useId()
  return (
    <fieldset className="learn-choice">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={String(o.id)}>
          <input type="radio" name={name} value={String(o.id)} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

export function DemoNote({ text }: { text: string }) {
  return <p className="learn-demo-note">{text}</p>
}
