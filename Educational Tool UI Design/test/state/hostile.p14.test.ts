import fc from 'fast-check'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { importDesign } from '../../src/state/importExport'
import { sessionReducer } from '../../src/state/reducer'
import { arbInvalidSection, bundledChallenge } from '../arbitraries'
import { assertProperty } from '../pbt'
import { reachableSession } from './model'
import { assertSequences } from './sequence'
const ch = bundledChallenge()

// Feature: engineering-intuition-mvp, Property 14: Hostile input rejection
it('rejected imports leave the entire reachable session unchanged', () => {
  assertSequences(() => ({ action, before, after, challenge }) => {
    if (action.type === 'importDesign' && !importDesign(action.json, challenge).ok) strictEqual(after, before)
  })
}, 30_000)
it('hostile drafts cannot consume an iteration even with a pending prediction', () => {
  assertProperty(fc.property(reachableSession(ch), arbInvalidSection(ch.sectionLimits), ({ state }, section) => {
    const before = { ...state, draft: { ...state.draft, section } }
    const after = sessionReducer(before, { type: 'runTest', now: 't', id: 'hostile-run' }, ch)
    strictEqual(after.history, before.history)
    strictEqual(after.draft, before.draft)
    deepStrictEqual(after.pendingPrediction, before.pendingPrediction)
  }))
}, 30_000)
