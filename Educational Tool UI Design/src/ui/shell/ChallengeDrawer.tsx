import type { CatalogEntry } from '../../challenge/catalog'
import { DIFFICULTY_LABELS } from '../../challenge/catalog'
import type { InteractionMode } from '../../challenge/types'
import Icon from '../icons/Icon'
import { MODE_LABELS, MODE_SENTENCES } from '../workbench/WorkbenchChrome'
import TechnicalArt from './TechnicalArt'

// Challenge detail drawer with the design-mode cards (task 13.5; Req 34.2–34.4, 35.4).
// Only an available catalog entry in a mode from the challenge's `allowedModes` can be
// opened. Preview challenges and Freeform show "Not available yet" with the action disabled;
// no result is computed or shown for them.

export const NOT_AVAILABLE_TEXT = 'Not available yet'

export interface ModeInfo {
  mode: InteractionMode
  icon: string
  /** Mode-card text on the library page. */
  summary: string
  /** Mode-choice text in the drawer. */
  detail: string
}

export const MODE_INFO: readonly ModeInfo[] = [
  {
    mode: 'guided',
    icon: 'tune',
    summary: 'Structured experiments: change one variable per step, then design freely.',
    detail: MODE_SENTENCES.guided,
  },
  {
    mode: 'parametric',
    icon: 'cube',
    summary: 'Open design: every parameter editable from the start.',
    detail: MODE_SENTENCES.parametric,
  },
  {
    mode: 'freeform',
    icon: 'plus',
    summary: 'Sketch, extrude, and edit geometry.',
    detail: 'Sketch and geometry tools',
  },
]

/** "Available" when the loaded challenge allows the mode, otherwise "Planned". */
export function modeStatus(mode: InteractionMode, allowedModes: readonly InteractionMode[]): 'Available' | 'Planned' {
  return allowedModes.includes(mode) ? 'Available' : 'Planned'
}

export interface ChallengeDrawerProps {
  entry: CatalogEntry
  /** True when this entry is linked to the loaded, runnable challenge. */
  runnable: boolean
  allowedModes: readonly InteractionMode[]
  mode: InteractionMode
  onModeChange: (mode: InteractionMode) => void
  onOpen: (mode: InteractionMode) => void
  onClose: () => void
  /** Shown when an open request was rejected (Req 35.4). */
  error: string | null
  /** Switches the drawer to the available challenge in Guided mode. */
  onFallback: () => void
  /** Model-specific description for a runnable entry (task 34.2); defaults to the beam text. */
  availableText?: string
}

const BEAM_AVAILABLE_TEXT = 'Available with an idealized beam solver. Length, load, material, and support remain fixed by the challenge.'

export default function ChallengeDrawer({
  entry,
  runnable,
  allowedModes,
  mode,
  onModeChange,
  onOpen,
  onClose,
  error,
  onFallback,
  availableText = BEAM_AVAILABLE_TEXT,
}: ChallengeDrawerProps) {
  const modeAllowed = allowedModes.includes(mode)
  const canOpen = runnable && modeAllowed
  return (
    <div className="detail-backdrop" onClick={onClose}>
      <aside
        className={`challenge-detail theme-${entry.art}`}
        role="dialog"
        aria-modal="true"
        aria-label={entry.title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close challenge details">
          ×
        </button>
        <div className="detail-art">
          <TechnicalArt kind={entry.art} />
        </div>
        <div className="detail-content">
          <div className="eyebrow">
            CHALLENGE {entry.id} · {entry.discipline.toUpperCase()}
            {!runnable && ' · PLANNED CHALLENGE'}
          </div>
          <h2>{entry.title}</h2>
          <p>{entry.description}</p>
          <div className="detail-meta">
            <span className="tag">{DIFFICULTY_LABELS[entry.difficulty]}</span>
            <span>
              <Icon name="clock" size={13} />
              {entry.time}
            </span>
          </div>
          <div className="detail-section">
            <h3>Topics</h3>
            {entry.concepts.map((c) => (
              <div className="detail-concept" key={c}>
                <Icon name="check" size={14} />
                {c}
              </div>
            ))}
          </div>
          <div className="detail-section">
            <h3>Choose how you design</h3>
            <p>Choose before opening. Your mode stays fixed while you work.</p>
            {MODE_INFO.map((m) => {
              const status = modeStatus(m.mode, allowedModes)
              return (
                <button
                  type="button"
                  className={`mode-choice ${mode === m.mode ? 'selected' : ''}`}
                  key={m.mode}
                  aria-pressed={mode === m.mode}
                  onClick={() => onModeChange(m.mode)}
                >
                  <Icon name={m.icon} size={18} />
                  <span>
                    <strong>{MODE_LABELS[m.mode]}</strong>
                    <small>
                      {m.detail}
                      {status === 'Planned' && ' · Planned'}
                    </small>
                  </span>
                  <span className="mode-radio" />
                </button>
              )
            })}
          </div>
          <div className="detail-scope">
            <Icon name="help" size={15} />
            <p>
              {!runnable
                ? 'This is a preview of the expanded challenge library. Its geometry tools and validated solver are not available yet.'
                : !modeAllowed
                  ? `${MODE_LABELS[mode]} requires a geometry kernel and additional validated analyzers. This mode is a preview, not an active CAD tool.`
                  : availableText}
            </p>
          </div>
          {error !== null && (
            <p className="detail-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="primary" disabled={!canOpen} onClick={() => onOpen(mode)}>
            {canOpen ? 'Open challenge' : NOT_AVAILABLE_TEXT}
            <Icon name="arrow" size={15} />
          </button>
          {!canOpen && (
            <button type="button" className="detail-fallback" onClick={onFallback}>
              Try the available guided challenge
              <Icon name="arrow" size={13} />
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
