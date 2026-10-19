import type { Result } from '../challenge/types'
import { VESSEL_MODEL_REF, type VesselChallenge } from '../challenge/vessel/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { VESSEL_CONSTRAINT_ORDER } from '../evaluation/vessel/constraints'
import { evaluateVessel } from '../evaluation/vessel/evaluate'
import { VESSEL_PRIMARY_METRIC } from '../evaluation/vessel/metrics'
import type { VesselEvaluation } from '../evaluation/vessel/types'
import { vesselDesignSchema, type VesselDesign } from '../geometry/vessel/design'
import { applyVesselEdit, type VesselEdit } from '../geometry/vessel/edit'
import { VESSEL_ERROR_CODES, validateVesselDesign, type VesselDesignError } from '../geometry/vessel/validate'
import { analyzeVessel, VesselInvariantError } from '../physics/vessel/analyze'
import type { VesselAnalysis } from '../physics/vessel/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Pressure Vessel I model definition (task 69, model `thinWallPressureVessel` v1; MM-05, MM-13,
// MM-18, MM-19). Binds the pure vessel modules to the learning-loop engine: v2 persistence, v2
// design files and a hoop-stress prediction.

export type VesselModelDefinition = ModelDefinition<
  VesselChallenge,
  VesselDesign,
  VesselAnalysis,
  VesselEvaluation,
  PredictionOutcomeV2,
  VesselDesignError
>

/** Fresh design with keys in a fixed order. */
function cloneVessel(d: Readonly<VesselDesign>): VesselDesign {
  return {
    id: d.id,
    innerDiameterM: d.innerDiameterM,
    shellLengthM: d.shellLengthM,
    shellThicknessM: d.shellThicknessM,
    headThicknessM: d.headThicknessM,
    materialId: d.materialId,
  }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameVesselIgnoringId(a: Readonly<VesselDesign>, b: Readonly<VesselDesign>): boolean {
  return (
    Object.is(a.innerDiameterM, b.innerDiameterM) &&
    Object.is(a.shellLengthM, b.shellLengthM) &&
    Object.is(a.shellThicknessM, b.shellThicknessM) &&
    Object.is(a.headThicknessM, b.headThicknessM) &&
    a.materialId === b.materialId
  )
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseVesselDesign(value: Record<string, unknown>, ch: VesselChallenge): Result<VesselDesign, string[]> {
  const parsed = vesselDesignSchema.safeParse(value)
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
  const errors = validateVesselDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneVessel(parsed.data) }
}

export const vesselModel: VesselModelDefinition = Object.freeze({
  ref: VESSEL_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateVesselDesign,
  cloneDesign: cloneVessel,
  sameDesignIgnoringId: sameVesselIgnoringId,
  analyze: analyzeVessel,
  evaluate: evaluateVessel,
  isInvariantError: (e: unknown): e is VesselInvariantError => e instanceof VesselInvariantError,
  primaryMetric: VESSEL_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) => scorePredictionByMetric(p, VESSEL_PRIMARY_METRIC.id, VESSEL_PRIMARY_METRIC.read(prev.analysis), VESSEL_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: VesselChallenge) => importDesignV2(json, ch, VESSEL_MODEL_REF, (d) => parseVesselDesign(d, ch)),
  exportDesign: (d: VesselDesign, ch: VesselChallenge) => exportDesignV2(cloneVessel(d), ch, VESSEL_MODEL_REF),
} satisfies VesselModelDefinition)

export type VesselSession = AnySession<VesselDesign, VesselAnalysis, VesselEvaluation, PredictionOutcomeV2, VesselDesignError>
export type VesselAction = SharedAction | { type: 'edit'; edit: VesselEdit }

/** Vessel edits go through applyVesselEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceVesselEdit(s: VesselSession, a: { type: 'edit'; edit: VesselEdit }, ch: VesselChallenge): VesselSession {
  if (a.type !== 'edit') return s
  const r = applyVesselEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(vesselModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for vessel challenges. */
export const vesselReducer: (s: VesselSession, a: VesselAction, ch: VesselChallenge) => VesselSession = makeSessionReducer(vesselModel, reduceVesselEdit)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const vesselPersistence: V2Persistence<VesselChallenge, VesselDesign> = Object.freeze({
  parseDesign: parseVesselDesign,
  errorCodes: VESSEL_ERROR_CODES,
  constraintIds: VESSEL_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
