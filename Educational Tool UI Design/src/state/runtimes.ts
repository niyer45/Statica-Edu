import { loadChallenge } from '../challenge/loader'
import { loadTorsionChallenge } from '../challenge/torsion/loader'
import type { TorsionChallenge } from '../challenge/torsion/types'
import type { Challenge, InteractionMode, ModelRef, Result, SchemaIssue } from '../challenge/types'
import { initSessionWith } from './engine'
import { beamModel, modelFor, modelOf } from './models'
import { deserializeSession, deserializeSessionV2, serializeSession, serializeSessionV2, sessionKey } from './persistence'
import { sessionReducer } from './reducer'
import { initSession, type Action, type InitSessionError, type SessionState } from './session'
import { torsionModel, torsionPersistence, torsionReducer, type TorsionAction, type TorsionSession } from './torsionModel'

// Model runtimes (task 34.2; multi-model-architecture MM-05, MM-15–MM-18).
// Everything the store and shell need to run one challenge's learning loop, dispatched by the
// challenge's explicit model identity: load the config, start a session, reduce actions and
// read/write the model's own persistence envelope (v1 for the beam, v2 otherwise). Shared,
// model-independent fields (mode, history, reflection, …) keep the same shape for every model,
// so shell code reads them through `LoopSession` without knowing the model.

/** Model-independent session fields the shell and shared UI read. */
export interface LoopSession {
  challengeId: string
  mode: InteractionMode
  draftStatus: 'draft' | 'tested'
  history: ReadonlyArray<{ id: string; iteration: number; evaluation: { status: string } }>
  deletedIterationIds?: string[]
  reflectionAnswer: string
  submission?: { testResultId: string }
  ui: { predictionDialogOpen: boolean; notice?: { kind: 'info' | 'error'; message: string } }
}

/** Challenge fields every model's config has. */
export interface LoopChallenge {
  id: string
  version: number
  title: string
  model?: Readonly<ModelRef>
  allowedModes: InteractionMode[]
  referenceDesign?: unknown
}

export interface ModelRuntime<S extends LoopSession = LoopSession, A extends { type: string } = { type: string }, Ch extends LoopChallenge = LoopChallenge> {
  ref: Readonly<ModelRef>
  load(json: unknown): Result<Ch, SchemaIssue[]>
  init(ch: Ch, now: string, id: string, mode?: InteractionMode): Result<S, InitSessionError>
  reduce(s: S, a: A, ch: Ch): S
  key(ch: Ch): string
  serialize(s: S, savedAt: string): string
  deserialize(raw: string, ch: Ch): Result<S, string>
}

export const beamRuntime: ModelRuntime<SessionState, Action, Challenge> = Object.freeze({
  ref: beamModel.ref,
  load: loadChallenge,
  init: initSession,
  reduce: sessionReducer,
  key: sessionKey,
  serialize: serializeSession,
  deserialize: deserializeSession,
})

export const torsionRuntime: ModelRuntime<TorsionSession, TorsionAction, TorsionChallenge> = Object.freeze({
  ref: torsionModel.ref,
  load: loadTorsionChallenge,
  init: (ch: TorsionChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(torsionModel, ch, now, id, mode),
  reduce: torsionReducer,
  key: sessionKey,
  serialize: (s: TorsionSession, savedAt: string) => serializeSessionV2(torsionModel.ref, s, savedAt),
  deserialize: (raw: string, ch: TorsionChallenge) => deserializeSessionV2(torsionModel, torsionPersistence, raw, ch),
})

/** Erased runtime type for dispatch; callers only pass values the same runtime produced. */
export type AnyRuntime = ModelRuntime<LoopSession, { type: string }, LoopChallenge>

const RUNTIMES: ReadonlyMap<string, AnyRuntime> = new Map<string, AnyRuntime>([
  [beamRuntime.ref.id, beamRuntime as unknown as AnyRuntime],
  [torsionRuntime.ref.id, torsionRuntime as unknown as AnyRuntime],
])

/** Runtime for an exact registered model identity, or undefined (never a substitute, MM-07). */
export function runtimeFor(ref: Readonly<ModelRef>): AnyRuntime | undefined {
  const r = RUNTIMES.get(ref.id)
  return r !== undefined && modelFor(ref) !== undefined && r.ref.version === ref.version ? r : undefined
}

/** Runtime for a raw (untrusted) config: reads only its declared `model`, absent = beam (MM-02). */
export function runtimeForJson(json: unknown): AnyRuntime | undefined {
  const declared = typeof json === 'object' && json !== null && !Array.isArray(json) ? (json as { model?: unknown }).model : undefined
  if (declared === undefined) return runtimeFor(modelOf({}))
  if (typeof declared !== 'object' || declared === null) return undefined
  const { id, version } = declared as { id?: unknown; version?: unknown }
  return typeof id === 'string' && typeof version === 'number' ? runtimeFor({ id, version }) : undefined
}
