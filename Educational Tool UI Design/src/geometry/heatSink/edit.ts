import type { HeatSinkChallenge, HeatSinkDesignLimits } from '../../challenge/heatSink/types'
import type { Result } from '../../challenge/types'
import { GEOM_TOL } from '../sections'
import { finGap, type FinArray, type HeatSinkDesign } from './design'
import { MIN_FIN_COUNT, validateFinArray, validateHeatSinkDesign, type HeatSinkGeometryError } from './validate'

// Heat sink edit operations (task 48.2; HSK-04, HSK-14, MM-09). Pure: inputs are never mutated;
// a changed design is always a new object. Same clamp/strict semantics as the torsion edits:
//
// Permissible ranges (clamp mode), for the other parameters held fixed:
//   finCount      N ∈ [max(2, minN), largest N ≤ maxN whose gap s(N, t) ≥ minGeometricGapM]
//   finThicknessM t ∈ [minT, largest on-step t ≤ maxT whose gap s(N, t) ≥ minGeometricGapM]
//   finHeightM    H ∈ [minH, maxH]
// The gap falls as N or t grows (ds/dN = (t − W)/(N − 1)² < 0 and ds/dt = −N/(N − 1) < 0), so
// each feasible set is an interval starting at the range minimum. Degenerate ranges (lower >
// upper, only for an invalid draft or inconsistent limits) collapse to the current value.
// Snapping: clamp mode rounds N to the nearest integer and t/H to the nearest grid value
// min + k·step before clamping, so a clamped value always passes the integer and step rules.
// Grid values are quantized to whole nanometres so they equal their decimal literals
// (0.001 + 0.0005 → 0.0015 exactly).
// Unsupported inputs: a non-finite value or an unknown parameter makes clampHeatSinkParam return
// the input design unchanged (same object); trySetHeatSinkParam and applyHeatSinkEdit reject an
// unknown parameter with UNKNOWN_PARAM naming it.
//
// applyHeatSinkEdit is the design-level entry point (MM-09): it either returns a new design that
// passes validateHeatSinkDesign or the errors for the candidate, so callers keep their draft
// unchanged on failure. The locked materialId is not editable through any edit.

export const HEAT_SINK_DESIGN_PARAMS = ['finCount', 'finThicknessM', 'finHeightM'] as const

export type HeatSinkDesignParam = (typeof HEAT_SINK_DESIGN_PARAMS)[number]

export function isHeatSinkParam(param: string): param is HeatSinkDesignParam {
  return (HEAT_SINK_DESIGN_PARAMS as readonly string[]).includes(param)
}

/** Rounds metres to whole nanometres; `+ 0` normalizes −0 to 0. */
export function quantizeM(v: number): number {
  return Math.round(v * 1e9) / 1e9 + 0
}

/** Same test as the validator's GAP_TOO_SMALL rule. */
function gapOk(baseWidthM: number, N: number, t: number, limits: HeatSinkDesignLimits): boolean {
  return finGap(baseWidthM, N, t) >= limits.minGeometricGapM - GEOM_TOL
}

function bounds(min: number, max: number, current: number): { min: number; max: number } {
  return min > max ? { min: current, max: current } : { min, max }
}

/**
 * The range clampHeatSinkParam clamps `param` into for fins `f` (other parameters fixed), or null
 * for an unknown param. Fin count is in fins; thickness and height in metres.
 */
export function heatSinkPermissibleRange(
  f: FinArray,
  param: string,
  limits: HeatSinkDesignLimits,
  baseWidthM: number,
): { min: number; max: number } | null {
  if (!isHeatSinkParam(param)) return null
  const g = limits.minGeometricGapM
  if (param === 'finHeightM') return bounds(limits.finHeightM.minM, limits.finHeightM.maxM, f.finHeightM)
  if (param === 'finCount') {
    const r = limits.finCount
    const lo = Math.max(MIN_FIN_COUNT, r.min)
    // N ≤ (W + g)/(t + g) is the gap rule solved for N; step down until the validator agrees.
    let hi = Math.min(r.max, Math.floor((baseWidthM + g) / (f.finThicknessM + g)) + 1)
    while (hi >= lo && !gapOk(baseWidthM, hi, f.finThicknessM, limits)) hi--
    return bounds(lo, hi, f.finCount)
  }
  const r = limits.finThicknessM
  // t ≤ (W − g(N − 1))/N is the gap rule solved for t; step down until the validator agrees.
  const cap = Math.min(r.maxM, (baseWidthM - g * (f.finCount - 1)) / f.finCount)
  let k = Math.floor((cap - r.minM) / r.stepM) + 1
  const at = (i: number) => quantizeM(r.minM + i * r.stepM)
  while (k >= 0 && (at(k) > r.maxM + GEOM_TOL || !gapOk(baseWidthM, f.finCount, at(k), limits))) k--
  return k < 0 ? { min: f.finThicknessM, max: f.finThicknessM } : bounds(r.minM, at(k), f.finThicknessM)
}

/** Nearest allowed value before clamping: an integer count, or an on-grid length. */
function snap(param: HeatSinkDesignParam, value: number, limits: HeatSinkDesignLimits): number {
  if (param === 'finCount') return Math.round(value) + 0
  const r = limits[param]
  return quantizeM(r.minM + Math.round((value - r.minM) / r.stepM) * r.stepM)
}

/**
 * Clamp-mode set: snaps `value` to the parameter's grid and clamps it into its permissible range.
 * For a valid input the result is valid. Non-finite value or unknown param → returns `d` unchanged.
 */
export function clampHeatSinkParam<D extends FinArray>(
  d: D,
  param: string,
  value: number,
  limits: HeatSinkDesignLimits,
  baseWidthM: number,
): D {
  if (!Number.isFinite(value)) return d
  const r = heatSinkPermissibleRange(d, param, limits, baseWidthM)
  if (r === null || !isHeatSinkParam(param)) return d
  // `+ 0` normalizes −0 to 0.
  const v = Math.min(r.max, Math.max(r.min, snap(param, value, limits))) + 0
  return { ...d, [param]: v }
}

function unknownParam(param: string): { ok: false; error: HeatSinkGeometryError[] } {
  return {
    ok: false,
    error: [{ code: 'UNKNOWN_PARAM', param, message: `"${param}" is not an adjustable heat sink parameter (fin count, fin thickness, fin height).` }],
  }
}

/**
 * Strict-mode set: replaces only `param` (no snapping or coupling). Succeeds iff the candidate fin
 * array validates; otherwise fails with every validator error for the candidate.
 */
export function trySetHeatSinkParam<D extends FinArray>(
  d: D,
  param: string,
  value: number,
  limits: HeatSinkDesignLimits,
  baseWidthM: number,
): Result<D, HeatSinkGeometryError[]> {
  if (!isHeatSinkParam(param)) return unknownParam(param)
  const candidate: D = { ...d, [param]: value }
  const errors = validateFinArray(candidate, limits, baseWidthM)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}

/** The single design-level edit: set one fin parameter (count in fins, lengths in metres). */
export type HeatSinkEdit = { type: 'setParam'; param: string; value: number; mode: 'clamp' | 'strict' }

/** The challenge fields applyHeatSinkEdit reads. */
export type HeatSinkEditContext = Pick<HeatSinkChallenge, 'initialDesign' | 'designLimits' | 'base'>

/**
 * Applies one edit to `draft`. Returns a new valid design, or every validator error for the
 * candidate (the caller keeps `draft`). An unknown parameter reports UNKNOWN_PARAM naming it.
 */
export function applyHeatSinkEdit(
  draft: HeatSinkDesign,
  edit: HeatSinkEdit,
  ch: HeatSinkEditContext,
): Result<HeatSinkDesign, HeatSinkGeometryError[]> {
  if (!isHeatSinkParam(edit.param)) return unknownParam(edit.param)
  let candidate: HeatSinkDesign
  if (edit.mode === 'strict') {
    const r = trySetHeatSinkParam(draft, edit.param, edit.value, ch.designLimits, ch.base.widthM)
    if (!r.ok) return r
    candidate = r.value
  } else {
    candidate = clampHeatSinkParam(draft, edit.param, edit.value, ch.designLimits, ch.base.widthM)
    // A non-finite clamp value leaves the design unchanged; still return a fresh object.
    if (candidate === draft) candidate = { ...draft }
  }
  const errors = validateHeatSinkDesign(candidate, ch)
  return errors.length === 0 ? { ok: true, value: candidate } : { ok: false, error: errors }
}
