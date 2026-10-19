import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { formatAxial, materialName, useAxialStore } from './shared'

// Stress and Strain I challenge panel (task 72; SSR-06, SSR-07, SSR-10, D-48 amendment). The
// Cantilever layout: the statement as a visible paragraph, the stored VALUE / LIMIT list of the
// latest test with text Pass/Fail, applicability reasons (a rod at or beyond yield is flagged
// here) and warnings, a Test details disclosure with the table and the stored rod quantities,
// draft errors, the reference link and Run Test.

export default function AxialChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useAxialStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  const details: [string, string][] = [
    ['Material', materialName(ch, latest.designSnapshot.materialId)],
    ['Diameter', formatAxial(a.diameterM, 'diameter')],
    ['Cross-sectional area', formatAxial(a.areaM2, 'area')],
    ["Young's modulus E", formatAxial(a.elasticModulusPa, 'modulus')],
    ['Yield strength', formatAxial(a.yieldStressPa, 'Pa')],
    ['Strain', formatAxial(a.strain, 'strain')],
    ['Axial stiffness EA/L', formatAxial(a.axialStiffnessNPerM, 'stiffness')],
    ['Stress / yield strength', formatAxial(a.yieldRatio, 'ratio')],
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
              <span>{c.id === 'stress' ? `${c.label} (allowable)` : c.label}</span>
              <strong>
                <span>{formatAxial(c.value, c.unit)}</span> / <span>{formatAxial(c.limit, c.unit)}</span>
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
                <th scope="col">Check</th>
                <th scope="col">Value</th>
                <th scope="col">Limit</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.constraints.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.label}</th>
                  <td>{c.unit === 'bool' ? '' : formatAxial(c.value, c.unit)}</td>
                  <td>{c.unit === 'bool' ? '' : formatAxial(c.limit, c.unit)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested rod values">
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
            Stress and strain reference <Icon name="arrow" size={12} />
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
