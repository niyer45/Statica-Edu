import { deepStrictEqual, notStrictEqual, strictEqual } from 'node:assert/strict'
import { it } from 'vitest'
import type { Analysis } from '../../src/physics/types'
import { assertSequences } from './sequence'

// Feature: engineering-intuition-mvp, Property 31: Restore
it('restore copies known snapshots without changing history and reproduces analysis when retested', () => {
  assertSequences(() => {
    let restoredAnalysis: Analysis | undefined
    return ({ action, before, after }) => {
      if (action.type === 'restore') {
        const target = before.history.find((r) => r.id === action.testResultId)
        if (!target) { deepStrictEqual(after, before); return }
        const { id, ...snapshot } = target.designSnapshot
        const { id: restoredId, ...draft } = after.draft
        notStrictEqual(restoredId, id)
        deepStrictEqual(draft, snapshot)
        notStrictEqual(after.draft.section, target.designSnapshot.section)
        strictEqual(after.history, before.history)
        deepStrictEqual(after.draftErrors, [])
        restoredAnalysis = target.analysis
      } else if (action.type === 'runTest') {
        if (restoredAnalysis && after.history.length > before.history.length) {
          deepStrictEqual(after.history[after.history.length - 1]!.analysis, restoredAnalysis)
          restoredAnalysis = undefined
        }
      } else if (['applySection', 'setParam', 'setOrientation', 'importDesign', 'reset', 'resetDraft'].includes(action.type)) {
        restoredAnalysis = undefined
      }
    }
  })
}, 30_000)
