import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { checkApplicability } from './applicability'
import { maxMoment, nominalStress, tipDeflection } from './beam'
import { ASSUMPTIONS, UNSUPPORTED_EFFECTS } from './constants'
import { bendingProperties, sectionProperties } from './sectionProperties'
import type { Analysis, AnalysisBase, ModelId } from './types'

// Cantilever analysis entry point (Req 9.1–9.3, 9.10–9.12, 10.8, 10.9).
// Pure and deterministic: reads only the typed design and challenge, never mesh/UI state,
// clocks, or randomness, and never mutates its inputs.

export const MODEL_ID: ModelId = 'eulerBernoulliCantileverTipForce'

/** Thrown when a computed analysis value is non-finite or not strictly positive (Req 9.3). */
export class PhysicsInvariantError extends Error {
  /** Name of the offending Analysis field, e.g. `'areaM2'`. */
  readonly field: string
  /** The offending value. */
  readonly value: number

  constructor(field: string, value: number) {
    super(`Physics invariant violated: ${field} = ${String(value)} (expected finite and > 0)`)
    this.name = 'PhysicsInvariantError'
    this.field = field
    this.value = value
  }
}

/** Numeric fields checked in this order; the first offending one is reported. */
const NUMERIC_FIELDS = [
  'areaM2',
  'IxxM4',
  'IyyM4',
  'bendingInertiaM4',
  'extremeFiberM',
  'massKg',
  'tipDeflectionM',
  'maxMomentNm',
  'nominalMaxStressPa',
] as const satisfies readonly (keyof AnalysisBase)[]

/**
 * Analyzes a cantilever design under the challenge tip load.
 *
 * Precondition: `validateDesign(d, ch)` returns `[]`. This function does not call the
 * validator; callers (the session reducer, persistence re-analysis) must do so first.
 * When the precondition holds every numeric field is finite and > 0. Otherwise a
 * `PhysicsInvariantError` naming the first offending field is thrown and nothing is returned.
 *
 * The returned Analysis is deep-frozen. `applicable` is true iff `notApplicableReasons`
 * is empty, regardless of `warnings`.
 */
export function analyze(d: BeamDesign, ch: Challenge): Analysis {
  const F = ch.load.forceN
  const L = d.lengthM
  const E = ch.material.elasticModulusPa
  const rho = ch.material.densityKgM3

  const p = sectionProperties(d.section)
  const { I, c } = bendingProperties(p, d.orientationDeg)
  const M = maxMoment(F, L)

  const base: AnalysisBase = {
    modelId: MODEL_ID,
    unsupportedEffects: UNSUPPORTED_EFFECTS,
    assumptions: ASSUMPTIONS,
    areaM2: p.areaM2,
    IxxM4: p.IxxM4,
    IyyM4: p.IyyM4,
    bendingInertiaM4: I,
    extremeFiberM: c,
    massKg: rho * p.areaM2 * L,
    tipDeflectionM: tipDeflection(F, L, E, I),
    maxMomentNm: M,
    nominalMaxStressPa: nominalStress(M, c, I),
  }

  for (const field of NUMERIC_FIELDS) {
    const v = base[field]
    if (!Number.isFinite(v) || v <= 0) throw new PhysicsInvariantError(field, v)
  }

  const { warnings, notApplicable } = checkApplicability(d, base, ch)

  return deepFreeze({
    ...base,
    applicable: notApplicable.length === 0,
    warnings,
    notApplicableReasons: notApplicable,
  })
}
