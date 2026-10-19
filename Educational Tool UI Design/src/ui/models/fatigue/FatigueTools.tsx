import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { wheelLoadRangeN } from '../../../challenge/fatigue/types'
import { FATIGUE_PARAMS, type FatigueParam } from '../../../geometry/fatigue/design'
import { fatiguePermissibleRange } from '../../../geometry/fatigue/edit'
import { FATIGUE_PARAM_LABELS } from '../../../geometry/fatigue/validate'
import { formatMm, mmToM, mToMm, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { finishName, useFatigueStore } from './shared'

// Fatigue design tools (task 70; FAT-16, MODE-04, MODE-07, MM-22). One numeric field plus slider
// per dimension (neck diameter, collar diameter, fillet radius) and a radio group for the surface
// finish. Text is parsed on blur or Enter and dispatched as a strict edit; sliders dispatch clamp
// edits on the configured grid. A rejected edit (out of range, or a fillet that no longer fits
// inside the step) keeps the draft and shows an inline error announced once. In Guided, controls
// the current step does not unlock are read-only or disabled with a visible reason.

type Field = FatigueParam | 'surfaceFinish'

export default function FatigueTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useFatigueStore()
  const draft = state.draft
  const guided = useGuided()
  const [texts, setTexts] = useState<Partial<Record<FatigueParam, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [synced, setSynced] = useState(draft)
  if (synced !== draft) {
    setSynced(draft)
    setTexts({})
    setErrors({})
  }
  const pending = useRef<Field | null>(null)
  useEffect(() => {
    const field = pending.current
    if (field === null) return
    pending.current = null
    if (state.draftErrors.length === 0) return
    const e = state.draftErrors.find((x) => x.param === field) ?? state.draftErrors[0]!
    const message = `${FATIGUE_PARAM_LABELS[field]}: ${e.message}`
    setErrors((prev) => ({ ...prev, [field]: message }))
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = (param: FatigueParam) => {
    const text = texts[param]
    if (text === undefined || guided.locked(param)) return
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = `${FATIGUE_PARAM_LABELS[param]}: enter a number in millimetres.`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce(message)
      return
    }
    pending.current = param
    dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(mm), mode: 'strict' } })
  }
  const keys = (param: FatigueParam) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(param)
    if (e.key === 'Escape') {
      setTexts((prev) => ({ ...prev, [param]: undefined }))
      setErrors((prev) => ({ ...prev, [param]: undefined }))
    }
  }
  const finishLocked = guided.locked('surfaceFinish')

  return (
    <>
      <div className="section-heading">
        STEPPED SPINDLE <span>01</span>
      </div>
      <p className="bracket-step-note">A collar held in its housing, a shoulder fillet, and a neck that carries the fluctuating wheel load.</p>
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {FATIGUE_PARAMS.map((param) => {
        const range = fatiguePermissibleRange(param, ch.designLimits)!
        const id = `fatigue-${param}`
        const error = errors[param]
        const locked = guided.locked(param)
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={id}>{FATIGUE_PARAM_LABELS[param]}</label>
            <div className="number-field">
              <input
                id={id}
                inputMode="decimal"
                value={texts[param] ?? formatMm(draft[param], 2)}
                readOnly={locked}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${id}-error` : locked ? `${id}-locked` : undefined}
                onChange={(e) => setTexts((prev) => ({ ...prev, [param]: e.target.value }))}
                onBlur={() => commit(param)}
                onKeyDown={keys(param)}
              />
              <span>mm</span>
            </div>
            <input
              type="range"
              aria-label={`${FATIGUE_PARAM_LABELS[param]} slider`}
              min={mToMm(range.minM)}
              max={mToMm(range.maxM)}
              step={mToMm(ch.designLimits[param].stepM)}
              value={mToMm(draft[param])}
              disabled={locked}
              onChange={(e) => {
                pending.current = param
                dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(Number(e.target.value)), mode: 'clamp' } })
              }}
            />
            {locked && <LockNote id={`${id}-locked`} reason={guided.lockReason} />}
            {error && (
              <p id={`${id}-error`} className="field-error">
                {error}
              </p>
            )}
          </div>
        )
      })}
      <fieldset className="fatigue-finish" aria-describedby={finishLocked ? 'fatigue-finish-locked' : errors.surfaceFinish ? 'fatigue-finish-error' : undefined}>
        <legend className="section-heading">SURFACE FINISH AT THE FILLET</legend>
        {ch.allowedFinishes.map((f) => (
          <label key={f} className="fatigue-finish-option">
            <input
              type="radio"
              name="fatigue-finish"
              value={f}
              checked={draft.surfaceFinish === f}
              disabled={finishLocked}
              onChange={() => {
                pending.current = 'surfaceFinish'
                dispatch({ type: 'edit', edit: { type: 'setFinish', finish: f } })
              }}
            />
            {finishName(f)}
          </label>
        ))}
        {finishLocked && <LockNote id="fatigue-finish-locked" reason={guided.lockReason} />}
        {errors.surfaceFinish && (
          <p id="fatigue-finish-error" className="field-error">
            {errors.surfaceFinish}
          </p>
        )}
      </fieldset>
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Wheel load</dt>
          <dd>
            {wheelLoadRangeN(ch.load).minN} N to {wheelLoadRangeN(ch.load).maxN} N every cycle, {formatMm(ch.load.armM, 0)} mm from the shoulder
          </dd>
          <dt>Target life</dt>
          <dd>{ch.targetLifeCycles.toLocaleString('en-US')} cycles</dd>
          <dt>Lengths</dt>
          <dd>
            Collar {formatMm(ch.geometry.collarLengthM, 0)} mm, neck {formatMm(ch.geometry.neckLengthM, 0)} mm
          </dd>
          <dt>Material</dt>
          <dd>{ch.material.name}</dd>
          <dt>Reliability</dt>
          <dd>{ch.reliability.percent} %</dd>
          <dt>Support</dt>
          <dd>Collar held rigidly; the spindle does not rotate</dd>
        </dl>
      </details>
    </>
  )
}
