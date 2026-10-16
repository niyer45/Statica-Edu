import { useId, useState, type KeyboardEvent } from 'react'
import { compareResults, explainChange, SECTION_KIND_NAMES } from '../../evaluation/explain'
import type { TestResult } from '../../state/session'
import Icon from '../icons/Icon'
import SectionIcon from '../icons/SectionIcon'
import ImportExportBar from '../panels/ImportExportBar'
import { formatConstraint, STATUS_LABELS } from '../panels/resultPresentation'
import { useStore } from '../state/store'

const label = (r: TestResult) => r.iteration === 0 ? 'Baseline' : `Iteration ${r.iteration}`
const signed = (value: number, unit: 'm' | 'Pa' | 'kg') => `${value > 0 ? '+' : ''}${formatConstraint(value, unit)}`
export default function HistoryCompare() {
  const { state: s, dispatch } = useStore()
  const [tab, setTab] = useState<'history' | 'compare'>('history')
  const [selectedId, setSelectedId] = useState<string>()
  const id = useId()
  const selected = s.history.find((r) => r.id === selectedId) ?? s.history[s.history.length - 1]!
  const compared = s.history.filter((r) => r.iteration === 0 || s.compareSelection.includes(r.id))
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'history' : event.key === 'End' ? 'compare' : tab === 'history' ? 'compare' : 'history'
    setTab(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }
  const previous = selected.iteration > 0 ? s.history[selected.iteration - 1]! : undefined
  const facts = previous ? explainChange(previous, selected) : selected.evaluation.facts
  return <>
    <div className="results-header"><div className="result-tabs" role="tablist" aria-label="Results view">
      {(['history', 'compare'] as const).map((value) => <button key={value} type="button" id={`${id}-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${id}-panel-${value}`} tabIndex={tab === value ? 0 : -1} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} onKeyDown={keys}>{value === 'history' ? 'Design history' : 'Compare results'}</button>)}
    </div><ImportExportBar /></div>
    <div id={`${id}-panel-history`} role="tabpanel" aria-labelledby={`${id}-history`} hidden={tab !== 'history'} className="results-content">
      <div className="iteration-list">{s.history.map((r) => <div className={`iteration ${r.id === selected.id ? 'active' : ''}`} key={r.id}>
        <span className="iteration-symbol"><SectionIcon kind={r.designSnapshot.section.kind} /></span>
        <div className="iteration-copy"><button type="button" className="iteration-select" aria-pressed={r.id === selected.id} onClick={() => setSelectedId(r.id)}><strong>{label(r)}</strong><small>{SECTION_KIND_NAMES[r.designSnapshot.section.kind]}</small></button>
          <span className={r.evaluation.accepted ? 'status-pass' : 'status-fail'}>{r.evaluation.accepted ? '✓' : '!'} {STATUS_LABELS[r.evaluation.status]}</span>
          <label className="iteration-compare"><input type="checkbox" checked={r.iteration === 0 || s.compareSelection.includes(r.id)} disabled={r.iteration === 0} onChange={() => dispatch({ type: 'toggleCompare', testResultId: r.id })} /><span className="sr-only">Compare {label(r)}{r.iteration === 0 && ' (always included)'}</span></label>
          <button type="button" onClick={() => dispatch({ type: 'restore', testResultId: r.id })} aria-label={`Restore ${label(r)}`}>Restore</button>
        </div>
      </div>)}</div>
      <div className="analysis-results"><div className="analysis-heading"><span>{label(selected)} results</span><span aria-label="Result status" className={selected.evaluation.accepted ? 'status-pass' : 'status-fail'}>{selected.evaluation.accepted ? '✓' : '!'} {STATUS_LABELS[selected.evaluation.status]}</span></div><div className="metrics">
        {selected.evaluation.constraints.filter((c) => ['deflection', 'stress', 'mass'].includes(c.id)).map((c) => <div className="metric" key={c.id}><div>{c.label}</div><strong>{formatConstraint(c.value, c.unit).split(' ')[0]}<span>{formatConstraint(c.value, c.unit).split(' ').slice(1).join(' ')}</span></strong><small>{c.passed ? 'Pass' : 'Fail'} · Limit: {formatConstraint(c.limit, c.unit)}{selected.evaluation.status === 'modelNotApplicable' && ' · Outside model assumptions'}</small></div>)}
      </div><details className="history-details"><summary>Test details</summary>
        {selected.predictionOutcome && <p>Prediction: {selected.predictionOutcome.predicted} · Actual: {selected.predictionOutcome.actual} · {selected.predictionOutcome.matched ? 'Matched' : 'Did not match'}</p>}
        <ul aria-label={`${label(selected)} constraints`}>{selected.evaluation.constraints.map((c) => <li key={c.id}>{c.label}: {c.passed ? 'Pass' : 'Fail'}</li>)}</ul>
        <div className="result-explanation"><Icon name="bulb" size={15} /><div>{facts.map((fact) => <p key={fact.id}>{fact.text}</p>)}</div></div>
      </details></div>
    </div>
    <div id={`${id}-panel-compare`} role="tabpanel" aria-labelledby={`${id}-compare`} hidden={tab !== 'compare'} className="comparison-content">
      <p className="comparison-hint">Baseline + up to 3 iterations</p><div className="comparison-grid">
      {compared.map((r) => {
        const baseline = r.iteration > 0 ? compareResults(s.history[0]!, r) : undefined
        const prev = r.iteration > 0 ? compareResults(s.history[r.iteration - 1]!, r) : undefined
        return <section className="comparison-card" key={r.id} aria-label={`Compare ${label(r)}`}><header><h3>{label(r)}</h3><span className={r.evaluation.accepted ? 'status-pass' : 'status-fail'}>{r.evaluation.accepted ? '✓' : '!'} {STATUS_LABELS[r.evaluation.status]}</span></header>
          {r.evaluation.status === 'modelNotApplicable' && <p>Outside model assumptions</p>}
          <table aria-label={`${label(r)} differences`}><thead><tr><th>Metric</th><th>Value</th><th>Δ vs Baseline</th><th>Δ vs previous iteration</th></tr></thead><tbody>
            {([['massKg', 'Mass', 'kg'], ['tipDeflectionM', 'Tip deflection', 'm'], ['nominalMaxStressPa', 'Bending stress', 'Pa']] as const).map(([key, name, unit]) => <tr key={key}><th scope="row">{name}</th><td>{formatConstraint(r.analysis[key], unit)}</td><td>{baseline ? signed(baseline.metrics[key].delta, unit) : '—'}</td><td>{prev ? signed(prev.metrics[key].delta, unit) : '—'}</td></tr>)}
          </tbody></table>
          {r.iteration > 0 && <details className="comparison-details"><summary>Constraint changes</summary>
          {([['Baseline', baseline], ['previous iteration', prev]] as const).map(([name, delta]) => delta && <div key={name}><p>Section type vs {name}: {delta.section.changed ? 'changed' : 'unchanged'}</p><ul>{r.evaluation.constraints.map((c) => {
            const old = (name === 'Baseline' ? s.history[0]! : s.history[r.iteration - 1]!).evaluation.constraints.find((v) => v.id === c.id)!
            return <li key={c.id}>{c.label}: {old.passed ? 'Pass' : 'Fail'} → {c.passed ? 'Pass' : 'Fail'}</li>
          })}</ul></div>)}
          </details>}
        </section>
      })}</div>
    </div>
    {s.ui.notice && <p>{s.ui.notice.message}</p>}
  </>
}
