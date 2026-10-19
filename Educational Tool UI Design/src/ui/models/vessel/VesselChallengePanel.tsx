import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { formatLimit, formatVessel, useVesselStore } from './shared'

// Pressure vessel challenge panel (task 69; PVS-15, D-48 amendment). The Cantilever layout: the
// statement as a visible paragraph, the stored VALUE / LIMIT list of the latest test with text
// Pass/Fail, not-applicable reasons (they change the Status), a Test details disclosure (D-30,
// D-52) holding the caution warnings, the full table and the stored stress values, draft errors,
// the reference link and Run Test.

export default function VesselChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useVesselStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  const details: [string, string][] = [
    ['Inner radius', formatVessel(a.innerRadiusM, 'm')],
    ['Hoop stress', formatVessel(a.hoopStressPa, 'Pa')],
    ['Longitudinal stress', formatVessel(a.longitudinalStressPa, 'Pa')],
    ['Head stress', formatVessel(a.headStressPa, 'Pa')],
    ['Allowable stress', formatVessel(a.allowableStressPa, 'Pa')],
    ['Shell radius ÷ thickness', formatVessel(a.shellRadiusRatio, 'ratio')],
    ['Head radius ÷ thickness', formatVessel(a.headRadiusRatio, 'ratio')],
    ['Shell mass', formatVessel(a.shellMassKg, 'kg')],
    ['Heads mass', formatVessel(a.headsMassKg, 'kg')],
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
                <span>{formatVessel(c.value, c.unit)}</span> / <span>{formatLimit(c)}</span>
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
        <details className="result-details">
          <summary>Test details</summary>
          {a.warnings.length > 0 && (
            <ul aria-label="Model warnings">
              {a.warnings.map((w) => (
                <li key={w.code}>{w.message}</li>
              ))}
            </ul>
          )}
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
                  <td>{c.unit === 'bool' ? '' : formatVessel(c.value, c.unit)}</td>
                  <td>{c.unit === 'bool' ? '' : formatLimit(c)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested stresses and walls">
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
            Pressure vessel stress reference <Icon name="arrow" size={12} />
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
