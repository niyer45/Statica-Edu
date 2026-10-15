import type { Section, Vec2 } from './sections'

// Display-only cross-section outline (no physics). Coordinates are section-local (u, v) in metres,
// centred on the centroid, u to the right (width b) and v up (height h), unrotated.
//
// Winding: `outer` is counter-clockwise; every hole is clockwise, matching the three.js
// Shape/Path convention (holes wound opposite to the outer contour).

export const DEFAULT_SEGMENTS = 48
export const MIN_SEGMENTS = 8
export const MAX_SEGMENTS = 512

/** Integer in [MIN_SEGMENTS, MAX_SEGMENTS]; non-finite input falls back to the default. */
function normalizeSegments(segments: number): number {
  if (!Number.isFinite(segments)) return DEFAULT_SEGMENTS
  return Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(segments)))
}

/** `segments` points on a circle of radius r, counter-clockwise starting at +u. */
function circlePoints(r: number, segments: number): Vec2[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i * 2 * Math.PI) / segments
    return { u: r * Math.cos(a), v: r * Math.sin(a) }
  })
}

export function sectionOutline(
  s: Section,
  segments: number = DEFAULT_SEGMENTS,
): { outer: Vec2[]; holes: Vec2[][] } {
  const n = normalizeSegments(segments)
  switch (s.kind) {
    case 'circle':
      return { outer: circlePoints(s.diameterM / 2, n), holes: [] }
    case 'tube': {
      const outer = circlePoints(s.outerDiameterM / 2, n)
      // d = 0 means a solid tube: no hole.
      const holes = s.innerDiameterM > 0 ? [circlePoints(s.innerDiameterM / 2, n).reverse()] : []
      return { outer, holes }
    }
    case 'rectangle': {
      const hb = s.widthM / 2
      const hh = s.heightM / 2
      return {
        outer: [
          { u: -hb, v: -hh },
          { u: hb, v: -hh },
          { u: hb, v: hh },
          { u: -hb, v: hh },
        ],
        holes: [],
      }
    }
    case 'iSection': {
      // Same 12-point order as the template's BeamScene I-section; tf vertical, tw horizontal.
      const hb = s.widthM / 2
      const hh = s.heightM / 2
      const tf = s.flangeThicknessM
      const htw = s.webThicknessM / 2
      return {
        outer: [
          { u: -hb, v: -hh },
          { u: hb, v: -hh },
          { u: hb, v: -hh + tf },
          { u: htw, v: -hh + tf },
          { u: htw, v: hh - tf },
          { u: hb, v: hh - tf },
          { u: hb, v: hh },
          { u: -hb, v: hh },
          { u: -hb, v: hh - tf },
          { u: -htw, v: hh - tf },
          { u: -htw, v: -hh + tf },
          { u: -hb, v: -hh + tf },
        ],
        holes: [],
      }
    }
  }
}
