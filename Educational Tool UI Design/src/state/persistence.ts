import { z } from 'zod'
import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge, Result } from '../challenge/types'
import { evaluate } from '../evaluation/evaluate'
import { scorePrediction } from '../evaluation/prediction'
import { analyze } from '../physics/analyze'
import { importDesign } from './importExport'
import { migrateEnvelope } from './migrations'
import { draftStatusOf, sameDesignIgnoringId, type SessionState, type TestResult } from './session'

const status = z.enum(['accepted', 'notAccepted', 'modelNotApplicable'])
const number = z.number().finite()
const efficiency = z.object({ massUsage: number, deflectionMargin: number, stressMargin: number }).strict()
const direction = z.enum(['increase', 'decrease', 'same'])
const prediction = z.object({ iteration: z.number().int().positive(), direction, explanation: z.string().max(500).optional(), createdAt: z.string() }).strict()
const failures = z.array(z.enum(['deflection', 'stress', 'mass', 'envelopeWidth', 'envelopeHeight', 'featureGeometry', 'applicability']))
const resultSchema = z.object({
  id: z.string().min(1), iteration: z.number().int().nonnegative(), label: z.string().optional(),
  designSnapshot: z.unknown(), analysis: z.unknown(), evaluation: z.unknown(), accepted: z.boolean(), failures,
  prediction: prediction.optional(), predictionOutcome: z.unknown().optional(), timestamp: z.string(),
}).strict()
const sessionSchema = z.object({
  schemaVersion: z.literal(1), challengeId: z.string(), challengeVersion: z.number().int().positive(),
  mode: z.enum(['guided', 'parametric']), draft: z.unknown(), draftStatus: z.enum(['draft', 'tested']),
  draftErrors: z.array(z.object({ code: z.enum(['NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'INNER_NOT_LESS_THAN_OUTER', 'WALL_TOO_THIN', 'FLANGES_OVERLAP', 'WEB_WIDER_THAN_FLANGE', 'FLANGE_TOO_THIN', 'WEB_TOO_THIN', 'SECTION_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED', 'BAD_ORIENTATION']), param: z.string().optional(), message: z.string() }).strict()),
  history: z.array(resultSchema).min(1), pendingPrediction: prediction.optional(), compareSelection: z.array(z.string()).max(3),
  reflectionAnswer: z.string().max(2000),
  submission: z.object({ testResultId: z.string(), status, reflection: z.string().max(2000), efficiency, submittedAt: z.string() }).strict().optional(),
  ui: z.object({ predictionDialogOpen: z.boolean(), notice: z.object({ kind: z.enum(['info', 'error']), message: z.string() }).strict().optional() }).strict(),
}).strict()
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

/** Untrusted storage is accepted all-or-nothing, revalidated and reanalyzed; never throws. */
export function deserializeSession(raw: string, ch: Challenge): Result<SessionState, string> {
  try {
    const value: unknown = JSON.parse(raw)
    rejectKeys(value)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved session')
    const envelope = envelopeSchema.parse(migrateEnvelope(value as Record<string, unknown>))
    const saved = envelope.session
    if (saved.challengeId !== ch.id || saved.challengeVersion !== ch.version || !ch.allowedModes.includes(saved.mode)) throw new Error('Saved challenge mismatch')
    const draft = checkedDesign(saved.draft, ch)
    const history: TestResult[] = []
    for (const [index, result] of saved.history.entries()) {
      if (result.iteration !== index || history.some((r) => r.id === result.id)) throw new Error('Invalid history order or duplicate id')
      const design = checkedDesign(result.designSnapshot, ch)
      if (index === 0 && (!sameDesignIgnoringId(design, ch.initialDesign) || result.label !== 'Baseline' || result.prediction !== undefined || result.predictionOutcome !== undefined)) throw new Error('Invalid baseline')
      if (ch.predictionPolicy.requiredOnIterations.includes(index) && !result.prediction) throw new Error('Missing checkpoint prediction')
      if (result.prediction && result.prediction.iteration !== index) throw new Error('Prediction iteration mismatch')
      const analysis = analyze(design, ch)
      const evaluation = evaluate(design, analysis, ch)
      if (!agrees(result.analysis, analysis) || !agrees(result.evaluation, evaluation) || result.accepted !== evaluation.accepted || !agrees(result.failures, evaluation.failures)) throw new Error('Saved results differ from recomputed results')
      const outcome = result.prediction && index > 0 ? scorePrediction(result.prediction, history[index - 1]!, analysis) : undefined
      if (!agrees(result.predictionOutcome, outcome)) throw new Error('Invalid prediction outcome')
      history.push(deepFreeze({ ...result, designSnapshot: design }) as TestResult)
    }
    if (draftStatusOf(draft, history) !== saved.draftStatus) throw new Error('Invalid draft status')
    if (new Set(saved.compareSelection).size !== saved.compareSelection.length || saved.compareSelection.some((id) => !history.some((r) => r.id === id && r.iteration > 0))) throw new Error('Invalid comparison selection')
    if (saved.pendingPrediction && saved.pendingPrediction.iteration !== history.length) throw new Error('Invalid pending prediction')
    if (saved.submission) {
      const target = history.find((r) => r.id === saved.submission!.testResultId && r.iteration > 0)
      if (!target || !saved.submission.reflection.trim() || saved.submission.status !== target.evaluation.status || !agrees(saved.submission.efficiency, target.evaluation.efficiency)) throw new Error('Invalid submission')
    }
    const state = { ...saved, draft, history: Object.freeze(history) } as SessionState
    for (const field of envelope.undefinedFields) {
      if (field === 'ui.notice') { if (state.ui.notice !== undefined) throw new Error('Invalid undefined field'); state.ui.notice = undefined }
      else { if (state[field] !== undefined) throw new Error('Invalid undefined field'); state[field] = undefined }
    }
    return { ok: true, value: state }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Saved session could not be read' }
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
