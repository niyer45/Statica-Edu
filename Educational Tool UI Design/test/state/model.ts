import fc from 'fast-check'
import { expect } from 'vitest'
import type { Challenge, InteractionMode, SectionKind } from '../../src/challenge/types'
import type { PredictionDirection } from '../../src/evaluation/types'
import type { Orientation } from '../../src/geometry/sections'
import { validateDesign } from '../../src/geometry/validate'
import { exportDesign, importDesign } from '../../src/state/importExport'
import { sessionReducer } from '../../src/state/reducer'
import { initSession, sameDesignIgnoringId, type Action, type SessionState } from '../../src/state/session'
import { arbAnyJson, arbDesign, arbHostileNumber, SECTION_KINDS } from '../arbitraries'

// Task 19.3 infrastructure. Dedicated Properties 28–37 are added by 19.4–19.15.
// The model deliberately tracks only independently predictable workflow facts, not a second
// implementation of geometry/physics or a second call to the reducer as its own oracle.
export interface SessionModel {
  resultIds: string[]
  pending: boolean
  reflection: string
  steps: number
}

export interface Transition {
  action: Action
  before: SessionState
  after: SessionState
  /** Detached snapshot of the independent model AFTER this action. */
  model: Readonly<SessionModel>
  challenge: Challenge
  step: number
}

export type InvariantHook = (transition: Transition) => void
export interface SessionReal {
  state: SessionState
  challenge: Challenge
  trace: Action[]
  hooks: readonly InvariantHook[]
  /** Allows harness tests to verify that a broken reducer is actually detected. */
  reduce: typeof sessionReducer
}

export interface HarnessOptions {
  mode?: InteractionMode
  hooks?: readonly InvariantHook[]
  reduce?: typeof sessionReducer
}

export function createHarness(challenge: Challenge, options: HarnessOptions = {}): { model: SessionModel; real: SessionReal } {
  const initialized = initSession(challenge, '2026-10-15T00:00:00.000Z', 'model:baseline', options.mode)
  if (!initialized.ok) throw new Error(initialized.error.message)
  return {
    model: { resultIds: ['model:baseline'], pending: false, reflection: '', steps: 0 },
    real: { state: initialized.value, challenge, trace: [], hooks: options.hooks ?? [], reduce: options.reduce ?? sessionReducer },
  }
}

/** Resolve valid and unknown history targets at execution time, so shrinking keeps them useful. */
export type Target = 'baseline' | 'latest' | 'previous' | 'missing'
function targetId(model: Readonly<SessionModel>, target: Target): string {
  if (target === 'missing') return 'model:missing'
  if (target === 'baseline') return model.resultIds[0]!
  return model.resultIds[Math.max(0, model.resultIds.length - (target === 'previous' ? 2 : 1))]!
}

type TargetAction = 'restore' | 'toggleCompare' | 'submit'
export type CommandInput =
  | { kind: 'literal'; action: Action }
  | { kind: 'runTest' }
  | { kind: 'target'; type: TargetAction; target: Target }
  | { kind: 'importCurrent' }
  | { kind: 'setCurrentParam'; value: number; mode: 'clamp' | 'strict' }

/** Materialize deterministic ids/time at execution, never random draws inside a command. */
function actionOf(input: CommandInput, model: Readonly<SessionModel>, real: SessionReal): Action {
  const now = `model:time:${model.steps}`
  switch (input.kind) {
    case 'literal': return input.action
    case 'runTest': return { type: 'runTest', id: `model:result:${model.steps}`, now }
    case 'target': {
      const testResultId = targetId(model, input.target)
      return input.type === 'submit' ? { type: 'submit', testResultId, now } : { type: input.type, testResultId }
    }
    case 'importCurrent': return { type: 'importDesign', json: exportDesign(real.state.draft, real.challenge) }
    case 'setCurrentParam': {
      const section = real.state.draft.section
      const param = section.kind === 'circle' ? 'diameterM' : section.kind === 'tube' ? 'outerDiameterM' : 'heightM'
      return { type: 'setParam', param, valueM: input.value, mode: input.mode }
    }
  }
}

function advanceModel(model: SessionModel, action: Action, ch: Challenge): void {
  switch (action.type) {
    case 'setPrediction':
      model.pending = ['increase', 'decrease', 'same'].includes(action.direction) &&
        (action.explanation === undefined || (typeof action.explanation === 'string' && action.explanation.length <= 500))
      break
    case 'cancelPrediction':
      model.pending = false
      break
    case 'runTest':
      // All generated sessions start valid; edits/imports must preserve that invariant. The
      // injected id factory is trusted, as in StoreProvider: result ids are unique per step.
      if (model.pending || !ch.predictionPolicy.requiredOnIterations.includes(model.resultIds.length)) {
        model.resultIds.push(action.id)
        model.pending = false
      }
      break
    case 'setReflection':
      if (typeof action.text === 'string' && action.text.length <= 2000) model.reflection = action.text
      break
    case 'restore':
      if (model.resultIds.includes(action.testResultId)) model.pending = false
      break
    case 'reset':
      model.pending = false
      model.reflection = ''
      break
    // resetDraft (task 60) clears a pending prediction only when it changes the draft; that
    // depends on the draft, so SessionCommand.run decides it from the public model definition.
    case 'resetDraft':
      break
    // Import success is determined separately by the public domain validator; it is not
    // inferred from the reducer's output, which would conceal a broken import transition.
    case 'importDesign':
      break
    default:
      break
  }
  model.steps++
}

/** Baseline invariant hook; additional property suites can register any number of hooks. */
export const assertSessionInvariants: InvariantHook = ({ before, after, model, challenge }) => {
  expect(validateDesign(after.draft, challenge)).toEqual([])
  expect(after.history.map((result) => result.id)).toEqual(model.resultIds)
  expect(after.reflectionAnswer).toBe(model.reflection)
  expect(after.pendingPrediction !== undefined).toBe(model.pending)
  expect(after.history[0]).toBe(before.history[0])
  expect(after.history.map((result) => result.iteration)).toEqual(after.history.map((_, index) => index))
  expect(after.compareSelection.length).toBeLessThanOrEqual(3)
  expect(new Set(after.compareSelection).size).toBe(after.compareSelection.length)
  for (const id of after.compareSelection) expect(after.history.some((r) => r.id === id && r.iteration > 0)).toBe(true)
}

export class SessionCommand implements fc.Command<SessionModel, SessionReal> {
  constructor(readonly input: CommandInput) {}
  // No command is skipped: invalid payloads and unknown ids must exercise rejection paths.
  check(): boolean { return true }
  run(model: SessionModel, real: SessionReal): void {
    const action = actionOf(this.input, model, real)
    const before = real.state
    const after = real.reduce(before, action, real.challenge)
    if (action.type === 'importDesign' && importDesign(action.json, real.challenge).ok) model.pending = false
    if (action.type === 'resetDraft' && !sameDesignIgnoringId(before.draft, real.challenge.initialDesign)) model.pending = false
    advanceModel(model, action, real.challenge)
    real.state = after
    real.trace.push(action)
    const transition: Transition = {
      action, before, after, model: { ...model, resultIds: [...model.resultIds] }, challenge: real.challenge, step: model.steps,
    }
    assertSessionInvariants(transition)
    for (const hook of real.hooks) hook(transition)
  }
  toString(): string { return `SessionCommand(${fc.stringify(this.input)})` }
}

const literal = (action: Action): CommandInput => ({ kind: 'literal', action })
const directions = fc.constantFrom<PredictionDirection>('increase', 'decrease', 'same')
const targets = fc.constantFrom<Target>('baseline', 'latest', 'previous', 'missing')

/** Every domain action, with valid boundary values and hostile payloads where applicable.
 * Trusted action discriminants, mode tags and injected clock/id factories stay well-typed.
 * Hostile geometry numbers, unknown fields/kinds/ids, invalid directions/orientations,
 * oversized/non-string text and arbitrary import data cross the intended input boundaries.
 */
export function commandInputs(ch: Challenge): fc.Arbitrary<CommandInput>[] {
  return [
    fc.constantFrom(...SECTION_KINDS).map((kind) => literal({ type: 'applySection', kind })),
    fc.constant(literal({ type: 'applySection', kind: 'unknown' as SectionKind })),
    fc.tuple(fc.double({ min: 0.01, max: 0.1, noNaN: true }), fc.constantFrom<'strict' | 'clamp'>('strict', 'clamp'))
      .map(([value, mode]) => ({ kind: 'setCurrentParam', value, mode })),
    fc.tuple(arbHostileNumber, fc.constantFrom<'strict' | 'clamp'>('strict', 'clamp'))
      .map(([value, mode]) => ({ kind: 'setCurrentParam', value, mode })),
    fc.tuple(fc.constantFrom('lengthM', 'materialId', 'forceN', 'support', 'unknown'), arbHostileNumber)
      .map(([param, valueM]) => literal({ type: 'setParam', param, valueM, mode: 'strict' })),
    fc.constantFrom(0, 90, -90, 45, Number.NaN, Infinity).map((orientationDeg) => literal({ type: 'setOrientation', orientationDeg: orientationDeg as Orientation })),
    fc.tuple(directions, fc.option(fc.string({ maxLength: 500 }), { nil: undefined }))
      .map(([direction, explanation]) => literal({ type: 'setPrediction', direction, explanation, now: 'model:prediction-time' })),
    fc.constantFrom(
      literal({ type: 'setPrediction', direction: 'invalid' as PredictionDirection, now: 't' }),
      literal({ type: 'setPrediction', direction: 'same', explanation: 'x'.repeat(501), now: 't' }),
      literal({ type: 'setPrediction', direction: 'same', explanation: null as unknown as string, now: 't' }),
    ),
    fc.constant(literal({ type: 'cancelPrediction' })),
    fc.constant({ kind: 'runTest' }),
    ...(['restore', 'toggleCompare', 'submit'] as const).map((type) => targets.map((target): CommandInput => ({ kind: 'target', type, target }))),
    fc.oneof(fc.string({ maxLength: 2000 }), fc.constantFrom('', ' \n\t', 'x'.repeat(2000), 'x'.repeat(2001), null as unknown as string))
      .map((text) => literal({ type: 'setReflection', text })),
    fc.constant({ kind: 'importCurrent' }),
    arbDesign(ch).map((design) => literal({ type: 'importDesign', json: exportDesign(design, ch) })),
    arbAnyJson.map((json) => literal({ type: 'importDesign', json })),
    fc.constantFrom('{', '{"__proto__":{}}', '').map((json) => literal({ type: 'importDesign', json })),
    arbDesign(ch).map((design) => literal({ type: 'importDesign', json: { format: 'ei-design', schemaVersion: 1, challengeId: ch.id, design: { ...design, lengthM: -1, materialId: 'wrong' } } })),
    fc.constant(literal({ type: 'reset' })),
    fc.constant(literal({ type: 'resetDraft' })),
  ]
}

export function sessionCommands(ch: Challenge, maxCommands = 50) {
  return fc.commands(commandInputs(ch).map((arb) => arb.map((input) => new SessionCommand(input))), { maxCommands })
}

export interface ReachableSession {
  state: SessionState
  /** Replayable concrete actions from initSession, including deterministic ids/timestamps. */
  actions: Action[]
}

/** No hand-assembled states: every generated state is reached through real reducer actions.
 * This trace-based arbitrary shrinks its construction path along with the resulting state.
 */
export function reachableSession(ch: Challenge, maxActions = 30, options: HarnessOptions = {}): fc.Arbitrary<ReachableSession> {
  return fc.array(fc.oneof(...commandInputs(ch)), { maxLength: maxActions }).map((inputs) => {
    const { model, real } = createHarness(ch, options)
    for (const input of inputs) new SessionCommand(input).run(model, real)
    return { state: real.state, actions: real.trace }
  })
}
