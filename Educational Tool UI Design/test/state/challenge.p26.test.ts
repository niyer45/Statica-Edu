import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { bundledChallenge } from '../arbitraries'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 26: Constraints immutable
it('no action sequence changes any challenge data or constraints', () => {
  const original = structuredClone(bundledChallenge())
  assertSequences(() => ({ challenge }) => {
    deepStrictEqual(challenge, original)
    strictEqual(Object.isFrozen(challenge), true)
    strictEqual(Object.isFrozen(challenge.constraints), true)
  })
}, 30_000)
