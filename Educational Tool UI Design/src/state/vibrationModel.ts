import type { Result } from '../challenge/types'
import { VIBRATION_MODEL_REF, type VibrationChallenge } from '../challenge/vibration/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { VIBRATION_CONSTRAINT_ORDER } from '../evaluation/vibration/constraints'
import { evaluateIsolator } from '../evaluation/vibration/evaluate'
import { VIBRATION_PRIMARY_METRIC } from '../evaluation/vibration/metrics'
import type { VibrationEvaluation } from '../evaluation/vibration/types'
import { vibrationDesignSchema, type VibrationDesign } from '../geometry/vibration/design'
import { applyVibrationEdit, type VibrationEdit } from '../geometry/vibration/edit'
import { VIBRATION_DESIGN_ERROR_CODES, validateVibrationDesign, type VibrationDesignError } from '../geometry/vibration/validate'
import { analyzeIsolator, VibrationInvariantError } from '../physics/vibration/analyze'
import type { VibrationAnalysis } from '../physics/vibration/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Vibration Isolation I model definition (task 50.2; vibration-isolation-1, MM-05, MM-13,
// MM-18, MM-19). Binds the pure vibration modules to the learning-loop engine: v2 persistence,
// v2 design files and a worst-in-band-transmissibility prediction that is not scorable without a
// finite metric. Not registered in state/models.ts and not linked from the catalog: registration
// and card gating belong to 50.3 (VIB-16).

export type VibrationModelDefinition = ModelDefinition<
  VibrationChallenge,
  VibrationDesign,
  VibrationAnalysis,
  VibrationEvaluation,
  PredictionOutcomeV2,
  VibrationDesignError
>

/** Fresh design with keys in a fixed order. */
function cloneIsolator(d: Readonly<VibrationDesign>): VibrationDesign {
  return { id: d.id, stiffnessNPerM: d.stiffnessNPerM, materialId: d.materialId }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameIsolatorIgnoringId(a: Readonly<VibrationDesign>, b: Readonly<VibrationDesign>): boolean {
  return Object.is(a.stiffnessNPerM, b.stiffnessNPerM) && a.materialId === b.materialId
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseIsolatorDesign(value: Record<string, unknown>, ch: VibrationChallenge): Result<VibrationDesign, string[]> {
  const parsed = vibrationDesignSchema.safeParse(value)
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
  const errors = validateVibrationDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneIsolator(parsed.data) }
}

export const vibrationModel: VibrationModelDefinition = Object.freeze({
  ref: VIBRATION_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateVibrationDesign,
  cloneDesign: cloneIsolator,
  sameDesignIgnoringId: sameIsolatorIgnoringId,
  analyze: analyzeIsolator,
  evaluate: evaluateIsolator,
  isInvariantError: (e: unknown): e is VibrationInvariantError => e instanceof VibrationInvariantError,
  primaryMetric: VIBRATION_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) =>
    scorePredictionByMetric(p, VIBRATION_PRIMARY_METRIC.id, VIBRATION_PRIMARY_METRIC.read(prev.analysis), VIBRATION_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: VibrationChallenge) => importDesignV2(json, ch, VIBRATION_MODEL_REF, (d) => parseIsolatorDesign(d, ch)),
  exportDesign: (d: VibrationDesign, ch: VibrationChallenge) => exportDesignV2(cloneIsolator(d), ch, VIBRATION_MODEL_REF),
} satisfies VibrationModelDefinition)

export type VibrationSession = AnySession<VibrationDesign, VibrationAnalysis, VibrationEvaluation, PredictionOutcomeV2, VibrationDesignError>
export type VibrationAction = SharedAction | { type: 'edit'; edit: VibrationEdit }

/** Vibration edits go through applyVibrationEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceVibrationEdit(s: VibrationSession, a: { type: 'edit'; edit: VibrationEdit }, ch: VibrationChallenge): VibrationSession {
  if (a.type !== 'edit') return s
  const r = applyVibrationEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(vibrationModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for vibration challenges. */
export const vibrationReducer: (s: VibrationSession, a: VibrationAction, ch: VibrationChallenge) => VibrationSession =
  makeSessionReducer(vibrationModel, reduceVibrationEdit)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const vibrationPersistence: V2Persistence<VibrationChallenge, VibrationDesign> = Object.freeze({
  parseDesign: parseIsolatorDesign,
  errorCodes: VIBRATION_DESIGN_ERROR_CODES,
  constraintIds: VIBRATION_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
