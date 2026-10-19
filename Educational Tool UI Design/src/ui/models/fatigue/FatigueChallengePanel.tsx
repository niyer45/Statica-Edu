import { STATUS_LABELS } from '../../panels/resultPresentation'
import Icon from '../../icons/Icon'
import { formatFatigue, formatLimit, lifeText, useFatigueStore } from './shared'

// Fatigue challenge panel (task 70; FAT-16, D-48 amendment). The Cantilever presentation: a
// visible statement paragraph, the stored VALUE / LIMIT checks of the latest test with text
// Pass/Fail (lower bounds say "min", upper bounds "max"), applicability reasons, a Test details
// disclosure with the full table and the stored fatigue quantities, draft errors, the reference
// link and Run Test.

export default function FatigueChallengePanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { state, challenge: ch, runTest } = useFatigueStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation } = latest
  const outside = evaluation.status === 'modelNotApplicable'
  const shown = evaluation.constraints.filter((c) => c.unit !== 'bool')
  const details: [string, string][] = [
    ['Stress-concentration factor Kt', formatFatigue(a.stressConcentrationKt, 'factor')],
    ['Notch sensitivity q', formatFatigue(a.notchSensitivityQ, 'factor')],
    ['Fatigue notch factor Kf', formatFatigue(a.fatigueNotchFactorKf, 'factor')],
    ['Nominal alternating / mean stress', `${formatFatigue(a.nominalAlternatingStressPa, 'Pa')} / ${formatFatigue(a.nominalMeanStressPa, 'Pa')}`],
    ['Alternating / mean stress at the fillet', `${formatFatigue(a.alternatingStressPa, 'Pa')} / ${formatFatigue(a.meanStressPa, 'Pa')}`],
    ['Surface factor ka / size factor kb', `${formatFatigue(a.surfaceFactorKa, 'factor')} / ${formatFatigue(a.sizeFactorKb, 'factor')}`],
    ['Endurance limit Se', formatFatigue(a.enduranceLimitPa, 'Pa')],
    [`Fatigue strength at ${ch.targetLifeCycles.toLocaleString('en-US')} cycles`, formatFatigue(a.strengthAtTargetLifePa, 'Pa')],
    ['Equivalent reversed stress', a.equivalentReversedStressPa === undefined ? 'Not defined' : formatFatigue(a.equivalentReversedStressPa, 'Pa')],
    ['Predicted life', lifeText(a)],
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
                <span>{formatFatigue(c.value, c.unit)}</span> / <span>{formatLimit(c)}</span>
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
                  <td>{c.unit === 'bool' ? '' : formatFatigue(c.value, c.unit)}</td>
                  <td>{c.unit === 'bool' ? '' : formatLimit(c)}</td>
                  <td>{c.passed ? '✓ Pass' : '✗ Fail'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Latest tested fatigue values">
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
            Fatigue and stress concentration reference <Icon name="arrow" size={12} />
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
