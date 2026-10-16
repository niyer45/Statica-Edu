import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 37: Submit gating
it('only non-baseline results with a nonblank reflection can be submitted, without grading text', () => {
  assertSequences(() => ({ action, before, after }) => {
    if (after.submission) {
      const result = after.history.find((r) => r.id === after.submission!.testResultId)
      ok(result && result.iteration >= 1)
      ok(after.submission.reflection.trim().length > 0)
      strictEqual(after.submission.status, result.evaluation.status)
      deepStrictEqual(after.submission.efficiency, result.evaluation.efficiency)
    }
    if (action.type === 'submit') {
      const target = before.history.find((r) => r.id === action.testResultId)
      if (!target || target.iteration === 0 || !before.reflectionAnswer.trim()) strictEqual(after, before)
      else {
        strictEqual(after.submission!.reflection, before.reflectionAnswer)
        strictEqual(after.submission!.testResultId, target.id)
        strictEqual(after.submission!.submittedAt, action.now)
      }
    }
  })
}, 30_000)
