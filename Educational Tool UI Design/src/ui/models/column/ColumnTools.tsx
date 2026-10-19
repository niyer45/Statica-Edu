import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ColumnSectionKind } from '../../../geometry/column/design'
import { columnPermissibleRange } from '../../../geometry/column/edit'
import { COLUMN_PARAM_LABELS, COLUMN_SECTION_PARAMS, type ColumnSectionParam } from '../../../geometry/column/validate'
import { formatMm, mmToM, mToMm, nToKn, parseMmInput } from '../../../units/units'
import Icon from '../../icons/Icon'
import SectionIcon from '../../icons/SectionIcon'
import LockNote from '../../workbench/LockNote'
import { useGuided } from '../../workbench/useGuided'
import { COLUMN_SECTION_ICONS, COLUMN_SECTION_NAMES, formatColumn, useColumnStore } from './shared'

// Column design tools (task 68; CBK-05, CBK-18, MODE-04, MODE-07). Solid bar / hollow tube tiles
// and one numeric field plus slider per dimension, using the template `design-panel` classes, as
// for the torsion shaft. Text is parsed on blur or Enter and dispatched as a strict edit; sliders
// dispatch clamp edits. The reducer's verdict returns through `draftErrors`; a rejection keeps the
// draft and shows an inline error announced once. Fixed values stay read-only in a collapsed
// disclosure. In Guided, controls the current step does not unlock are read-only or disabled with a
// visible reason; Parametric leaves every control editable.

export default function ColumnTools({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const { state, challenge: ch, dispatch } = useColumnStore()
  const section = state.draft.section
  const params = COLUMN_SECTION_PARAMS[section.kind] as readonly ColumnSectionParam[]
  const values = section as unknown as Record<string, number>
  const guided = useGuided()
  const sectionLocked = guided.locked('section')
  const setSection = (kind: ColumnSectionKind) => {
    if (!sectionLocked) dispatch({ type: 'edit', edit: { type: 'setSection', kind } })
  }
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
    const message = `${COLUMN_PARAM_LABELS[param as ColumnSectionParam] ?? param}: ${e.message}`
    setErrors((prev) => ({ ...prev, [param]: message }))
    onAnnounce(message)
  }, [state.draftErrors, onAnnounce])

  const commit = (param: ColumnSectionParam) => {
    const text = texts[param]
    if (text === undefined || guided.locked(param)) return
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = `${COLUMN_PARAM_LABELS[param]}: enter a number in millimetres.`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce(message)
      return
    }
    pending.current = param
    dispatch({ type: 'edit', edit: { type: 'setParam', param, valueM: mmToM(mm), mode: 'strict' } })
  }
  const keys = (param: ColumnSectionParam) => (e: KeyboardEvent<HTMLInputElement>) => {
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
            aria-disabled={sectionLocked || undefined}
            aria-describedby={sectionLocked ? 'column-section-locked' : undefined}
            className={`shape-tile ${section.kind === kind ? 'selected' : ''} ${sectionLocked ? 'locked' : ''}`}
            onClick={() => setSection(kind)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              setSection(kind)
            }}
          >
            <SectionIcon kind={COLUMN_SECTION_ICONS[kind]} />
            <span>{COLUMN_SECTION_NAMES[kind]}</span>
          </div>
        ))}
      </div>
      {sectionLocked && <LockNote id="column-section-locked" reason={guided.lockReason} />}
      <div className="section-heading dimensions-heading">DIMENSIONS</div>
      {params.map((param) => {
        const range = columnPermissibleRange(section, param, ch.sectionLimits)!
        const id = `column-${param}`
        const error = errors[param]
        const locked = guided.locked(param)
        return (
          <div className="dimension-field" key={param}>
            <label htmlFor={id}>{COLUMN_PARAM_LABELS[param]}</label>
            <div className="number-field">
              <input
                id={id}
                inputMode="decimal"
                value={texts[param] ?? formatMm(values[param]!, 1)}
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
              aria-label={`${COLUMN_PARAM_LABELS[param]} slider`}
              min={mToMm(range.minM)}
              max={mToMm(range.maxM)}
              step={0.5}
              value={mToMm(values[param]!)}
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
          <dt>Length</dt>
          <dd>{formatColumn(ch.lengthM, 'm')} between the pins</dd>
          <dt>Load</dt>
          <dd>{nToKn(ch.load.forceN)} kN pressing straight down at the top</dd>
          <dt>Ends</dt>
          <dd>Pinned at the top and bottom (free to rotate, held sideways)</dd>
          <dt>Material</dt>
          <dd>{ch.material.name}</dd>
        </dl>
      </details>
    </>
  )
}
