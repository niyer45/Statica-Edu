import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { allowableStress } from '../../../physics/axial/formulas'
import { formatMm, mmToM, mToMm, parseMmInput, nToKn } from '../../../units/units'
import Icon from '../../icons/Icon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { formatAxial, useAxialStore } from './shared'

// Stress and Strain I design tools (task 72; SSR-04, SSR-15, MODE-04, MODE-07, MM-22). A numeric
// diameter field (mm) plus slider on the configured grid, and an accessible radio group of rod
// materials showing each material's typical E, yield strength, density and allowable stress (the
// allowable stress comes from the physics layer). Text is parsed on blur or Enter and dispatched
// as a strict edit; the slider dispatches clamp edits. The reducer's verdict returns through
// `draftErrors`; a rejection keeps the draft and shows an inline error announced once. Fixed
// values stay read-only in a collapsed disclosure. In Guided, controls the current step does not
// unlock are read-only or disabled with a visible reason.

const FIELD_ID = 'rod-diameter'

export default function AxialTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useAxialStore()
  const draft = state.draft
  const range = ch.diameterLimits
  const guided = useGuided()
  const diameterLocked = guided.locked('diameterM')
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
    const e = state.draftErrors.find((x) => x.param === 'diameterM') ?? state.draftErrors[0]!
    const message = `Diameter: ${e.message}`
    setError(message)
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = () => {
    if (text === undefined || diameterLocked) return
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = 'Diameter: enter a number in millimetres.'
      setError(message)
      onAnnounce(message)
      return
    }
    pending.current = true
    dispatch({ type: 'edit', edit: { type: 'setDiameter', valueM: mmToM(mm), mode: 'strict' } })
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setText(undefined)
      setError(undefined)
    }
  }

  return (
    <div className="axial-tools">
      <div className="section-heading">
        ROD DIAMETER <span>01</span>
      </div>
      <p className="axial-note">A solid round rod. The load pulls straight along its axis.</p>
      <div className="dimension-field">
        <label htmlFor={FIELD_ID}>Diameter</label>
        <div className="number-field">
          <input
            id={FIELD_ID}
            inputMode="decimal"
            value={text ?? formatMm(draft.diameterM, 1)}
            readOnly={diameterLocked}
            aria-invalid={error !== undefined}
            aria-describedby={error ? `${FIELD_ID}-error` : diameterLocked ? `${FIELD_ID}-range ${FIELD_ID}-locked` : `${FIELD_ID}-range`}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={keys}
          />
          <span>mm</span>
        </div>
        <input
          type="range"
          aria-label="Diameter slider"
          min={mToMm(range.minM)}
          max={mToMm(range.maxM)}
          step={mToMm(range.stepM)}
          value={mToMm(draft.diameterM)}
          disabled={diameterLocked}
          onChange={(e) => dispatch({ type: 'edit', edit: { type: 'setDiameter', valueM: mmToM(Number(e.target.value)), mode: 'clamp' } })}
        />
        <p id={`${FIELD_ID}-range`} className="field-hint">
          {formatMm(range.minM, 0)}–{formatMm(range.maxM, 0)} mm
        </p>
        {diameterLocked && <LockNote id={`${FIELD_ID}-locked`} reason={guided.lockReason} />}
        {error && (
          <p id={`${FIELD_ID}-error`} className="field-error">
            {error}
          </p>
        )}
      </div>
      <fieldset className="material-choice" disabled={materialLocked} aria-describedby={materialLocked ? 'rod-material-locked' : undefined}>
        <legend className="section-heading">
          MATERIAL <span>02</span>
        </legend>
        {ch.materials.map((m) => (
          <label key={m.id} className={`material-option axial-material ${draft.materialId === m.id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="rod-material"
              value={m.id}
              checked={draft.materialId === m.id}
              disabled={materialLocked}
              onChange={() => dispatch({ type: 'edit', edit: { type: 'setMaterial', materialId: m.id } })}
            />
            <span>{m.name}</span>
            <small>
              E {formatAxial(m.elasticModulusPa, 'modulus')} · yield {formatAxial(m.yieldStressPa, 'Pa')} · {m.densityKgM3} kg/m³ · allowable{' '}
              {formatAxial(allowableStress(m.yieldStressPa, ch.designFactor), 'Pa')}
            </small>
          </label>
        ))}
        {materialLocked && <LockNote id="rod-material-locked" reason={guided.lockReason} />}
        <p className="field-hint">Typical textbook values, not certified material data.</p>
      </fieldset>
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Length</dt>
          <dd>{ch.lengthM} m between the pins</dd>
          <dt>Load</dt>
          <dd>{nToKn(ch.forceN)} kN tension, through the rod&apos;s axis</dd>
          <dt>Design factor</dt>
          <dd>{ch.designFactor} on yield strength</dd>
          <dt>Support</dt>
          <dd>Pinned to a rigid roof beam; the load hangs from the lower pin</dd>
        </dl>
      </details>
    </div>
  )
}
