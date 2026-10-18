import { HEAT_SINK_MODEL_REF, type HeatSinkChallenge } from '../challenge/heatSink/types'
import type { Result } from '../challenge/types'
import { HEAT_SINK_CONSTRAINT_ORDER } from '../evaluation/heatSink/constraints'
import { evaluateHeatSink } from '../evaluation/heatSink/evaluate'
import { HEAT_SINK_PRIMARY_METRIC } from '../evaluation/heatSink/metrics'
import type { HeatSinkEvaluation } from '../evaluation/heatSink/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { heatSinkDesignSchema, type HeatSinkDesign } from '../geometry/heatSink/design'
import { applyHeatSinkEdit, type HeatSinkEdit } from '../geometry/heatSink/edit'
import { HEAT_SINK_GEOMETRY_ERROR_CODES, validateHeatSinkDesign, type HeatSinkGeometryError } from '../geometry/heatSink/validate'
import { analyzeHeatSink, HeatSinkInvariantError } from '../physics/heatSink/analyze'
import type { HeatSinkAnalysis } from '../physics/heatSink/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Heat Sink I model definition (task 48.2; heat-sink-1, MM-05, MM-13, MM-18, MM-19). Binds the
// pure heat sink modules to the learning-loop engine: v2 persistence, v2 design files and a
// base-temperature-rise prediction that is not scorable without a finite metric. Registered for
// dispatch in state/models.ts (48.3); the catalog card stays unavailable until owner-approved
// activation (HSK-16).

export type HeatSinkModelDefinition = ModelDefinition<
  HeatSinkChallenge,
  HeatSinkDesign,
  HeatSinkAnalysis,
  HeatSinkEvaluation,
  PredictionOutcomeV2,
  HeatSinkGeometryError
>

/** Fresh design with keys in a fixed order. */
function cloneHeatSink(d: Readonly<HeatSinkDesign>): HeatSinkDesign {
  return { id: d.id, finCount: d.finCount, finThicknessM: d.finThicknessM, finHeightM: d.finHeightM, materialId: d.materialId }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameHeatSinkIgnoringId(a: Readonly<HeatSinkDesign>, b: Readonly<HeatSinkDesign>): boolean {
  return (
    Object.is(a.finCount, b.finCount) &&
    Object.is(a.finThicknessM, b.finThicknessM) &&
    Object.is(a.finHeightM, b.finHeightM) &&
    a.materialId === b.materialId
  )
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseHeatSinkDesign(value: Record<string, unknown>, ch: HeatSinkChallenge): Result<HeatSinkDesign, string[]> {
  const parsed = heatSinkDesignSchema.safeParse(value)
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
  const errors = validateHeatSinkDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneHeatSink(parsed.data) }
}

export const heatSinkModel: HeatSinkModelDefinition = Object.freeze({
  ref: HEAT_SINK_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateHeatSinkDesign,
  cloneDesign: cloneHeatSink,
  sameDesignIgnoringId: sameHeatSinkIgnoringId,
  analyze: analyzeHeatSink,
  evaluate: evaluateHeatSink,
  isInvariantError: (e: unknown): e is HeatSinkInvariantError => e instanceof HeatSinkInvariantError,
  primaryMetric: HEAT_SINK_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) =>
    scorePredictionByMetric(p, HEAT_SINK_PRIMARY_METRIC.id, HEAT_SINK_PRIMARY_METRIC.read(prev.analysis), HEAT_SINK_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: HeatSinkChallenge) => importDesignV2(json, ch, HEAT_SINK_MODEL_REF, (d) => parseHeatSinkDesign(d, ch)),
  exportDesign: (d: HeatSinkDesign, ch: HeatSinkChallenge) => exportDesignV2(cloneHeatSink(d), ch, HEAT_SINK_MODEL_REF),
} satisfies HeatSinkModelDefinition)

export type HeatSinkSession = AnySession<HeatSinkDesign, HeatSinkAnalysis, HeatSinkEvaluation, PredictionOutcomeV2, HeatSinkGeometryError>
export type HeatSinkAction = SharedAction | { type: 'edit'; edit: HeatSinkEdit }

/** Heat sink edits go through applyHeatSinkEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceHeatSinkEdit(s: HeatSinkSession, a: { type: 'edit'; edit: HeatSinkEdit }, ch: HeatSinkChallenge): HeatSinkSession {
  if (a.type !== 'edit') return s
  const r = applyHeatSinkEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(heatSinkModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for heat sink challenges. */
export const heatSinkReducer: (s: HeatSinkSession, a: HeatSinkAction, ch: HeatSinkChallenge) => HeatSinkSession = makeSessionReducer(
  heatSinkModel,
  reduceHeatSinkEdit,
)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const heatSinkPersistence: V2Persistence<HeatSinkChallenge, HeatSinkDesign> = Object.freeze({
  parseDesign: parseHeatSinkDesign,
  errorCodes: HEAT_SINK_GEOMETRY_ERROR_CODES,
  constraintIds: HEAT_SINK_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
