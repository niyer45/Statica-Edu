import { deepStrictEqual, notStrictEqual } from 'node:assert/strict'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { TestResult } from '../../src/state/session'
import { bundledChallenge, SECTION_KINDS } from '../arbitraries'
import { assertProperty } from '../pbt'
import { createHarness, SessionCommand, sessionCommands, type CommandInput, type InvariantHook } from './model'

const ch = bundledChallenge()

/** Keep detached values from record time, not references to objects under test. Comparing the
 * whole result also protects Evaluation, failures, stored prediction and prediction outcome.
 */
function snapshotIsolationHook(initial: readonly TestResult[]): InvariantHook {
  const recorded = initial.map((result) => structuredClone(result))
  return ({ after }) => {
    // Node's structural comparison avoids expensive per-field Vitest matcher setup on each
    // generated step while retaining strict equality of every captured field (including undefined).
    deepStrictEqual(after.history.slice(0, recorded.length), recorded)
    // Capture only newly recorded entries. Never overwrite an old expected value after an edit.
    for (const result of after.history.slice(recorded.length)) recorded.push(structuredClone(result))
    // A future in-place draft edit must not be able to write through into a stored snapshot.
    for (const result of after.history) {
      notStrictEqual(after.draft, result.designSnapshot)
      notStrictEqual(after.draft.section, result.designSnapshot.section)
    }
  }
}

// Feature: engineering-intuition-mvp, Property 29: Snapshot isolation
// Validates: Requirements 18.2.
describe('Property 29: snapshot isolation', () => {
  it('preserves recorded result values through edits, tests, restores, imports and resets', () => {
    assertProperty(fc.property(sessionCommands(ch), (commands) => {
      fc.modelRun(() => {
        const harness = createHarness(ch)
        harness.real.hooks = [snapshotIsolationHook(harness.real.state.history)]
        const execute = (input: CommandInput) => new SessionCommand(input).run(harness.model, harness.real)
        // Guarantee stored predictions and all four profiles, then edit each tested draft.
        // In particular, the next test must not overwrite any earlier Analysis/Evaluation.
        for (const kind of SECTION_KINDS) {
          const inputs: CommandInput[] = [
            { kind: 'literal', action: { type: 'applySection', kind } },
            { kind: 'literal', action: { type: 'setOrientation', orientationDeg: 90 } },
            { kind: 'setCurrentParam', value: 0.06, mode: 'strict' },
            { kind: 'literal', action: { type: 'setPrediction', direction: 'decrease', explanation: `Prediction for ${kind}`, now: 'prediction-time' } },
            { kind: 'runTest' },
            { kind: 'setCurrentParam', value: 0.07, mode: 'clamp' },
            { kind: 'literal', action: { type: 'setOrientation', orientationDeg: 0 } },
            { kind: 'literal', action: { type: 'setParam', param: 'lengthM', valueM: -1, mode: 'strict' } },
          ]
          inputs.forEach(execute)
          const last = harness.real.state.history[harness.real.state.history.length - 1]!
          expect(last.designSnapshot.section.kind).toBe(kind)
          expect(last.prediction?.explanation).toBe(`Prediction for ${kind}`)
        }
        // Record an optional-prediction iteration with neither prediction key present.
        execute({ kind: 'runTest' })
        expect(harness.real.state.history[harness.real.state.history.length - 1]!.prediction).toBeUndefined()
        const followUp: CommandInput[] = [
          { kind: 'target', type: 'restore', target: 'previous' },
          { kind: 'setCurrentParam', value: 0.08, mode: 'clamp' },
          { kind: 'importCurrent' },
          { kind: 'literal', action: { type: 'importDesign', json: '{' } },
          { kind: 'literal', action: { type: 'setReflection', text: 'Stored tests must remain unchanged.' } },
          { kind: 'target', type: 'submit', target: 'latest' },
          { kind: 'literal', action: { type: 'reset' } },
        ]
        followUp.forEach(execute)
        return harness
      }, commands)
    }))
  }, 30_000) // Allow the supported PBT_RUNS=2000 deep run without lowering coverage.

  const corruptions: { name: string; corrupt: (result: TestResult) => TestResult }[] = [
    { name: 'design snapshot', corrupt: (result) => ({ ...result, designSnapshot: { ...result.designSnapshot, orientationDeg: result.designSnapshot.orientationDeg === 90 ? 0 : 90 } }) },
    { name: 'analysis', corrupt: (result) => ({ ...result, analysis: { ...result.analysis, tipDeflectionM: result.analysis.tipDeflectionM + 1 } }) },
    { name: 'evaluation', corrupt: (result) => ({ ...result, evaluation: { ...result.evaluation, accepted: !result.evaluation.accepted } }) },
    { name: 'stored prediction', corrupt: (result) => ({ ...result, prediction: { ...result.prediction!, explanation: 'tampered' } }) },
  ]
  it.each(corruptions)('detects corruption of a previously recorded $name', ({ corrupt }) => {
    const harness = createHarness(ch)
    harness.real.hooks = [snapshotIsolationHook(harness.real.state.history)]
    new SessionCommand({ kind: 'literal', action: { type: 'setPrediction', direction: 'same', now: 't' } }).run(harness.model, harness.real)
    new SessionCommand({ kind: 'runTest' }).run(harness.model, harness.real)
    // Preserve ids/count/baseline so the harness's general checks cannot mask a weak oracle.
    harness.real.reduce = (state) => ({ ...state, history: [state.history[0]!, corrupt(state.history[1]!)] })
    expect(() => new SessionCommand({ kind: 'literal', action: { type: 'setReflection', text: '' } })
      .run(harness.model, harness.real)).toThrow()
  })
})
