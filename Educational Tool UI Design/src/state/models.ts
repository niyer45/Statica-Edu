import { BEAM_MODEL_REF, type Challenge, type ModelRef } from '../challenge/types'
import { evaluate } from '../evaluation/evaluate'
import { scorePrediction } from '../evaluation/prediction'
import type { Evaluation, PredictionOutcome } from '../evaluation/types'
import type { BeamDesign, GeometryError } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { analyze, PhysicsInvariantError } from '../physics/analyze'
import type { Analysis } from '../physics/types'
import { heatSinkModel, type HeatSinkModelDefinition } from './heatSinkModel'
import { bracketModel, type BracketModelDefinition } from './bracketModel'
import { bracedFrameModel, type BracedFrameModelDefinition } from './bracedFrameModel'
import { isFreshSessionWith, type ChallengeBase, type DesignBase, type DesignError, type EngineModel, type EvaluationBase } from './engine'
import { exportDesign, importDesign } from './importExport'
import { cloneDesign, sameDesignIgnoringId } from './session'
import { torsionModel, type TorsionModelDefinition } from './torsionModel'
import { vesselModel, type VesselModelDefinition } from './vesselModel'
import { vibrationModel, type VibrationModelDefinition } from './vibrationModel'

// Model registry (task 34.1 step 1; multi-model-architecture MM-01–MM-07).
// Binds the pure domain layers of each analysis model behind one definition and dispatches
// only on explicit model identity. The beam definition wraps the existing functions without
// changing them, so beam results and v1 saves stay byte-compatible (MM-03, MM-17, D-39).
// Non-beam models register here in their tracks (46–50). Registration enables dispatch only;
// a catalog entry becomes runnable solely through the bundled registry and its own gate.

export type { ModelRef }

/**
 * A registered analysis model: the engine contract (state/engine.ts; validation, analysis,
 * evaluation, prediction scoring, import) plus persistence and presentation metadata.
 * Analysis precondition: validateDesign is empty; otherwise analyze throws the model's
 * invariant error (MM-10).
 */
export interface ModelDefinition<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O = PredictionOutcome, Err extends DesignError = GeometryError>
  extends EngineModel<Ch, D, A, E, O, Err> {
  /** Persistence envelope written and accepted for this model's sessions (MM-17, MM-18). */
  envelopeVersion: 1 | 2
  /** The metric whose change a prediction is scored against (MM-13). */
  primaryMetric: { id: string; label: string; read(a: A): number | undefined }
  exportDesign(d: D, ch: Ch): string
}

export type BeamModelDefinition = ModelDefinition<Challenge, BeamDesign, Analysis, Evaluation>

export const beamModel: BeamModelDefinition = Object.freeze({
  ref: BEAM_MODEL_REF,
  envelopeVersion: 1,
  validateDesign,
  cloneDesign,
  sameDesignIgnoringId,
  // Called through the module bindings so existing physics/evaluation test doubles still apply.
  analyze: (d: BeamDesign, ch: Challenge) => analyze(d, ch),
  evaluate: (d: BeamDesign, a: Analysis, ch: Challenge) => evaluate(d, a, ch),
  isInvariantError: (e: unknown): e is PhysicsInvariantError => e instanceof PhysicsInvariantError,
  primaryMetric: Object.freeze({ id: 'tipDeflectionM', label: 'tip deflection', read: (a: Analysis) => a.tipDeflectionM }),
  scorePrediction,
  importDesign,
  exportDesign,
})

/** Any registered model definition. Dispatch narrows by identity (`def === beamModel`). */
export type RegisteredModel = BeamModelDefinition | TorsionModelDefinition | VibrationModelDefinition | HeatSinkModelDefinition | BracketModelDefinition | BracedFrameModelDefinition | VesselModelDefinition

/** Every registered model, keyed by id. Exactly one version per id (MM-04). */
const REGISTRY: ReadonlyMap<string, RegisteredModel> = new Map<string, RegisteredModel>([
  [beamModel.ref.id, beamModel],
  [torsionModel.ref.id, torsionModel],
  [vibrationModel.ref.id, vibrationModel],
  [heatSinkModel.ref.id, heatSinkModel],
  [bracketModel.ref.id, bracketModel],
  [bracedFrameModel.ref.id, bracedFrameModel],
  // Task 69 (D-59): Pressure Vessel I.
  [vesselModel.ref.id, vesselModel],
])

/** The registered model ids, for guard tests. */
export const REGISTERED_MODEL_IDS: readonly string[] = Object.freeze([...REGISTRY.keys()])

/** Explicit model identity of a challenge; a beam config without `model` is the beam (MM-02). */
export function modelOf(ch: { model?: Readonly<ModelRef> }): Readonly<ModelRef> {
  return ch.model ?? BEAM_MODEL_REF
}

/** The registered definition for an exact id and version, or undefined (MM-05, MM-07). */
export function modelFor(ref: Readonly<ModelRef>): RegisteredModel | undefined {
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
export function requireModel(ch: { model?: Readonly<ModelRef> }): RegisteredModel {
  const ref = modelOf(ch)
  const def = modelFor(ref)
  if (def === undefined) throw new UnregisteredModelError(ref)
  return def
}

/**
 * Task 60: whether a session already equals a fresh start of its challenge (baseline draft, only
 * the Baseline in history, nothing archived, compared, pending, reflected or submitted), using
 * the challenge's own registered model to compare designs. The shared workbench makes Reset to
 * baseline unavailable then; the engine's `resetDraft` applies the same rule.
 */
export function isFreshSession(ch: { model?: Readonly<ModelRef>; initialDesign: unknown }, s: Parameters<typeof isFreshSessionWith<unknown>>[1]): boolean {
  // Each definition compares its own design type; the challenge's model identity selects it.
  const def = requireModel(ch) as unknown as { sameDesignIgnoringId(a: unknown, b: unknown): boolean }
  return isFreshSessionWith(def.sameDesignIgnoringId, s, ch as { initialDesign: Readonly<unknown> })
}
