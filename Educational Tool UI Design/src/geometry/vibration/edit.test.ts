import { describe, expect, it } from 'vitest'
import { isolator, vibrationChallenge } from '../../../test/fixtures/vibration'
import { applyVibrationEdit, clampStiffness } from './edit'

// Vibration isolator edits (task 50.2; VIB-04, MM-09).

const ch = vibrationChallenge()
const limits = ch.stiffnessLimits
const draft = isolator('draft', 85000, 0.1)

describe('clampStiffness', () => {
  it('clamps into the configured range', () => {
    expect(clampStiffness(85000, 1, limits)).toBe(20000)
    expect(clampStiffness(85000, 5e6, limits)).toBe(2000000)
    expect(clampStiffness(85000, 61291.5625, limits)).toBe(61291.5625)
  })

  it('keeps the current value for non-finite input', () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(clampStiffness(85000, v, limits)).toBe(85000)
  })

  it('lets the upper bound win for inconsistent limits', () => {
    expect(clampStiffness(1, 10, { minNPerM: 20, maxNPerM: 5, stepNPerM: 1 })).toBe(5)
  })
})

describe('applyVibrationEdit', () => {
  it('applies clamp and strict stiffness edits and keeps the id and material', () => {
    expect(applyVibrationEdit(draft, { type: 'setStiffness', valueNPerM: 1e7, mode: 'clamp' }, ch)).toEqual({
      ok: true,
      value: { id: 'draft', stiffnessNPerM: 2000000, materialId: 'neoprene' },
    })
    expect(applyVibrationEdit(draft, { type: 'setStiffness', valueNPerM: 72500, mode: 'strict' }, ch)).toEqual({
      ok: true,
      value: { id: 'draft', stiffnessNPerM: 72500, materialId: 'neoprene' },
    })
  })

  it('rejects an out-of-range strict edit with every validator error', () => {
    const r = applyVibrationEdit(draft, { type: 'setStiffness', valueNPerM: 19500, mode: 'strict' }, ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((e) => e.code)).toEqual(['BELOW_MIN'])
    const nan = applyVibrationEdit(draft, { type: 'setStiffness', valueNPerM: Number.NaN, mode: 'strict' }, ch)
    expect(!nan.ok && nan.error.map((e) => e.code)).toEqual(['NON_FINITE'])
  })

  it('treats a non-finite clamp edit as a no-op that still returns a fresh design', () => {
    const r = applyVibrationEdit(draft, { type: 'setStiffness', valueNPerM: Number.NaN, mode: 'clamp' }, ch)
    expect(r).toEqual({ ok: true, value: draft })
    expect(r.ok && r.value).not.toBe(draft)
  })

  it('changes the material independently of stiffness and rejects an unlisted one', () => {
    expect(applyVibrationEdit(draft, { type: 'setMaterial', materialId: 'butylRubber' }, ch)).toEqual({
      ok: true,
      value: { id: 'draft', stiffnessNPerM: 85000, materialId: 'butylRubber' },
    })
    const r = applyVibrationEdit(draft, { type: 'setMaterial', materialId: 'cork' }, ch)
    expect(!r.ok && r.error.map((e) => `${e.param} ${e.code}`)).toEqual(['materialId MATERIAL_NOT_ALLOWED'])
  })

  it('never changes locked fields and does not mutate the draft', () => {
    const tampered = { ...draft, massKg: 40 }
    const r = applyVibrationEdit(tampered, { type: 'setStiffness', valueNPerM: 90000, mode: 'clamp' }, ch)
    // The edit rebuilds the design from its own fields, so the stray locked field is dropped.
    expect(r).toEqual({ ok: true, value: { id: 'draft', stiffnessNPerM: 90000, materialId: 'neoprene' } })
    const before = structuredClone(draft)
    applyVibrationEdit(draft, { type: 'setMaterial', materialId: 'steelSpring' }, ch)
    expect(draft).toEqual(before)
  })
})
