import { bracketOutline } from '../../../geometry/bracket/outline'
import { useBracketStore } from './shared'

// Bracket 2D side view (tasks 46.3, 54.1; MBR-18, OC-12). Main bundle, no Three.js, so it is the
// view on devices without WebGL and the fallback if the 3D chunk fails. Owner feedback: the first
// version did not show what the part is, so the drawing now carries its real-world context:
//   - a hatched wall on the left with the bracket's mounting plate and two bolt heads;
//   - the DRAFT stepped bar to scale (outline from the pure geometry/bracket/outline.ts), with a
//     receding top edge so it reads as a flat plate of fixed thickness rather than a line drawing;
//   - dashed lines at the two checked sections (root and step);
//   - a load hanging from the tip on a short cable, with a downward arrow.
// No text is drawn on the model (D-26); BracketDetails carries the words, values and markers.

const X0 = 46
const PX_PER_M = 1150
const CENTRE_Y = 74
/** Receding offset that shows the plate thickness (oblique projection, display only). */
const DEPTH_DX = 7
const DEPTH_DY = -7

export const ELEVATION_LABEL =
  'Side view of the wall-mounted bracket: the mounting plate is bolted to the wall on the left, and the load hangs from the tip on the right'

export default function BracketElevation() {
  const { state, challenge: ch } = useBracketStore()
  const draft = state.draft
  const L = ch.lengthM
  const sx = (m: number) => X0 + m * PX_PER_M
  const sy = (m: number) => CENTRE_Y - m * PX_PER_M
  const pts = bracketOutline(draft, L)
  const front = pts.map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')
  const back = pts.map((p) => `${(sx(p.x) + DEPTH_DX).toFixed(2)},${(sy(p.y) + DEPTH_DY).toFixed(2)}`).join(' ')
  const halfRoot = (draft.rootDepthM / 2) * PX_PER_M
  const plateHalf = halfRoot + 16
  const tipX = sx(L)
  const tipBottom = sy(-draft.armDepthM / 2)
  const hasStep = draft.armDepthM !== draft.rootDepthM
  return (
    <svg viewBox="0 0 460 190" role="img" aria-label={ELEVATION_LABEL} className="beam-scene bracket-elevation">
      <defs>
        <pattern id="bracket-wall-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="bracket-hatch-line" />
        </pattern>
      </defs>
      <rect x={0} y={8} width={X0 - 8} height={170} className="bracket-wall" />
      <rect x={0} y={8} width={X0 - 8} height={170} fill="url(#bracket-wall-hatch)" />
      <line x1={X0 - 8} y1={8} x2={X0 - 8} y2={178} className="bracket-wall-face" />
      <rect x={X0 - 8} y={CENTRE_Y - plateHalf} width={8} height={2 * plateHalf} className="bracket-plate" />
      <rect x={X0 - 5} y={CENTRE_Y - plateHalf + 4} width={9} height={6} rx={1} className="bracket-bolt" />
      <rect x={X0 - 5} y={CENTRE_Y + plateHalf - 10} width={9} height={6} rx={1} className="bracket-bolt" />
      <polygon points={back} className="bracket-body-back" />
      <polygon points={front} className="bracket-body" />
      <line x1={sx(0) + 1} y1={CENTRE_Y - halfRoot - 5} x2={sx(0) + 1} y2={CENTRE_Y + halfRoot + 5} className="bracket-section-line" />
      {hasStep && (
        <line x1={sx(draft.stepLocationM)} y1={CENTRE_Y - halfRoot - 5} x2={sx(draft.stepLocationM)} y2={CENTRE_Y + halfRoot + 5} className="bracket-section-line" />
      )}
      <line x1={tipX - 4} y1={tipBottom} x2={tipX - 4} y2={tipBottom + 26} className="bracket-cable" />
      <rect x={tipX - 18} y={tipBottom + 26} width={28} height={22} rx={2} className="bracket-weight" />
      <line x1={tipX - 4} y1={tipBottom + 52} x2={tipX - 4} y2={tipBottom + 66} className="bracket-load" />
      <polygon points={`${tipX - 8},${tipBottom + 64} ${tipX},${tipBottom + 64} ${tipX - 4},${tipBottom + 72}`} className="bracket-load-head" />
    </svg>
  )
}
