import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { formatBracket, formatOptional, NOT_APPLICABLE, peakSummary, useBracketStore } from './shared'

// Bracket challenge panel (task 46.3; MBR-07, MBR-08, MBR-12, MBR-13, MBR-14). Mirrors the beam
// and torsion panels: the statement, stored value/limit summary of the latest test with the peak
// location and Kt, applicability reasons/warnings, a table-only Test details disclosure (D-30)
// including h/r and D/d, draft errors and Run Test. When the Kt fit does not cover the step the
// peak stress is shown as "Not applicable" with the reasons, never as a number.

export default function BracketChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useBracketStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation, designSnapshot } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  const details: [string, string][] = [
    ['Peak stress', a.peakStressPa !== undefined ? `${formatBracket(a.peakStressPa, 'Pa')} at the ${a.peakLocation}` : NOT_APPLICABLE],
    ['Nominal root stress', formatBracket(a.rootStressPa, 'Pa')],
    ['Nominal step stress', formatOptional(a.stepNominalStressPa, 'Pa', designSnapshot)],
    ['Kt at the step', formatOptional(a.ktStep, 'ratio', designSnapshot)],
    ['Step peak stress', formatOptional(a.stepPeakStressPa, 'Pa', designSnapshot)],
    ['h / r', formatOptional(a.heightToRadiusRatio, 'ratio', designSnapshot)],
    ['D / d', formatOptional(a.stepRatio, 'ratio', designSnapshot)],
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
                <span>{c.value !== undefined ? formatBracket(c.value, c.unit) : NOT_APPLICABLE}</span> / <span>{formatBracket(c.limit, c.unit)}</span>
                {outside && <small>Outside model assumptions</small>}
              </strong>
              <span className={c.passed ? 'pass-mark' : 'fail-mark'}>{c.passed ? '✓ Pass' : '✗ Fail'}</span>
            </li>
          ))}
        </ul>
        <p className="bracket-peak">{peakSummary(a)}</p>
        {outside && (
          <ul aria-label="Model applicability reasons">
            {a.notApplicableReasons.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
        )}
        <ul aria-label="Model warnings">
          {a.warnings.map((w) => (
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
                  <td>{c.unit === 'bool' ? '' : c.value !== undefined ? formatBracket(c.value, c.unit) : NOT_APPLICABLE}</td>
                  <td>{c.unit === 'bool' ? '' : formatBracket(c.limit, c.unit)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested stresses">
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
            Stress concentration reference <Icon name="arrow" size={12} />
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
