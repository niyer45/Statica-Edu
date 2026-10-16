import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { LockedField } from '../../challenge/types'
import { handlesFor } from '../../geometry/handles'
import { PARAM_LABELS, type SectionParam } from '../../geometry/params'
import type { GeometryError, Orientation } from '../../geometry/sections'
import { formatMm, mmToM, mToMm, parseMmInput } from '../../units/units'
import Icon from '../icons/Icon'
import { useChallenge, useDispatch, useSession } from '../state/store'

// Numeric controls (task 17.1; Req 2.3, 4.8, 4.9, 7.4, 7.6, 28.1–28.8, 35.2).
//
// Template `design-panel` dimensions block (`.dimension-field`, `.number-field`, range slider,
// `.rotate-button`, `.locked-features`) with one field per typed draft parameter. The template's
// shared "Web & flange" / "Wall thickness" fields and hard-coded 8–80 / 3–15 mm ranges are gone.
//
// - Ranges come from `handlesFor` (the challenge ranges, narrowed for dependent thicknesses
//   exactly like clamp mode), so inputs, sliders, and viewport handles agree.
// - Number inputs: text is parsed by the Units_Module on blur or Enter (only after an edit),
//   converted mm → m, and dispatched as a strict `setParam`. The reducer's verdict comes back
//   through `session.draftErrors`; a rejection keeps the draft and shows an inline error
//   (`aria-invalid`, `aria-describedby`) plus one announcement via `onAnnounce`.
// - Escape restores the draft value and clears the error without dispatching.
// - Sliders dispatch clamp-mode `setParam` (same as handle drags).
// - Any accepted draft change (section, orientation, kind) resyncs every field (Req 28.2).
// - Guided and Parametric show the same fields; locked fields stay read-only in both.

export interface NumericControlsProps {
  /** Announces once through the Workbench's single live region. */
  onAnnounce?: (message: string) => void
}

type Texts = Partial<Record<SectionParam, string>>
type Errors = Partial<Record<SectionParam, string>>

const ROUND_KINDS = new Set(['circle', 'tube'])

function errorText(param: SectionParam, errors: readonly GeometryError[]): string {
  const e = errors.find((x) => x.param === param) ?? errors[0]
  return `${PARAM_LABELS[param]}: ${e?.message ?? 'this value is not allowed.'}`
}

export default function NumericControls({ onAnnounce }: NumericControlsProps) {
  const session = useSession()
  const challenge = useChallenge()
  const dispatch = useDispatch()
  const draft = session.draft
  const section = draft.section
  const values = section as unknown as Record<SectionParam, number>
  const fields = handlesFor(section, draft.orientationDeg, challenge.sectionLimits)

  // Field text while the student is editing (absent = show the draft value) and inline errors.
  const [texts, setTexts] = useState<Texts>({})
  const [errors, setErrors] = useState<Errors>({})
  // Resync every field whenever the accepted draft changes (Req 28.2). Rejected edits keep
  // the draft object, so their text and error survive.
  const [syncedDraft, setSyncedDraft] = useState(draft)
  if (syncedDraft !== draft) {
    setSyncedDraft(draft)
    setTexts({})
    setErrors({})
  }

  // The field whose strict set is awaiting the reducer's verdict.
  const pending = useRef<SectionParam | null>(null)
  // Last committed text per field, to avoid re-dispatching an already rejected value.
  const rejected = useRef<Texts>({})
  const draftErrors = session.draftErrors
  useEffect(() => {
    const param = pending.current
    if (param === null) return
    pending.current = null
    if (draftErrors.length === 0) {
      setErrors((prev) => ({ ...prev, [param]: undefined }))
      setTexts((prev) => ({ ...prev, [param]: undefined }))
      return
    }
    const message = errorText(param, draftErrors)
    setErrors((prev) => ({ ...prev, [param]: message }))
    onAnnounce?.(message)
  }, [draftErrors, onAnnounce])

  const shown = (param: SectionParam): string => texts[param] ?? formatMm(values[param])

  const commit = (param: SectionParam) => {
    const text = texts[param]
    if (text === undefined) return // untouched: never round the draft to display precision
    // Enter then blur on the same rejected text: already reported and announced once.
    if (errors[param] !== undefined && rejected.current[param] === text) return
    rejected.current[param] = text
    const mm = parseMmInput(text)
    if (mm === null) {
      const message = `${PARAM_LABELS[param]}: enter a number in millimetres, such as 25.`
      setErrors((prev) => ({ ...prev, [param]: message }))
      onAnnounce?.(message)
      return
    }
    pending.current = param
    dispatch({ type: 'setParam', param, valueM: mmToM(mm), mode: 'strict' })
  }

  const revert = (param: SectionParam) => {
    setTexts((prev) => ({ ...prev, [param]: undefined }))
    setErrors((prev) => ({ ...prev, [param]: undefined }))
  }

  const onKeyDown = (param: SectionParam) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(param)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      revert(param)
    }
  }

  const round = ROUND_KINDS.has(section.kind)
  const setOrientation = (o: Orientation) => dispatch({ type: 'setOrientation', orientationDeg: o })

  return (
    <>
      <div className="section-heading dimensions-heading">
        DIMENSIONS <span>mm</span>
      </div>
      {fields.map(({ param, label, range }) => {
        const id = `dim-${param}`
        const errorId = `${id}-error`
        const error = errors[param]
        const minMm = mToMm(range.minM)
        const maxMm = mToMm(range.maxM)
        const stepMm = mToMm(range.stepM)
        return (
          <div className="dimension-field" key={`${section.kind}-${param}`}>
            <label htmlFor={id}>
              {label}
              <span className="sr-only"> (mm)</span>
            </label>
            <div className="number-field">
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={minMm}
                max={maxMm}
                step={stepMm}
                value={shown(param)}
                aria-invalid={error !== undefined ? true : undefined}
                aria-describedby={error !== undefined ? errorId : undefined}
                onChange={(e) => {
                  const text = e.target.value
                  setTexts((prev) => ({ ...prev, [param]: text }))
                }}
                onBlur={() => commit(param)}
                onKeyDown={onKeyDown(param)}
              />
              <span aria-hidden="true">mm</span>
            </div>
            <input
              type="range"
              min={minMm}
              max={maxMm}
              step={stepMm}
              value={mToMm(values[param])}
              aria-label={`${label} slider`}
              aria-valuetext={`${formatMm(values[param])} mm`}
              onChange={(e) => {
                const mm = Number(e.target.value)
                if (Number.isFinite(mm)) {
                  dispatch({ type: 'setParam', param, valueM: mmToM(mm), mode: 'clamp' })
                }
              }}
            />
            {error !== undefined && (
              <p id={errorId} className="col-span-full m-0 text-[9px] leading-snug text-[#a3392b]">
                {error}
              </p>
            )}
          </div>
        )
      })}
      <div className="rotate-button" role="radiogroup" aria-labelledby="orientation-label" aria-disabled={round || undefined}>
        <Icon name="reset" size={14} />
        <span id="orientation-label" className="ml-0!">
          Section orientation
        </span>
        <span className="flex gap-2">
          {([0, 90] as const).map((o) => (
            <label key={o} className={`flex items-center gap-1 ${round ? 'opacity-60' : 'cursor-pointer'}`}>
              <input
                type="radio"
                name="orientation"
                value={o}
                checked={draft.orientationDeg === o}
                disabled={round}
                tabIndex={round ? -1 : undefined}
                onChange={() => setOrientation(o)}
              />
              {o}°
            </label>
          ))}
        </span>
      </div>
      <LockedFields />
    </>
  )
}

const LOCKED_LABELS: Readonly<Record<LockedField, string>> = {
  lengthM: 'Span',
  materialId: 'Material',
  forceN: 'Load',
  support: 'Support',
}

const SUPPORT_LABELS: Readonly<Record<string, string>> = { fixedRoot: 'Fixed root (cantilever)' }

/** Read-only challenge values (Req 4.8, 4.9, 35.2): no handler can change them. */
function LockedFields() {
  const challenge = useChallenge()
  const display: Record<LockedField, { value: string; unit?: string }> = {
    lengthM: { value: formatMm(challenge.initialDesign.lengthM, 0), unit: 'mm' },
    materialId: { value: challenge.material.name },
    forceN: { value: String(challenge.load.forceN), unit: 'N' },
    support: { value: SUPPORT_LABELS[challenge.support] ?? challenge.support },
  }
  const fields = (Object.keys(LOCKED_LABELS) as LockedField[]).filter((f) => challenge.lockedFields.includes(f))
  return (
    <details className="locked-features">
      <summary><Icon name="lock" size={13} />Some things are fixed.</summary>
      <div className="min-w-0">
        {fields.map((f) => {
          const id = `locked-${f}`
          const { value, unit } = display[f]
          return (
            <div key={f} className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-x-1.5">
              <label htmlFor={id}>{LOCKED_LABELS[f]}</label>
              <span className="flex items-center gap-1 text-[8px]">
                <span role="img" aria-label={`${LOCKED_LABELS[f]} is fixed by the challenge`}>
                  <Icon name="lock" size={10} />
                </span>
                Fixed by challenge
              </span>
              <input
                id={id}
                type="text"
                readOnly
                aria-readonly="true"
                value={unit !== undefined ? `${value} ${unit}` : value}
                className="col-span-full w-full rounded border border-[#e2e7d9] bg-[#f4f6f0] px-1.5 py-1 text-[9px] text-[#53674a]"
              />
            </div>
          )
        })}
      </div>
    </details>
  )
}
