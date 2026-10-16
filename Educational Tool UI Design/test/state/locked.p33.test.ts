import { strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 33: Locked fields
it('every action preserves the exact challenge length and material in draft and history', () => {
  assertSequences(() => ({ after, challenge }) => {
    for (const design of [after.draft, ...after.history.map((r) => r.designSnapshot)]) {
      strictEqual(design.lengthM, challenge.initialDesign.lengthM)
      strictEqual(design.materialId, challenge.initialDesign.materialId)
    }
  })
}, 30_000)
