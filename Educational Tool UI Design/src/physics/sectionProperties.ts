import type { Orientation, Section } from '../geometry/sections'

// Closed-form section properties (Req 8.1, 8.2). Pure and deterministic.
// Local axes: u horizontal (width b), v vertical (height h). Ixx is about the
// horizontal centroidal axis (resists vertical bending at 0°).

export interface SectionProperties {
  areaM2: number
  IxxM4: number
  IyyM4: number
  /** Half the unrotated height (h/2; D/2 for circle/tube). */
  cVerticalM: number
  /** Half the unrotated width (b/2; D/2 for circle/tube). */
  cHorizontalM: number
}

/** Precondition: `validateSection(s, limits)` returns `[]`. All outputs are finite and > 0. */
export function sectionProperties(s: Section): SectionProperties {
  switch (s.kind) {
    case 'circle': {
      const d = s.diameterM
      const I = (Math.PI * d ** 4) / 64
      return { areaM2: (Math.PI * d ** 2) / 4, IxxM4: I, IyyM4: I, cVerticalM: d / 2, cHorizontalM: d / 2 }
    }
    case 'tube': {
      const D = s.outerDiameterM
      const d = s.innerDiameterM
      const I = (Math.PI * (D ** 4 - d ** 4)) / 64
      return {
        areaM2: (Math.PI * (D ** 2 - d ** 2)) / 4,
        IxxM4: I,
        IyyM4: I,
        cVerticalM: D / 2,
        cHorizontalM: D / 2,
      }
    }
    case 'rectangle': {
      const b = s.widthM
      const h = s.heightM
      return {
        areaM2: b * h,
        IxxM4: (b * h ** 3) / 12,
        IyyM4: (h * b ** 3) / 12,
        cVerticalM: h / 2,
        cHorizontalM: b / 2,
      }
    }
    case 'iSection': {
      const { widthM: b, heightM: h, flangeThicknessM: tf, webThicknessM: tw } = s
      const hw = h - 2 * tf // clear web height, computed once
      return {
        areaM2: 2 * b * tf + tw * hw,
        IxxM4: (b * h ** 3 - (b - tw) * hw ** 3) / 12,
        IyyM4: (2 * tf * b ** 3 + hw * tw ** 3) / 12,
        cVerticalM: h / 2,
        cHorizontalM: b / 2,
      }
    }
  }
}

/**
 * Bending inertia and extreme-fibre distance for the vertical tip load.
 * 0°: bending about the local horizontal axis (Ixx, h/2).
 * 90°: section rotated, so Iyy governs and the vertical extent is the unrotated width (b/2).
 */
export function bendingProperties(p: SectionProperties, o: Orientation): { I: number; c: number } {
  return o === 0 ? { I: p.IxxM4, c: p.cVerticalM } : { I: p.IyyM4, c: p.cHorizontalM }
}
