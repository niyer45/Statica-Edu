import { z } from 'zod'
import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge, ModelRef, Result } from '../challenge/types'
import type { Prediction } from '../evaluation/types'
import { draftStatusWith, type ChallengeBase, type DesignBase, type DesignError, type EngineModel, type EvaluationBase, type TestResultOf } from './engine'
import { importDesign } from './importExport'
import { migrateEnvelope } from './migrations'
import { beamModel, requireModel } from './models'
import type { SessionState, SessionStateOf } from './session'

const status = z.enum(['accepted', 'notAccepted', 'modelNotApplicable'])
const number = z.number().finite()
const efficiency = z.object({ massUsage: number, deflectionMargin: number, stressMargin: number }).strict()
const direction = z.enum(['increase', 'decrease', 'same'])
const prediction = z.object({ iteration: z.number().int().positive(), direction, explanation: z.string().max(500).optional(), createdAt: z.string() }).strict()
const failures = z.array(z.enum(['deflection', 'stress', 'mass', 'envelopeWidth', 'envelopeHeight', 'featureGeometry', 'applicability']))
const beamErrorCode = z.enum(['NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'INNER_NOT_LESS_THAN_OUTER', 'WALL_TOO_THIN', 'FLANGES_OVERLAP', 'WEB_WIDER_THAN_FLANGE', 'FLANGE_TOO_THIN', 'WEB_TOO_THIN', 'SECTION_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED', 'BAD_ORIENTATION'])
/** Session shape shared by the v1 (beam) and v2 envelopes; models supply codes and ids (task 34.2). */
function sessionShape(errorCode: z.ZodTypeAny, failureIds: z.ZodTypeAny, efficiencySchema: z.ZodTypeAny) {
  const resultSchema = z.object({
    id: z.string().min(1), iteration: z.number().int().nonnegative(), label: z.string().optional(),
    designSnapshot: z.unknown(), analysis: z.unknown(), evaluation: z.unknown(), accepted: z.boolean(), failures: failureIds,
    prediction: prediction.optional(), predictionOutcome: z.unknown().optional(), timestamp: z.string(),
  }).strict()
  return z.object({
    schemaVersion: z.literal(1), challengeId: z.string(), challengeVersion: z.number().int().positive(),
    mode: z.enum(['guided', 'parametric']), draft: z.unknown(), draftStatus: z.enum(['draft', 'tested']),
    draftErrors: z.array(z.object({ code: errorCode, param: z.string().optional(), message: z.string() }).strict()),
    history: z.array(resultSchema).min(1), pendingPrediction: prediction.optional(), compareSelection: z.array(z.string()).max(3),
    deletedIterationIds: z.array(z.string()).optional(),
    reflectionAnswer: z.string().max(2000),
    submission: z.object({ testResultId: z.string(), status, reflection: z.string().max(2000), efficiency: efficiencySchema, submittedAt: z.string() }).strict().optional(),
    ui: z.object({ predictionDialogOpen: z.boolean(), notice: z.object({ kind: z.enum(['info', 'error']), message: z.string() }).strict().optional() }).strict(),
  }).strict()
}
const sessionSchema = sessionShape(beamErrorCode, failures, efficiency)
const undefinedField = z.enum(['pendingPrediction', 'submission', 'ui.notice'])
const envelopeSchema = z.object({ schemaVersion: z.literal(1), savedAt: z.string().datetime(), session: sessionSchema, undefinedFields: z.array(undefinedField) }).strict()

/** JSON-safe structural comparison; every numeric result must agree within 1e-9 relative. */
function agrees(actual: unknown, expected: unknown): boolean {
  if (typeof expected === 'number') return typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9 * Math.max(Math.abs(actual), Math.abs(expected))
  if (expected === null || typeof expected !== 'object') return actual === expected
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false
  const a = actual as Record<string, unknown>, e = expected as Record<string, unknown>
  const keys = Object.keys(e)
  return Object.keys(a).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(a, key) && agrees(a[key], e[key]))
}
function rejectKeys(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unexpected saved session key')
    rejectKeys((value as Record<string, unknown>)[key])
  }
}
function checkedDesign(value: unknown, ch: Challenge) {
  const checked = importDesign({ format: 'ei-design', schemaVersion: 1, challengeId: ch.id, design: value }, ch)
  if (!checked.ok) throw new Error(checked.error.join(' '))
  return checked.value
}
export const sessionKey = (ch: Pick<Challenge, 'id' | 'version'>) => `ei:session:${ch.id}:v${ch.version}`

/** Time is injected by the store; the deterministic default supports pure round-trip callers. */
export function serializeSession(s: SessionState, savedAt = '1970-01-01T00:00:00.000Z'): string {
  const undefinedFields: string[] = []
  for (const key of ['pendingPrediction', 'submission'] as const) if (Object.prototype.hasOwnProperty.call(s, key) && s[key] === undefined) undefinedFields.push(key)
  if (Object.prototype.hasOwnProperty.call(s.ui, 'notice') && s.ui.notice === undefined) undefinedFields.push('ui.notice')
  return JSON.stringify({ schemaVersion: 1, savedAt, session: s, undefinedFields })
}

/** Parsed session fields the shared restore core reads (v1 and v2 schemas both produce them). */
interface ParsedSession {
  challengeId: string
  challengeVersion: number
  mode: string
  draft: unknown
  draftStatus: 'draft' | 'tested'
  history: { id: string; iteration: number; label?: string; designSnapshot: unknown; analysis: unknown; evaluation: unknown; accepted: boolean; failures: string[]; prediction?: Prediction; predictionOutcome?: unknown }[]
  deletedIterationIds?: string[]
  compareSelection: string[]
  pendingPrediction?: Prediction
  submission?: { testResultId: string; status: string; reflection: string; efficiency: unknown }
  ui: { notice?: unknown }
}

/**
 * Shared all-or-nothing restore (tasks 20.1, 34.2): re-validates every design, re-analyzes
 * and re-evaluates every result with `model`, verifies prediction outcomes, checkpoints,
 * deletion/comparison/submission references and explicit-undefined fields. Throws on any
 * mismatch; callers turn the throw into a rejected load.
 */
function restoreParsed<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O, Err extends DesignError>(
  model: EngineModel<Ch, D, A, E, O, Err>,
  saved: ParsedSession,
  undefinedFields: readonly string[],
  ch: Ch,
  checkDesign: (value: unknown) => D,
): SessionStateOf<D, TestResultOf<D, A, E, O>, Err, E['efficiency']> {
  type R = TestResultOf<D, A, E, O>
  if (saved.challengeId !== ch.id || saved.challengeVersion !== ch.version || !(ch.allowedModes as readonly string[]).includes(saved.mode)) throw new Error('Saved challenge mismatch')
  const draft = checkDesign(saved.draft)
  const history: R[] = []
  for (const [index, result] of saved.history.entries()) {
    if (result.iteration !== index || history.some((r) => r.id === result.id)) throw new Error('Invalid history order or duplicate id')
    const design = checkDesign(result.designSnapshot)
    if (index === 0 && (!model.sameDesignIgnoringId(design, ch.initialDesign) || result.label !== 'Baseline' || result.prediction !== undefined || result.predictionOutcome !== undefined)) throw new Error('Invalid baseline')
    if (ch.predictionPolicy.requiredOnIterations.includes(index) && !result.prediction) throw new Error('Missing checkpoint prediction')
    if (result.prediction && result.prediction.iteration !== index) throw new Error('Prediction iteration mismatch')
    const analysis = model.analyze(design, ch)
    const evaluation = model.evaluate(design, analysis, ch)
    if (!agrees(result.analysis, analysis) || !agrees(result.evaluation, evaluation) || result.accepted !== evaluation.accepted || !agrees(result.failures, evaluation.failures)) throw new Error('Saved results differ from recomputed results')
    const outcome = result.prediction && index > 0 ? model.scorePrediction(result.prediction, history[index - 1]!, analysis) : undefined
    if (!agrees(result.predictionOutcome, outcome)) throw new Error('Invalid prediction outcome')
    history.push(deepFreeze({ ...result, designSnapshot: design }) as unknown as R)
  }
  if (draftStatusWith(model.sameDesignIgnoringId, draft, history) !== saved.draftStatus) throw new Error('Invalid draft status')
  const deleted = saved.deletedIterationIds ?? []
  if (new Set(deleted).size !== deleted.length || deleted.some((id) => !history.some((r) => r.id === id && r.iteration > 0))) throw new Error('Invalid deleted iteration')
  if (saved.compareSelection.some((id) => deleted.includes(id)) || (saved.submission && deleted.includes(saved.submission.testResultId))) throw new Error('Deleted iteration reference')
  if (new Set(saved.compareSelection).size !== saved.compareSelection.length || saved.compareSelection.some((id) => !history.some((r) => r.id === id && r.iteration > 0))) throw new Error('Invalid comparison selection')
  if (saved.pendingPrediction && saved.pendingPrediction.iteration !== history.length) throw new Error('Invalid pending prediction')
  if (saved.submission) {
    const target = history.find((r) => r.id === saved.submission!.testResultId && r.iteration > 0)
    if (!target || !saved.submission.reflection.trim() || saved.submission.status !== target.evaluation.status || !agrees(saved.submission.efficiency, target.evaluation.efficiency)) throw new Error('Invalid submission')
  }
  const state = { ...saved, draft, history: Object.freeze(history) } as unknown as SessionStateOf<D, R, Err, E['efficiency']>
  for (const field of undefinedFields) {
    if (field === 'ui.notice') { if (state.ui.notice !== undefined) throw new Error('Invalid undefined field'); state.ui.notice = undefined }
    else if (field === 'pendingPrediction' || field === 'submission') { if (state[field] !== undefined) throw new Error('Invalid undefined field'); state[field] = undefined }
  }
  return state
}

/** JSON.parse plus the shared prototype-key and plain-object checks. */
function parseRaw(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw)
  rejectKeys(value)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved session')
  return value as Record<string, unknown>
}

/** Untrusted storage is accepted all-or-nothing, revalidated and reanalyzed; never throws. */
export function deserializeSession(raw: string, ch: Challenge): Result<SessionState, string> {
  try {
    // Dispatch on the challenge's explicit model; beam sessions use the frozen v1 envelope (MM-17).
    if (requireModel(ch) !== beamModel) throw new Error('Saved session format is not supported for this model')
    const envelope = envelopeSchema.parse(migrateEnvelope(parseRaw(raw)))
    return { ok: true, value: restoreParsed(beamModel, envelope.session as ParsedSession, envelope.undefinedFields, ch, (v) => checkedDesign(v, ch)) as SessionState }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Saved session could not be read' }
  }
}

/** Persistence metadata a v2 (non-beam) model supplies (MM-18). */
export interface V2Persistence<Ch, D> {
  /** Validates an untrusted design object and rebuilds it, or returns reasons. */
  parseDesign(value: Record<string, unknown>, ch: Ch): Result<D, string[]>
  /** Draft error codes the model's validator can produce. */
  errorCodes: readonly [string, ...string[]]
  /** Constraint ids, in the model's fixed order. */
  constraintIds: readonly [string, ...string[]]
}

function v2EnvelopeSchema(p: V2Persistence<unknown, unknown>) {
  const session = sessionShape(z.enum(p.errorCodes as [string, ...string[]]), z.array(z.enum(p.constraintIds as [string, ...string[]])), z.unknown())
  return z.object({
    schemaVersion: z.literal(2), savedAt: z.string().datetime(),
    model: z.object({ id: z.string(), version: z.number().int().positive() }).strict(),
    session, undefinedFields: z.array(undefinedField),
  }).strict()
}

/** v2 envelope with model identity; there is deliberately no v1 → v2 migration (D-39). */
export function serializeSessionV2(ref: Readonly<ModelRef>, s: object, savedAt = '1970-01-01T00:00:00.000Z'): string {
  const session = s as { pendingPrediction?: unknown; submission?: unknown; ui: { notice?: unknown } }
  const undefinedFields: string[] = []
  for (const key of ['pendingPrediction', 'submission'] as const) if (Object.prototype.hasOwnProperty.call(session, key) && session[key] === undefined) undefinedFields.push(key)
  if (Object.prototype.hasOwnProperty.call(session.ui, 'notice') && session.ui.notice === undefined) undefinedFields.push('ui.notice')
  return JSON.stringify({ schemaVersion: 2, savedAt, model: { id: ref.id, version: ref.version }, session: s, undefinedFields })
}

/**
 * Restores a v2 session for `model` (MM-18): rejects other envelope versions, another model
 * identity, unknown codes/keys and any recomputation mismatch. All-or-nothing; never throws.
 */
export function deserializeSessionV2<Ch extends ChallengeBase<D>, D extends DesignBase, A, E extends EvaluationBase, O, Err extends DesignError>(
  model: EngineModel<Ch, D, A, E, O, Err>,
  persistence: V2Persistence<Ch, D>,
  raw: string,
  ch: Ch,
): Result<SessionStateOf<D, TestResultOf<D, A, E, O>, Err, E['efficiency']>, string> {
  try {
    const value = parseRaw(raw)
    if (value.schemaVersion !== 2) throw new Error('Unsupported saved session version')
    const envelope = v2EnvelopeSchema(persistence as V2Persistence<unknown, unknown>).parse(value)
    if (envelope.model.id !== model.ref.id || envelope.model.version !== model.ref.version) throw new Error('Saved session belongs to a different model')
    const checkDesign = (v: unknown): D => {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid saved design')
      const r = persistence.parseDesign(v as Record<string, unknown>, ch)
      if (!r.ok) throw new Error(r.error.join(' '))
      return r.value
    }
    return { ok: true, value: restoreParsed(model, envelope.session as ParsedSession, envelope.undefinedFields, ch, checkDesign) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Saved session could not be read' }
  }
}

/**
 * Read-only view of a challenge's saved session for shell summaries (task 34.1 step 2; MM-23).
 * Never writes or removes storage and never throws; invalid or unreadable saves read as absent.
 */
export function peekSession(ch: Challenge, storage: SessionStorage): SessionState | undefined {
  try {
    const raw = storage.getItem(sessionKey(ch))
    if (raw === null) return undefined
    const restored = deserializeSession(raw, ch)
    return restored.ok ? restored.value : undefined
  } catch {
    return undefined
  }
}

export interface SessionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const RESTORE_FAILURE = 'Saved session could not be restored'
export const STORAGE_FAILURE = 'Progress will not be saved in this browser'
/** One controller per provider/page load; storage exceptions are announced at most once. */
export function createPersistence(ch: Challenge, storage: SessionStorage, notice: (message: string) => void) {
  let warned = false
  const storageFailure = () => { if (!warned) { warned = true; notice(STORAGE_FAILURE) } }
  return {
    load(fresh: SessionState): SessionState {
      try {
        const raw = storage.getItem(sessionKey(ch))
        if (raw === null) return fresh
        const restored = deserializeSession(raw, ch)
        if (restored.ok) return restored.value
        notice(RESTORE_FAILURE)
        storage.removeItem(sessionKey(ch))
      } catch { storageFailure() }
      return fresh
    },
    save(state: SessionState, now: string): void {
      try { storage.setItem(sessionKey(ch), serializeSession(state, now)) } catch { storageFailure() }
    },
  }
}
