import { useId, useState, type KeyboardEvent } from 'react'
import type { BracketChallenge } from '../../../challenge/bracket/types'
import { explainBracketChange } from '../../../evaluation/bracket/explain'
import { BRACKET_COMPARISON_METRICS, type BracketMetricId } from '../../../evaluation/bracket/metrics'
import { isUniformBar, type BracketDesign } from '../../../geometry/bracket/design'
import { bracketModel } from '../../../state/bracketModel'
import { selectVisibleHistory } from '../../../state/selectors'
import { useAnnounce } from '../../a11y/useAnnouncements'
import Dialog from '../../dialogs/Dialog'
import Icon from '../../icons/Icon'
import { STATUS_LABELS } from '../../panels/resultPresentation'
import { designLabel, formatBracket, formatOptional, LOCATION_LABELS, NOT_APPLICABLE, useBracketStore, type BracketDisplayUnit } from './shared'

// Bracket history and comparison (task 46.3; MBR-07, MBR-09, MBR-18, MM-13, MM-14, MM-19). Same
// list/detail layout, compare limit, restore and confirmed deletion as the beam and torsion
// (D-29–D-31), with the model's stored metrics and grounded change facts. Absent stored values
// (no step, Kt fit undefined) are words, never numbers. Design files use the v2 format.

const METRIC_UNITS: Readonly<Record<BracketMetricId, BracketDisplayUnit>> = {
  peakStressPa: 'Pa',
  ktStep: 'ratio',
  rootStressPa: 'Pa',
  stepNominalStressPa: 'Pa',
  stepPeakStressPa: 'Pa',
  tipDeflectionM: 'm',
  massKg: 'kg',
  envelopeDepthM: 'm',
}

const label = (iteration: number) => (iteration === 0 ? 'Baseline' : `Iteration ${iteration}`)

/** Decorative stepped-bar glyph for history rows. */
function BracketGlyph({ design }: { design: Readonly<BracketDesign> }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" focusable="false" className="bracket-glyph">
      <path d={isUniformBar(design) ? 'M3 4v16M3 9h18v6H3' : 'M3 4v16M3 7h9v3h9v4h-9v3H3'} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  )
}

function DesignFiles() {
  const { state, challenge, dispatch } = useBracketStore()
  const announce = useAnnounce()
  const [errors, setErrors] = useState<string[]>([])
  const ch = challenge as BracketChallenge
  const exportFile = () => {
    try {
      const url = URL.createObjectURL(new Blob([bracketModel.exportDesign(state.draft, ch)], { type: 'application/json' }))
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
            const result = text === null ? { ok: false as const, error: ['The design file could not be read.'] } : bracketModel.importDesign(text, ch)
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

export default function BracketResults() {
  const { state: s, dispatch } = useBracketStore()
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
  const facts = previous ? explainBracketChange(previous, selected) : selected.evaluation.facts
  const outcome = selected.predictionOutcome
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'history' : event.key === 'End' ? 'compare' : tab === 'history' ? 'compare' : 'history'
    setTab(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }
  const delta = (value: number | undefined, base: number | undefined, unit: BracketDisplayUnit) => {
    if (value === undefined || base === undefined) return '—'
    const d = value - base
    return `${d > 0 ? '+' : d < 0 ? '−' : ''}${formatBracket(Math.abs(d), unit)}`
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
                <BracketGlyph design={r.designSnapshot} />
              </span>
              <div className="iteration-copy">
                <button type="button" className="iteration-select" aria-pressed={r.id === selected.id} onClick={() => setSelectedId(r.id)}>
                  <strong>{label(r.iteration)}</strong>
                  <small>{designLabel(r.designSnapshot)}</small>
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
          <div className="metrics">
            {selected.evaluation.constraints
              .filter((c) => c.unit !== 'bool')
              .map((c) => (
                <div className="metric" key={c.id}>
                  <div>{c.label}</div>
                  <strong>{c.value !== undefined ? formatBracket(c.value, c.unit) : NOT_APPLICABLE}</strong>
                  <small>
                    {c.passed ? 'Pass' : 'Fail'} · Limit: {formatBracket(c.limit, c.unit)}
                    {c.id === 'peakStress' && selected.analysis.peakLocation !== undefined && ` · At the ${selected.analysis.peakLocation}`}
                    {selected.evaluation.status === 'modelNotApplicable' && ' · Outside model assumptions'}
                  </small>
                </div>
              ))}
          </div>
          <details className="history-details">
            <summary>Test details</summary>
            {outcome && (
              <p>
                {outcome.scorable
                  ? `Prediction: ${outcome.predicted} · Actual: ${outcome.actual} · ${outcome.matched ? 'Matched' : 'Did not match'}`
                  : `Prediction: ${outcome.predicted} · Not scorable: no peak stress to compare`}
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
                <BracketGlyph design={r.designSnapshot} />
              </span>
              <div className="iteration-copy">
                <button type="button" className="iteration-select" aria-pressed={r.id === active.id} onClick={() => setCompareId(r.id)}>
                  <strong>{label(r.iteration)}</strong>
                  <small>{designLabel(r.designSnapshot)}</small>
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
                    <tr>
                      <th scope="row">peak location</th>
                      <td className="comparison-value">{r.analysis.peakLocation !== undefined ? LOCATION_LABELS[r.analysis.peakLocation] : NOT_APPLICABLE}</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                    {BRACKET_COMPARISON_METRICS.map((m) => {
                      const unit = METRIC_UNITS[m.id]
                      const v = m.read(r.analysis)
                      return (
                        <tr key={m.id}>
                          <th scope="row">{m.label}</th>
                          <td className="comparison-value">{formatOptional(v, unit, r.designSnapshot)}</td>
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
