import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { TestResult } from '../../src/state/session'
import { bundledChallenge } from '../arbitraries'
import { assertProperty } from '../pbt'
import { createHarness, SessionCommand, sessionCommands, type CommandInput, type InvariantHook } from './model'

const ch = bundledChallenge()

/** Capture references independently of the input array, so an in-place change cannot hide
 * a removed/replaced/reordered entry or make an append look like zero growth.
 */
function appendOnlyHook(initial: readonly TestResult[]): InvariantHook {
  let recorded = [...initial]
  const baseline = structuredClone(initial[0]!)
  return ({ action, before, after, model }) => {
    expect(before.history).toHaveLength(recorded.length)
    recorded.forEach((result, index) => {
      expect(before.history[index]).toBe(result)
      expect(after.history[index]).toBe(result)
    })
    // The harness model predicts successful Run Test requests independently of the reducer.
    const growth = model.resultIds.length - recorded.length
    expect(growth).toBeGreaterThanOrEqual(0)
    expect(growth).toBeLessThanOrEqual(1)
    if (action.type !== 'runTest') expect(growth).toBe(0)
    expect(after.history).toHaveLength(recorded.length + growth)
    expect(after.history[0]!.iteration).toBe(0)
    expect(after.history[0]).toEqual(baseline)
    if (growth === 1 && action.type === 'runTest') {
      const appended = after.history[recorded.length]!
      expect(appended.id).toBe(action.id)
      expect(appended.timestamp).toBe(action.now)
      expect(appended.iteration).toBe(recorded[recorded.length - 1]!.iteration + 1)
      expect(recorded).not.toContain(appended)
    }
    recorded = [...after.history]
  }
}

// Feature: engineering-intuition-mvp, Property 28: Append-only
// Validates: Requirements 15.4, 17.1, 18.1.
describe('Property 28: append-only history', () => {
  it('preserves every existing result reference/index and appends exactly once only for recorded tests', () => {
    assertProperty(fc.property(sessionCommands(ch), (commands) => {
      fc.modelRun(() => {
        const harness = createHarness(ch)
        harness.real.hooks = [appendOnlyHook(harness.real.state.history)]
        // Guarantee that every generated run exercises multiple stored entries, gated and
        // ungated tests, rejected tests, restore, valid import and reset before the random tail.
        const prefix: CommandInput[] = [
          { kind: 'runTest' }, // iteration 1 is gated
          { kind: 'literal', action: { type: 'setPrediction', direction: 'same', now: 'prediction:1' } },
          { kind: 'runTest' }, // iteration 1 appends
          { kind: 'runTest' }, // iteration 2 appends without a prediction
          { kind: 'runTest' }, // iteration 3 is gated
          { kind: 'literal', action: { type: 'cancelPrediction' } },
          { kind: 'literal', action: { type: 'setPrediction', direction: 'same', now: 'prediction:3' } },
          { kind: 'runTest' }, // iteration 3 appends
          { kind: 'target', type: 'restore', target: 'baseline' },
          { kind: 'importCurrent' },
          { kind: 'literal', action: { type: 'reset' } },
        ]
        for (const input of prefix) new SessionCommand(input).run(harness.model, harness.real)
        return harness
      }, commands)
    }))
  })

  it('detects replacement of a non-baseline entry even when ids, values and length match', () => {
    const harness = createHarness(ch)
    harness.real.hooks = [appendOnlyHook(harness.real.state.history)]
    new SessionCommand({ kind: 'literal', action: { type: 'setPrediction', direction: 'same', now: 't' } }).run(harness.model, harness.real)
    new SessionCommand({ kind: 'runTest' }).run(harness.model, harness.real)
    // This regression passes the harness's id/count/baseline checks. Property 28 must catch it.
    harness.real.reduce = (state) => ({ ...state, history: [state.history[0]!, { ...state.history[1]! }] })
    expect(() => new SessionCommand({ kind: 'literal', action: { type: 'setReflection', text: '' } })
      .run(harness.model, harness.real)).toThrow()
  })
})
