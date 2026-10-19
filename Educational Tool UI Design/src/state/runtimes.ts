import { loadHeatSinkChallenge } from '../challenge/heatSink/loader'
import type { HeatSinkChallenge } from '../challenge/heatSink/types'
import { loadBracketChallenge } from '../challenge/bracket/loader'
import type { BracketChallenge } from '../challenge/bracket/types'
import { loadBracedFrameChallenge } from '../challenge/bracedFrame/loader'
import type { BracedFrameChallenge } from '../challenge/bracedFrame/types'
import { loadChallenge } from '../challenge/loader'
import { loadTorsionChallenge } from '../challenge/torsion/loader'
import type { TorsionChallenge } from '../challenge/torsion/types'
import { loadVesselChallenge } from '../challenge/vessel/loader'
import type { VesselChallenge } from '../challenge/vessel/types'
import { loadVibrationChallenge } from '../challenge/vibration/loader'
import type { VibrationChallenge } from '../challenge/vibration/types'
import type { Challenge, InteractionMode, ModelRef, Result, SchemaIssue } from '../challenge/types'
import { bracketModel, bracketPersistence, bracketReducer, type BracketAction, type BracketSession } from './bracketModel'
import { bracedFrameModel, bracedFramePersistence, bracedFrameReducer, type BracedFrameAction, type BracedFrameSession } from './bracedFrameModel'
import { initSessionWith } from './engine'
import { withGuidedLocks } from './guided'
import { heatSinkModel, heatSinkPersistence, heatSinkReducer, type HeatSinkAction, type HeatSinkSession } from './heatSinkModel'
import { beamModel, modelFor, modelOf } from './models'
import { deserializeSession, deserializeSessionV2, serializeSession, serializeSessionV2, sessionKey } from './persistence'
import { sessionReducer } from './reducer'
import { initSession, type Action, type InitSessionError, type SessionState } from './session'
import { BEAM_GUIDED_PLAN } from '../evaluation/guided/beam'
import { BRACED_FRAME_GUIDED_PLAN } from '../evaluation/guided/bracedFrame'
import { BRACKET_GUIDED_PLAN } from '../evaluation/guided/bracket'
import { HEAT_SINK_GUIDED_PLAN } from '../evaluation/guided/heatSink'
import { TORSION_GUIDED_PLAN } from '../evaluation/guided/torsion'
import { VESSEL_GUIDED_PLAN } from '../evaluation/guided/vessel'
import { VIBRATION_GUIDED_PLAN } from '../evaluation/guided/vibration'
import { torsionModel, torsionPersistence, torsionReducer, type TorsionAction, type TorsionSession } from './torsionModel'
import { vesselModel, vesselPersistence, vesselReducer, type VesselAction, type VesselSession } from './vesselModel'
import { vibrationModel, vibrationPersistence, vibrationReducer, type VibrationAction, type VibrationSession } from './vibrationModel'

// Model runtimes (task 34.2; multi-model-architecture MM-05, MM-15–MM-18).
// Everything the store and shell need to run one challenge's learning loop, dispatched by the
// challenge's explicit model identity: load the config, start a session, reduce actions and
// read/write the model's own persistence envelope (v1 for the beam, v2 otherwise). Shared,
// model-independent fields (mode, history, reflection, …) keep the same shape for every model,
// so shell code reads them through `LoopSession` without knowing the model. Every reducer is
// wrapped with the Guided parameter locks of its model's guided plan (task 58, state/guided.ts).

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
  reduce: withGuidedLocks(BEAM_GUIDED_PLAN, sessionReducer),
  key: sessionKey,
  serialize: serializeSession,
  deserialize: deserializeSession,
})

export const torsionRuntime: ModelRuntime<TorsionSession, TorsionAction, TorsionChallenge> = Object.freeze({
  ref: torsionModel.ref,
  load: loadTorsionChallenge,
  init: (ch: TorsionChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(torsionModel, ch, now, id, mode),
  reduce: withGuidedLocks(TORSION_GUIDED_PLAN, torsionReducer),
  key: sessionKey,
  serialize: (s: TorsionSession, savedAt: string) => serializeSessionV2(torsionModel.ref, s, savedAt),
  deserialize: (raw: string, ch: TorsionChallenge) => deserializeSessionV2(torsionModel, torsionPersistence, raw, ch),
})

export const vibrationRuntime: ModelRuntime<VibrationSession, VibrationAction, VibrationChallenge> = Object.freeze({
  ref: vibrationModel.ref,
  load: loadVibrationChallenge,
  init: (ch: VibrationChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(vibrationModel, ch, now, id, mode),
  reduce: withGuidedLocks(VIBRATION_GUIDED_PLAN, vibrationReducer),
  key: sessionKey,
  serialize: (s: VibrationSession, savedAt: string) => serializeSessionV2(vibrationModel.ref, s, savedAt),
  deserialize: (raw: string, ch: VibrationChallenge) => deserializeSessionV2(vibrationModel, vibrationPersistence, raw, ch),
})

export const heatSinkRuntime: ModelRuntime<HeatSinkSession, HeatSinkAction, HeatSinkChallenge> = Object.freeze({
  ref: heatSinkModel.ref,
  load: loadHeatSinkChallenge,
  init: (ch: HeatSinkChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(heatSinkModel, ch, now, id, mode),
  reduce: withGuidedLocks(HEAT_SINK_GUIDED_PLAN, heatSinkReducer),
  key: sessionKey,
  serialize: (s: HeatSinkSession, savedAt: string) => serializeSessionV2(heatSinkModel.ref, s, savedAt),
  deserialize: (raw: string, ch: HeatSinkChallenge) => deserializeSessionV2(heatSinkModel, heatSinkPersistence, raw, ch),
})

export const bracketRuntime: ModelRuntime<BracketSession, BracketAction, BracketChallenge> = Object.freeze({
  ref: bracketModel.ref,
  load: loadBracketChallenge,
  init: (ch: BracketChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(bracketModel, ch, now, id, mode),
  reduce: withGuidedLocks(BRACKET_GUIDED_PLAN, bracketReducer),
  key: sessionKey,
  serialize: (s: BracketSession, savedAt: string) => serializeSessionV2(bracketModel.ref, s, savedAt),
  deserialize: (raw: string, ch: BracketChallenge) => deserializeSessionV2(bracketModel, bracketPersistence, raw, ch),
})

export const bracedFrameRuntime: ModelRuntime<BracedFrameSession, BracedFrameAction, BracedFrameChallenge> = Object.freeze({
  ref: bracedFrameModel.ref,
  load: loadBracedFrameChallenge,
  init: (ch: BracedFrameChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(bracedFrameModel, ch, now, id, mode),
  reduce: withGuidedLocks(BRACED_FRAME_GUIDED_PLAN, bracedFrameReducer),
  key: sessionKey,
  serialize: (s: BracedFrameSession, savedAt: string) => serializeSessionV2(bracedFrameModel.ref, s, savedAt),
  deserialize: (raw: string, ch: BracedFrameChallenge) => deserializeSessionV2(bracedFrameModel, bracedFramePersistence, raw, ch),
})

/** Task 69 (D-59): Pressure Vessel I. */
export const vesselRuntime: ModelRuntime<VesselSession, VesselAction, VesselChallenge> = Object.freeze({
  ref: vesselModel.ref,
  load: loadVesselChallenge,
  init: (ch: VesselChallenge, now: string, id: string, mode?: InteractionMode) => initSessionWith(vesselModel, ch, now, id, mode),
  reduce: withGuidedLocks(VESSEL_GUIDED_PLAN, vesselReducer),
  key: sessionKey,
  serialize: (s: VesselSession, savedAt: string) => serializeSessionV2(vesselModel.ref, s, savedAt),
  deserialize: (raw: string, ch: VesselChallenge) => deserializeSessionV2(vesselModel, vesselPersistence, raw, ch),
})

/** Erased runtime type for dispatch; callers only pass values the same runtime produced. */
export type AnyRuntime = ModelRuntime<LoopSession, { type: string }, LoopChallenge>

const RUNTIMES: ReadonlyMap<string, AnyRuntime> = new Map<string, AnyRuntime>([
  [beamRuntime.ref.id, beamRuntime as unknown as AnyRuntime],
  [torsionRuntime.ref.id, torsionRuntime as unknown as AnyRuntime],
  [vibrationRuntime.ref.id, vibrationRuntime as unknown as AnyRuntime],
  [heatSinkRuntime.ref.id, heatSinkRuntime as unknown as AnyRuntime],
  [bracketRuntime.ref.id, bracketRuntime as unknown as AnyRuntime],
  [bracedFrameRuntime.ref.id, bracedFrameRuntime as unknown as AnyRuntime],
  [vesselRuntime.ref.id, vesselRuntime as unknown as AnyRuntime],
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
