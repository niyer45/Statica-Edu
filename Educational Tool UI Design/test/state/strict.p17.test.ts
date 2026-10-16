import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 17: Strict set
it('rejected strict sets preserve the draft, draft status and history', () => {
  assertSequences(() => ({ action, before, after }) => {
    if (action.type === 'setParam' && action.mode === 'strict' && after.draftErrors.length) {
      deepStrictEqual(after.draft, before.draft)
      strictEqual(after.draftStatus, before.draftStatus)
      strictEqual(after.history, before.history)
    }
  })
}, 30_000)
