import { bracketOutline } from '../../../geometry/bracket/outline'
import { formatMm } from '../../../units/units'
import { formatBracket, NOT_APPLICABLE, peakSummary, useBracketStore } from './shared'

// Bracket design view (task 46.3; MBR-18, MM-22). A main-bundle SVG elevation with no Three.js
// dependency, so it is also the non-WebGL view.
//   Elevation: the wall clamp, the DRAFT stepped outline with its shoulder fillets from the pure
//   display outline (geometry/bracket/outline.ts, to scale), the tip load arrow, and dashed lines
//   at the two checked sections (root and step).
//   Moment strip: M(x) of the LATEST TESTED design drawn from its stored root and step moments
//   (zero at the free end, where the load acts), with both checked sections marked. The section
//   that governs the peak stress is a filled triangle, the other an open circle, so the critical
//   location never relies on color; the summary and table below say it in words.
// No static text is drawn on the model (D-26); the summary and section table are the text
// equivalent. The optional 3D extrusion (MBR-18) is not added.

const X0 = 34
const PX_PER_M = 1200
const CENTRE_Y = 62
const STRIP_BASE = 206
const STRIP_HEIGHT = 64

const fmtMoment = (nm: number) => `${nm.toFixed(1)} N·m`

function Triangle({ x, y }: { x: number; y: number }) {
  return <polygon className="governing-marker" points={`${x - 6},${y + 5} ${x + 6},${y + 5} ${x},${y - 6}`} />
}
function Circle({ x, y }: { x: number; y: number }) {
  return <circle className="section-marker" cx={x} cy={y} r={4.5} />
}

export default function BracketView() {
  const { state, challenge: ch } = useBracketStore()
  const draft = state.draft
  const L = ch.lengthM
  const sx = (m: number) => X0 + m * PX_PER_M
  const sy = (m: number) => CENTRE_Y - m * PX_PER_M
  const outline = bracketOutline(draft, L)
    .map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`)
    .join(' ')
  const tipTop = sy(draft.armDepthM / 2)
  const tipX = sx(L)
  const halfD = (draft.rootDepthM / 2) * PX_PER_M
  const draftStep = draft.armDepthM !== draft.rootDepthM

  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const tested = latest.designSnapshot
  const testedStep = a.stepMomentNm !== undefined
  const momentY = (nm: number) => STRIP_BASE - (nm / a.rootMomentNm) * STRIP_HEIGHT
  const rootPt = { x: sx(0), y: momentY(a.rootMomentNm) }
  const stepPt = testedStep ? { x: sx(tested.stepLocationM), y: momentY(a.stepMomentNm!) } : undefined
  const strip = [`${sx(0)},${STRIP_BASE}`, `${rootPt.x},${rootPt.y}`, ...(stepPt ? [`${stepPt.x},${stepPt.y}`] : []), `${sx(L)},${STRIP_BASE}`].join(' ')
  const governs = a.peakLocation

  return (
    <div className="bracket-view">
      <svg viewBox="0 0 440 220" role="img" aria-label="Side elevation of the stepped bracket with the wall clamp and tip load, above the bending-moment strip of the latest tested design" className="beam-scene">
        <rect x={X0 - 10} y={CENTRE_Y - 46} width={10} height={92} className="bracket-wall" />
        <polygon points={outline} className="bracket-body" />
        <line x1={sx(0) + 1} y1={CENTRE_Y - halfD - 4} x2={sx(0) + 1} y2={CENTRE_Y + halfD + 4} className="bracket-section-line" />
        {draftStep && <line x1={sx(draft.stepLocationM)} y1={CENTRE_Y - halfD - 4} x2={sx(draft.stepLocationM)} y2={CENTRE_Y + halfD + 4} className="bracket-section-line" />}
        <line x1={tipX} y1={4} x2={tipX} y2={tipTop - 7} className="bracket-load" />
        <polygon points={`${tipX - 4},${tipTop - 8} ${tipX + 4},${tipTop - 8} ${tipX},${tipTop - 1}`} className="bracket-load-head" />
        <line x1={sx(0)} y1={STRIP_BASE} x2={sx(L)} y2={STRIP_BASE} className="moment-axis" />
        <polygon points={strip} className="moment-strip" />
        {governs === 'root' ? <Triangle {...rootPt} /> : <Circle {...rootPt} />}
        {stepPt && (governs === 'step' ? <Triangle {...stepPt} /> : <Circle {...stepPt} />)}
      </svg>
      <p className="viewport-label bracket-summary" aria-live="off">
        Latest tested: {peakSummary(a)}
        {governs !== undefined && ' · the triangle marks the governing section'}
        {state.draftStatus === 'draft' && ' · draft changed since this test'}
      </p>
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
    </div>
  )
}
