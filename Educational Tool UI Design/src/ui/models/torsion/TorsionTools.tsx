import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { torsionPermissibleRange, TORSION_SECTION_PARAMS } from '../../../geometry/torsion/edit'
import { formatMm, mmToM, mToMm, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import SectionIcon from '../../icons/SectionIcon'
import { formatTorsion, SHAFT_PARAM_LABELS, SHAFT_SECTION_NAMES, useTorsionStore } from './shared'

// Torsion design tools (task 47.3; TSH-04, TSH-14, MODE-04, MODE-07). Solid/tube tiles and one
// numeric field plus slider per shaft parameter, using the template `design-panel` classes.
// Text is parsed on blur or Enter and dispatched as a strict edit; sliders dispatch clamp
// edits. The reducer's verdict returns through `draftErrors`; a rejection keeps the draft and
// shows an inline error announced once. Fixed values stay read-only in a collapsed disclosure.

export default function TorsionTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useTorsionStore()
  const section = state.draft.section
  const params = TORSION_SECTION_PARAMS[section.kind] as readonly string[]
  const values = section as unknown as Record<string, number>
  const [texts, setTexts] = useState<Record<string, string | undefined>>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [synced, setSynced] = useState(state.draft)
  if (synced !== state.draft) {
    setSynced(state.draft)
    setTexts({})
    setErrors({})
  }
  const pending = useRef<string | null>(null)
  useEffect(() => {
    const param = pending.current
    if (param === null) return
    pending.current = null
    if (state.draftErrors.length === 0) return
    const e = state.draftErrors.find((x) => x.param === param) ?? state.draftErrors[0]!
    const message = `${SHAFT_PARAM_LABELS[param] ?? param}: ${e.message}`
    setErrors((prev) => ({ ...prev, [param]: message }))
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = (param: string) => {
    const text = texts[param]
    if (text === undefined) return
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = `${SHAFT_PARAM_LABELS[param]}: enter a number in millimetres.`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce(message)
      return
    }
    pending.current = param
    dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(mm), mode: 'strict' } })
  }
  const keys = (param: string) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(param)
    if (e.key === 'Escape') {
      setTexts((prev) => ({ ...prev, [param]: undefined }))
      setErrors((prev) => ({ ...prev, [param]: undefined }))
    }
  }

  return (
    <>
      <div className="section-heading">
        CROSS-SECTION <span>01</span>
      </div>
      <div className="shape-grid">
        {ch.allowedSections.map((kind) => (
          <div
            key={kind}
            role="button"
            tabIndex={0}
            aria-pressed={section.kind === kind}
            className={`shape-tile ${section.kind === kind ? 'selected' : ''}`}
            onClick={() => dispatch({ type: 'edit', edit: { type: 'setSection', kind } })}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              dispatch({ type: 'edit', edit: { type: 'setSection', kind } })
            }}
          >
            <SectionIcon kind={kind} />
            <span>{SHAFT_SECTION_NAMES[kind]}</span>
          </div>
        ))}
      </div>
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {params.map((param) => {
        const range = torsionPermissibleRange(section, param, ch.sectionLimits)!
        const id = `shaft-${param}`
        const error = errors[param]
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={id}>{SHAFT_PARAM_LABELS[param]}</label>
            <div className="number-field">
              <input
                id={id}
                inputMode="decimal"
                value={texts[param] ?? formatMm(values[param]!, 1)}
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
              aria-label={`${SHAFT_PARAM_LABELS[param]} slider`}
              min={mToMm(range.minM)}
              max={mToMm(range.maxM)}
              step={0.5}
              value={mToMm(values[param]!)}
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
          <dt>Length</dt>
          <dd>{formatTorsion(ch.lengthM, 'm')}</dd>
          <dt>Torque</dt>
          <dd>{ch.torqueNm} N·m at the free end</dd>
          <dt>Material</dt>
          <dd>{ch.material.name}</dd>
          <dt>Support</dt>
          <dd>Opposite end fixed against rotation</dd>
        </dl>
      </details>
    </>
  )
}
