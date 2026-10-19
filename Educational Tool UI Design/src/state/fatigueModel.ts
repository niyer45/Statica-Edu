import { FATIGUE_MODEL_REF, type FatigueChallenge } from '../challenge/fatigue/types'
import type { Result } from '../challenge/types'
import { FATIGUE_CONSTRAINT_ORDER } from '../evaluation/fatigue/constraints'
import { evaluateFatigue } from '../evaluation/fatigue/evaluate'
import { FATIGUE_PRIMARY_METRIC } from '../evaluation/fatigue/metrics'
import type { FatigueEvaluation } from '../evaluation/fatigue/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { fatigueDesignSchema, type FatigueDesign } from '../geometry/fatigue/design'
import { applyFatigueEdit, type FatigueEdit } from '../geometry/fatigue/edit'
import { FATIGUE_ERROR_CODES, validateFatigueDesign, type FatigueDesignError } from '../geometry/fatigue/validate'
import { analyzeFatigue, FatigueInvariantError } from '../physics/fatigue/analyze'
import type { FatigueAnalysis } from '../physics/fatigue/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Fatigue Analysis I model definition (task 70, model `steppedShaftFatigue` v1; MM-05, MM-13,
// MM-18, MM-19). Binds the pure fatigue modules to the learning-loop engine: v2 persistence, v2
// design files and a fatigue-safety-factor prediction.

export type FatigueModelDefinition = ModelDefinition<FatigueChallenge, FatigueDesign, FatigueAnalysis, FatigueEvaluation, PredictionOutcomeV2, FatigueDesignError>

/** Fresh design with keys in a fixed order. */
function cloneFatigue(d: Readonly<FatigueDesign>): FatigueDesign {
  return {
    id: d.id,
    neckDiameterM: d.neckDiameterM,
    collarDiameterM: d.collarDiameterM,
    filletRadiusM: d.filletRadiusM,
    surfaceFinish: d.surfaceFinish,
    materialId: d.materialId,
  }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameFatigueIgnoringId(a: Readonly<FatigueDesign>, b: Readonly<FatigueDesign>): boolean {
  return (
    Object.is(a.neckDiameterM, b.neckDiameterM) &&
    Object.is(a.collarDiameterM, b.collarDiameterM) &&
    Object.is(a.filletRadiusM, b.filletRadiusM) &&
    a.surfaceFinish === b.surfaceFinish &&
    a.materialId === b.materialId
  )
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseFatigueDesign(value: Record<string, unknown>, ch: FatigueChallenge): Result<FatigueDesign, string[]> {
  const parsed = fatigueDesignSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.flatMap((issue) =>
        issue.code === 'unrecognized_keys'
          ? issue.keys.map((k) => `Unexpected key "${['design', ...issue.path, k].join('.')}" is not part of the design file format.`)
          : [`${['design', ...issue.path].join('.')}: ${issue.message}`],
      ),
    }
  }
  const errors = validateFatigueDesign(parsed.data, ch)
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneFatigue(parsed.data) }
}

export const fatigueModel: FatigueModelDefinition = Object.freeze({
  ref: FATIGUE_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateFatigueDesign,
  cloneDesign: cloneFatigue,
  sameDesignIgnoringId: sameFatigueIgnoringId,
  analyze: analyzeFatigue,
  evaluate: evaluateFatigue,
  isInvariantError: (e: unknown): e is FatigueInvariantError => e instanceof FatigueInvariantError,
  primaryMetric: FATIGUE_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) => scorePredictionByMetric(p, FATIGUE_PRIMARY_METRIC.id, FATIGUE_PRIMARY_METRIC.read(prev.analysis), FATIGUE_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: FatigueChallenge) => importDesignV2(json, ch, FATIGUE_MODEL_REF, (d) => parseFatigueDesign(d, ch)),
  exportDesign: (d: FatigueDesign, ch: FatigueChallenge) => exportDesignV2(cloneFatigue(d), ch, FATIGUE_MODEL_REF),
} satisfies FatigueModelDefinition)

export type FatigueSession = AnySession<FatigueDesign, FatigueAnalysis, FatigueEvaluation, PredictionOutcomeV2, FatigueDesignError>
export type FatigueAction = SharedAction | { type: 'edit'; edit: FatigueEdit }

/** Fatigue edits go through applyFatigueEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceFatigueEdit(s: FatigueSession, a: { type: 'edit'; edit: FatigueEdit }, ch: FatigueChallenge): FatigueSession {
  if (a.type !== 'edit') return s
  const r = applyFatigueEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(fatigueModel, s, r.value, ch) : rejectEdit(s, r.error)
}

export const fatigueReducer: (s: FatigueSession, a: FatigueAction, ch: FatigueChallenge) => FatigueSession = makeSessionReducer(fatigueModel, reduceFatigueEdit)

export const fatiguePersistence: V2Persistence<FatigueChallenge, FatigueDesign> = Object.freeze({
  parseDesign: parseFatigueDesign,
  errorCodes: FATIGUE_ERROR_CODES,
  constraintIds: FATIGUE_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
