import { BRACED_FRAME_MODEL_REF, type BracedFrameChallenge } from '../challenge/bracedFrame/types'
import type { Result } from '../challenge/types'
import { BRACED_FRAME_CONSTRAINT_ORDER } from '../evaluation/bracedFrame/constraints'
import { evaluateBracedFrame } from '../evaluation/bracedFrame/evaluate'
import { BRACED_FRAME_PRIMARY_METRIC } from '../evaluation/bracedFrame/metrics'
import type { BracedFrameEvaluation } from '../evaluation/bracedFrame/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { bracedFrameDesignSchema, type BracedFrameDesign, type BracedFrameMembers } from '../geometry/bracedFrame/design'
import { applyBracedFrameEdit, type BracedFrameEdit } from '../geometry/bracedFrame/edit'
import { DIAGONAL_IDS, FIXED_MEMBER_IDS, FRAME_MEMBER_IDS } from '../geometry/bracedFrame/template'
import { BRACED_FRAME_DESIGN_ERROR_CODES, validateBracedFrameDesign, type BracedFrameDesignError } from '../geometry/bracedFrame/validate'
import { analyzeBracedFrame, BracedFrameInvariantError } from '../physics/bracedFrame/analyze'
import type { BracedFrameAnalysis } from '../physics/bracedFrame/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Braced Frame I model definition (task 49.2; braced-frame-1, MM-05, MM-10, MM-13, MM-18,
// MM-19). Binds the pure braced-frame modules to the learning-loop engine: v2 persistence, v2
// design files and a roof-drift prediction that is not scorable when either side is a
// mechanism. Not registered in state/models.ts and not linked from any catalog entry: dispatch
// registration and card gating belong to the integration step (49.3).

export type BracedFrameModelDefinition = ModelDefinition<
  BracedFrameChallenge,
  BracedFrameDesign,
  BracedFrameAnalysis,
  BracedFrameEvaluation,
  PredictionOutcomeV2,
  BracedFrameDesignError
>

/** Fresh design with members and keys in a fixed order. */
function cloneFrame(d: Readonly<BracedFrameDesign>): BracedFrameDesign {
  const members = {} as Record<string, { sectionId: string } | { present: boolean; sectionId: string }>
  for (const id of FIXED_MEMBER_IDS) members[id] = { sectionId: d.members[id].sectionId }
  for (const id of DIAGONAL_IDS) members[id] = { present: d.members[id].present, sectionId: d.members[id].sectionId }
  return { id: d.id, materialId: d.materialId, members: members as BracedFrameMembers }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameFrameIgnoringId(a: Readonly<BracedFrameDesign>, b: Readonly<BracedFrameDesign>): boolean {
  if (a.materialId !== b.materialId) return false
  return FRAME_MEMBER_IDS.every((id) => {
    const ma = a.members[id] as { present?: boolean; sectionId: string }
    const mb = b.members[id] as { present?: boolean; sectionId: string }
    return ma.sectionId === mb.sectionId && ma.present === mb.present
  })
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseBracedFrameDesign(value: Record<string, unknown>, ch: BracedFrameChallenge): Result<BracedFrameDesign, string[]> {
  const parsed = bracedFrameDesignSchema.safeParse(value)
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
  const errors = validateBracedFrameDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneFrame(parsed.data) }
}

export const bracedFrameModel: BracedFrameModelDefinition = Object.freeze({
  ref: BRACED_FRAME_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateBracedFrameDesign,
  cloneDesign: cloneFrame,
  sameDesignIgnoringId: sameFrameIgnoringId,
  analyze: analyzeBracedFrame,
  evaluate: evaluateBracedFrame,
  isInvariantError: (e: unknown): e is BracedFrameInvariantError => e instanceof BracedFrameInvariantError,
  primaryMetric: BRACED_FRAME_PRIMARY_METRIC,
  // A mechanism on either side has no roof drift, so the outcome is not scorable (MM-13).
  scorePrediction: (p, prev, next) =>
    scorePredictionByMetric(p, BRACED_FRAME_PRIMARY_METRIC.id, BRACED_FRAME_PRIMARY_METRIC.read(prev.analysis), BRACED_FRAME_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: BracedFrameChallenge) => importDesignV2(json, ch, BRACED_FRAME_MODEL_REF, (d) => parseBracedFrameDesign(d, ch)),
  exportDesign: (d: BracedFrameDesign, ch: BracedFrameChallenge) => exportDesignV2(cloneFrame(d), ch, BRACED_FRAME_MODEL_REF),
} satisfies BracedFrameModelDefinition)

export type BracedFrameSession = AnySession<BracedFrameDesign, BracedFrameAnalysis, BracedFrameEvaluation, PredictionOutcomeV2, BracedFrameDesignError>
export type BracedFrameAction = SharedAction | { type: 'edit'; edit: BracedFrameEdit }

/** Frame edits go through applyBracedFrameEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceBracedFrameEdit(s: BracedFrameSession, a: { type: 'edit'; edit: BracedFrameEdit }, ch: BracedFrameChallenge): BracedFrameSession {
  if (a.type !== 'edit') return s
  const r = applyBracedFrameEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(bracedFrameModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for braced-frame challenges. */
export const bracedFrameReducer: (s: BracedFrameSession, a: BracedFrameAction, ch: BracedFrameChallenge) => BracedFrameSession = makeSessionReducer(
  bracedFrameModel,
  reduceBracedFrameEdit,
)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const bracedFramePersistence: V2Persistence<BracedFrameChallenge, BracedFrameDesign> = Object.freeze({
  parseDesign: parseBracedFrameDesign,
  errorCodes: BRACED_FRAME_DESIGN_ERROR_CODES,
  constraintIds: BRACED_FRAME_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
