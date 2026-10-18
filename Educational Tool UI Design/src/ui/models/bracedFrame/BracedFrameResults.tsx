import { useId, useState, type KeyboardEvent } from 'react'
import type { BracedFrameChallenge } from '../../../challenge/bracedFrame/types'
import { explainBracedFrameChange } from '../../../evaluation/bracedFrame/explain'
import { BRACED_FRAME_COMPARISON_METRICS, type BracedFrameMetricId } from '../../../evaluation/bracedFrame/metrics'
import type { BracedFrameDesign } from '../../../geometry/bracedFrame/design'
import { bracedFrameModel } from '../../../state/bracedFrameModel'
import { selectVisibleHistory } from '../../../state/selectors'
import { useAnnounce } from '../../a11y/useAnnouncements'
import Dialog from '../../dialogs/Dialog'
import Icon from '../../icons/Icon'
import { STATUS_LABELS } from '../../panels/resultPresentation'
import { boolText, bracingSummary, CHECK_LABELS, constraintRows, formatFrame, NOT_APPLICABLE, useFrameStore } from './shared'

// Braced frame history and comparison (task 49.3; BFR-06, BFR-08, MM-13, MM-14, MM-19). Same
// list/detail layout, compare limit, restore and confirmed deletion as the beam and torsion
// (D-29–D-31), with the frame's stored metrics and grounded change facts. A mechanism's roof
// drift and utilization are shown as not applicable, and a prediction that involves one is
// reported as not scorable. Design files use the v2 format.

const METRIC_UNITS = { roofDriftM: 'm', maxUtilization: 'ratio', massKg: 'kg', floorDriftM: 'm' } as const satisfies Partial<Record<BracedFrameMetricId, string>>
type ShownMetric = keyof typeof METRIC_UNITS
const SHOWN = BRACED_FRAME_COMPARISON_METRICS.filter((m): m is (typeof m) & { id: ShownMetric } => m.id in METRIC_UNITS)

const label = (iteration: number) => (iteration === 0 ? 'Baseline' : `Iteration ${iteration}`)

/** Small decorative glyph of the bracing pattern (aria-hidden; the text summary is the equivalent). */
function FrameGlyph({ design }: { design: Readonly<BracedFrameDesign> }) {
  const m = design.members
  return (
    <svg viewBox="0 0 16 24" aria-hidden="true" className="frame-glyph">
      <rect x={2} y={2} width={12} height={20} />
      <line x1={2} y1={12} x2={14} y2={12} />
      {m.diag1a.present && <line x1={2} y1={22} x2={14} y2={12} />}
      {m.diag1b.present && <line x1={14} y1={22} x2={2} y2={12} />}
      {m.diag2a.present && <line x1={2} y1={12} x2={14} y2={2} />}
      {m.diag2b.present && <line x1={14} y1={12} x2={2} y2={2} />}
    </svg>
  )
}

function DesignFiles() {
  const { state, challenge, dispatch } = useFrameStore()
  const announce = useAnnounce()
  const [errors, setErrors] = useState<string[]>([])
  const ch = challenge as BracedFrameChallenge
  const exportFile = () => {
    try {
      const url = URL.createObjectURL(new Blob([bracedFrameModel.exportDesign(state.draft, ch)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${ch.id}-design.json`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setErrors(['The design file could not be downloaded in this browser.'])
    }
  }
  return (
    <div className="history-note">
      <span className="tiny-dot" />
      Local design files
      <button type="button" title="Export current design" aria-label="Export design" onClick={exportFile}>
        <Icon name="download" size={15} />
      </button>
      <label className="design-import">
        Import design
        <input
          className="sr-only"
          type="file"
          aria-label="Import design"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            const text = await file.text().catch(() => null)
            const result = text === null ? { ok: false as const, error: ['The design file could not be read.'] } : bracedFrameModel.importDesign(text, ch)
            if (!result.ok) {
              setErrors(result.error)
              announce(`Design import rejected: ${result.error.join(' ')}`)
              return
            }
            dispatch({ type: 'importDesign', json: text })
            announce('Design imported. Run Test to record its results.')
          }}
        />
      </label>
      {errors.length > 0 && (
        <Dialog title="Design could not be imported" icon="book" onClose={() => setErrors([])}>
          <ul aria-label="Import error reasons">
            {errors.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setErrors([])}>
            Back to design
          </button>
        </Dialog>
      )}
    </div>
  )
}

function Status({ status, accepted }: { status: keyof typeof STATUS_LABELS; accepted: boolean }) {
  return <span className={accepted ? 'status-pass' : 'status-fail'}>{accepted ? '✓ ' : status === 'modelNotApplicable' ? '! ' : ''}{STATUS_LABELS[status]}</span>
}

export default function BracedFrameResults() {
  const { state: s, dispatch } = useFrameStore()
  const [tab, setTab] = useState<'history' | 'compare'>('history')
  const [selectedId, setSelectedId] = useState<string>()
  const [compareId, setCompareId] = useState<string>()
  const [deleteId, setDeleteId] = useState<string>()
  const id = useId()
  const visible = selectVisibleHistory(s)
  const selected = visible.find((r) => r.id === selectedId) ?? visible[visible.length - 1]!
  const compared = visible.filter((r) => r.iteration === 0 || s.compareSelection.includes(r.id))
  const active = compared.find((r) => r.id === compareId) ?? compared[compared.length - 1]!
  const deleting = visible.find((r) => r.id === deleteId)
  const previous = selected.iteration > 0 ? s.history[selected.iteration - 1]! : undefined
  const facts = previous ? explainBracedFrameChange(previous, selected) : selected.evaluation.facts
  const outcome = selected.predictionOutcome
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'history' : event.key === 'End' ? 'compare' : tab === 'history' ? 'compare' : 'history'
    setTab(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }
  const delta = (value: number | undefined, base: number | undefined, unit: (typeof METRIC_UNITS)[ShownMetric]) => {
    if (value === undefined || base === undefined) return NOT_APPLICABLE
    const d = value - base
    return `${d > 0 ? '+' : d < 0 ? '−' : ''}${formatFrame(Math.abs(d), unit)}`
  }
  return (
    <>
      <div className="results-header">
        <div className="result-tabs" role="tablist" aria-label="Results view">
          {(['history', 'compare'] as const).map((value) => (
            <button key={value} type="button" id={`${id}-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${id}-panel-${value}`} tabIndex={tab === value ? 0 : -1} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} onKeyDown={keys}>
              {value === 'history' ? 'Design history' : 'Compare results'}
            </button>
          ))}
        </div>
        <DesignFiles />
      </div>
      <div id={`${id}-panel-history`} role="tabpanel" aria-labelledby={`${id}-history`} hidden={tab !== 'history'} className="results-content">
        <div className="iteration-list">
          {visible.map((r) => (
            <div className={`iteration ${r.id === selected.id ? 'active' : ''}`} key={r.id}>
              <span className="iteration-symbol">
                <FrameGlyph design={r.designSnapshot} />
              </span>
              <div className="iteration-copy">
                <button type="button" className="iteration-select" aria-pressed={r.id === selected.id} onClick={() => setSelectedId(r.id)}>
                  <strong>{label(r.iteration)}</strong>
                  <small>{bracingSummary(r.designSnapshot)}</small>
                </button>
                <Status status={r.evaluation.status} accepted={r.evaluation.accepted} />
                <label className="iteration-compare">
                  <input type="checkbox" checked={r.iteration === 0 || s.compareSelection.includes(r.id)} disabled={r.iteration === 0} onChange={() => dispatch({ type: 'toggleCompare', testResultId: r.id })} />
                  <span className="sr-only">
                    Compare {label(r.iteration)}
                    {r.iteration === 0 && ' (always included)'}
                  </span>
                </label>
                <button type="button" className="restore-iteration" onClick={() => dispatch({ type: 'restore', testResultId: r.id })} aria-label={`Restore ${label(r.iteration)}`}>
                  Restore
                </button>
                {r.iteration > 0 && (
                  <button type="button" className="delete-iteration" aria-label={`Delete ${label(r.iteration)}`} onClick={() => setDeleteId(r.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="analysis-results">
          <div className="analysis-heading">
            <span>{label(selected.iteration)} results</span>
            <span aria-label="Result status">
              <Status status={selected.evaluation.status} accepted={selected.evaluation.accepted} />
            </span>
          </div>
          <div className="metrics frame-metrics">
            {constraintRows(selected.evaluation).map(({ id: cid, result: c }) =>
              cid === 'applicability' ? null : (
                <div className="metric" key={cid}>
                  <div>{CHECK_LABELS[cid]}</div>
                  {c === undefined ? (
                    <>
                      <strong>{NOT_APPLICABLE}</strong>
                      <small>Not defined: the frame is a mechanism</small>
                    </>
                  ) : (
                    <>
                      <strong>{c.unit === 'bool' ? boolText(c) : formatFrame(c.value, c.unit)}</strong>
                      <small>
                        {c.passed ? 'Pass' : 'Fail'}
                        {c.unit !== 'bool' && ` · Limit: ${formatFrame(c.limit, c.unit)}`}
                        {selected.evaluation.status === 'modelNotApplicable' && c.unit !== 'bool' && ' · Outside model assumptions'}
                      </small>
                    </>
                  )}
                </div>
              ),
            )}
          </div>
          <details className="history-details">
            <summary>Test details</summary>
            {outcome && (
              <p>
                {outcome.scorable
                  ? `Prediction: ${outcome.predicted} · Actual: ${outcome.actual} · ${outcome.matched ? 'Matched' : 'Did not match'}`
                  : `Prediction: ${outcome.predicted} · Not scorable: roof drift is not defined for a mechanism`}
              </p>
            )}
            <div className="result-explanation">
              <Icon name="bulb" size={15} />
              <div>
                {facts.map((f) => (
                  <p key={f.id}>{f.text}</p>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
      <div id={`${id}-panel-compare`} role="tabpanel" aria-labelledby={`${id}-compare`} hidden={tab !== 'compare'} className="results-content comparison-content">
        <div className="iteration-list" aria-label="Compared designs">
          {compared.map((r) => (
            <div className={`iteration ${r.id === active.id ? 'active' : ''}`} key={r.id}>
              <span className="iteration-symbol">
                <FrameGlyph design={r.designSnapshot} />
              </span>
              <div className="iteration-copy">
                <button type="button" className="iteration-select" aria-pressed={r.id === active.id} onClick={() => setCompareId(r.id)}>
                  <strong>{label(r.iteration)}</strong>
                  <small>{bracingSummary(r.designSnapshot)}</small>
                </button>
                <Status status={r.evaluation.status} accepted={r.evaluation.accepted} />
              </div>
            </div>
          ))}
        </div>
        <div className="analysis-results comparison-selection">
          {compared.map((r) => {
            const base = s.history[0]!
            const prev = r.iteration > 0 ? s.history[r.iteration - 1]! : undefined
            return (
              <section className="comparison-card" hidden={r.id !== active.id} key={r.id} aria-label={`Compare ${label(r.iteration)}`}>
                <header>
                  <h3>{label(r.iteration)}</h3>
                  <Status status={r.evaluation.status} accepted={r.evaluation.accepted} />
                </header>
                <table aria-label={`${label(r.iteration)} differences`}>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Δ vs Baseline</th>
                      <th>Δ vs previous iteration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHOWN.map((m) => {
                      const unit = METRIC_UNITS[m.id]
                      const v = m.read(r.analysis)
                      return (
                        <tr key={m.id}>
                          <th scope="row">{m.label}</th>
                          <td className="comparison-value">{v === undefined ? NOT_APPLICABLE : formatFrame(v, unit)}</td>
                          <td>{r.iteration > 0 ? delta(v, m.read(base.analysis), unit) : '—'}</td>
                          <td>{prev ? delta(v, m.read(prev.analysis), unit) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      </div>
      {deleting && (
        <Dialog title={`Delete ${label(deleting.iteration)}?`} onClose={() => setDeleteId(undefined)}>
          <p>Remove this iteration from design history and comparisons? Your current design and last test stay unchanged.</p>
          {s.submission?.testResultId === deleting.id && <p>This will also remove its recorded submission.</p>}
          <button type="button" className="primary modal-primary" onClick={() => { dispatch({ type: 'deleteIteration', testResultId: deleting.id }); setDeleteId(undefined) }}>
            Delete iteration
          </button>
          <button type="button" className="delete-cancel" onClick={() => setDeleteId(undefined)}>
            Cancel
          </button>
        </Dialog>
      )}
    </>
  )
}
