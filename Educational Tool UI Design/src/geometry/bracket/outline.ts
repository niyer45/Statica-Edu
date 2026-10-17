import { isUniformBar, type BracketDesign } from './design'

// Display-only elevation outline of the stepped bracket (task 46.2; MBR-18, design.md
// "Integration notes"). No physics: the fillet arcs are drawn for the elevation SVG only and
// their material and stiffness are neglected by the model. Coordinates are elevation metres:
// x from the wall clamp (0) to the tip (L), y from the bar centreline (+ up).
//
// Each opposite shoulder fillet is a quarter-circle-type arc of radius r tangent to the arm face
// at (a + r, ±d/2), centred at (a + r, ±(d/2 + r)). When r ≤ h = (D − d)/2 the arc starts on the
// shoulder face at (a, ±(d/2 + r)), so the outline runs along the shoulder face from the deep
// face down to it. When r > h the arc meets the deep face directly, at the point where it
// reaches y = ±D/2 (design.md: "arcs tangent to the arm face and meeting the deep face").
// A uniform bar (d = D) is a plain rectangle.

export interface ElevationPoint {
  x: number
  y: number
}

/** Arc segments per fillet in the polyline. */
export const FILLET_ARC_SEGMENTS = 12

/** The upper edge from the wall (0, D/2) to the tip (L, d/2), fillet sampled as a polyline. */
function upperEdge(d: BracketDesign, lengthM: number, segments: number): ElevationPoint[] {
  const D = d.rootDepthM
  const dArm = d.armDepthM
  const a = d.stepLocationM
  const r = d.filletRadiusM
  if (isUniformBar(d)) return [{ x: 0, y: D / 2 }, { x: lengthM, y: D / 2 }]
  const h = (D - dArm) / 2
  const cx = a + r
  const cy = dArm / 2 + r
  // Start angle: π on the shoulder face (r ≤ h), otherwise where the arc meets y = D/2.
  const alpha = r > h ? Math.asin((r - h) / r) : 0
  const start = Math.PI + alpha
  const end = 1.5 * Math.PI
  const pts: ElevationPoint[] = [{ x: 0, y: D / 2 }]
  for (let i = 0; i <= segments; i++) {
    const t = start + ((end - start) * i) / segments
    // For r ≥ h the first arc point lies on the deep face: pin y to avoid rounding drift.
    const y = i === 0 && r >= h ? D / 2 : cy + r * Math.sin(t)
    pts.push({ x: i === segments ? cx : cx + r * Math.cos(t), y: i === segments ? dArm / 2 : y })
  }
  if (r < h) pts.splice(1, 0, { x: a, y: D / 2 })
  pts.push({ x: lengthM, y: dArm / 2 })
  return pts
}

/**
 * Closed elevation outline, clockwise (y up) from the wall top: upper edge to the tip, down the
 * tip face, then the mirrored lower edge back to the wall. Precondition: the design is valid and
 * a + r < L. The last point is not repeated.
 */
export function bracketOutline(d: BracketDesign, lengthM: number, segments: number = FILLET_ARC_SEGMENTS): ElevationPoint[] {
  const upper = upperEdge(d, lengthM, Math.max(1, Math.floor(segments)))
  const lower = upper.map((p) => ({ x: p.x, y: -p.y })).reverse()
  return [...upper, ...lower]
}
