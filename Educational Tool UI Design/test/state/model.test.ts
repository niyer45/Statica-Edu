import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { sessionReducer } from '../../src/state/reducer'
import type { Action } from '../../src/state/session'
import { bundledChallenge } from '../arbitraries'
import { assertProperty } from '../pbt'
import { createHarness, reachableSession, SessionCommand, sessionCommands, type CommandInput, type Transition } from './model'

const ch = bundledChallenge()
const literal = (action: Action): CommandInput => ({ kind: 'literal', action })

describe('model-based harness infrastructure (task 19.3)', () => {
  it('runs random commands and checks the independent model after every action', () => {
    assertProperty(fc.property(sessionCommands(ch), (commands) => {
      fc.modelRun(() => createHarness(ch), commands)
    }))
  })

  it('generates reachable states with concrete replayable traces in both modes', () => {
    const reachableInMode = fc.constantFrom<'guided' | 'parametric'>('guided', 'parametric')
      .chain((mode) => reachableSession(ch, 30, { mode }).map((session) => ({ ...session, mode })))
    assertProperty(fc.property(reachableInMode, ({ state, actions, mode }) => {
      const initial = createHarness(ch, { mode }).real.state
      const replayed = actions.reduce((s, action) => sessionReducer(s, action, ch), initial)
      expect(replayed).toEqual(state)
      expect(state.mode).toBe(mode)
    }))
  })

  it('executes every action and rejection without skipped commands and calls all hooks in order', () => {
    const transitions: Transition[] = []
    const calls: string[] = []
    const { model, real } = createHarness(ch, { hooks: [
      (t) => { transitions.push(t); calls.push(`first:${t.step}`) },
      (t) => { calls.push(`second:${t.step}`) },
    ] })
    const inputs: CommandInput[] = [
      literal({ type: 'applySection', kind: 'rectangle' }),
      { kind: 'setCurrentParam', value: 0.06, mode: 'strict' },
      literal({ type: 'setParam', param: 'lengthM', valueM: -1, mode: 'strict' }),
      literal({ type: 'setOrientation', orientationDeg: 90 }),
      { kind: 'runTest' }, // checkpoint opens but does not append
      literal({ type: 'cancelPrediction' }),
      literal({ type: 'setPrediction', direction: 'decrease', now: 'prediction' }),
      { kind: 'runTest' }, // records iteration 1
      { kind: 'runTest' }, // records iteration 2 without prediction
      { kind: 'target', type: 'toggleCompare', target: 'latest' },
      { kind: 'target', type: 'restore', target: 'baseline' },
      { kind: 'target', type: 'restore', target: 'missing' },
      literal({ type: 'setReflection', text: '  understanding  ' }),
      { kind: 'target', type: 'submit', target: 'latest' },
      { kind: 'target', type: 'submit', target: 'missing' },
      literal({ type: 'setPrediction', direction: 'same', now: 'prediction' }),
      literal({ type: 'importDesign', json: '{' }), // invalid import retains pending
      { kind: 'importCurrent' }, // valid import clears pending
      literal({ type: 'reset' }),
    ]
    for (const input of inputs) {
      const command = new SessionCommand(input)
      expect(command.check()).toBe(true)
      command.run(model, real)
    }
    expect(new Set(real.trace.map((action) => action.type))).toEqual(new Set([
      'applySection', 'setParam', 'setOrientation', 'runTest', 'cancelPrediction',
      'setPrediction', 'toggleCompare', 'restore', 'setReflection', 'submit', 'importDesign', 'reset',
    ]))
    expect(real.trace).toHaveLength(inputs.length)
    expect(transitions).toHaveLength(inputs.length)
    expect(calls).toEqual(inputs.flatMap((_, i) => [`first:${i + 1}`, `second:${i + 1}`]))
    expect(transitions[4]!.after.history).toHaveLength(1)
    expect(transitions[7]!.after.history).toHaveLength(2)
    expect(transitions[8]!.after.history).toHaveLength(3)
    expect(transitions[13]!.after.submission?.reflection).toBe('  understanding  ')
    expect(transitions[16]!.model.pending).toBe(true)
    expect(transitions[17]!.model.pending).toBe(false)
    expect(transitions[0]!.model.steps).toBe(1) // hook model snapshots are not live aliases
    expect(new SessionCommand(inputs[0]!).toString()).toContain('rectangle')
  })

  it('detects a reducer that silently ignores a valid checkpoint run', () => {
    const { model, real } = createHarness(ch, { reduce: (s, action, challenge) => action.type === 'runTest' ? s : sessionReducer(s, action, challenge) })
    new SessionCommand(literal({ type: 'setPrediction', direction: 'same', now: 't' })).run(model, real)
    expect(() => new SessionCommand({ kind: 'runTest' }).run(model, real)).toThrow()
  })

  it('propagates invariant hook failures to fast-check for shrinking and replay', () => {
    const brokenHook = () => { throw new Error('deliberate invariant failure') }
    expect(() => assertProperty(fc.property(sessionCommands(ch, 5), (commands) => {
      fc.modelRun(() => createHarness(ch, { hooks: [brokenHook] }), commands)
    }), { numRuns: 20 })).toThrow(/seed:.*path:/)
  })

  it('can generate an empty reachable session without inventing state', () => {
    assertProperty(fc.property(reachableSession(ch, 0), ({ state, actions }) => {
      expect(actions).toEqual([])
      expect(state).toEqual(createHarness(ch).real.state)
    }))
  })
})
