import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BRACKET_PARAMS, isUniformBar, type BracketParam } from '../../../geometry/bracket/design'
import { bracketPermissibleRange } from '../../../geometry/bracket/edit'
import { BRACKET_PARAM_LABELS } from '../../../geometry/bracket/validate'
import { formatMm, mmToM, mToMm, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { useBracketStore } from './shared'

// Bracket design tools (task 46.3; MBR-04, MBR-05, MBR-12, MODE-04, MODE-07, MM-22). One numeric
// field plus slider per adjustable dimension (root depth, arm depth, step location, fillet
// radius), using the template `design-panel` classes. Text is parsed on blur or Enter and
// dispatched as a strict edit; sliders dispatch clamp edits on the configured grid. The
// reducer's verdict returns through `draftErrors`; a rejection keeps the draft and shows an
// inline error announced once. With equal depths the bar has no step: the step location and
// fillet radius stay editable (K-5) and a note says they have no effect. Fixed values stay
// read-only in a collapsed disclosure.
// Task 58: in Guided, controls the current step does not unlock are read-only or disabled
// with a visible reason; Parametric leaves every control editable.

export default function BracketTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useBracketStore()
  const draft = state.draft
  const guided = useGuided()
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
    if (text === undefined || guided.locked(param)) return
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
  const uniform = isUniformBar(draft)

  return (
    <>
      <div className="section-heading">
        STEPPED BAR <span>01</span>
      </div>
      <p className="bracket-step-note" aria-live="off">
        {uniform
          ? 'No step: the arm depth equals the root depth, so the step location and fillet radius have no effect until the depths differ.'
          : 'Deep root segment from the wall, a symmetric step with opposite shoulder fillets, then the thinner arm to the tip.'}
      </p>
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {BRACKET_PARAMS.map((param) => {
        const range = bracketPermissibleRange(param, ch.designLimits)!
        const id = `bracket-${param}`
        const error = errors[param]
        const inactive = uniform && (param === 'stepLocationM' || param === 'filletRadiusM')
        const locked = guided.locked(param)
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={id}>{BRACKET_PARAM_LABELS[param]}</label>
            <div className="number-field">
              <input
                id={id}
                inputMode="decimal"
                value={texts[param] ?? formatMm(draft[param], 1)}
                readOnly={locked}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${id}-error` : locked ? `${id}-locked` : inactive ? `${id}-inactive` : undefined}
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
              disabled={locked}
              onChange={(e) => dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(Number(e.target.value)), mode: 'clamp' } })}
            />
            {locked && <LockNote id={`${id}-locked`} reason={guided.lockReason} />}
            {inactive && !error && (
              <p id={`${id}-inactive`} className="field-note">
                No step: no effect
              </p>
            )}
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
          <dt>Length</dt>
          <dd>{formatMm(ch.lengthM, 0)} mm</dd>
          <dt>Thickness</dt>
          <dd>{formatMm(ch.thicknessM, 0)} mm (out of plane)</dd>
          <dt>Force</dt>
          <dd>{ch.load.forceN} N downward at the free end</dd>
          <dt>Material</dt>
          <dd>{ch.material.name}</dd>
          <dt>Support</dt>
          <dd>Rigid wall clamp at the root</dd>
        </dl>
      </details>
    </>
  )
}
