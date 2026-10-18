import { HEAT_SINK_COMPARISON_METRICS } from '../../../evaluation/heatSink/metrics'
import Icon from '../../icons/Icon'
import { STATUS_LABELS } from '../../panels/resultPresentation'
import { formatConstraint, formatLimit, METRIC_DISPLAY, useHeatSinkStore } from './shared'

// Heat sink challenge panel (task 48.3; HSK-06, HSK-07, HSK-10). Mirrors the beam and torsion
// panels: the statement, the stored value/limit summary of the latest test (base temperature in
// °C; the fin gap is a minimum), applicability reasons/warnings, a table-only Test details
// disclosure (D-30) with every stored thermal metric, draft errors and Run Test.

export default function HeatSinkChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useHeatSinkStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  return (
    <>
      <div className="panel-title">
        <Icon name="book" size={16} />
        <h2>The challenge</h2>
      </div>
      <div className="challenge-body">
        <p>{ch.statement}</p>
        <div className="section-heading requirements-title">
          VALUE / LIMIT <Icon name="lock" size={11} />
        </div>
        <ul aria-label="Design requirements">
          {shown.map((c) => (
            <li className="requirement" key={c.id}>
              <span>{c.label}</span>
              <strong>
                <span>{formatConstraint(c.id, c.value)}</span> / <span>{formatLimit(c)}</span>
                {outside && <small>Outside model assumptions</small>}
              </strong>
              <span className={c.passed ? 'pass-mark' : 'fail-mark'}>{c.passed ? '✓ Pass' : '✗ Fail'}</span>
            </li>
          ))}
        </ul>
        {outside && (
          <ul aria-label="Model applicability reasons">
            {analysis.notApplicableReasons.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
        )}
        <ul aria-label="Model warnings">
          {analysis.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
        <details className="result-details">
          <summary>Test details</summary>
          <table aria-label="Latest tested results">
            <thead>
              <tr>
                <th scope="col">Constraint</th>
                <th scope="col">Value</th>
                <th scope="col">Limit</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.constraints.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.label}</th>
                  <td>{formatConstraint(c.id, c.value)}</td>
                  <td>{c.unit === 'bool' ? '' : formatLimit(c)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested thermal metrics">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {HEAT_SINK_COMPARISON_METRICS.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.label}</th>
                  <td>{METRIC_DISPLAY[m.id].value(analysis[m.id])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Status: {STATUS_LABELS[evaluation.status]}</p>
        </details>
        {state.draftErrors.length > 0 && (
          <ul aria-label="Design errors">
            {state.draftErrors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        )}
        {state.ui.notice?.kind === 'error' && <p role="alert">{state.ui.notice.message}</p>}
        <div className="insight">
          <Icon name="bulb" size={18} />
          <button type="button" onClick={onOpenHelp}>
            Fin heat transfer reference <Icon name="arrow" size={12} />
          </button>
        </div>
      </div>
      <div className="test-action">
        <button type="button" className="primary run-test" onClick={runTest}>
          <Icon name="play" size={15} />
          Run Test
        </button>
      </div>
    </>
  )
}
