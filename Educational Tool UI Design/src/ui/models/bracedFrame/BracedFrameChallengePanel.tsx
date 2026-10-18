import { BRACED_FRAME_CONSTRAINT_LABELS } from '../../../evaluation/bracedFrame/constraints'
import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { boolText, constraintRows, formatFrame, MODE_PHRASES, memberName, NOT_APPLICABLE, useFrameStore } from './shared'

// Braced frame challenge panel (task 49.3; BFR-06, BFR-07, MM-10, MM-11). Mirrors the beam and
// torsion panels: the statement (with the pin-jointed idealization sentence from the config),
// the stored value/limit summary of the latest test (stability, roof drift, maximum
// utilization, mass), applicability reasons/warnings, a table-only Test details disclosure
// (D-30), draft errors and Run Test. For a mechanism, roof drift and utilization are not
// defined: they are shown as "Not applicable", never as numbers or as failed.

export default function BracedFrameChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useFrameStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const rows = constraintRows(evaluation).filter((r) => r.id !== 'applicability')
  const governing = analysis.status === 'solved' ? analysis.members[analysis.governingMemberId] : undefined
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
          {rows.map(({ id, result: c }) => (
            <li className="requirement" key={id}>
              <span>{BRACED_FRAME_CONSTRAINT_LABELS[id]}</span>
              {c === undefined ? (
                <>
                  <strong>
                    <span>{NOT_APPLICABLE}</span>
                    <small>Not defined: the frame is a mechanism</small>
                  </strong>
                  <span className="fail-mark">— N/A</span>
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
          ))}
        </ul>
        {analysis.status === 'solved' && governing !== undefined && (
          <p className="frame-governing">
            Governing member: {memberName(analysis.governingMemberId)}, {governing.sense === 'zero' ? 'carrying almost no force' : `in ${governing.sense}`}, limited by{' '}
            {MODE_PHRASES[governing.mode]}.
          </p>
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
