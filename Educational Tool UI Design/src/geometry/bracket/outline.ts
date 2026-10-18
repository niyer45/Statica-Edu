import type { BracketDesign } from './design'

// Display geometry of the L-bracket side view (task 55). No physics. Coordinates are elevation
// metres: x from the wall face (0) outward along the arm, y up from the underside of the arm (0).
// The outer face of the flange lies on the wall (x = 0) from the top of the flange (y = H) down to
// the start of the bend (y = r_o). The bend is a quarter annulus centred at (r_o, r_o) with inner
// radius r_i and outer radius r_o = r_i + t, so it is tangent to the wall face, the underside of
// the arm, the inner flange face (x = t) and the top of the arm (y = t). The arm runs to the tip at
// x = a + tip overhang.

export interface ElevationPoint {
  x: number
  y: number
}

/** Arc segments per bend arc in the polyline. */
export const BEND_ARC_SEGMENTS = 12

/** Outer arm length from the wall face to the tip: load offset plus overhang, m. */
export function bracketArmLengthM(ch: { loadOffsetM: number; tipOverhangM: number }): number {
  return ch.loadOffsetM + ch.tipOverhangM
}

/** Height of the bolt row above the underside of the arm: H − bolt edge distance, m. */
export function bracketBoltRowHeightM(d: Pick<BracketDesign, 'flangeHeightM'>, ch: { bolts: { edgeDistanceM: number } }): number {
  return d.flangeHeightM - ch.bolts.edgeDistanceM
}

/** Outer bend radius r_o = r_i + t, m. The flange leaves the wall below y = r_o (the heel). */
export function bracketOuterRadiusM(d: Pick<BracketDesign, 'innerRadiusM' | 'thicknessM'>): number {
  return d.innerRadiusM + d.thicknessM
}

function arc(cx: number, cy: number, r: number, from: number, to: number, segments: number): ElevationPoint[] {
  const pts: ElevationPoint[] = []
  for (let i = 0; i <= segments; i++) {
    const t = from + ((to - from) * i) / segments
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

/**
 * Closed side-view outline, counter-clockwise (y up): from the top of the flange at the wall down
 * the outer face, around the outer bend arc, along the underside of the arm to the tip, up the
 * tip face, back along the top of the arm, around the inner bend arc and up the inner flange face.
 * The last point is not repeated. Arc end points are pinned to their tangent points.
 */
export function bracketOutline(d: BracketDesign, armLengthM: number, segments: number = BEND_ARC_SEGMENTS): ElevationPoint[] {
  const n = Math.max(1, Math.floor(segments))
  const t = d.thicknessM
  const H = d.flangeHeightM
  const ri = d.innerRadiusM
  const ro = ri + t
  const outer = arc(ro, ro, ro, Math.PI, 1.5 * Math.PI, n)
  outer[0] = { x: 0, y: ro }
  outer[n] = { x: ro, y: 0 }
  const inner = arc(ro, ro, ri, 1.5 * Math.PI, Math.PI, n)
  inner[0] = { x: ro, y: t }
  inner[n] = { x: t, y: ro }
  return [{ x: 0, y: H }, ...outer, { x: armLengthM, y: 0 }, { x: armLengthM, y: t }, ...inner, { x: t, y: H }]
}

/**
 * End points of the radial line across the middle of the bend (at 45°), from the inner fibre to
 * the outer fibre: where the display marks the critical section.
 */
export function bracketBendSection(d: Pick<BracketDesign, 'innerRadiusM' | 'thicknessM'>): { inner: ElevationPoint; outer: ElevationPoint } {
  const ro = d.innerRadiusM + d.thicknessM
  const c = Math.SQRT1_2
  return {
    inner: { x: ro - d.innerRadiusM * c, y: ro - d.innerRadiusM * c },
    outer: { x: ro - ro * c, y: ro - ro * c },
  }
}
