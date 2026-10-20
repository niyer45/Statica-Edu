import { vesselPressureStations, vesselProfile, type ProfilePoint } from '../../../geometry/vessel/profile'
import { useVesselStore } from './shared'

// Pressure vessel 2D half-section (task 69; OC-12, PVS-15). Main bundle, no Three.js, so it is
// the view on devices without WebGL and the fallback if the 3D chunk fails. It shows the DRAFT as
// a longitudinal section through the axis: the steel walls of the shell and of the two
// hemispherical heads (filled), the air space inside, and the dashed axis. Lengths and the inner
// radius are to scale; the wall thicknesses are drawn WALL_EXAGGERATION times thicker so that
// both walls stay visible (a few millimetres on a vessel over a metre long), which the caption
// below the drawing states. The geometry comes from the pure display profile
// (geometry/vessel/profile.ts). Arrows inside the air space show the internal pressure pushing
// outward on the shell and heads (owner request 2026-10-19); their tips sit on the inner surface,
// which the wall exaggeration does not move. No text is drawn on the model (D-26).

/** Wall thicknesses are drawn this many times their true size (display only, disclosed). */
export const WALL_EXAGGERATION = 6

const CX = 180
const CY = 82
/** Fixed drawing scale, so a longer or wider vessel looks longer or wider, px/m. */
const PX_PER_M = 170

export const ELEVATION_LABEL =
  'Section through the vessel along its axis: the cylindrical shell in the middle and a hemispherical head at each end, with the steel walls filled, the air space inside, and arrows showing the internal pressure pushing outward on the walls'

/** Pressure arrow length and head size, px (display only). */
const ARROW_PX = 14
const HEAD_PX = 4

export default function VesselElevation() {
  const { state } = useVesselStore()
  const d = state.draft
  const shown = { ...d, shellThicknessM: d.shellThicknessM * WALL_EXAGGERATION, headThicknessM: d.headThicknessM * WALL_EXAGGERATION }
  const { outer, inner } = vesselProfile(shown)
  const px = (q: ProfilePoint, sign: 1 | -1) => `${(CX + q.x * PX_PER_M).toFixed(2)},${(CY - sign * q.y * PX_PER_M).toFixed(2)}`
  // Upper and lower walls: outer surface left to right, then the inner surface back.
  const wall = (sign: 1 | -1) => [...outer, ...[...inner].reverse()].map((q) => px(q, sign)).join(' ')
  // The air space: the inner surface over the top, then back along the bottom.
  const cavity = [...inner.map((q) => px(q, 1)), ...[...inner].reverse().map((q) => px(q, -1))].join(' ')
  const ends = outer[0]!.x * PX_PER_M
  // Each arrow ends on the inner surface and points along the outward normal; the lower half is
  // the mirror image (the poles lie on the axis, so they are drawn once).
  const length = Math.min(ARROW_PX, 0.6 * (d.innerDiameterM / 2) * PX_PER_M)
  const arrows = vesselPressureStations(d).flatMap(({ point, normal }) =>
    ([1, -1] as const).filter((sign) => sign === 1 || point.y > 0).map((sign) => {
      const tip = { x: CX + point.x * PX_PER_M, y: CY - sign * point.y * PX_PER_M }
      const dir = { x: normal.x, y: -sign * normal.y }
      const tail = { x: tip.x - dir.x * length, y: tip.y - dir.y * length }
      const back = { x: tip.x - dir.x * HEAD_PX, y: tip.y - dir.y * HEAD_PX }
      const side = { x: -dir.y * HEAD_PX * 0.75, y: dir.x * HEAD_PX * 0.75 }
      const f = (q: { x: number; y: number }) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`
      return `M${f(tail)}L${f(tip)}M${f({ x: back.x + side.x, y: back.y + side.y })}L${f(tip)}L${f({ x: back.x - side.x, y: back.y - side.y })}`
    }),
  )
  return (
    <svg viewBox="0 0 360 164" role="img" aria-label={ELEVATION_LABEL} className="beam-scene vessel-elevation">
      <polygon points={cavity} className="vessel-cavity" />
      <polygon points={wall(1)} className="vessel-wall" />
      <polygon points={wall(-1)} className="vessel-wall" />
      <line x1={CX + ends - 8} y1={CY} x2={CX - ends + 8} y2={CY} className="vessel-axis" />
      <g className="vessel-pressure">
        {arrows.map((path, i) => (
          <path key={i} d={path} />
        ))}
      </g>
    </svg>
  )
}
