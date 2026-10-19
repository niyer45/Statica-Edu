import { COLUMN_MODEL_REF, type ColumnChallenge } from '../challenge/column/types'
import type { Result } from '../challenge/types'
import { COLUMN_CONSTRAINT_ORDER } from '../evaluation/column/constraints'
import { evaluateColumn } from '../evaluation/column/evaluate'
import { COLUMN_PRIMARY_METRIC } from '../evaluation/column/metrics'
import type { ColumnEvaluation } from '../evaluation/column/types'
import { scorePredictionByMetric } from '../evaluation/prediction'
import type { PredictionOutcomeV2 } from '../evaluation/types'
import { columnDesignSchema, type ColumnDesign, type ColumnSection } from '../geometry/column/design'
import { applyColumnEdit, type ColumnEdit } from '../geometry/column/edit'
import { COLUMN_ERROR_CODES, validateColumnDesign, type ColumnDesignError } from '../geometry/column/validate'
import { analyzeColumn, ColumnInvariantError } from '../physics/column/analyze'
import type { ColumnAnalysis } from '../physics/column/types'
import { acceptDraft, makeSessionReducer, rejectEdit, type AnySession, type SharedAction } from './engine'
import { exportDesignV2, importDesignV2 } from './importV2'
import type { ModelDefinition } from './models'
import type { V2Persistence } from './persistence'

// Column Buckling I model definition (task 68, model `eulerColumnBuckling` v1; MM-05, MM-13, MM-18,
// MM-19). Binds the pure column modules to the learning-loop engine: v2 persistence, v2 design
// files and a critical-buckling-load prediction that is not scorable without a finite metric.

export type ColumnModelDefinition = ModelDefinition<ColumnChallenge, ColumnDesign, ColumnAnalysis, ColumnEvaluation, PredictionOutcomeV2, ColumnDesignError>

/** Fresh design with sections and keys in a fixed order. */
function cloneColumn(d: Readonly<ColumnDesign>): ColumnDesign {
  const section: ColumnSection =
    d.section.kind === 'solid'
      ? { kind: 'solid', diameterM: d.section.diameterM }
      : { kind: 'tube', outerDiameterM: d.section.outerDiameterM, wallThicknessM: d.section.wallThicknessM }
  return { id: d.id, section, lengthM: d.lengthM, materialId: d.materialId }
}

/** Deep equality ignoring only `id` (Req 16.1 semantics). */
function sameColumnIgnoringId(a: Readonly<ColumnDesign>, b: Readonly<ColumnDesign>): boolean {
  const sa = cloneColumn(a).section as unknown as Record<string, number | string>
  const sb = cloneColumn(b).section as unknown as Record<string, number | string>
  const keys = Object.keys(sa)
  return (
    Object.is(a.lengthM, b.lengthM) &&
    a.materialId === b.materialId &&
    keys.length === Object.keys(sb).length &&
    keys.every((k) => Object.is(sa[k], sb[k]))
  )
}

/** Validates an untrusted design object (import, saved session) and rebuilds it. */
export function parseColumnDesign(value: Record<string, unknown>, ch: ColumnChallenge): Result<ColumnDesign, string[]> {
  const parsed = columnDesignSchema.safeParse(value)
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
  const errors = validateColumnDesign(parsed.data, ch)
  // Locked-field reasons first, as for the beam (Req 22.4 ordering).
  const ordered = [...errors.filter((e) => e.code === 'LOCKED_FIELD_CHANGED'), ...errors.filter((e) => e.code !== 'LOCKED_FIELD_CHANGED')]
  return ordered.length > 0 ? { ok: false, error: ordered.map((e) => e.message) } : { ok: true, value: cloneColumn(parsed.data) }
}

export const columnModel: ColumnModelDefinition = Object.freeze({
  ref: COLUMN_MODEL_REF,
  envelopeVersion: 2,
  validateDesign: validateColumnDesign,
  cloneDesign: cloneColumn,
  sameDesignIgnoringId: sameColumnIgnoringId,
  analyze: analyzeColumn,
  evaluate: evaluateColumn,
  isInvariantError: (e: unknown): e is ColumnInvariantError => e instanceof ColumnInvariantError,
  primaryMetric: COLUMN_PRIMARY_METRIC,
  scorePrediction: (p, prev, next) =>
    scorePredictionByMetric(p, COLUMN_PRIMARY_METRIC.id, COLUMN_PRIMARY_METRIC.read(prev.analysis), COLUMN_PRIMARY_METRIC.read(next)),
  importDesign: (json: unknown, ch: ColumnChallenge) => importDesignV2(json, ch, COLUMN_MODEL_REF, (d) => parseColumnDesign(d, ch)),
  exportDesign: (d: ColumnDesign, ch: ColumnChallenge) => exportDesignV2(cloneColumn(d), ch, COLUMN_MODEL_REF),
} satisfies ColumnModelDefinition)

export type ColumnSession = AnySession<ColumnDesign, ColumnAnalysis, ColumnEvaluation, PredictionOutcomeV2, ColumnDesignError>
export type ColumnAction = SharedAction | { type: 'edit'; edit: ColumnEdit }

/** Column edits go through applyColumnEdit; a rejected edit keeps the draft (Req 15.9). */
function reduceColumnEdit(s: ColumnSession, a: { type: 'edit'; edit: ColumnEdit }, ch: ColumnChallenge): ColumnSession {
  if (a.type !== 'edit') return s
  const r = applyColumnEdit(s.draft, a.edit, ch)
  return r.ok ? acceptDraft(columnModel, s, r.value, ch) : rejectEdit(s, r.error)
}

/** Session reducer for column challenges. */
export const columnReducer: (s: ColumnSession, a: ColumnAction, ch: ColumnChallenge) => ColumnSession = makeSessionReducer(columnModel, reduceColumnEdit)

/** v2 persistence metadata (MM-18): design re-validation, draft error codes, constraint ids. */
export const columnPersistence: V2Persistence<ColumnChallenge, ColumnDesign> = Object.freeze({
  parseDesign: parseColumnDesign,
  errorCodes: COLUMN_ERROR_CODES,
  constraintIds: COLUMN_CONSTRAINT_ORDER as unknown as readonly [string, ...string[]],
})
