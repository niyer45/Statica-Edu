import { selectLatestResult, selectStatusBadge } from '../../state/selectors'
import { formatMm, m4ToMm4 } from '../../units/units'
import Icon from '../icons/Icon'
import { useStore } from '../state/store'
import { formatConstraint, STATUS_LABELS } from './resultPresentation'

export default function RequirementsPanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useStore()
  const result = selectLatestResult(state)
  const { analysis, evaluation } = result
  const outside = evaluation.status === 'modelNotApplicable'
  const envelopePassed = evaluation.constraints.filter((c) => c.id === 'envelopeWidth' || c.id === 'envelopeHeight').every((c) => c.passed)
  const featurePassed = evaluation.constraints.find((c) => c.id === 'featureGeometry')!.passed
  return <>
    <div className="panel-title"><Icon name="book" size={16} /><h2>The challenge</h2><span className="challenge-number">01 / 01</span></div>
    <div className="challenge-body">
      <p>{ch.statement}</p>
      <p>Fixed by challenge: {ch.load.forceN} N downward · {ch.material.name} · {formatMm(ch.initialDesign.lengthM, 0)} mm span</p>
      <div className="section-heading requirements-title">DESIGN REQUIREMENTS <Icon name="lock" size={11} /></div>
      <ul aria-label="Design requirements">
        {evaluation.constraints.filter((c) => ['deflection', 'stress', 'mass'].includes(c.id)).map((c) => <li className="requirement" key={c.id}><span>{c.label}</span><strong>≤ {formatConstraint(c.limit, c.unit)}</strong><span className="pass-mark">{c.passed ? '✓ Pass' : '✗ Fail'}</span></li>)}
        <li className="requirement"><span>Section envelope</span><strong>{formatMm(ch.constraints.maxWidthM, 0)} × {formatMm(ch.constraints.maxHeightM, 0)} mm</strong><span className="pass-mark">{envelopePassed ? '✓ Pass' : '✗ Fail'}</span></li>
        <li className="requirement"><span>Min. feature size</span><span className="pass-mark">{featurePassed ? '✓ Pass' : '✗ Fail'}</span></li>
      </ul>
      <p className="draft-badge" aria-label="Test status">{selectStatusBadge(state)}</p>
      <div className="status-banner" aria-label="Result status"><span aria-hidden="true">{evaluation.accepted ? '✓' : '!'}</span> {STATUS_LABELS[evaluation.status]}</div>
      {outside && <ul aria-label="Model applicability reasons">{analysis.notApplicableReasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}</ul>}
      <table aria-label="Latest tested results"><thead><tr><th scope="col">Constraint</th><th scope="col">Value</th><th scope="col">Limit</th><th scope="col">Result</th></tr></thead>
        <tbody>{evaluation.constraints.map((c) => <tr key={c.id}><th scope="row">{c.label}</th><td>{formatConstraint(c.value, c.unit)}{outside && c.unit !== 'bool' && <small> Outside model assumptions</small>}</td><td>{c.unit === 'bool' ? '' : formatConstraint(c.limit, c.unit)}</td><td>{c.passed ? '✓ Pass' : '✗ Fail'}</td></tr>)}</tbody>
      </table>
      <ul aria-label="Model warnings">{analysis.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul>
      <div aria-label="Explanation facts">{evaluation.facts.map((fact) => <p key={fact.id}>{fact.text}</p>)}</div>
      {ch.content.collegeDetails && <details><summary>College details</summary><p>δ = FL³ / (3EI); σ = Mc / I</p><p>I_bend: {m4ToMm4(analysis.bendingInertiaM4).toFixed(2)} mm⁴; c: {formatMm(analysis.extremeFiberM)} mm</p><ul>{analysis.assumptions.map((text) => <li key={text}>{text}</li>)}</ul></details>}
      {state.draftErrors.length > 0 && <ul aria-label="Design errors">{state.draftErrors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
      {state.ui.notice?.kind === 'error' && <p role="alert">{state.ui.notice.message}</p>}
      <div className="insight"><Icon name="bulb" size={18} /><button type="button" onClick={onOpenHelp}>Section stiffness reference <Icon name="arrow" size={12} /></button></div>
    </div>
    <div className="test-action"><button type="button" className="primary run-test" onClick={runTest}><Icon name="play" size={15} />Run Test</button></div>
  </>
}
