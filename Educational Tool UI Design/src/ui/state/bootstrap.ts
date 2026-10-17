import type { Challenge, InteractionMode, ModelRef, Result, SchemaIssue } from '../../challenge/types'
import { beamModel, modelOf } from '../../state/models'
import { runtimeFor, type AnyRuntime, type LoopChallenge, type LoopSession } from '../../state/runtimes'
import type { SessionState } from '../../state/session'

// App bootstrap (task 13.2; Req 3.3, 15.3, 35.1, 35.4).
// Turns the loader result for the bundled challenge into either a ready session or a
// full-page error that lists every problem. The clock and id factory are injected so the
// reducer stays pure and tests stay deterministic.

/** ISO-8601 timestamp source, called outside the reducer. */
export type Clock = () => string
/** Unique id source for Test_Results, called outside the reducer. */
export type IdFactory = () => string

export const systemClock: Clock = () => new Date().toISOString()

let fallbackCounter = 0
export const randomIdFactory: IdFactory = () => {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  fallbackCounter += 1
  return `tr-${Date.now().toString(36)}-${fallbackCounter}`
}

/** One line of the full-page error. `path`/`rule` are empty when not applicable. */
export interface BootIssue {
  path: string
  rule: string
  message: string
}

export interface BootFailure {
  source: 'challenge' | 'initialDesign'
  message: string
  /** Every issue, never truncated (Req 3.3). */
  issues: BootIssue[]
}

export interface BootSuccess {
  challenge: Challenge
  session: SessionState
}

/** True when `mode` is one of the challenge's allowed modes (Req 35.4). */
export function isModeAllowed(ch: { allowedModes: readonly InteractionMode[] }, mode: InteractionMode): boolean {
  return ch.allowedModes.includes(mode)
}

/** Generic boot result: the challenge, its fresh session and the runtime that owns them. */
export interface RuntimeBootSuccess {
  challenge: LoopChallenge
  session: LoopSession
  runtime: AnyRuntime
}

function modelUnavailable(model: Readonly<ModelRef>, registered: boolean): BootFailure {
  return {
    source: 'challenge',
    message: 'The challenge uses an analysis model that is not available.',
    issues: [registered
      ? { path: 'model', rule: 'MODEL_UI_UNAVAILABLE', message: `Model "${model.id}" version ${model.version} has no integrated workbench yet.` }
      : { path: 'model', rule: 'MODEL_NOT_REGISTERED', message: `Model "${model.id}" version ${model.version} is not registered.` }],
  }
}

/**
 * Builds the initial session for a loaded challenge of any registered model (task 34.2).
 * Refuses a model without a runtime (never substitutes one) or without a workbench UI
 * (`hasUi`, supplied by the UI layer). A requested mode outside `allowedModes` falls back to
 * the first allowed mode. Never throws.
 */
export function bootstrapWith(
  loaded: Result<LoopChallenge, SchemaIssue[]>,
  clock: Clock,
  newId: IdFactory,
  hasUi: (ref: Readonly<ModelRef>) => boolean,
  mode?: InteractionMode,
): Result<RuntimeBootSuccess, BootFailure> {
  if (!loaded.ok) {
    const n = loaded.error.length
    return {
      ok: false,
      error: {
        source: 'challenge',
        message: `The challenge content failed validation (${n} issue${n === 1 ? '' : 's'}).`,
        issues: loaded.error.map((i) => ({ path: i.path, rule: i.rule, message: i.message })),
      },
    }
  }
  const ch = loaded.value
  const model = modelOf(ch)
  const runtime = runtimeFor(model)
  if (runtime === undefined || !hasUi(model)) return { ok: false, error: modelUnavailable(model, runtime !== undefined) }
  const start = mode !== undefined && isModeAllowed(ch, mode) ? mode : undefined
  const r = runtime.init(ch, clock(), newId(), start)
  if (!r.ok) {
    return {
      ok: false,
      error: {
        source: r.error.source,
        message: r.error.message,
        issues: r.error.details.map((message) => ({ path: 'initialDesign', rule: '', message })),
      },
    }
  }
  return { ok: true, value: { challenge: ch, session: r.value, runtime } }
}

/** True only for the beam: the default when no UI registry is consulted. */
const beamUiOnly = (ref: Readonly<ModelRef>) => ref.id === beamModel.ref.id

/**
 * Builds the initial session for a loaded beam challenge. A requested mode outside
 * `allowedModes` falls back to the first allowed mode. Never throws.
 */
export function bootstrap(
  loaded: Result<Challenge, SchemaIssue[]>,
  clock: Clock,
  newId: IdFactory,
  mode?: InteractionMode,
): Result<BootSuccess, BootFailure> {
  const r = bootstrapWith(loaded, clock, newId, beamUiOnly, mode)
  return r.ok ? { ok: true, value: { challenge: r.value.challenge as Challenge, session: r.value.session as SessionState } } : r
}
