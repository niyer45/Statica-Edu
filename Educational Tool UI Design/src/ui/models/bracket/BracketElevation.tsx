import { BEND_ARC_SEGMENTS, bracketArmLengthM, bracketBendSection, bracketBoltRowHeightM, bracketOutline } from '../../../geometry/bracket/outline'
import { useBracketStore } from './shared'

// Bracket 2D side view (task 55 L-bracket; OC-12). Main bundle, no Three.js, so it is the view on
// devices without WebGL and the fallback if the 3D chunk fails. It shows the DRAFT to scale in an
// oblique projection (depth across the width recedes up and to the right), so the bracket reads
// as a solid plate bolted flat to the wall:
//   - the wall: its hatched front and its face, receding, which the flange lies flat against;
//   - the L outline (pure geometry/bracket/outline.ts: flange on the wall, the bend with its inner
//     radius, the arm) extruded across the bracket width, with its visible top, inner and tip
//     faces;
//   - the two bolt heads of the row on the inside face of the flange, a quarter of the width in
//     from each edge;
//   - a dashed line across the front of the bend, the checked section;
//   - the load hanging from mid-width under the arm at the load offset, with a downward arrow.
// No text is drawn on the model (D-26); BracketDetails carries the words, values and markers.

const X0 = 56
const Y0 = 172
const PX_PER_M = 800
/** Oblique receding factor: depth z is drawn as (+RECEDE·z, −RECEDE·z) (display only). */
const RECEDE = 0.3
/** The bracket sits this far behind the wall's front edge, m. */
const MARGIN_M = 0.01

export const ELEVATION_LABEL =
  'Side view of the L-bracket: its vertical flange is bolted flat to the wall on the left, and the load hangs from the horizontal arm on the right'

export default function BracketElevation() {
  const { state, challenge: ch } = useBracketStore()
  const draft = state.draft
  const w = draft.widthM
  /** Projects elevation metres (x from the wall face, y up from the arm underside) at depth z. */
  const p = (x: number, y: number, z: number) => ({
    x: X0 + (x + RECEDE * z) * PX_PER_M,
    y: Y0 - (y + RECEDE * z) * PX_PER_M,
  })
  const fmt = (q: { x: number; y: number }) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`
  const z0 = MARGIN_M
  const z1 = MARGIN_M + w
  const pts = bracketOutline(draft, bracketArmLengthM(ch))
  const front = pts.map((q) => fmt(p(q.x, q.y, z0))).join(' ')
  const back = pts.map((q) => fmt(p(q.x, q.y, z1))).join(' ')
  // Faces along the outline. Faces on the bend arcs are drawn without seams so the bend reads
  // smooth; the outline indices of the arc segments follow bracketOutline's point order.
  const n = BEND_ARC_SEGMENTS
  const onArc = (i: number) => (i >= 1 && i <= n) || (i >= n + 4 && i <= 2 * n + 3)
  const sides = pts.map((q, i) => {
    const r = pts[(i + 1) % pts.length]!
    return { points: [p(q.x, q.y, z0), p(r.x, r.y, z0), p(r.x, r.y, z1), p(q.x, q.y, z1)].map(fmt).join(' '), smooth: onArc(i) }
  })
  // Wall: front face (z = 0) to the left of the wall face, and the wall face itself receding.
  const wallTop = 0.165
  const wallBottom = -0.085
  const wallDepth = w + 2 * MARGIN_M
  const wallFace = [p(0, wallTop, 0), p(0, wallTop, wallDepth), p(0, wallBottom, wallDepth), p(0, wallBottom, 0)].map(fmt).join(' ')
  const wallFront = { x: 0, y: p(0, wallTop, 0).y, height: (wallTop - wallBottom) * PX_PER_M }
  const boltY = bracketBoltRowHeightM(draft, ch)
  const bolts = [z0 + w / 4, z0 + (3 * w) / 4].map((z) => p(draft.thicknessM, boltY, z))
  const section = bracketBendSection(draft)
  const sectionInner = p(section.inner.x, section.inner.y, z0)
  const sectionOuter = p(section.outer.x, section.outer.y, z0)
  const hang = p(ch.loadOffsetM, 0, z0 + w / 2)
  return (
    <svg viewBox="0 0 260 250" role="img" aria-label={ELEVATION_LABEL} className="beam-scene bracket-elevation">
      <defs>
        <pattern id="bracket-wall-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="bracket-hatch-line" />
        </pattern>
      </defs>
      <rect x={wallFront.x} y={wallFront.y} width={X0} height={wallFront.height} className="bracket-wall" />
      <rect x={wallFront.x} y={wallFront.y} width={X0} height={wallFront.height} fill="url(#bracket-wall-hatch)" />
      <polygon points={wallFace} className="bracket-wall-side" />
      <line x1={hang.x} y1={hang.y} x2={hang.x} y2={hang.y + 30} className="bracket-cable" />
      <rect x={hang.x - 13} y={hang.y + 30} width={26} height={20} rx={2} className="bracket-weight" />
      <line x1={hang.x} y1={hang.y + 54} x2={hang.x} y2={hang.y + 66} className="bracket-load" />
      <polygon points={`${hang.x - 4},${hang.y + 64} ${hang.x + 4},${hang.y + 64} ${hang.x},${hang.y + 72}`} className="bracket-load-head" />
      <polygon points={back} className="bracket-body-back" />
      {sides.map((s, i) => (
        <polygon key={i} points={s.points} className={s.smooth ? 'bracket-body-side bracket-body-side-smooth' : 'bracket-body-side'} />
      ))}
      {bolts.map((b, i) => (
        <g key={i}>
          <ellipse cx={b.x + 1.5} cy={b.y} rx={2.2} ry={6} className="bracket-washer" />
          <rect x={b.x + 1.5} y={b.y - 4} width={4} height={8} rx={1} className="bracket-bolt" />
        </g>
      ))}
      <polygon points={front} className="bracket-body" />
      <line x1={sectionInner.x} y1={sectionInner.y} x2={sectionOuter.x} y2={sectionOuter.y} className="bracket-section-line" />
    </svg>
  )
}
