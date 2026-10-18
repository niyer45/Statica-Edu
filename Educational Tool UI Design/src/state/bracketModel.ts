import { BRACKET_MODEL_REF, type BracketChallenge } from '../challenge/bracket/types'
import type { Result } from '../challenge/types'
import { BRACKET_CONSTRAINT_ORDER } from '../evaluation/bracket/constraints'
import { evaluateBracket } from '../evaluation/bracket/evaluate'
import { BRACKET_PRIMARY_METRIC } from '../evaluation/bracket/metrics'
import type { BracketEvaluation } from '../evaluation/bracket/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { bracketDesignSchema, type BracketDesign } from '../geometry/bracket/design'
import { applyBracketEdit, type BracketEdit } from '../geometry/bracket/edit'
import { BRACKET_ERROR_CODES, validateBracketDesign, type BracketDesignError } from '../geometry/bracket/validate'
import { analyzeBracket, BracketInvariantError } from '../physics/bracket/analyze'
import type { BracketAnalysis } from '../physics/bracket/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Mounting Bracket I model definition (task 46.2; mounting-bracket-1, MM-05, MM-13, MM-18,
// MM-19). Binds the pure bracket modules to the learning-loop engine: v2 persistence, v2 design
// files and a peak-stress prediction that is not scorable when either result has no peak stress
// (Kt fit undefined). Registered for dispatch in 46.3 (state/models.ts, state/runtimes.ts); no
// catalog entry links a bracket challenge until its owner-approved activation.

export type BracketModelDefinition = ModelDefinition<
  BracketChallenge,
  BracketDesign,
  BracketAnalysis,
  BracketEvaluation,
  PredictionOutcomeV2,
  BracketDesignError
>

/** Fresh design with keys in a fixed order. */
function cloneBracket(d: Readonly<BracketDesign>): BracketDesign {
  return {
    id: d.id,
    rootDepthM: d.rootDepthM,
    armDepthM: d.armDepthM,
    stepLocationM: d.stepLocationM,
    filletRadiusM: d.filletRadiusM,
    materialId: d.materialId,
  }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameBracketIgnoringId(a: Readonly<BracketDesign>, b: Readonly<BracketDesign>): boolean {
  return (
    Object.is(a.rootDepthM, b.rootDepthM) &&
    Object.is(a.armDepthM, b.armDepthM) &&
    Object.is(a.stepLocationM, b.stepLocationM) &&
    Object.is(a.filletRadiusM, b.filletRadiusM) &&
    a.materialId === b.materialId
  )
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseBracketDesign(value: Record<string, unknown>, ch: BracketChallenge): Result<BracketDesign, string[]> {
  const parsed = bracketDesignSchema.safeParse(value)
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
  const errors = validateBracketDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneBracket(parsed.data) }
}

export const bracketModel: BracketModelDefinition = Object.freeze({
  ref: BRACKET_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateBracketDesign,
  cloneDesign: cloneBracket,
  sameDesignIgnoringId: sameBracketIgnoringId,
  analyze: analyzeBracket,
  evaluate: evaluateBracket,
  isInvariantError: (e: unknown): e is BracketInvariantError => e instanceof BracketInvariantError,
  primaryMetric: BRACKET_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) => scorePredictionByMetric(p, BRACKET_PRIMARY_METRIC.id, BRACKET_PRIMARY_METRIC.read(prev.analysis), BRACKET_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: BracketChallenge) => importDesignV2(json, ch, BRACKET_MODEL_REF, (d) => parseBracketDesign(d, ch)),
  exportDesign: (d: BracketDesign, ch: BracketChallenge) => exportDesignV2(cloneBracket(d), ch, BRACKET_MODEL_REF),
} satisfies BracketModelDefinition)

export type BracketSession = AnySession<BracketDesign, BracketAnalysis, BracketEvaluation, PredictionOutcomeV2, BracketDesignError>
export type BracketAction = SharedAction | { type: 'edit'; edit: BracketEdit }

/** Bracket edits go through applyBracketEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceBracketEdit(s: BracketSession, a: { type: 'edit'; edit: BracketEdit }, ch: BracketChallenge): BracketSession {
  if (a.type !== 'edit') return s
  const r = applyBracketEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(bracketModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for bracket challenges. */
export const bracketReducer: (s: BracketSession, a: BracketAction, ch: BracketChallenge) => BracketSession = makeSessionReducer(bracketModel, reduceBracketEdit)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const bracketPersistence: V2Persistence<BracketChallenge, BracketDesign> = Object.freeze({
  parseDesign: parseBracketDesign,
  errorCodes: BRACKET_ERROR_CODES,
  constraintIds: BRACKET_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
