import type { Challenge } from '../../challenge/types'
import type { BeamDesign } from '../../geometry/sections'
import { deflectionShape } from '../../physics/beam'
import type { Analysis } from '../../physics/types'

// Deformed-shape visualization (design "Deformed-shape visualization (display only)", Req 25.2,
// 25.3, 25.6). Display-only: every value here is read from the Challenge, the design, and an
// Analysis produced by `physics/analyze`. Nothing computed here flows back into results, and no
// input is mutated.

/** Everything the deformation needs, read once from (design, analysis, challenge). */
export interface DeformationParams {
  forceN: number
  lengthM: number
  elasticModulusPa: number
  /** Analysis.bendingInertiaM4 of the displayed (tested or baseline) snapshot. */
  bendingInertiaM4: number
  /** Analysis.tipDeflectionM of the displayed snapshot; equals deflectionShape at x = L. */
  tipDeflectionM: number
  /** Challenge visualization exaggeration factor k (15 for the MVP challenge). */
  exaggerationFactor: number
  /** Cap on the largest visual offset, as a fraction of L (0.3 for the MVP challenge). */
  maxVisualDeflectionFractionOfL: number
}

export function deformationParams(
  design: BeamDesign,
  analysis: Analysis,
  challenge: Challenge,
): DeformationParams {
  return {
    forceN: challenge.load.forceN,
    lengthM: design.lengthM,
    elasticModulusPa: challenge.material.elasticModulusPa,
    bendingInertiaM4: analysis.bendingInertiaM4,
    tipDeflectionM: analysis.tipDeflectionM,
    exaggerationFactor: challenge.visualization.exaggerationFactor,
    maxVisualDeflectionFractionOfL: challenge.visualization.maxVisualDeflectionFractionOfL,
  }
}

/**
 * Uniform factor applied to the physical deflection w(x) to get the visual offset:
 * min(k, f·L / δ_tip). Since w is largest at the tip, this is exactly
 * `wVis = min(k·w, f·L·(w / δ_tip))` from the design, applied uniformly along the beam so the
 * shape is preserved and the largest visual offset never exceeds f·L.
 * Returns 0 for a non-finite or non-positive tip deflection (nothing sensible to draw).
 */
export function visualDeflectionScale(p: DeformationParams): number {
  const k = p.exaggerationFactor
  if (!Number.isFinite(p.tipDeflectionM) || p.tipDeflectionM <= 0) return 0
  const capScale = (p.maxVisualDeflectionFractionOfL * p.lengthM) / p.tipDeflectionM
  const scale = Math.min(k, capScale)
  return Number.isFinite(scale) && scale > 0 ? scale : 0
}

/** Visual downward offset at x (metres, ≥ 0). x is clamped to [0, L] by `deflectionShape`. */
export function visualOffset(x: number, p: DeformationParams, scale = visualDeflectionScale(p)): number {
  const w = deflectionShape(p.forceN, p.lengthM, p.elasticModulusPa, p.bendingInertiaM4, x)
  return scale * w
}

/** Deformed Y of a vertex at (x, y0). The load acts in −Y, so the beam moves down. */
export function deformedVertexY(
  x: number,
  y0: number,
  p: DeformationParams,
  scale = visualDeflectionScale(p),
): number {
  return y0 - visualOffset(x, p, scale)
}
