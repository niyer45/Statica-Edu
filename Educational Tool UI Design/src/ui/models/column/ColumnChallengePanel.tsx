import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { formatColumn, formatLimit, useColumnStore } from './shared'

// Column challenge panel (task 68; CBK-07, CBK-08, CBK-11, CBK-12, D-48 amendment). The Cantilever
// layout: the statement as a visible paragraph, the stored VALUE / LIMIT list of the latest test
// with text Pass/Fail (the critical load is a minimum, shown as "≥ limit"), applicability reasons
// and cautions, a Test details disclosure (D-30) with the constraint table and the stored column
// quantities, draft errors, the reference link and Run Test.

export default function ColumnChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useColumnStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  const details: [string, string][] = [
    ['Safety factor against buckling (critical load ÷ load)', `${formatColumn(a.bucklingSafetyFactor, 'ratio')} (required ${ch.constraints.minBucklingSafetyFactor})`],
    ['Second moment of area', formatColumn(a.secondMomentM4, 'm4')],
    ['Cross-section area', formatColumn(a.areaM2, 'm2')],
    ['Radius of gyration', formatColumn(a.radiusOfGyrationM, 'm')],
    ['Slenderness (length ÷ radius of gyration)', `${a.slenderness.toFixed(0)} (Euler applies from ${a.transitionSlenderness.toFixed(0)})`],
    ['Buckling stress (critical load ÷ area)', formatColumn(a.eulerStressPa, 'Pa')],
  ]
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
                <span>{formatColumn(c.value, c.unit)}</span> / <span>{formatLimit(c)}</span>
                {outside && <small>Outside model assumptions</small>}
              </strong>
              <span className={c.passed ? 'pass-mark' : 'fail-mark'}>{c.passed ? '✓ Pass' : '✗ Fail'}</span>
            </li>
          ))}
        </ul>
        {outside && (
          <ul aria-label="Model applicability reasons">
            {a.notApplicableReasons.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
        )}
        {a.warnings.length > 0 && (
          <ul aria-label="Model warnings">
            {a.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        )}
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
                  <td>{formatColumn(c.value, c.unit)}</td>
                  <td>{formatLimit(c)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested column values">
            <tbody>
              {details.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
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
            Column buckling reference <Icon name="arrow" size={12} />
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
