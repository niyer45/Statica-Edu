import { BRACED_FRAME_CONSTRAINT_LABELS } from '../../../evaluation/bracedFrame/constraints'
import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { boolText, CHECK_LABELS, constraintRows, formatFrame, MODE_PHRASES, memberName, NOT_APPLICABLE, unstableText, useFrameStore } from './shared'

// Braced frame challenge panel (task 49.3; task 56 follow-up: same structure and styling as
// Cantilever Beam I's RequirementsPanel; BFR-06, BFR-07, MM-10, MM-11). The visible challenge
// statement (with the pin-jointed idealization sentence, BFR-01), the stored value/limit list of
// the latest test with Pass/Fail marks, one governing-member (or unstable-storey) line,
// applicability reasons/warnings, a table-only Test details disclosure (D-30), draft errors, the
// reference link and Run Test. For a mechanism, roof drift and utilization are not defined: they
// are shown as "Not applicable", never as numbers or as failed.

export default function BracedFrameChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useFrameStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const governing = analysis.status === 'solved' ? analysis.members[analysis.governingMemberId] : undefined
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
          {constraintRows(evaluation).map(({ id, result: c }) =>
            id === 'applicability' ? null : (
              <li className="requirement" key={id}>
                <span>{CHECK_LABELS[id]}</span>
                {c === undefined ? (
                  <>
                    <strong>
                      <span>{NOT_APPLICABLE}</span>
                    </strong>
                    <span className="fail-mark">– N/A</span>
                  </>
                ) : (
                  <>
                    <strong>
                      {c.unit === 'bool' ? (
                        <span>{boolText(c)}</span>
                      ) : (
                        <>
                          <span>{formatFrame(c.value, c.unit)}</span> / <span>{formatFrame(c.limit, c.unit)}</span>
                        </>
                      )}
                      {outside && c.unit !== 'bool' && <small>Outside model assumptions</small>}
                    </strong>
                    <span className={c.passed ? 'pass-mark' : 'fail-mark'}>{c.passed ? '✓ Pass' : '✗ Fail'}</span>
                  </>
                )}
              </li>
            ),
          )}
        </ul>
        {analysis.status === 'mechanism' ? (
          <p className="frame-governing">{unstableText(analysis.unbracedStoreys)}.</p>
        ) : (
          governing !== undefined && (
            <p className="frame-governing">
              Governing member: {memberName(analysis.governingMemberId)}, {governing.sense === 'zero' ? 'almost no force' : governing.sense},{' '}
              {MODE_PHRASES[governing.mode]}.
            </p>
          )
        )}
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
