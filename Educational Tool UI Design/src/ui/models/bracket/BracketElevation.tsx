import { bracketArmLengthM, bracketBendSection, bracketBoltRowHeightM, bracketOutline } from '../../../geometry/bracket/outline'
import { useBracketStore } from './shared'

// Bracket 2D side view (task 55 L-bracket; OC-12). Main bundle, no Three.js, so it is the view on
// devices without WebGL and the fallback if the 3D chunk fails. It shows the DRAFT to scale:
//   - a hatched wall on the left;
//   - the L outline (pure geometry/bracket/outline.ts: flange on the wall, the bend with its inner
//     radius, the arm), with a receding copy offset in proportion to the width so the plate reads
//     as a solid of that width;
//   - the two bolts of the row (heads on the inside of the flange, shanks into the wall);
//   - a dashed line across the bend, the checked section;
//   - the load hanging from the arm at the load offset on a cable, with a downward arrow.
// No text is drawn on the model (D-26); BracketDetails carries the words, values and markers.

const X0 = 64
const Y0 = 170
const PX_PER_M = 800
/** Oblique receding factor for the width (display only). */
const RECEDE = 0.3

export const ELEVATION_LABEL =
  'Side view of the L-bracket: its vertical flange is bolted flat to the wall on the left, and the load hangs from the horizontal arm on the right'

export default function BracketElevation() {
  const { state, challenge: ch } = useBracketStore()
  const draft = state.draft
  const sx = (m: number) => X0 + m * PX_PER_M
  const sy = (m: number) => Y0 - m * PX_PER_M
  const depth = draft.widthM * PX_PER_M * RECEDE
  const pts = bracketOutline(draft, bracketArmLengthM(ch))
  const front = pts.map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')
  const back = pts.map((p) => `${(sx(p.x) + depth).toFixed(2)},${(sy(p.y) - depth).toFixed(2)}`).join(' ')
  const t = draft.thicknessM * PX_PER_M
  const boltY = sy(bracketBoltRowHeightM(draft, ch))
  const section = bracketBendSection(draft)
  const loadX = sx(ch.loadOffsetM) + depth / 2
  const loadTop = Y0 - depth / 2
  // Bolt heads at a quarter and three quarters of the width (two bolts across the row).
  const bolts = [0.75, 0.25].map((f) => f * depth)
  return (
    <svg viewBox="0 0 260 250" role="img" aria-label={ELEVATION_LABEL} className="beam-scene bracket-elevation">
      <defs>
        <pattern id="bracket-wall-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="bracket-hatch-line" />
        </pattern>
      </defs>
      <rect x={0} y={4} width={X0} height={232} className="bracket-wall" />
      <rect x={0} y={4} width={X0} height={232} fill="url(#bracket-wall-hatch)" />
      <line x1={X0} y1={4} x2={X0} y2={236} className="bracket-wall-face" />
      <polygon points={back} className="bracket-body-back" />
      {bolts.map((o, i) => (
        <line key={`shank-back-${i}`} x1={X0 - 16} y1={boltY - o} x2={X0 + o} y2={boltY - o} className="bracket-bolt-shank" />
      ))}
      <polygon points={front} className="bracket-body" />
      {bolts.map((o, i) => (
        <rect key={`head-${i}`} x={X0 + t + o} y={boltY - o - 5} width={4} height={10} rx={1} className="bracket-bolt" />
      ))}
      <line
        x1={sx(section.inner.x)}
        y1={sy(section.inner.y)}
        x2={sx(section.outer.x)}
        y2={sy(section.outer.y)}
        className="bracket-section-line"
      />
      <line x1={loadX} y1={loadTop} x2={loadX} y2={loadTop + 24} className="bracket-cable" />
      <rect x={loadX - 13} y={loadTop + 24} width={26} height={20} rx={2} className="bracket-weight" />
      <line x1={loadX} y1={loadTop + 48} x2={loadX} y2={loadTop + 62} className="bracket-load" />
      <polygon points={`${loadX - 4},${loadTop + 60} ${loadX + 4},${loadTop + 60} ${loadX},${loadTop + 68}`} className="bracket-load-head" />
    </svg>
  )
}
