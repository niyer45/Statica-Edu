import { formatCycles, formatFatigue, lifeText, useFatigueStore } from './shared'

// Fatigue result details under the 3D or 2D view (task 70; FAT-16, MM-22). A text summary of the
// LATEST TESTED design and its S-N diagram, drawn from stored values only: the Basquin line is the
// straight segment between the stored points (10³ cycles, f·Sut) and (10⁶ cycles, Se) on log-log
// axes, flat beyond 10⁶ (the endurance limit); the dashed horizontal line is the stored equivalent
// reversed stress; the dotted vertical line is the target life; a filled circle marks the predicted
// failure point (finite life) and an open circle at the right edge marks infinite life. The table
// below repeats every plotted value in words (never color alone).

export const SUMMARY_ID = 'fatigue-view-summary'
export const SN_LABEL =
  'S-N diagram of the latest tested design on log-log axes: fatigue strength falls along a straight line from a thousand to a million cycles and is flat beyond (the endurance limit); a dashed line marks the stress at the fillet and a dotted line the target life'

const W = 320
const H = 170
const LEFT = 52
const RIGHT = 12
const TOP = 10
const BOTTOM = 34
const MIN_LOG_N = 3
const MAX_LOG_N = 7

export default function FatigueDetails() {
  const { state, challenge: ch } = useFatigueStore()
  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const reversed = a.equivalentReversedStressPa
  const stresses = [a.strengthAt1e3CyclesPa, a.enduranceLimitPa, ...(reversed === undefined ? [] : [reversed])]
  const lo = Math.log10(Math.min(...stresses) * 0.8)
  const hi = Math.log10(Math.max(...stresses) * 1.15)
  const x = (cycles: number) => LEFT + ((Math.log10(cycles) - MIN_LOG_N) / (MAX_LOG_N - MIN_LOG_N)) * (W - LEFT - RIGHT)
  const y = (stressPa: number) => TOP + ((hi - Math.log10(stressPa)) / (hi - lo)) * (H - TOP - BOTTOM)
  const line = `${x(1e3)},${y(a.strengthAt1e3CyclesPa)} ${x(1e6)},${y(a.enduranceLimitPa)} ${x(1e7)},${y(a.enduranceLimitPa)}`
  const marker =
    reversed === undefined ? undefined : a.lifeRegime === 'finite' && a.predictedLifeCycles !== undefined ? { cx: x(a.predictedLifeCycles), cy: y(reversed), open: false } : a.lifeRegime === 'infinite' ? { cx: x(1e7), cy: y(reversed), open: true } : undefined
  const passed = latest.evaluation.constraints.find((c) => c.id === 'fatigueSafetyFactor')!.passed
  return (
    <>
      <p id={SUMMARY_ID} className="viewport-label bracket-summary" aria-live="off">
        A stepped steel spindle: the collar is held, the neck carries a wheel load that rises and falls every cycle, and the shoulder fillet is where fatigue cracks start.{' '}
        Latest tested: fatigue safety factor {formatFatigue(a.fatigueSafetyFactor, 'ratio')} ({passed ? 'pass' : 'fail'}), Kf {formatFatigue(a.fatigueNotchFactorKf, 'factor')}, predicted life {lifeText(a).toLowerCase()}
        {state.draftStatus === 'draft' && ' · draft changed since this test'}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={SN_LABEL} className="fatigue-sn">
        <line x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} className="moment-axis" />
        <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} className="moment-axis" />
        {[3, 4, 5, 6, 7].map((n) => (
          <g key={n}>
            <line x1={x(10 ** n)} y1={H - BOTTOM} x2={x(10 ** n)} y2={H - BOTTOM + 4} className="moment-axis" />
            <text x={x(10 ** n)} y={H - BOTTOM + 14} className="fatigue-sn-tick" textAnchor="middle">
              10{['³', '⁴', '⁵', '⁶', '⁷'][n - 3]}
            </text>
          </g>
        ))}
        <text x={(LEFT + W - RIGHT) / 2} y={H - 4} className="fatigue-sn-tick" textAnchor="middle">
          Cycles
        </text>
        {[a.strengthAt1e3CyclesPa, a.enduranceLimitPa].map((s) => (
          <text key={s} x={LEFT - 4} y={y(s) + 3} className="fatigue-sn-tick" textAnchor="end">
            {formatFatigue(s, 'Pa').replace(' MPa', '')}
          </text>
        ))}
        <text x={10} y={(TOP + H - BOTTOM) / 2} className="fatigue-sn-tick" textAnchor="middle" transform={`rotate(-90 10 ${(TOP + H - BOTTOM) / 2})`}>
          MPa
        </text>
        <polyline points={line} className="fatigue-sn-line" />
        <line x1={x(ch.targetLifeCycles)} y1={TOP} x2={x(ch.targetLifeCycles)} y2={H - BOTTOM} className="fatigue-sn-target" />
        {reversed !== undefined && <line x1={LEFT} y1={y(reversed)} x2={W - RIGHT} y2={y(reversed)} className="fatigue-sn-stress" />}
        {marker && <circle cx={marker.cx} cy={marker.cy} r={4.5} className={marker.open ? 'fatigue-sn-point-open' : 'fatigue-sn-point'} />}
      </svg>
      <details className="bracket-sections">
        <summary>S-N values</summary>
        <table aria-label="S-N values of the latest tested design">
          <tbody>
            <tr>
              <th scope="row">Strength at 10³ cycles</th>
              <td>{formatFatigue(a.strengthAt1e3CyclesPa, 'Pa')}</td>
            </tr>
            <tr>
              <th scope="row">Endurance limit (10⁶ cycles and beyond)</th>
              <td>{formatFatigue(a.enduranceLimitPa, 'Pa')}</td>
            </tr>
            <tr>
              <th scope="row">Strength at the target life ({formatCycles(ch.targetLifeCycles)})</th>
              <td>{formatFatigue(a.strengthAtTargetLifePa, 'Pa')}</td>
            </tr>
            <tr>
              <th scope="row">Equivalent reversed stress at the fillet (dashed line)</th>
              <td>{reversed === undefined ? 'Not defined' : formatFatigue(reversed, 'Pa')}</td>
            </tr>
            <tr>
              <th scope="row">Predicted life (circle)</th>
              <td>{lifeText(a)}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </>
  )
}
