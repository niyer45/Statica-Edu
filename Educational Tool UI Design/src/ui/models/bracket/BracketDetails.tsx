import type { BracketAnalysis } from '../../../physics/bracket/types'
import { formatBracket, useBracketStore } from './shared'

// Bracket result details shown under the 3D or 2D view (task 55 L-bracket; MM-22).
//   Moment path: the bending moment of the LATEST TESTED design along its load path, drawn
//   developed flat: from the bolt row (zero moment) down the flange to the heel and bend (the
//   peak, M = P a), then out along the arm to the load line (zero). Lengths come from the stored
//   bolt lever arm and the configured load offset; the peak from the stored bend moment. The bend
//   is a filled triangle and the bolt row an open circle, so the critical section never relies
//   on color; the summary and table say the same in words.

export const SUMMARY_ID = 'bracket-view-summary'
export const STRIP_LABEL =
  'Bending-moment path of the latest tested design: from the bolt row on the left, down the flange to the bend, then out along the arm to the load on the right; the triangle marks the bend, where the moment and the stress peak'

const X0 = 40
const PX_PER_M = 1500
const BASE = 70
const HEIGHT = 54

/** One-line description of the stored bend stress and bolt tension. */
export function bendSummary(a: Pick<BracketAnalysis, 'bendStressPa' | 'curvedBeamFactor' | 'boltTensionN'>): string {
  return `Bend stress ${formatBracket(a.bendStressPa, 'Pa')} at the inside of the bend (curved-beam factor ${formatBracket(a.curvedBeamFactor, 'ratio')}) · ${formatBracket(a.boltTensionN, 'N')} per bolt`
}

export default function BracketDetails() {
  const { state, challenge: ch } = useBracketStore()
  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const passed = (id: string) => latest.evaluation.constraints.find((c) => c.id === id)?.passed === true
  const limit = (id: string) => latest.evaluation.constraints.find((c) => c.id === id)!.limit
  const boltX = X0
  const bendX = X0 + a.boltLeverArmM * PX_PER_M
  const loadX = bendX + ch.loadOffsetM * PX_PER_M
  const peakY = BASE - HEIGHT
  const strip = `${boltX},${BASE} ${bendX},${peakY} ${loadX},${BASE}`
  const width = Math.max(460, Math.ceil(loadX + X0))
  const result = (ok: boolean) => (ok ? '✓ Pass' : '✗ Fail')
  return (
    <>
      <p id={SUMMARY_ID} className="viewport-label bracket-summary" aria-live="off">
        An L-bracket: its vertical flange is bolted flat to the wall and its horizontal arm carries a load hanging near the tip.
        {' '}Latest tested: {bendSummary(a)} · the triangle in the moment path marks the bend
        {state.draftStatus === 'draft' && ' · draft changed since this test'}
      </p>
      <svg viewBox={`0 0 ${width} 84`} role="img" aria-label={STRIP_LABEL} className="bracket-moment">
        <line x1={boltX} y1={BASE} x2={loadX} y2={BASE} className="moment-axis" />
        <line x1={bendX} y1={BASE + 4} x2={bendX} y2={BASE + 10} className="moment-axis" />
        <polygon points={strip} className="moment-strip" />
        <polygon className="governing-marker" points={`${bendX - 6},${peakY + 5} ${bendX + 6},${peakY + 5} ${bendX},${peakY - 6}`} />
        <circle className="section-marker" cx={boltX} cy={BASE} r={4.5} />
      </svg>
      <details className="bracket-sections">
        <summary>Checked sections</summary>
        <table aria-label="Checked sections of the latest tested design">
          <thead>
            <tr>
              <th scope="col">Location</th>
              <th scope="col">Moment</th>
              <th scope="col">Value</th>
              <th scope="col">Limit</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Bend, inner fibre (triangle)</th>
              <td>{formatBracket(a.bendMomentNm, 'Nm')}</td>
              <td>{formatBracket(a.bendStressPa, 'Pa')}</td>
              <td>{formatBracket(limit('bendStress'), 'Pa')}</td>
              <td>{result(passed('bendStress'))}</td>
            </tr>
            <tr>
              <th scope="row">Bolt row, {formatBracket(a.boltLeverArmM, 'm')} above the heel (circle)</th>
              <td>None</td>
              <td>{formatBracket(a.boltTensionN, 'N')} per bolt</td>
              <td>{formatBracket(limit('boltTension'), 'N')}</td>
              <td>{result(passed('boltTension'))}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </>
  )
}
