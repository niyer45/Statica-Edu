import { formatMm } from '../../../units/units'
import { formatBracket, NOT_APPLICABLE, peakSummary, useBracketStore } from './shared'

// Bracket result details shown under the 3D or 2D view (tasks 46.3, 54.1; MBR-18, MM-22).
//   Moment strip: M(x) of the LATEST TESTED design from its stored root and step moments (zero at
//   the free end, where the load acts), with both checked sections marked. The section that
//   governs the peak stress is a filled triangle and the other an open circle, so the critical
//   location never relies on color; the summary and table say the same in words.

export const SUMMARY_ID = 'bracket-view-summary'
export const STRIP_LABEL = 'Bending-moment strip of the latest tested design, from the wall (left) to the tip (right); the triangle marks the governing section'

const X0 = 46
const PX_PER_M = 1150
const BASE = 74
const HEIGHT = 58

const fmtMoment = (nm: number) => `${nm.toFixed(1)} N·m`

export default function BracketDetails() {
  const { state, challenge: ch } = useBracketStore()
  const L = ch.lengthM
  const sx = (m: number) => X0 + m * PX_PER_M
  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const tested = latest.designSnapshot
  const testedStep = a.stepMomentNm !== undefined
  const momentY = (nm: number) => BASE - (nm / a.rootMomentNm) * HEIGHT
  const rootPt = { x: sx(0), y: momentY(a.rootMomentNm) }
  const stepPt = testedStep ? { x: sx(tested.stepLocationM), y: momentY(a.stepMomentNm!) } : undefined
  const strip = [`${sx(0)},${BASE}`, `${rootPt.x},${rootPt.y}`, ...(stepPt ? [`${stepPt.x},${stepPt.y}`] : []), `${sx(L)},${BASE}`].join(' ')
  const governs = a.peakLocation
  const marker = (pt: { x: number; y: number }, isGoverning: boolean) =>
    isGoverning ? (
      <polygon className="governing-marker" points={`${pt.x - 6},${pt.y + 5} ${pt.x + 6},${pt.y + 5} ${pt.x},${pt.y - 6}`} />
    ) : (
      <circle className="section-marker" cx={pt.x} cy={pt.y} r={4.5} />
    )
  return (
    <>
      <p id={SUMMARY_ID} className="viewport-label bracket-summary" aria-live="off">
        A flat bracket bolted to a wall carries a load hanging from its tip; its deeper root steps down to a thinner arm through a rounded fillet.
        {' '}Latest tested: {peakSummary(a)}
        {governs !== undefined && ' · the triangle in the moment strip marks the governing section'}
        {state.draftStatus === 'draft' && ' · draft changed since this test'}
      </p>
      <svg viewBox="0 0 460 84" role="img" aria-label={STRIP_LABEL} className="bracket-moment">
        <line x1={sx(0)} y1={BASE} x2={sx(L)} y2={BASE} className="moment-axis" />
        <polygon points={strip} className="moment-strip" />
        {marker(rootPt, governs === 'root')}
        {stepPt && marker(stepPt, governs === 'step')}
      </svg>
      <details className="bracket-sections">
        <summary>Checked sections</summary>
        <table aria-label="Checked sections of the latest tested design">
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col">From wall</th>
              <th scope="col">Moment</th>
              <th scope="col">Nominal stress</th>
              <th scope="col">Kt</th>
              <th scope="col">Governs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Root</th>
              <td>0 mm</td>
              <td>{fmtMoment(a.rootMomentNm)}</td>
              <td>{formatBracket(a.rootStressPa, 'Pa')}</td>
              <td>Not applied</td>
              <td>{governs === undefined ? NOT_APPLICABLE : governs === 'root' ? 'Yes (triangle)' : 'No'}</td>
            </tr>
            <tr>
              <th scope="row">Step</th>
              {testedStep ? (
                <>
                  <td>{formatMm(tested.stepLocationM, 0)} mm</td>
                  <td>{fmtMoment(a.stepMomentNm!)}</td>
                  <td>{formatBracket(a.stepNominalStressPa!, 'Pa')}</td>
                  <td>{a.ktStep !== undefined ? formatBracket(a.ktStep, 'ratio') : NOT_APPLICABLE}</td>
                  <td>{governs === undefined ? NOT_APPLICABLE : governs === 'step' ? 'Yes (triangle)' : 'No'}</td>
                </>
              ) : (
                <td colSpan={5}>No step: stress concentration not applied</td>
              )}
            </tr>
          </tbody>
        </table>
      </details>
    </>
  )
}
