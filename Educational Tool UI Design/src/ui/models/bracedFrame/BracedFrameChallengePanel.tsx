import { BRACED_FRAME_CONSTRAINT_LABELS } from '../../../evaluation/bracedFrame/constraints'
import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { boolText, constraintRows, formatFrame, NOT_APPLICABLE, useFrameStore } from './shared'

// Braced frame challenge panel (task 49.3, decluttered in task 56; BFR-06, BFR-07, MM-10, MM-11).
// The goal and the stored pass/fail checks are in the goal card at the top of the design view
// (BracedFrameGoal), so this panel keeps only: the full challenge statement with the pin-jointed
// idealization (collapsed), the table-only Test details disclosure (D-30), draft errors, the
// reference link and Run Test. For a mechanism, roof drift and utilization are not defined: they
// are shown as "Not applicable", never as numbers or as failed.

export default function BracedFrameChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useFrameStore()
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
              {constraintRows(evaluation).map(({ id, result: c }) => (
                <tr key={id}>
                  <th scope="row">{BRACED_FRAME_CONSTRAINT_LABELS[id]}</th>
                  {c === undefined ? (
                    <>
                      <td>{NOT_APPLICABLE}</td>
                      <td />
                      <td>Not defined (mechanism)</td>
                    </>
                  ) : (
                    <>
                      <td>{c.unit === 'bool' ? boolText(c) : formatFrame(c.value, c.unit)}</td>
                      <td>{c.unit === 'bool' ? '' : formatFrame(c.limit, c.unit)}</td>
                      <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                    </>
                  )}
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
            Pin-jointed frame reference <Icon name="arrow" size={12} />
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
