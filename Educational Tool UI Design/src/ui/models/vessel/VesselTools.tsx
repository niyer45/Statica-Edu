import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { allowableStressPa } from '../../../challenge/vessel/types'
import { VESSEL_PARAMS, type VesselParam } from '../../../geometry/vessel/design'
import { vesselPermissibleRange } from '../../../geometry/vessel/edit'
import { VESSEL_PARAM_LABELS } from '../../../geometry/vessel/validate'
import { formatMm, mmToM, mToMm, paToMpa, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { useVesselStore } from './shared'

// Pressure vessel design tools (task 69; MODE-04, MODE-07, MM-22). One numeric field plus slider
// per adjustable dimension (inner diameter, shell length, shell thickness, head thickness), using
// the template `design-panel` classes, as for the bracket. Text is parsed on blur or Enter and
// dispatched as a strict edit; sliders dispatch clamp edits on the configured grid. The reducer's
// verdict returns through `draftErrors`; a rejection keeps the draft and shows an inline error
// announced once. Fixed values stay read-only in a collapsed disclosure. In Guided, controls the
// current step does not unlock are read-only or disabled with a visible reason.

/** Display digits per parameter: diameters and lengths in whole millimetres, walls to 0.1 mm. */
const DIGITS: Readonly<Record<VesselParam, number>> = { innerDiameterM: 0, shellLengthM: 0, shellThicknessM: 1, headThicknessM: 1 }

export default function VesselTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useVesselStore()
  const draft = state.draft
  const guided = useGuided()
  const [texts, setTexts] = useState<Partial<Record<VesselParam, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<VesselParam, string>>>({})
  const [synced, setSynced] = useState(draft)
  if (synced !== draft) {
    setSynced(draft)
    setTexts({})
    setErrors({})
  }
  const pending = useRef<VesselParam | null>(null)
  useEffect(() => {
    const param = pending.current
    if (param === null) return
    pending.current = null
    if (state.draftErrors.length === 0) return
    const e = state.draftErrors.find((x) => x.param === param) ?? state.draftErrors[0]!
    const message = `${VESSEL_PARAM_LABELS[param]}: ${e.message}`
    setErrors((prev) => ({ ...prev, [param]: message }))
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = (param: VesselParam) => {
    const text = texts[param]
    if (text === undefined || guided.locked(param)) return
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = `${VESSEL_PARAM_LABELS[param]}: enter a number in millimetres.`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce(message)
      return
    }
    pending.current = param
    dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(mm), mode: 'strict' } })
  }
  const keys = (param: VesselParam) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(param)
    if (e.key === 'Escape') {
      setTexts((prev) => ({ ...prev, [param]: undefined }))
      setErrors((prev) => ({ ...prev, [param]: undefined }))
    }
  }

  return (
    <>
      <div className="section-heading">
        PRESSURE VESSEL <span>01</span>
      </div>
      <p className="vessel-step-note">
        A cylindrical shell closed by two hemispherical heads. The shell length is the straight part between the heads.
      </p>
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {VESSEL_PARAMS.map((param) => {
        const range = vesselPermissibleRange(param, ch.designLimits)!
        const id = `vessel-${param}`
        const error = errors[param]
        const locked = guided.locked(param)
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={id}>{VESSEL_PARAM_LABELS[param]}</label>
            <div className="number-field">
              <input
                id={id}
                inputMode="decimal"
                value={texts[param] ?? formatMm(draft[param], DIGITS[param])}
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
              aria-label={`${VESSEL_PARAM_LABELS[param]} slider`}
              min={mToMm(range.minM)}
              max={mToMm(range.maxM)}
              step={mToMm(ch.designLimits[param].stepM)}
              value={mToMm(draft[param])}
              disabled={locked}
              onChange={(e) => dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(Number(e.target.value)), mode: 'clamp' } })}
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
      <details className="locked-features">
        <summary>
          <Icon name="lock" size={14} /> Some things are fixed.
        </summary>
        <dl>
          <dt>Internal pressure</dt>
          <dd>{paToMpa(ch.pressurePa).toFixed(1)} MPa (gauge)</dd>
          <dt>Heads</dt>
          <dd>Hemispherical, same inner diameter as the shell</dd>
          <dt>Material</dt>
          <dd>
            {ch.material.name}, yield {paToMpa(ch.material.yieldStressPa).toFixed(0)} MPa
          </dd>
          <dt>Design factor</dt>
          <dd>
            {ch.designFactor} on yield: allowable stress {paToMpa(allowableStressPa(ch)).toFixed(0)} MPa
          </dd>
        </dl>
      </details>
    </>
  )
}
