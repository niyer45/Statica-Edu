import { describe, expect, it } from 'vitest'
import { fatigueChallenge } from '../../../test/fixtures/fatigue'
import { applyFatigueEdit, clampFatigueParam, fatiguePermissibleRange } from './edit'

const ch = fatigueChallenge()
const base = ch.initialDesign

describe('applyFatigueEdit', () => {
  it('clamps into the configured range and keeps the rest of the design', () => {
    const r = applyFatigueEdit(base, { type: 'setParam', param: 'filletRadiusM', valueM: 0.5, mode: 'clamp' }, ch)
    expect(r).toEqual({ ok: true, value: { ...base, filletRadiusM: 0.005 } })
    const low = applyFatigueEdit(base, { type: 'setParam', param: 'neckDiameterM', valueM: -1, mode: 'clamp' }, ch)
    expect(low.ok && low.value.neckDiameterM).toBe(0.02)
  })

  it('rejects a strict out-of-range value and keeps the draft', () => {
    const r = applyFatigueEdit(base, { type: 'setParam', param: 'collarDiameterM', valueM: 0.07, mode: 'strict' }, ch)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error[0]!.code).toBe('ABOVE_MAX')
  })

  it('rejects an edit that leaves the fillet larger than the step, even in clamp mode', () => {
    const r = applyFatigueEdit({ ...base, filletRadiusM: 0.005 }, { type: 'setParam', param: 'neckDiameterM', valueM: 0.04, mode: 'clamp' }, ch)
    expect(!r.ok && r.error.map((e) => e.code)).toEqual(['FILLET_EXCEEDS_STEP'])
  })

  it('changes the finish only to an offered finish', () => {
    expect(applyFatigueEdit(base, { type: 'setFinish', finish: 'ground' }, ch)).toEqual({ ok: true, value: { ...base, surfaceFinish: 'ground' } })
    const r = applyFatigueEdit(base, { type: 'setFinish', finish: 'hotRolled' }, ch)
    expect(!r.ok && r.error.map((e) => e.code)).toEqual(['FINISH_NOT_ALLOWED'])
  })

  it('names an unknown parameter and ignores non-finite clamp values', () => {
    const r = applyFatigueEdit(base, { type: 'setParam', param: 'materialId', valueM: 1, mode: 'strict' }, ch)
    expect(!r.ok && r.error).toEqual([{ code: 'UNKNOWN_PARAM', param: 'materialId', message: '"materialId" is not an adjustable dimension of the spindle.' }])
    expect(clampFatigueParam(base, 'neckDiameterM', Number.NaN, ch.designLimits)).toBe(base)
    expect(clampFatigueParam(base, 'nope', 0.02, ch.designLimits)).toBe(base)  })

  it('collapses an inconsistent range to its upper bound', () => {
    expect(fatiguePermissibleRange('neckDiameterM', { ...ch.designLimits, neckDiameterM: { minM: 0.03, maxM: 0.02, stepM: 0.001 } })).toEqual({ minM: 0.02, maxM: 0.02 })
    expect(fatiguePermissibleRange('x', ch.designLimits)).toBeNull()
  })
})
