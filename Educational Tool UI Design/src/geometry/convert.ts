import type { SectionDefaults, SectionKind, SectionLimits } from '../challenge/types'
import { GEOM_TOL, sectionBoundingBox, type Section } from './sections'

// Section-kind conversion (Req 6.9–6.11, decision D-12). Pure: inputs are never mutated.
//
// Outer size: the source's unrotated bounding box (b, h) is preserved, clamped to the target's
// ranges. Circle / tube targets use D = max(b, h); rectangle / I-section targets built from a
// circle or tube use b = h = D (which is what sectionBoundingBox already reports).
// Target ranges include the same derived lower bounds clampParam uses (see clamp.ts), so the
// thicknesses always have a non-empty permissible range:
//   tube D   ∈ [max(minD, 2·minWall), maxD]
//   I h      ∈ [max(minH, 2·minTf + minClearWeb), maxH]
//   I b      ∈ [max(minB, minTw), maxB]
// For well-formed challenges these derived bounds never bind.
//
// Thicknesses (Req 6.10): start at the challenge defaults. A default that would make the
// section invalid is replaced by the largest value of that thickness's permissible range
// (Req 6.1, with the outer dimensions already fixed):
//   tube wall t ∈ [minWall, D/2]   (from d ∈ [0, D − 2·minWall], t = (D − d)/2)
//                → fallback t = D/2, i.e. d = 0 (solid tube). The defaulted quantity is the wall,
//                  so "largest" is read for the wall, not for d.
//   I tf        ∈ [minTf, (h − minClearWeb)/2] → fallback (h − minClearWeb)/2
//   I tw        ∈ [minTw, b]                   → fallback b
// tf and tw are independent once b and h are fixed, so each is checked on its own.
//
// Same kind (Req 6.11): returns `from` itself (trivially deep-equal).

function clampTo(v: number, lo: number, hi: number): number {
  // `+ 0` normalizes −0 to 0. If lo > hi (inconsistent limits) the upper bound wins.
  return Math.min(hi, Math.max(lo, v)) + 0
}

function within(v: number, lo: number, hi: number): boolean {
  return Number.isFinite(v) && v > 0 && v >= lo - GEOM_TOL && v <= hi + GEOM_TOL
}

/** Converts `from` to kind `to`, preserving the clamped bounding box (see header). */
export function convertSection(
  from: Section,
  to: SectionKind,
  limits: SectionLimits,
  defaults: SectionDefaults,
): Section {
  if (to === from.kind) return from

  const { widthM: b, heightM: h } = sectionBoundingBox(from)
  const size = Math.max(b, h)

  switch (to) {
    case 'circle': {
      const r = limits.circle.diameterM
      return { kind: 'circle', diameterM: clampTo(size, r.minM, r.maxM) }
    }
    case 'tube': {
      const L = limits.tube
      const D = clampTo(size, Math.max(L.outerDiameterM.minM, 2 * L.minWallM), L.outerDiameterM.maxM)
      const wall = within(defaults.tubeWallM, L.minWallM, D / 2) ? defaults.tubeWallM : D / 2
      return { kind: 'tube', outerDiameterM: D, innerDiameterM: Math.max(0, D - 2 * wall) + 0 }
    }
    case 'rectangle': {
      const L = limits.rectangle
      return {
        kind: 'rectangle',
        widthM: clampTo(b, L.widthM.minM, L.widthM.maxM),
        heightM: clampTo(h, L.heightM.minM, L.heightM.maxM),
      }
    }
    case 'iSection': {
      const L = limits.iSection
      const width = clampTo(b, Math.max(L.widthM.minM, L.minWebThicknessM), L.widthM.maxM)
      const height = clampTo(
        h,
        Math.max(L.heightM.minM, 2 * L.minFlangeThicknessM + L.minClearWebHeightM),
        L.heightM.maxM,
      )
      const maxTf = (height - L.minClearWebHeightM) / 2
      const tf = within(defaults.iSectionFlangeThicknessM, L.minFlangeThicknessM, maxTf)
        ? defaults.iSectionFlangeThicknessM
        : maxTf
      const tw = within(defaults.iSectionWebThicknessM, L.minWebThicknessM, width)
        ? defaults.iSectionWebThicknessM
        : width
      return { kind: 'iSection', widthM: width, heightM: height, flangeThicknessM: tf, webThicknessM: tw }
    }
  }
}
