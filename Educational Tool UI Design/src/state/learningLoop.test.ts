import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import { deepFreeze } from '../challenge/deepFreeze'
import { analyze } from '../physics/analyze'
import { exportDesign, importDesign } from './importExport'
import { sessionReducer } from './reducer'
import { initSession, sameDesignIgnoringId, type Action, type SessionState } from './session'

if (!bundledChallengeResult.ok) throw new Error('Challenge failed to load')
const ch = bundledChallengeResult.value
const run = (s: SessionState, ...actions: Action[]) => actions.reduce((state, action) => sessionReducer(state, action, ch), s)
function fresh() {
  const result = initSession(ch, 'baseline-time', 'base')
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
function tested(count = 4) {
  let s = fresh()
  for (let n = 1; n <= count; n++) {
    s = run(s,
      // The baseline is an I-section; each test raises its height by 2 mm.
      { type: 'setParam', param: 'heightM', valueM: 0.084 + n * 0.002, mode: 'strict' },
      { type: 'setPrediction', direction: 'decrease', now: 'prediction-time' },
      { type: 'runTest', id: `test-${n}`, now: `time-${n}` })
  }
  return s
}

describe('restore and reset (task 19.2)', () => {
  it('restores isolated geometry, clears transient state, preserves history and recomputes status', () => {
    const s = tested()
    for (const result of s.history) {
      const restored = run({ ...s, ui: { predictionDialogOpen: true }, pendingPrediction: { iteration: 5, direction: 'same', createdAt: 't' } }, { type: 'restore', testResultId: result.id })
      expect(restored.history).toBe(s.history)
      expect(restored.draft.id).not.toBe(result.designSnapshot.id)
      expect(sameDesignIgnoringId(restored.draft, result.designSnapshot)).toBe(true)
      expect(restored.draft.section).not.toBe(result.designSnapshot.section)
      expect(restored.draftStatus).toBe(result.iteration === 4 ? 'tested' : 'draft')
      expect(restored.draftErrors).toEqual([])
      expect(restored.pendingPrediction).toBeUndefined()
      expect(restored.ui.predictionDialogOpen).toBe(false)
      expect(analyze(restored.draft, ch)).toEqual(result.analysis)
      const edited = run(restored, { type: 'setParam', param: 'heightM', valueM: 0.06, mode: 'strict' })
      expect(edited.history).toBe(s.history)
      expect(result.designSnapshot.section).not.toEqual(edited.draft.section)
    }
  })
  it('unknown restore returns the exact input including errors', () => {
    const s = run(tested(), { type: 'setParam', param: 'heightM', valueM: -1, mode: 'strict' })
    expect(run(s, { type: 'restore', testResultId: 'missing' })).toBe(s)
  })
  it('uses deterministic fresh ids even when a derived id collides', () => {
    const s = fresh()
    const first = run(s, { type: 'restore', testResultId: 'base' })
    const second = run(first, { type: 'restore', testResultId: 'base' })
    expect(second.draft.id).not.toBe(first.draft.id)
    expect(run(s, { type: 'restore', testResultId: 'base' })).toEqual(first)
  })
  it('restored geometry can be retested as a new immutable iteration', () => {
    const s = tested(1)
    const next = run(s, { type: 'restore', testResultId: 'base' }, { type: 'runTest', id: 'restored-test', now: 't' })
    expect(next.history).toHaveLength(3)
    expect(next.history[2]!.analysis).toEqual(s.history[0]!.analysis)
    expect(next.history[0]).toBe(s.history[0])
    expect(next.history[1]).toBe(s.history[1])
  })
  it('reset clears learning/transient state, keeps mode and all history, restores locked baseline fields', () => {
    const s = run(tested(), { type: 'setReflection', text: 'learning' }, { type: 'submit', testResultId: 'test-1', now: 't' })
    const next = run(s, { type: 'reset' })
    expect(next.history).toBe(s.history)
    expect(next.mode).toBe(s.mode)
    expect(sameDesignIgnoringId(next.draft, s.history[0]!.designSnapshot)).toBe(true)
    expect(next.draft.lengthM).toBe(ch.initialDesign.lengthM)
    expect(next.draft.materialId).toBe(ch.initialDesign.materialId)
    expect(next.draftStatus).toBe('draft')
    expect(next.compareSelection).toEqual([])
    expect(next.reflectionAnswer).toBe('')
    expect(next.submission).toBeUndefined()
    expect(next.pendingPrediction).toBeUndefined()
    expect(next.draftErrors).toEqual([])
    expect(next.ui).toEqual({ predictionDialogOpen: false })
    expect(run(fresh(), { type: 'reset' }).draftStatus).toBe('tested')
  })
})

describe('comparison selection', () => {
  it('keeps baseline implicit and unknown ids unchanged', () => {
    const s = tested()
    expect(run(s, { type: 'toggleCompare', testResultId: 'base' })).toBe(s)
    expect(run(s, { type: 'toggleCompare', testResultId: 'missing' })).toBe(s)
  })
  it('rejects a fourth selection with notice, then permits deselection and re-selection in history order', () => {
    const s = tested()
    expect(s.compareSelection).toEqual(['test-2', 'test-3', 'test-4'])
    const blocked = run(s, { type: 'toggleCompare', testResultId: 'test-1' })
    expect(blocked.compareSelection).toBe(s.compareSelection)
    expect(blocked.ui.notice?.message).toMatch(/at most three/i)
    const next = run(blocked, { type: 'toggleCompare', testResultId: 'test-3' }, { type: 'toggleCompare', testResultId: 'test-1' })
    expect(next.compareSelection).toEqual(['test-1', 'test-2', 'test-4'])
    expect(next.ui.notice).toBeUndefined()
    expect(next.history).toBe(s.history)
  })
})

describe('reflection and submission', () => {
  it('preserves empty, whitespace, markup and 2000-character answers verbatim', () => {
    for (const text of ['', '  \n ', '<script>literal</script>', 'a'.repeat(2000)]) {
      expect(run(fresh(), { type: 'setReflection', text }).reflectionAnswer).toBe(text)
    }
  })
  it('rejects oversized and non-string reflection payloads without any changes', () => {
    const s = tested()
    for (const text of ['a'.repeat(2001), null, 5]) {
      expect(run(s, { type: 'setReflection', text: text as string })).toBe(s)
    }
  })
  it('rejects unknown targets, baseline, and whitespace without replacing a previous submission', () => {
    const s = run(tested(), { type: 'setReflection', text: ' explanation ' }, { type: 'submit', testResultId: 'test-1', now: 't' })
    for (const testResultId of ['missing', 'base']) expect(run(s, { type: 'submit', testResultId, now: 'later' })).toBe(s)
    const empty = run(s, { type: 'setReflection', text: ' \n\t' })
    expect(run(empty, { type: 'submit', testResultId: 'test-2', now: 'later' })).toBe(empty)
  })
  it('copies selected stored status/efficiency and untrimmed text, replacing the submission without grading', () => {
    const s = tested()
    const first = run(s, { type: 'setReflection', text: '  first\n' }, { type: 'submit', testResultId: 'test-1', now: 'submitted' })
    expect(first.submission).toEqual({ testResultId: 'test-1', status: s.history[1]!.evaluation.status, efficiency: s.history[1]!.evaluation.efficiency, reflection: '  first\n', submittedAt: 'submitted' })
    expect(first.submission!.efficiency).not.toBe(s.history[1]!.evaluation.efficiency)
    const next = run(first, { type: 'setReflection', text: '<img onerror=literal>' }, { type: 'submit', testResultId: 'test-1', now: 'later' })
    expect(next.submission!.status).toBe(first.submission!.status)
    expect(next.submission!.reflection).toBe('<img onerror=literal>')
    expect(next.history).toBe(s.history)
  })
})

describe('all-or-nothing import and purity', () => {
  it('valid imports preserve id, copy input, clear errors, and derive draft status against latest', () => {
    const s = tested()
    for (const result of [s.history[0]!, s.history[4]!]) {
      const json = JSON.parse(exportDesign({ ...result.designSnapshot, id: 'imported' }, ch))
      const next = run(s, { type: 'importDesign', json })
      expect(next.draft).toEqual(json.design)
      expect(next.draft).not.toBe(json.design)
      expect(next.draft.section).not.toBe(json.design.section)
      expect(next.draftStatus).toBe(result.iteration === 4 ? 'tested' : 'draft')
      expect(next.draftErrors).toEqual([])
      expect(next.history).toBe(s.history)
    }
  })
  it('rejects malformed, hostile and locked-field imports with exact state identity', () => {
    const s = tested()
    const locked = JSON.parse(exportDesign(s.draft, ch))
    locked.design.lengthM = 1
    locked.design.materialId = 'other'
    const reasons = importDesign(locked, ch)
    expect(reasons.ok).toBe(false)
    if (!reasons.ok) expect(reasons.error).toHaveLength(2)
    for (const json of [locked, null, '{', '{"__proto__":{}}', { ...locked, design: { ...locked.design, section: { kind: 'circle', diameterM: -1 } } }]) {
      expect(run(s, { type: 'importDesign', json })).toBe(s)
    }
  })
  it('all six actions accept frozen inputs without mutation and produce deterministic outputs', () => {
    const s = deepFreeze(run(tested(), { type: 'setReflection', text: 'answer' }))
    const before = structuredClone(s)
    const actions: Action[] = [
      { type: 'restore', testResultId: 'base' }, { type: 'toggleCompare', testResultId: 'test-4' },
      { type: 'setReflection', text: 'new answer' }, { type: 'submit', testResultId: 'test-1', now: 't' },
      { type: 'importDesign', json: exportDesign(s.draft, ch) }, { type: 'reset' },
    ]
    for (const action of actions) {
      expect(run(s, action)).toEqual(run(s, action))
      expect(run(s, action).history).toBe(s.history)
      expect(s).toEqual(before)
    }
  })
})
