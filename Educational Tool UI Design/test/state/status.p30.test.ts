import { isDeepStrictEqual } from 'node:util'
import { strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 30: Draft status
it('draftStatus exactly describes equality with the latest snapshot, ignoring only id', () => {
  assertSequences(() => ({ after }) => {
    const { id: draftId, ...draft } = after.draft
    const { id: snapshotId, ...snapshot } = after.history[after.history.length - 1]!.designSnapshot
    void draftId
    void snapshotId
    strictEqual(after.draftStatus, isDeepStrictEqual(draft, snapshot) ? 'tested' : 'draft')
  })
}, 30_000)
