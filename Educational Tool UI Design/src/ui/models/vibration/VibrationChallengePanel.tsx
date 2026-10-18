import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { formatVibration, useVibrationStore } from './shared'

// Vibration challenge panel (task 50.3, decluttered in task 56; VIB-06, VIB-07, VIB-10). The goal,
// stored pass/fail checks, applicability reasons and warnings are in the goal card at the top of
// the design view (VibrationGoal); this panel keeps the full statement (collapsed), the
// table-only Test details disclosure (D-30), draft errors, the reference link and Run Test.

export default function VibrationChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useVibrationStore()
  const latest = state.history[state.history.length - 1]!
  const { evaluation } = latest
  return (
    <>
      <div className="panel-title">
        <Icon name="book" size={16} />
        <h2>The challenge</h2>
      </div>
      <div className="challenge-body model-challenge-body">
        <details className="result-details challenge-brief">
          <summary>Full brief and model assumptions</summary>
          <p>{ch.statement}</p>
        </details>
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
