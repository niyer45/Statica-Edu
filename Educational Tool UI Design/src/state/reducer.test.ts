import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import { validateDesign } from '../geometry/validate'
import { sessionReducer } from './reducer'
import { selectStatusBadge } from './selectors'
import { initSession, sameDesignIgnoringId, type Action, type SessionState } from './session'

// Unit tests for initSession and the edit actions (task 13.1; Req 4.1, 4.2, 4.4, 6.6, 6.8,
// 7.6, 7.8, 15.1–15.3, 15.7, 16.1, 16.2, 16.7, 16.9).

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value

function fresh(): SessionState {
  const r = initSession(ch, '2026-10-14T10:00:00Z', 'base')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}

const run = (s: SessionState, ...actions: Action[]) =>
  actions.reduce((acc, a) => sessionReducer(acc, a, ch), s)

/** Unfrozen copy of the bundled challenge with overrides applied by `edit`. */
function variant(edit: (c: Challenge) => void): Challenge {
  const c = structuredClone(ch) as Challenge
  edit(c)
  return c
}

describe('initSession (Req 15.1, 15.2, 15.7, 16.7)', () => {
  it('stores the analyzed and evaluated baseline as iteration 0', () => {
    const s = fresh()
    expect(s.history).toHaveLength(1)
    const b = s.history[0]!
    expect(b).toMatchObject({ id: 'base', iteration: 0, label: 'Baseline', timestamp: '2026-10-14T10:00:00Z' })
    expect(b.prediction).toBeUndefined()
    expect(b.designSnapshot).toEqual(ch.initialDesign)
    expect(b.evaluation.status).toBe('notAccepted')
    expect(b.failures).toEqual(['deflection'])
    expect(b.analysis.tipDeflectionM).toBeCloseTo(7.8732e-3, 6)
  })

  it('starts with a tested, valid, error-free draft and an empty learning state', () => {
    const s = fresh()
    expect(s.draft).toEqual(s.history[0]!.designSnapshot)
    expect(s.draftStatus).toBe('tested')
    expect(s.draftErrors).toEqual([])
    expect(s.reflectionAnswer).toBe('')
    expect(s.pendingPrediction).toBeUndefined()
    expect(s.submission).toBeUndefined()
    expect(s.ui.predictionDialogOpen).toBe(false)
    expect(s.mode).toBe('guided')
    expect(selectStatusBadge(s)).toBe('Tested #0')
  })

  it('deep-freezes the baseline but leaves the draft editable', () => {
    const s = fresh()
    const b = s.history[0]!
    expect(Object.isFrozen(b)).toBe(true)
    expect(Object.isFrozen(b.designSnapshot.section)).toBe(true)
    expect(Object.isFrozen(b.analysis)).toBe(true)
    expect(Object.isFrozen(b.evaluation.constraints)).toBe(true)
    expect(s.draft).not.toBe(b.designSnapshot)
    expect(Object.isFrozen(s.draft)).toBe(false)
  })

  it('is deterministic for the same arguments', () => {
    expect(initSession(ch, 't', 'x')).toEqual(initSession(ch, 't', 'x'))
  })

  it('fails, naming the initial design, when it is invalid (Req 15.3)', () => {
    const bad = variant((c) => {
      c.initialDesign.section = { kind: 'circle', diameterM: 0.001 }
    })
    const r = initSession(bad, 't', 'x')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.source).toBe('initialDesign')
    expect(r.error.message).toMatch(/initial design/)
    expect(r.error.details.length).toBeGreaterThan(0)
  })

  it('fails, naming the initial design, when analysis throws PhysicsInvariantError (Req 15.3)', () => {
    const bad = variant((c) => {
      c.material.elasticModulusPa = 0
    })
    const r = initSession(bad, 't', 'x')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.source).toBe('initialDesign')
    expect(r.error.details[0]).toMatch(/Physics invariant violated/)
  })
})

describe('setParam (Req 6.6, 6.8, 15.9, 16.2, 16.9)', () => {
  it('clamp mode clamps out-of-range values into the range and marks the draft untested', () => {
    const s = run(fresh(), { type: 'setParam', param: 'diameterM', valueM: 5, mode: 'clamp' })
    expect(s.draft.section).toEqual({ kind: 'circle', diameterM: ch.sectionLimits.circle.diameterM.maxM })
    expect(s.draftErrors).toEqual([])
    expect(s.draftStatus).toBe('draft')
    expect(selectStatusBadge(s)).toBe('Draft')
  })

  it('clamp mode ignores non-finite values', () => {
    const s0 = fresh()
    const s = run(s0, { type: 'setParam', param: 'diameterM', valueM: Number.NaN, mode: 'clamp' })
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftStatus).toBe('tested')
  })

  it('strict mode rejects out-of-range values, keeping draft and status (Req 6.6, 16.9)', () => {
    const s0 = fresh()
    const s = run(s0, { type: 'setParam', param: 'diameterM', valueM: 0.001, mode: 'strict' })
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftStatus).toBe('tested')
    expect(s.draftErrors[0]).toMatchObject({ code: 'BELOW_MIN', param: 'diameterM' })
    expect(s.draftErrors[0]!.message.length).toBeGreaterThan(0)
  })

  it('strict mode rejects non-finite values with NON_FINITE (Req 6.7)', () => {
    const s0 = fresh()
    const s = run(s0, { type: 'setParam', param: 'diameterM', valueM: Infinity, mode: 'strict' })
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftErrors.map((e) => e.code)).toContain('NON_FINITE')
  })

  it('strict mode accepts a valid value and clears previous errors (Req 6.8)', () => {
    const s = run(
      fresh(),
      { type: 'setParam', param: 'diameterM', valueM: 0.001, mode: 'strict' },
      { type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' },
    )
    expect(s.draft.section).toEqual({ kind: 'circle', diameterM: 0.04 })
    expect(s.draftErrors).toEqual([])
    expect(s.draftStatus).toBe('draft')
  })

  it('strict mode does not couple thicknesses (only the parameter changes or nothing does)', () => {
    const s0 = run(fresh(), { type: 'applySection', kind: 'iSection' })
    const s = run(s0, { type: 'setParam', param: 'widthM', valueM: 0.002, mode: 'strict' })
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftErrors.length).toBeGreaterThan(0)
  })

  it('rejects edits to locked fields in either mode (Req 4.1, 4.4, 16.9)', () => {
    const s0 = run(fresh(), { type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'clamp' })
    for (const mode of ['clamp', 'strict'] as const) {
      for (const param of ['lengthM', 'materialId', 'forceN', 'support']) {
        const s = run(s0, { type: 'setParam', param, valueM: 1, mode })
        expect(s.draft).toEqual(s0.draft)
        expect(s.draftStatus).toBe('draft')
        expect(s.draftErrors).toEqual([expect.objectContaining({ code: 'LOCKED_FIELD_CHANGED', param })])
      }
    }
  })

  it('rejects a parameter that the current section kind does not have', () => {
    const s0 = fresh()
    for (const mode of ['clamp', 'strict'] as const) {
      const s = run(s0, { type: 'setParam', param: 'widthM', valueM: 0.02, mode })
      expect(s.draft).toEqual(s0.draft)
      expect(s.draftErrors[0]).toMatchObject({ code: 'SECTION_NOT_ALLOWED', param: 'widthM' })
    }
  })
})

describe('draftStatus (Req 16.1, 16.2)', () => {
  it('returns to tested when the draft is edited back to the latest snapshot', () => {
    const s = run(
      fresh(),
      { type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' },
      { type: 'setParam', param: 'diameterM', valueM: 0.03, mode: 'strict' },
    )
    expect(s.draftStatus).toBe('tested')
  })

  it('ignores the design id when comparing with the snapshot', () => {
    const s0 = fresh()
    const renamed: SessionState = { ...s0, draft: { ...s0.draft, id: 'some-other-id' } }
    const s = run(renamed, { type: 'setParam', param: 'diameterM', valueM: 0.03, mode: 'strict' })
    expect(s.draft.id).toBe('some-other-id')
    expect(s.draftStatus).toBe('tested')
    expect(sameDesignIgnoringId(s.draft, s0.history[0]!.designSnapshot)).toBe(true)
    expect(sameDesignIgnoringId(s.draft, { ...s.draft, orientationDeg: 90 })).toBe(false)
  })
})

describe('applySection and setOrientation (Req 6.9, 7.6, 7.8)', () => {
  it('converts the section preserving the bounding box, keeping locked fields', () => {
    const s = run(fresh(), { type: 'applySection', kind: 'iSection' })
    expect(s.draft.section).toMatchObject({ kind: 'iSection', widthM: 0.03, heightM: 0.03 })
    expect(validateDesign(s.draft, ch)).toEqual([])
    expect(s.draft.lengthM).toBe(ch.initialDesign.lengthM)
    expect(s.draft.materialId).toBe(ch.initialDesign.materialId)
    expect(s.draftStatus).toBe('draft')
  })

  it('applying the current kind is a no-op that stays tested', () => {
    const s0 = fresh()
    const s = run(s0, { type: 'applySection', kind: 'circle' })
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftStatus).toBe('tested')
  })

  it('rejects a section kind the challenge does not allow', () => {
    const limited = variant((c) => {
      c.allowedSections = ['circle']
    })
    const s0 = fresh()
    const s = sessionReducer(s0, { type: 'applySection', kind: 'tube' }, limited)
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftErrors.map((e) => e.code)).toContain('SECTION_NOT_ALLOWED')
  })

  it('sets 0° / 90° without touching the section or locked fields (Req 7.6)', () => {
    const s0 = run(fresh(), { type: 'applySection', kind: 'rectangle' })
    const s = run(s0, { type: 'setOrientation', orientationDeg: 90 })
    expect(s.draft).toEqual({ ...s0.draft, orientationDeg: 90 })
    expect(s.draftErrors).toEqual([])
  })

  it('rejects any other orientation with BAD_ORIENTATION (Req 7.8)', () => {
    const s0 = fresh()
    const s = sessionReducer(s0, { type: 'setOrientation', orientationDeg: 45 as unknown as 0 }, ch)
    expect(s.draft).toEqual(s0.draft)
    expect(s.draftStatus).toBe('tested')
    expect(s.draftErrors).toEqual([expect.objectContaining({ code: 'BAD_ORIENTATION', param: 'orientationDeg' })])
  })
})

describe('reducer purity', () => {
  it('never mutates the input state and keeps history by reference', () => {
    const s0 = fresh()
    const before = structuredClone(s0)
    const s = run(
      s0,
      { type: 'applySection', kind: 'tube' },
      { type: 'setParam', param: 'outerDiameterM', valueM: 0.05, mode: 'clamp' },
      { type: 'setOrientation', orientationDeg: 90 },
    )
    expect(s0).toEqual(before)
    expect(s.history).toBe(s0.history)
  })

  it('reset preserves the baseline history reference', () => {
    const s0 = fresh()
    expect(sessionReducer(s0, { type: 'reset' }, ch).history).toBe(s0.history)
  })
})
