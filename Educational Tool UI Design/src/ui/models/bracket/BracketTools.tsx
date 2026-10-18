import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BRACKET_PARAMS, type BracketParam } from '../../../geometry/bracket/design'
import { bracketPermissibleRange } from '../../../geometry/bracket/edit'
import { BRACKET_PARAM_LABELS } from '../../../geometry/bracket/validate'
import { formatMm, mmToM, mToMm, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import { useBracketStore } from './shared'

// Bracket design tools (task 55 L-bracket; MODE-04, MODE-07, MM-22). One numeric field plus
// slider per adjustable dimension (thickness, width, flange height, inner bend radius), using the
// template `design-panel` classes. Text is parsed on blur or Enter and dispatched as a strict
// edit; sliders dispatch clamp edits on the configured grid. The reducer's verdict returns through
// `draftErrors`; a rejection keeps the draft and shows an inline error announced once. Fixed
// values stay read-only in a collapsed disclosure.

export default function BracketTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useBracketStore()
  const draft = state.draft
  const [texts, setTexts] = useState<Partial<Record<BracketParam, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<BracketParam, string>>>({})
  const [synced, setSynced] = useState(draft)
  if (synced !== draft) {
    setSynced(draft)
    setTexts({})
    setErrors({})
  }
  const pending = useRef<BracketParam | null>(null)
  useEffect(() => {
    const param = pending.current
    if (param === null) return
    pending.current = null
    if (state.draftErrors.length === 0) return
    const e = state.draftErrors.find((x) => x.param === param) ?? state.draftErrors[0]!
    const message = `${BRACKET_PARAM_LABELS[param]}: ${e.message}`
    setErrors((prev) => ({ ...prev, [param]: message }))
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = (param: BracketParam) => {
    const text = texts[param]
    if (text === undefined) return
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = `${BRACKET_PARAM_LABELS[param]}: enter a number in millimetres.`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce(message)
      return
    }
    pending.current = param
    dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(mm), mode: 'strict' } })
  }
  const keys = (param: BracketParam) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(param)
    if (e.key === 'Escape') {
      setTexts((prev) => ({ ...prev, [param]: undefined }))
      setErrors((prev) => ({ ...prev, [param]: undefined }))
    }
  }

  return (
    <>
      <div className="section-heading">
        L-BRACKET <span>01</span>
      </div>
      <p className="bracket-step-note">
        A vertical flange bolted flat to the wall, a bend with an inner radius, and a horizontal arm that carries the hanging load.
      </p>
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {BRACKET_PARAMS.map((param) => {
        const range = bracketPermissibleRange(param, ch.designLimits)!
        const id = `bracket-${param}`
        const error = errors[param]
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={id}>{BRACKET_PARAM_LABELS[param]}</label>
            <div className="number-field">
              <input
                id={id}
                inputMode="decimal"
                value={texts[param] ?? formatMm(draft[param], 1)}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => setTexts((prev) => ({ ...prev, [param]: e.target.value }))}
                onBlur={() => commit(param)}
                onKeyDown={keys(param)}
              />
              <span>mm</span>
            </div>
            <input
              type="range"
              aria-label={`${BRACKET_PARAM_LABELS[param]} slider`}
              min={mToMm(range.minM)}
              max={mToMm(range.maxM)}
              step={mToMm(ch.designLimits[param].stepM)}
              value={mToMm(draft[param])}
              onChange={(e) => dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(Number(e.target.value)), mode: 'clamp' } })}
            />
            {error && (
              <p id={`${id}-error`} className="field-error">
                {error}
              </p>
            )}
          </div>
        )
      })}
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Load</dt>
          <dd>{ch.load.forceN} N hanging from the arm</dd>
          <dt>Load offset</dt>
          <dd>{formatMm(ch.loadOffsetM, 0)} mm from the wall face</dd>
          <dt>Arm beyond the load</dt>
          <dd>{formatMm(ch.tipOverhangM, 0)} mm</dd>
          <dt>Bolts</dt>
          <dd>
            {ch.bolts.count} in one row, {formatMm(ch.bolts.edgeDistanceM, 0)} mm below the top of the flange
          </dd>
          <dt>Material</dt>
          <dd>{ch.material.name}</dd>
          <dt>Support</dt>
          <dd>Flange bolted flat to a rigid wall</dd>
        </dl>
      </details>
    </>
  )
}
