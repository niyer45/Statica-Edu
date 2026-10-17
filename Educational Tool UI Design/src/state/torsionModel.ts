import { TORSION_MODEL_REF, type TorsionChallenge } from '../challenge/torsion/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import { evaluateShaft } from '../evaluation/torsion/evaluate'
import { TORSION_PRIMARY_METRIC } from '../evaluation/torsion/metrics'
import type { TorsionEvaluation } from '../evaluation/torsion/types'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import type { GeometryError } from '../geometry/sections'
import { torsionDesignSchema, type TorsionDesign, type TorsionSection } from '../geometry/torsion/design'
import { applyTorsionEdit, type TorsionEdit } from '../geometry/torsion/edit'
import { validateTorsionDesign } from '../geometry/torsion/validate'
import { analyzeShaft, TorsionInvariantError } from '../physics/torsion/analyze'
import type { TorsionAnalysis } from '../physics/torsion/types'
import type { Result } from '../challenge/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'
import { TORSION_CONSTRAINT_ORDER } from '../evaluation/torsion/constraints'

// Torsion Shaft I model definition (tasks 34.2/47.2; torsion-shaft-1, MM-05, MM-13, MM-18,
// MM-19). Binds the pure torsion modules to the learning-loop engine: v2 persistence, v2
// design files and a twist-angle prediction that is not scorable without a finite metric.
// Registered for dispatch only; no catalog entry links a torsion challenge until 47.3.

export type TorsionModelDefinition = ModelDefinition<TorsionChallenge, TorsionDesign, TorsionAnalysis, TorsionEvaluation, PredictionOutcomeV2>

/** Fresh design with sections and keys in a fixed order. */
function cloneShaft(d: Readonly<TorsionDesign>): TorsionDesign {
  const section: TorsionSection =
    d.section.kind === 'circle'
      ? { kind: 'circle', diameterM: d.section.diameterM }
      : { kind: 'tube', outerDiameterM: d.section.outerDiameterM, innerDiameterM: d.section.innerDiameterM }
  return { id: d.id, section, lengthM: d.lengthM, materialId: d.materialId }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameShaftIgnoringId(a: Readonly<TorsionDesign>, b: Readonly<TorsionDesign>): boolean {
  const sa = cloneShaft(a).section as unknown as Record<string, number | string>
  const sb = cloneShaft(b).section as unknown as Record<string, number | string>
  const keys = Object.keys(sa)
  return a.lengthM === b.lengthM && a.materialId === b.materialId && keys.length === Object.keys(sb).length && keys.every((k) => Object.is(sa[k], sb[k]))
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseShaftDesign(value: Record<string, unknown>, ch: TorsionChallenge): Result<TorsionDesign, string[]> {
  const parsed = torsionDesignSchema.safeParse(value)
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
  const errors = validateTorsionDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneShaft(parsed.data) }
}

export const torsionModel: TorsionModelDefinition = Object.freeze({
  ref: TORSION_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateTorsionDesign,
  cloneDesign: cloneShaft,
  sameDesignIgnoringId: sameShaftIgnoringId,
  analyze: analyzeShaft,
  evaluate: evaluateShaft,
  isInvariantError: (e: unknown): e is TorsionInvariantError => e instanceof TorsionInvariantError,
  primaryMetric: TORSION_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) => scorePredictionByMetric(p, TORSION_PRIMARY_METRIC.id, TORSION_PRIMARY_METRIC.read(prev.analysis), TORSION_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: TorsionChallenge) => importDesignV2(json, ch, TORSION_MODEL_REF, (d) => parseShaftDesign(d, ch)),
  exportDesign: (d: TorsionDesign, ch: TorsionChallenge) => exportDesignV2(cloneShaft(d), ch, TORSION_MODEL_REF),
} satisfies TorsionModelDefinition)

export type TorsionSession = AnySession<TorsionDesign, TorsionAnalysis, TorsionEvaluation, PredictionOutcomeV2, GeometryError>
export type TorsionAction = SharedAction | { type: 'edit'; edit: TorsionEdit }

/** Torsion edits go through applyTorsionEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceTorsionEdit(s: TorsionSession, a: { type: 'edit'; edit: TorsionEdit }, ch: TorsionChallenge): TorsionSession {
  if (a.type !== 'edit') return s
  const r = applyTorsionEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(torsionModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for torsion challenges. */
export const torsionReducer: (s: TorsionSession, a: TorsionAction, ch: TorsionChallenge) => TorsionSession = makeSessionReducer(torsionModel, reduceTorsionEdit)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const torsionPersistence: V2Persistence<TorsionChallenge, TorsionDesign> = Object.freeze({
  parseDesign: parseShaftDesign,
  errorCodes: ['NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'INNER_NOT_LESS_THAN_OUTER', 'WALL_TOO_THIN', 'SECTION_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED'] as const,
  constraintIds: TORSION_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
