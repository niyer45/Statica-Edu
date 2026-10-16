import { deepStrictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { validateDesign } from '../../src/geometry/validate'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 32: Draft validity invariant
it('all reachable drafts and recorded snapshots remain valid after valid and hostile actions', () => {
  assertSequences(() => ({ after, challenge }) => {
    deepStrictEqual(validateDesign(after.draft, challenge), [])
    for (const result of after.history) deepStrictEqual(validateDesign(result.designSnapshot, challenge), [])
  })
}, 30_000)
