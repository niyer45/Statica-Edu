import type { Result, SectionKind, SectionLimits } from '../challenge/types'
import { SECTION_PARAMS, type SectionParam } from './params'
import { GEOM_TOL, type GeometryError, type Section } from './sections'
import { validateSection } from './validate'

// Clamp-mode and strict-mode parameter setters (Req 6.1–6.5, 6.7). Pure: inputs are never
// mutated; a changed section is always a new object.
//
// Exports shared with handles / numeric controls:
//   SECTION_PARAMS, paramsOf(kind)  parameter names per kind, in validator order (from params.ts)
//   permissibleRange(s, p, limits)  the [minM, maxM] that clampParam clamps p into for section s
//
// Permissible ranges (Req 6.1). Dependent thicknesses, read from the current section:
//   tube d   ∈ [0, max(0, D − 2·minWall)]
//   I tf     ∈ [minTf, (h − minClearWeb)/2]
//   I tw     ∈ [minTw, b]
// Derived lower bounds on outer dimensions (not in Req 6.1, needed so the coupled shrink of
// Req 6.2 cannot push a thickness below its own minimum and make the result invalid):
//   tube D   ≥ 2·minWall               (d may shrink to 0, so D/2 must still be a full wall)
//   I h      ≥ 2·minTf + minClearWeb   (tf may shrink to (h − minClearWeb)/2, which must be ≥ minTf)
//   I b      ≥ minTw                   (tw may shrink to b, which must be ≥ minTw)
// For well-formed challenges (e.g. cantilever-beam-1) these never bind: the challenge range
// minimums already exceed them.
// Degenerate ranges: if a computed lower bound exceeds its upper bound (only possible for
// inconsistent limits, or a valid section sitting inside GEOM_TOL slack), the range collapses
// to the parameter's current value, so the section is returned unchanged and stays valid.
//
// Coupled shrink (Req 6.2) triggers use the validator's own comparisons, so a coupled
// thickness changes only when keeping it would actually fail validation, and only ever shrinks.
//
// Unsupported inputs: a non-finite value, or a parameter that is not one of the section kind's
// parameters, makes clampParam return the input section unchanged (same object).
// trySetParam rejects an unknown parameter with a SECTION_NOT_ALLOWED error naming it, since
// GeometryErrorCode has no dedicated code for that case.

export { SECTION_PARAMS, type SectionParam }

/** Parameter names of a section kind, in validator order. */
export function paramsOf(kind: SectionKind): readonly SectionParam[] {
  return SECTION_PARAMS[kind]
}

function isParamOf(kind: SectionKind, param: string): param is SectionParam {
  return (SECTION_PARAMS[kind] as readonly string[]).includes(param)
}

function read(s: Section, param: SectionParam): number {
  return (s as unknown as Record<string, number>)[param] as number
}

function bounds(minM: number, maxM: number, current: number): { minM: number; maxM: number } {
  return minM > maxM ? { minM: current, maxM: current } : { minM, maxM }
}

/**
 * The range clampParam clamps `param` into for section `s` (see the header for the dependent
 * and derived bounds). Returns null if `param` is not a parameter of `s.kind`.
 */
export function permissibleRange(
  s: Section,
  param: string,
  limits: SectionLimits,
): { minM: number; maxM: number } | null {
  if (!isParamOf(s.kind, param)) return null
  const cur = read(s, param)
  switch (s.kind) {
    case 'circle':
      return bounds(limits.circle.diameterM.minM, limits.circle.diameterM.maxM, cur)
    case 'tube': {
      const L = limits.tube
      if (param === 'outerDiameterM') {
        return bounds(Math.max(L.outerDiameterM.minM, 2 * L.minWallM), L.outerDiameterM.maxM, cur)
      }
      return bounds(0, Math.max(0, s.outerDiameterM - 2 * L.minWallM), cur)
    }
    case 'rectangle': {
      const r = param === 'widthM' ? limits.rectangle.widthM : limits.rectangle.heightM
      return bounds(r.minM, r.maxM, cur)
    }
    case 'iSection': {
      const L = limits.iSection
      switch (param) {
        case 'widthM':
          return bounds(Math.max(L.widthM.minM, L.minWebThicknessM), L.widthM.maxM, cur)
        case 'heightM':
          return bounds(
            Math.max(L.heightM.minM, 2 * L.minFlangeThicknessM + L.minClearWebHeightM),
            L.heightM.maxM,
            cur,
          )
        case 'flangeThicknessM':
          return bounds(L.minFlangeThicknessM, (s.heightM - L.minClearWebHeightM) / 2, cur)
        default:
          return bounds(L.minWebThicknessM, s.widthM, cur)
      }
    }
  }
}

/**
 * Clamp-mode set (Req 6.1–6.4): sets `param` to `valueM` clamped into its permissible range and
 * shrinks coupled thicknesses only when needed to stay valid. For a valid input the result is
 * valid. Non-finite value or unknown param → returns `s` unchanged.
 */
export function clampParam(
  s: Section,
  param: string,
  valueM: number,
  limits: SectionLimits,
): Section {
  if (!Number.isFinite(valueM)) return s
  const r = permissibleRange(s, param, limits)
  if (r === null) return s
  // `+ 0` normalizes −0 to 0.
  const v = Math.min(r.maxM, Math.max(r.minM, valueM)) + 0

  switch (s.kind) {
    case 'circle':
    case 'rectangle':
      return { ...s, [param]: v }
    case 'tube': {
      if (param === 'innerDiameterM') return { ...s, innerDiameterM: v }
      const minWall = limits.tube.minWallM
      const d = s.innerDiameterM
      // Same test as the validator's INNER_NOT_LESS_THAN_OUTER / WALL_TOO_THIN rules.
      const keep = d < v && (v - d) / 2 >= minWall - GEOM_TOL
      return {
        ...s,
        outerDiameterM: v,
        innerDiameterM: keep ? d : Math.max(0, v - 2 * minWall),
      }
    }
    case 'iSection': {
      const L = limits.iSection
      if (param === 'heightM') {
        const tf = s.flangeThicknessM
        const overlap = v - 2 * tf < L.minClearWebHeightM - GEOM_TOL
        return {
          ...s,
          heightM: v,
          flangeThicknessM: overlap ? (v - L.minClearWebHeightM) / 2 : tf,
        }
      }
      if (param === 'widthM') {
        const tw = s.webThicknessM
        return { ...s, widthM: v, webThicknessM: tw > v + GEOM_TOL ? v : tw }
      }
      return { ...s, [param]: v }
    }
  }
}

/**
 * Strict-mode set (Req 6.5, 6.7): replaces only `param` (no coupling). Succeeds iff the
 * candidate validates; otherwise fails with every validator error for the candidate. A
 * non-finite value always fails with a NON_FINITE error for `param`.
 */
export function trySetParam(
  s: Section,
  param: string,
  valueM: number,
  limits: SectionLimits,
): Result<Section, GeometryError[]> {
  if (!isParamOf(s.kind, param)) {
    return {
      ok: false,
      error: [
        {
          code: 'SECTION_NOT_ALLOWED',
          param,
          message: `"${param}" is not a dimension of a ${s.kind} section.`,
        },
      ],
    }
  }
  const candidate = { ...s, [param]: valueM } as Section
  const errors = validateSection(candidate, limits)
  if (!Number.isFinite(valueM) && !errors.some((e) => e.code === 'NON_FINITE' && e.param === param)) {
    // Defensive: the validator already reports this; never let a non-finite value through.
    errors.unshift({ code: 'NON_FINITE', param, message: `${param} must be a finite number (got ${String(valueM)}).` })
  }
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
