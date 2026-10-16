import { useId, useState, type KeyboardEvent } from 'react'
import { compareResults, explainChange, SECTION_KIND_NAMES } from '../../evaluation/explain'
import type { TestResult } from '../../state/session'
import { formatMm, paToMpa } from '../../units/units'
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
        <div><button type="button" onClick={() => setSelectedId(r.id)}>{label(r)}</button><small>{SECTION_KIND_NAMES[r.designSnapshot.section.kind]}</small><p>{STATUS_LABELS[r.evaluation.status]}</p>
          <p>{r.evaluation.status === 'modelNotApplicable' && 'Outside model assumptions: '}{r.analysis.massKg.toFixed(3)} kg · {formatMm(r.analysis.tipDeflectionM)} mm · {paToMpa(r.analysis.nominalMaxStressPa).toFixed(1)} MPa</p>
          <p>{r.predictionOutcome ? `Predicted ${r.predictionOutcome.predicted}; actual ${r.predictionOutcome.actual}; ${r.predictionOutcome.matched ? 'matched' : 'did not match'}` : 'no prediction'}</p>
          <ul aria-label={`${label(r)} constraints`}>{r.evaluation.constraints.map((c) => <li key={c.id}>{c.label}: {c.passed ? 'Pass' : 'Fail'}</li>)}</ul>
          <label><input type="checkbox" checked={r.iteration === 0 || s.compareSelection.includes(r.id)} disabled={r.iteration === 0} onChange={() => dispatch({ type: 'toggleCompare', testResultId: r.id })} />Compare {label(r)}{r.iteration === 0 && ' (always included)'}</label>
          <button type="button" onClick={() => dispatch({ type: 'restore', testResultId: r.id })}>Restore {label(r)}</button>
        </div>
      </div>)}</div>
      <div className="analysis-results"><div className="analysis-heading">{label(selected)} results</div><div className="metrics">
        {selected.evaluation.constraints.filter((c) => ['deflection', 'stress', 'mass'].includes(c.id)).map((c) => <div className="metric" key={c.id}><div>{c.label}</div><strong>{formatConstraint(c.value, c.unit)}</strong><small>{c.passed ? 'Pass' : 'Fail'} · Limit: {formatConstraint(c.limit, c.unit)}{selected.evaluation.status === 'modelNotApplicable' && ' · Outside model assumptions'}</small></div>)}
      </div><div className="result-explanation"><Icon name="bulb" size={15} /><div>{facts.map((fact) => <p key={fact.id}>{fact.text}</p>)}</div></div></div>
    </div>
    <div id={`${id}-panel-compare`} role="tabpanel" aria-labelledby={`${id}-compare`} hidden={tab !== 'compare'}>
      <p>Baseline is always included. Select up to three iterations in Design history.</p>
      {compared.map((r) => {
        const baseline = r.iteration > 0 ? compareResults(s.history[0]!, r) : undefined
        const prev = r.iteration > 0 ? compareResults(s.history[r.iteration - 1]!, r) : undefined
        return <section key={r.id} aria-label={`Compare ${label(r)}`}><h3>{label(r)} · {STATUS_LABELS[r.evaluation.status]}</h3>
          {r.evaluation.status === 'modelNotApplicable' && <p>Outside model assumptions</p>}
          <table aria-label={`${label(r)} differences`}><thead><tr><th>Metric</th><th>Value</th><th>Δ vs Baseline</th><th>Δ vs previous iteration</th></tr></thead><tbody>
            {([['massKg', 'Mass', 'kg'], ['tipDeflectionM', 'Tip deflection', 'm'], ['nominalMaxStressPa', 'Bending stress', 'Pa']] as const).map(([key, name, unit]) => <tr key={key}><th scope="row">{name}</th><td>{formatConstraint(r.analysis[key], unit)}</td><td>{baseline ? signed(baseline.metrics[key].delta, unit) : '—'}</td><td>{prev ? signed(prev.metrics[key].delta, unit) : '—'}</td></tr>)}
          </tbody></table>
          {([['Baseline', baseline], ['previous iteration', prev]] as const).map(([name, delta]) => delta && <div key={name}><p>Section type vs {name}: {delta.section.changed ? 'changed' : 'unchanged'}</p><ul>{r.evaluation.constraints.map((c) => {
            const old = (name === 'Baseline' ? s.history[0]! : s.history[r.iteration - 1]!).evaluation.constraints.find((v) => v.id === c.id)!
            return <li key={c.id}>{c.label}: {old.passed ? 'Pass' : 'Fail'} → {c.passed ? 'Pass' : 'Fail'}</li>
          })}</ul></div>)}
        </section>
      })}
    </div>
    {s.ui.notice && <p>{s.ui.notice.message}</p>}
  </>
}
