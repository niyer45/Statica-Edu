import { BEAM_MODEL_REF, type Challenge, type ModelRef, type Result } from '../challenge/types'
import { evaluate } from '../evaluation/evaluate'
import { scorePrediction } from '../evaluation/prediction'
import type { Evaluation, Prediction, PredictionOutcome, TestResult } from '../evaluation/types'
import type { BeamDesign, GeometryError } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { analyze } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { exportDesign, importDesign } from './importExport'
import { cloneDesign, sameDesignIgnoringId } from './session'

// Model registry (task 34.1 step 1; multi-model-architecture MM-01–MM-07).
// Binds the pure domain layers of each analysis model behind one definition and dispatches
// only on explicit model identity. The beam definition wraps the existing functions without
// changing them, so beam results and v1 saves stay byte-compatible (MM-03, MM-17, D-39).
// Non-beam models register here in their tracks (46–50); none is registered yet.

export type { ModelRef }

export interface ModelDefinition<Ch, D, A, E> {
  ref: Readonly<ModelRef>
  /** Persistence envelope written and accepted for this model's sessions (MM-17, MM-18). */
  envelopeVersion: 1 | 2
  validateDesign(d: D, ch: Ch): GeometryError[]
  cloneDesign(d: Readonly<D>): D
  sameDesignIgnoringId(a: Readonly<D>, b: Readonly<D>): boolean
  /** Precondition: validateDesign is empty. Throws the model's invariant error otherwise. */
  analyze(d: D, ch: Ch): A
  evaluate(d: D, a: A, ch: Ch): E
  /** The metric whose change a prediction is scored against (MM-13). */
  primaryMetric: { id: string; label: string; read(a: A): number | undefined }
  scorePrediction(p: Prediction, prev: TestResult, next: A): PredictionOutcome
  importDesign(json: unknown, ch: Ch): Result<D, string[]>
  exportDesign(d: D, ch: Ch): string
}

export type BeamModelDefinition = ModelDefinition<Challenge, BeamDesign, Analysis, Evaluation>

export const beamModel: BeamModelDefinition = Object.freeze({
  ref: BEAM_MODEL_REF,
  envelopeVersion: 1,
  validateDesign,
  cloneDesign,
  sameDesignIgnoringId,
  analyze,
  evaluate,
  primaryMetric: Object.freeze({ id: 'tipDeflectionM', label: 'tip deflection', read: (a: Analysis) => a.tipDeflectionM }),
  scorePrediction,
  importDesign,
  exportDesign,
})

/** Every registered model, keyed by id. Exactly one version per id (MM-04). */
const REGISTRY: ReadonlyMap<string, BeamModelDefinition> = new Map([[beamModel.ref.id, beamModel]])

/** The registered model ids, for guard tests. */
export const REGISTERED_MODEL_IDS: readonly string[] = Object.freeze([...REGISTRY.keys()])

/** Explicit model identity of a challenge; a beam config without `model` is the beam (MM-02). */
export function modelOf(ch: Pick<Challenge, 'model'>): Readonly<ModelRef> {
  return ch.model ?? BEAM_MODEL_REF
}

/** The registered definition for an exact id and version, or undefined (MM-05, MM-07). */
export function modelFor(ref: Readonly<ModelRef>): BeamModelDefinition | undefined {
  const def = REGISTRY.get(ref.id)
  return def !== undefined && def.ref.version === ref.version ? def : undefined
}

export class UnregisteredModelError extends Error {
  constructor(ref: Readonly<ModelRef>) {
    super(`Analysis model "${ref.id}" version ${ref.version} is not available.`)
    this.name = 'UnregisteredModelError'
  }
}

/** The challenge's registered model; throws UnregisteredModelError instead of substituting one. */
export function requireModel(ch: Pick<Challenge, 'model'>): BeamModelDefinition {
  const ref = modelOf(ch)
  const def = modelFor(ref)
  if (def === undefined) throw new UnregisteredModelError(ref)
  return def
}
