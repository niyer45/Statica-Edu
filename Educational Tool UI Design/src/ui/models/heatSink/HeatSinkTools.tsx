import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { heatSinkPermissibleRange } from '../../../geometry/heatSink/edit'
import { formatMm, mmToM, mToMm, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import { FIN_PARAM_LABELS, formatCelsius, formatLength, useHeatSinkStore } from './shared'

// Heat sink design tools (task 48.3; HSK-03, HSK-04, HSK-14, MODE-04, MODE-07). An integer fin
// count field with remove/add stepper buttons, then numeric thickness and height fields with
// sliders on the model's step grid, using the template `design-panel` classes. Text is parsed
// on blur or Enter and dispatched as a strict edit, the stepper dispatches strict ±1 edits and
// sliders dispatch clamp edits (snapped to the grid by the model). The reducer's verdict returns
// through `draftErrors`; a rejection keeps the draft and shows an inline error announced once.
// Fixed values stay read-only in a collapsed disclosure.

type Param = 'finCount' | 'finThicknessM' | 'finHeightM'
const LENGTH_PARAMS = ['finThicknessM', 'finHeightM'] as const

export default function HeatSinkTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useHeatSinkStore()
  const draft = state.draft
  const [texts, setTexts] = useState<Partial<Record<Param, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<Param, string>>>({})
  const [synced, setSynced] = useState(state.draft)
  if (synced !== state.draft) {
    setSynced(state.draft)
    setTexts({})
    setErrors({})
  }
  const pending = useRef<Param | null>(null)
  useEffect(() => {
    const param = pending.current
    if (param === null) return
    pending.current = null
    if (state.draftErrors.length === 0) return
    const e = state.draftErrors.find((x) => x.param === param) ?? state.draftErrors[0]!
    const message = `${FIN_PARAM_LABELS[param]}: ${e.message}`
    setErrors((prev) => ({ ...prev, [param]: message }))
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  /** Strict edit; the model validates integrality, range, step and the geometric gap. */
  const strict = (param: Param, value: number) => {
    pending.current = param
    dispatch({ type: 'edit', edit: { type: 'setParam', param, value, mode: 'strict' } })
  }
  const commit = (param: Param) => {
    const text = texts[param]
    if (text === undefined) return
    // parseMmInput is the shared plain-decimal parser; a count is parsed the same way and the
    // model rejects a non-integer count with its own typed error.
    const parsed = parseMmInput(text)
    if (parsed === null) {
      const message = `${FIN_PARAM_LABELS[param]}: ${param === 'finCount' ? 'enter a whole number of fins.' : 'enter a number in millimetres.'}`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce(message)
      return
    }
    strict(param, param === 'finCount' ? parsed : mmToM(parsed))
  }
  const keys = (param: Param) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(param)
    if (e.key === 'Escape') {
      setTexts((prev) => ({ ...prev, [param]: undefined }))
      setErrors((prev) => ({ ...prev, [param]: undefined }))
    }
  }
  const field = (param: Param, shown: string, unit: string) => {
    const id = `fins-${param}`
    const error = errors[param]
    return {
      id,
      error,
      input: (
        <div className="number-field">
          <input
            id={id}
            inputMode={param === 'finCount' ? 'numeric' : 'decimal'}
            value={texts[param] ?? shown}
            aria-invalid={error !== undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setTexts((prev) => ({ ...prev, [param]: e.target.value }))}
            onBlur={() => commit(param)}
            onKeyDown={keys(param)}
          />
          <span>{unit}</span>
        </div>
      ),
    }
  }
  const errorText = (id: string, error: string | undefined) =>
    error && (
      <p id={`${id}-error`} className="field-error">
        {error}
      </p>
    )

  const count = field('finCount', String(draft.finCount), 'fins')
  return (
    <div className="heat-sink-tools">
      <div className="section-heading">
        FIN ARRAY <span>01</span>
      </div>
      <p className="tool-copy">Straight fins across the base, evenly spaced.</p>
      <div className="dimension-field">
        <label htmlFor={count.id}>{FIN_PARAM_LABELS.finCount}</label>
        {count.input}
        <div className="fin-stepper">
          <button type="button" onClick={() => strict('finCount', draft.finCount - 1)}>
            Remove a fin
          </button>
          <button type="button" onClick={() => strict('finCount', draft.finCount + 1)}>
            Add a fin
          </button>
        </div>
        {errorText(count.id, count.error)}
      </div>
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {LENGTH_PARAMS.map((param) => {
        const range = heatSinkPermissibleRange(draft, param, ch.designLimits, ch.base.widthM)!
        const f = field(param, formatMm(draft[param], 1), 'mm')
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={f.id}>{FIN_PARAM_LABELS[param]}</label>
            {f.input}
            <input
              type="range"
              aria-label={`${FIN_PARAM_LABELS[param]} slider`}
              min={mToMm(range.min)}
              max={mToMm(range.max)}
              step={mToMm(ch.designLimits[param].stepM)}
              value={mToMm(draft[param])}
              onChange={(e) => dispatch({ type: 'edit', edit: { type: 'setParam', param, value: mmToM(Number(e.target.value)), mode: 'clamp' } })}
            />
            {errorText(f.id, f.error)}
          </div>
        )
      })}
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Base</dt>
          <dd>
            {formatMm(ch.base.widthM, 0)} × {formatMm(ch.base.depthM, 0)} mm footprint, {formatLength(ch.base.thicknessM)} thick
          </dd>
          <dt>Material</dt>
          <dd>
            {ch.material.name}, conductivity {ch.material.thermalConductivityWPerMK} W/m·K
          </dd>
          <dt>Heat load</dt>
          <dd>{ch.heatLoadW} W spread over the base mounting face</dd>
          <dt>Air temperature</dt>
          <dd>{formatCelsius(ch.ambientTemperatureK)}</dd>
          <dt>Convection</dt>
          <dd>
            Given coefficient {ch.convection.coefficientWPerM2K} W/m²·K ({ch.convection.description}); not computed by the model
          </dd>
          <dt>Fin layout</dt>
          <dd>Fins span the full base depth along the airflow, outer fins flush with the base edges</dd>
        </dl>
      </details>
    </div>
  )
}
