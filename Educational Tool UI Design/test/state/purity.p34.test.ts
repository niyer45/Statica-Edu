import fc from 'fast-check'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { deepFreeze } from '../../src/challenge/deepFreeze'
import { sessionReducer } from '../../src/state/reducer'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 34: Reducer purity
it('frozen inputs produce deterministic results without changing state, action or challenge', () => {
  assertSequences(() => ({ before, after, action, challenge }) => {
    const stateValue = structuredClone(before)
    const challengeValue = structuredClone(challenge)
    // fast-check preserves null prototypes in hostile payloads; structuredClone does not.
    const actionValue = fc.stringify(action)
    deepFreeze(before)
    deepFreeze(action)
    deepFreeze(challenge)
    deepStrictEqual(sessionReducer(before, action, challenge), after)
    deepStrictEqual(sessionReducer(before, action, challenge), after)
    deepStrictEqual(before, stateValue)
    strictEqual(fc.stringify(action), actionValue)
    deepStrictEqual(challenge, challengeValue)
    deepFreeze(after) // next command receives a frozen state, including its editable draft
  })
}, 60_000)
