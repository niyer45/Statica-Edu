import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { bendSummary } from './BracketDetails'
import { formatBracket, useBracketStore } from './shared'

// Bracket challenge panel (task 55 L-bracket). Mirrors the beam and torsion panels: the
// statement, stored value/limit summary of the latest test, applicability reasons/warnings, a
// table-only Test details disclosure (D-30) with the stored bend and bolt quantities, draft
// errors and Run Test.

export default function BracketChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useBracketStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  const details: [string, string][] = [
    ['Moment at the bend', formatBracket(a.bendMomentNm, 'Nm')],
    ['Straight-beam stress', formatBracket(a.nominalBendStressPa, 'Pa')],
    ['Curved-beam factor', formatBracket(a.curvedBeamFactor, 'ratio')],
    ['Bend stress (inner fibre)', formatBracket(a.bendStressPa, 'Pa')],
    ['R / c', formatBracket(a.bendRadiusRatio, 'ratio')],
    ['Arm bending deflection', formatBracket(a.armDeflectionM, 'm')],
    ['Flange rotation deflection', formatBracket(a.flangeRotationDeflectionM, 'm')],
    ['Bolt lever arm', formatBracket(a.boltLeverArmM, 'm')],
    ['Tension per bolt', formatBracket(a.boltTensionN, 'N')],
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
                <span>{formatBracket(c.value, c.unit)}</span> / <span>{formatBracket(c.limit, c.unit)}</span>
                {outside && <small>Outside model assumptions</small>}
              </strong>
              <span className={c.passed ? 'pass-mark' : 'fail-mark'}>{c.passed ? '✓ Pass' : '✗ Fail'}</span>
            </li>
          ))}
        </ul>
        <p className="bracket-peak">{bendSummary(a)}</p>
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
                  <td>{c.unit === 'bool' ? '' : formatBracket(c.value, c.unit)}</td>
                  <td>{c.unit === 'bool' ? '' : formatBracket(c.limit, c.unit)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested bend and bolt values">
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
            Bend stress and bolt load reference <Icon name="arrow" size={12} />
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
