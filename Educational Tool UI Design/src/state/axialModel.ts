import { AXIAL_MODEL_REF, type AxialChallenge } from '../challenge/axial/types'
import type { Result } from '../challenge/types'
import { AXIAL_CONSTRAINT_ORDER } from '../evaluation/axial/constraints'
import { evaluateRod } from '../evaluation/axial/evaluate'
import { AXIAL_PRIMARY_METRIC } from '../evaluation/axial/metrics'
import type { AxialEvaluation } from '../evaluation/axial/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { axialDesignSchema, type AxialDesign } from '../geometry/axial/design'
import { applyAxialEdit, type AxialEdit } from '../geometry/axial/edit'
import { AXIAL_ERROR_CODES, validateAxialDesign, type AxialDesignError } from '../geometry/axial/validate'
import { analyzeRod, AxialInvariantError } from '../physics/axial/analyze'
import type { AxialAnalysis } from '../physics/axial/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Stress and Strain I model definition (task 72, model `axialTieRod` v1; MM-05, MM-13, MM-18,
// MM-19). Binds the pure rod modules to the learning-loop engine: v2 persistence, v2 design files
// and an elongation prediction that is not scorable without a finite metric.

export type AxialModelDefinition = ModelDefinition<AxialChallenge, AxialDesign, AxialAnalysis, AxialEvaluation, PredictionOutcomeV2, AxialDesignError>

/** Fresh design with keys in a fixed order. */
function cloneRod(d: Readonly<AxialDesign>): AxialDesign {
  return { id: d.id, diameterM: d.diameterM, materialId: d.materialId }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameRodIgnoringId(a: Readonly<AxialDesign>, b: Readonly<AxialDesign>): boolean {
  return Object.is(a.diameterM, b.diameterM) && a.materialId === b.materialId
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseRodDesign(value: Record<string, unknown>, ch: AxialChallenge): Result<AxialDesign, string[]> {
  const parsed = axialDesignSchema.safeParse(value)
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
  const errors = validateAxialDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneRod(parsed.data) }
}

export const axialModel: AxialModelDefinition = Object.freeze({
  ref: AXIAL_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateAxialDesign,
  cloneDesign: cloneRod,
  sameDesignIgnoringId: sameRodIgnoringId,
  analyze: analyzeRod,
  evaluate: evaluateRod,
  isInvariantError: (e: unknown): e is AxialInvariantError => e instanceof AxialInvariantError,
  primaryMetric: AXIAL_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) => scorePredictionByMetric(p, AXIAL_PRIMARY_METRIC.id, AXIAL_PRIMARY_METRIC.read(prev.analysis), AXIAL_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: AxialChallenge) => importDesignV2(json, ch, AXIAL_MODEL_REF, (d) => parseRodDesign(d, ch)),
  exportDesign: (d: AxialDesign, ch: AxialChallenge) => exportDesignV2(cloneRod(d), ch, AXIAL_MODEL_REF),
} satisfies AxialModelDefinition)

export type AxialSession = AnySession<AxialDesign, AxialAnalysis, AxialEvaluation, PredictionOutcomeV2, AxialDesignError>
export type AxialAction = SharedAction | { type: 'edit'; edit: AxialEdit }

/** Rod edits go through applyAxialEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceAxialEdit(s: AxialSession, a: { type: 'edit'; edit: AxialEdit }, ch: AxialChallenge): AxialSession {
  if (a.type !== 'edit') return s
  const r = applyAxialEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(axialModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for Stress and Strain I. */
export const axialReducer: (s: AxialSession, a: AxialAction, ch: AxialChallenge) => AxialSession = makeSessionReducer(axialModel, reduceAxialEdit)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const axialPersistence: V2Persistence<AxialChallenge, AxialDesign> = Object.freeze({
  parseDesign: parseRodDesign,
  errorCodes: AXIAL_ERROR_CODES,
  constraintIds: AXIAL_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
