import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { bundledChallenge } from '../arbitraries'
import { sessionReducer } from '../../src/state/reducer'
import { createHarness } from './model'
import { assertSequences } from './sequence'

it('guided and parametric modes produce identical designs, history and evaluations for every action', () => {
  assertSequences(() => {
    let parametric = createHarness(bundledChallenge(), { mode: 'parametric' }).real.state
    return ({ action, after, challenge }) => {
      parametric = sessionReducer(parametric, action, challenge)
      const { mode: leftMode, ...left } = after
      const { mode: rightMode, ...right } = parametric
      strictEqual(leftMode, 'guided')
      strictEqual(rightMode, 'parametric')
      deepStrictEqual(left, right)
    }
  })
}, 30_000)
