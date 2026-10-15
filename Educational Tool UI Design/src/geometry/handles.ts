import type { ParamRange, SectionLimits } from '../challenge/types'
import { permissibleRange } from './clamp'
import { PARAM_LABELS, type SectionParam } from './params'
import type { Orientation, Section, Vec2 } from './sections'

// Display-only drag-handle descriptors (no physics).
//
// Deviation from the design signature `handlesFor(s, o)`: a third `limits` argument is required
// because each descriptor carries its permissible range, which comes from the challenge.
//
// Axis rule (design "Coordinate and Axis Convention"): a parameter measured along local u maps to
// global Z at 0° and Y at 90°; one measured along local v maps to Y at 0° and Z at 90°.
// Width b and web thickness tw are u-measured; height h and flange thickness tf are v-measured.
// Diameters always use Y: their anchor is placed on whichever local axis maps onto global Y.
//
// `anchorM` is in unrotated section-local coordinates; the viewport applies the rotation.

export interface HandleDescriptor {
  param: SectionParam
  axis: 'Y' | 'Z'
  anchorM: Vec2
  label: string
  range: ParamRange
}

type LocalAxis = 'u' | 'v'

function globalAxis(local: LocalAxis, o: Orientation): 'Y' | 'Z' {
  if (o === 0) return local === 'u' ? 'Z' : 'Y'
  return local === 'u' ? 'Y' : 'Z'
}

/** Point at distance r from the centroid on the local axis that maps onto global +Y. */
function onGlobalY(r: number, o: Orientation): Vec2 {
  return o === 0 ? { u: 0, v: r } : { u: r, v: 0 }
}

/**
 * Handle drags dispatch clamp-mode sets, so minM/maxM are exactly clamp.ts's
 * `permissibleRange` (Req 6.1 dependent bounds, derived lower bounds, degenerate collapse).
 * stepM comes from the challenge; thickness steps reuse the step of the outer dimension they
 * depend on.
 */
function rangeOf(
  s: Section,
  param: SectionParam,
  limits: SectionLimits,
  stepM: number,
): ParamRange {
  const r = permissibleRange(s, param, limits)
  // Unreachable: handlesFor only asks for parameters of s.kind.
  if (r === null) throw new Error(`"${param}" is not a dimension of a ${s.kind} section.`)
  return { minM: r.minM, maxM: r.maxM, stepM }
}

function make(
  s: Section,
  param: SectionParam,
  local: LocalAxis,
  anchorM: Vec2,
  stepM: number,
  o: Orientation,
  limits: SectionLimits,
): HandleDescriptor {
  return {
    param,
    axis: globalAxis(local, o),
    anchorM,
    label: PARAM_LABELS[param],
    range: rangeOf(s, param, limits, stepM),
  }
}

/** Diameter handle: always on global Y. */
function diameter(
  s: Section,
  param: SectionParam,
  valueM: number,
  stepM: number,
  o: Orientation,
  limits: SectionLimits,
): HandleDescriptor {
  return {
    param,
    axis: 'Y',
    anchorM: onGlobalY(valueM / 2, o),
    label: PARAM_LABELS[param],
    range: rangeOf(s, param, limits, stepM),
  }
}

export function handlesFor(
  s: Section,
  o: Orientation,
  limits: SectionLimits,
): HandleDescriptor[] {
  switch (s.kind) {
    case 'circle':
      return [diameter(s, 'diameterM', s.diameterM, limits.circle.diameterM.stepM, o, limits)]
    case 'tube': {
      const step = limits.tube.outerDiameterM.stepM
      return [
        diameter(s, 'outerDiameterM', s.outerDiameterM, step, o, limits),
        diameter(s, 'innerDiameterM', s.innerDiameterM, step, o, limits),
      ]
    }
    case 'rectangle': {
      const L = limits.rectangle
      return [
        make(s, 'widthM', 'u', { u: s.widthM / 2, v: 0 }, L.widthM.stepM, o, limits),
        make(s, 'heightM', 'v', { u: 0, v: s.heightM / 2 }, L.heightM.stepM, o, limits),
      ]
    }
    case 'iSection': {
      const L = limits.iSection
      const hh = s.heightM / 2
      const tf = s.flangeThicknessM
      return [
        // Right edge of the top flange.
        make(s, 'widthM', 'u', { u: s.widthM / 2, v: hh - tf / 2 }, L.widthM.stepM, o, limits),
        // Top edge.
        make(s, 'heightM', 'v', { u: 0, v: hh }, L.heightM.stepM, o, limits),
        // Inner face of the top flange, midway between web and flange tip.
        make(
          s,
          'flangeThicknessM',
          'v',
          { u: s.widthM / 4, v: hh - tf },
          L.heightM.stepM,
          o,
          limits,
        ),
        // Right face of the web at mid-height.
        make(
          s,
          'webThicknessM',
          'u',
          { u: s.webThicknessM / 2, v: 0 },
          L.widthM.stepM,
          o,
          limits,
        ),
      ]
    }
  }
}
