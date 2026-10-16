import { ok, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 36: Prediction gating
it('required iterations never record without a matching prediction and gating consumes no iteration', () => {
  assertSequences(() => ({ action, before, after, challenge }) => {
    for (const result of after.history) {
      if (challenge.predictionPolicy.requiredOnIterations.includes(result.iteration)) {
        ok(result.prediction)
        strictEqual(result.prediction.iteration, result.iteration)
      }
    }
    const next = before.history[before.history.length - 1]!.iteration + 1
    if (action.type === 'runTest' && challenge.predictionPolicy.requiredOnIterations.includes(next) && before.pendingPrediction?.iteration !== next) {
      strictEqual(after.history, before.history)
      strictEqual(after.ui.predictionDialogOpen, true)
    }
    if (action.type === 'cancelPrediction') {
      strictEqual(after.history, before.history)
      strictEqual(after.pendingPrediction, undefined)
      strictEqual(after.ui.predictionDialogOpen, false)
    }
  })
}, 30_000)
