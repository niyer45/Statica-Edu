import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatHz, formatKnPerM, knPerMToNPerM, parseDecimalInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { formatVibration, sliderToStiffness, STIFFNESS_SLIDER_STEPS, stiffnessToSlider, useVibrationStore } from './shared'

// Vibration design tools (task 50.3; VIB-04, VIB-14, MODE-04, MODE-07). One numeric stiffness
// field (kN/m) plus a logarithmic slider, and an accessible radio group of isolator materials
// showing each damping ratio ζ. Text is parsed on blur or Enter and dispatched as a strict edit;
// the slider dispatches clamp edits. The reducer's verdict returns through `draftErrors`; a
// rejection keeps the draft and shows an inline error announced once. Fixed values stay
// read-only in a collapsed disclosure.
// Task 58: in Guided, controls the current step does not unlock are read-only or disabled
// with a visible reason; Parametric leaves every control editable.

const FIELD_ID = 'isolator-stiffness'

export default function VibrationTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useVibrationStore()
  const draft = state.draft
  const limits = ch.stiffnessLimits
  const guided = useGuided()
  const stiffnessLocked = guided.locked('stiffnessNPerM')
  const materialLocked = guided.locked('materialId')
  const [text, setText] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [synced, setSynced] = useState(draft)
  if (synced !== draft) {
    setSynced(draft)
    setText(undefined)
    setError(undefined)
  }
  const pending = useRef(false)
  useEffect(() => {
    if (!pending.current) return
    pending.current = false
    if (state.draftErrors.length === 0) return
    const e = state.draftErrors.find((x) => x.param === 'stiffnessNPerM') ?? state.draftErrors[0]!
    const message = `Stiffness: ${e.message}`
    setError(message)
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = () => {
    if (text === undefined || stiffnessLocked) return
    const kn = parseDecimalInput(text)
    if (kn === null) {
      const message = 'Stiffness: enter a number in kN/m.'
      setError(message)
      onAnnounce(message)
      return
    }
    pending.current = true
    dispatch({ type: 'edit', edit: { type: 'setStiffness', valueNPerM: knPerMToNPerM(kn), mode: 'strict' } })
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setText(undefined)
      setError(undefined)
    }
  }

  return (
    <div className="vibration-tools">
      <div className="section-heading">
        MOUNT STIFFNESS <span>01</span>
      </div>
      <div className="dimension-field">
        <label htmlFor={FIELD_ID}>Stiffness</label>
        <div className="number-field">
          <input
            id={FIELD_ID}
            inputMode="decimal"
            value={text ?? formatKnPerM(draft.stiffnessNPerM)}
            readOnly={stiffnessLocked}
            aria-invalid={error !== undefined}
            aria-describedby={error ? `${FIELD_ID}-error` : stiffnessLocked ? `${FIELD_ID}-range ${FIELD_ID}-locked` : `${FIELD_ID}-range`}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={keys}
          />
          <span>kN/m</span>
        </div>
        <input
          type="range"
          aria-label="Stiffness slider (logarithmic)"
          aria-valuetext={`${formatKnPerM(draft.stiffnessNPerM)} kN/m`}
          min={0}
          max={STIFFNESS_SLIDER_STEPS}
          step={1}
          value={stiffnessToSlider(draft.stiffnessNPerM, limits)}
          disabled={stiffnessLocked}
          onChange={(e) =>
            dispatch({ type: 'edit', edit: { type: 'setStiffness', valueNPerM: sliderToStiffness(Number(e.target.value), limits), mode: 'clamp' } })
          }
        />
        <p id={`${FIELD_ID}-range`} className="field-hint">
          {formatKnPerM(limits.minNPerM)}–{formatKnPerM(limits.maxNPerM)} kN/m
        </p>
        {stiffnessLocked && <LockNote id={`${FIELD_ID}-locked`} reason={guided.lockReason} />}
        {error && (
          <p id={`${FIELD_ID}-error`} className="field-error">
            {error}
          </p>
        )}
      </div>
      <fieldset className="material-choice" disabled={materialLocked} aria-describedby={materialLocked ? 'isolator-material-locked' : undefined}>
        <legend className="section-heading">
          MATERIAL · DAMPING ζ <span>02</span>
        </legend>
        {ch.materials.map((m) => (
          <label key={m.id} className={`material-option ${draft.materialId === m.id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="isolator-material"
              value={m.id}
              checked={draft.materialId === m.id}
              disabled={materialLocked}
              onChange={() => dispatch({ type: 'edit', edit: { type: 'setMaterial', materialId: m.id } })}
            />
            <span>{m.name}</span>
            <small>ζ {formatVibration(m.dampingRatio, 'zeta')}</small>
          </label>
        ))}
        {materialLocked && <LockNote id="isolator-material-locked" reason={guided.lockReason} />}
      </fieldset>
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Component mass</dt>
          <dd>{ch.component.massKg} kg, rigid, vertical motion only</dd>
          <dt>Operating band</dt>
          <dd>
            {formatHz(ch.excitation.operatingBandHz.minHz)}–{formatHz(ch.excitation.operatingBandHz.maxHz)} Hz
          </dd>
          <dt>Base vibration</dt>
          <dd>{formatVibration(ch.excitation.amplitudeM, 'm')} amplitude at every frequency</dd>
          <dt>Mount stroke</dt>
          <dd>{formatVibration(ch.mount.linearStrokeM, 'm')} linear range</dd>
        </dl>
        <p className="field-hint">Material damping ratios are educational nominal values, not supplier data.</p>
      </details>
    </div>
  )
}
