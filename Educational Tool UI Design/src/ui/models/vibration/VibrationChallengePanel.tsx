import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { CHECK_LABELS, formatVibration, useVibrationStore } from './shared'

// Vibration challenge panel (task 50.3; task 56 follow-up: same structure and styling as
// Cantilever Beam I's RequirementsPanel; VIB-06, VIB-07, VIB-10). The visible statement, the
// stored value/limit list of the latest test with Pass/Fail marks (short check names; full
// labels in Test details), applicability reasons/warnings, a table-only Test details disclosure
// (D-30), draft errors, the reference link and Run Test.

export default function VibrationChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useVibrationStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  return (
    <>
      <div className="panel-title">
        <Icon name="book" size={16} />
        <h2>The challenge</h2>
        <span className="challenge-number">01 / 01</span>
      </div>
      <div className="challenge-body">
        <p>{ch.statement}</p>
        <div className="section-heading requirements-title">
          VALUE / LIMIT <Icon name="lock" size={11} />
        </div>
        <ul aria-label="Design requirements">
          {evaluation.constraints.map((c) =>
            c.id === 'applicability' ? null : (
              <li className="requirement" key={c.id}>
                <span>{CHECK_LABELS[c.id]}</span>
                <strong>
                  <span>{formatVibration(c.value, c.unit)}</span> / <span>{formatVibration(c.limit, c.unit)}</span>
                  {outside && <small>Outside model assumptions</small>}
                </strong>
                <span className={c.passed ? 'pass-mark' : 'fail-mark'}>{c.passed ? '✓ Pass' : '✗ Fail'}</span>
              </li>
            ),
          )}
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
                  <td>{formatVibration(c.value, c.unit)}</td>
                  <td>{c.unit === 'bool' ? '' : formatVibration(c.limit, c.unit)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
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
            Vibration isolation reference <Icon name="arrow" size={12} />
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
