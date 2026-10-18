import { describe, expect, it } from 'vitest'
import { bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import type { BracketDesignLimits } from '../../challenge/bracket/types'
import { applyBracketEdit, bracketPermissibleRange, clampBracketParam, isBracketParam } from './edit'

// Bracket edits (task 55 L-bracket; MM-09).

const ch = bracketChallenge()
const base = worksheetFixture('baseline').design

describe('applyBracketEdit', () => {
  it('sets each parameter in clamp and strict mode', () => {
    for (const mode of ['clamp', 'strict'] as const) {
      expect(applyBracketEdit(base, { type: 'setParam', param: 'thicknessM', valueM: 0.007, mode }, ch)).toEqual({ ok: true, value: { ...base, thicknessM: 0.007 } })
      expect(applyBracketEdit(base, { type: 'setParam', param: 'widthM', valueM: 0.04, mode }, ch)).toEqual({ ok: true, value: { ...base, widthM: 0.04 } })
      expect(applyBracketEdit(base, { type: 'setParam', param: 'flangeHeightM', valueM: 0.08, mode }, ch)).toEqual({ ok: true, value: { ...base, flangeHeightM: 0.08 } })
      expect(applyBracketEdit(base, { type: 'setParam', param: 'innerRadiusM', valueM: 0.006, mode }, ch)).toEqual({ ok: true, value: { ...base, innerRadiusM: 0.006 } })
    }
  })

  it('clamps out-of-range values into the configured range in clamp mode', () => {
    expect(applyBracketEdit(base, { type: 'setParam', param: 'flangeHeightM', valueM: 0.5, mode: 'clamp' }, ch)).toEqual({ ok: true, value: { ...base, flangeHeightM: 0.15 } })
    expect(applyBracketEdit(base, { type: 'setParam', param: 'innerRadiusM', valueM: -1, mode: 'clamp' }, ch)).toEqual({ ok: true, value: { ...base, innerRadiusM: 0.001 } })
  })

  it('rejects out-of-range values in strict mode with the validator errors', () => {
    const r = applyBracketEdit(base, { type: 'setParam', param: 'flangeHeightM', valueM: 0.5, mode: 'strict' }, ch)
    expect(!r.ok && r.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    const n = applyBracketEdit(base, { type: 'setParam', param: 'innerRadiusM', valueM: Number.NaN, mode: 'strict' }, ch)
    expect(!n.ok && n.error.map((e) => e.code)).toEqual(['NON_FINITE'])
  })

  it('leaves the parameter unchanged for a non-finite clamp value', () => {
    const r = applyBracketEdit(base, { type: 'setParam', param: 'thicknessM', valueM: Number.POSITIVE_INFINITY, mode: 'clamp' }, ch)
    expect(r).toEqual({ ok: true, value: base })
    expect(r.ok && r.value).not.toBe(base)
  })

  it('rejects unknown, locked and retired stepped-bar parameters with UNKNOWN_PARAM', () => {
    for (const param of ['loadOffsetM', 'materialId', 'rootDepthM', 'filletRadiusM']) {
      const r = applyBracketEdit(base, { type: 'setParam', param, valueM: 0.02, mode: 'clamp' }, ch)
      expect(r).toEqual({ ok: false, error: [{ code: 'UNKNOWN_PARAM', param, message: `"${param}" is not an adjustable dimension of the bracket.` }] })
    }
  })

  it('never mutates the draft', () => {
    const before = structuredClone(base)
    applyBracketEdit(base, { type: 'setParam', param: 'thicknessM', valueM: 0.009, mode: 'clamp' }, ch)
    applyBracketEdit(base, { type: 'setParam', param: 'widthM', valueM: 0.2, mode: 'strict' }, ch)
    expect(base).toEqual(before)
  })
})

describe('edit helpers', () => {
  it('isBracketParam recognizes the four dimensions only', () => {
    expect(['thicknessM', 'widthM', 'flangeHeightM', 'innerRadiusM'].every(isBracketParam)).toBe(true)
    expect(isBracketParam('loadOffsetM')).toBe(false)
  })

  it('bracketPermissibleRange is the configured range; degenerate ranges collapse', () => {
    expect(bracketPermissibleRange('innerRadiusM', ch.designLimits)).toEqual({ minM: 0.001, maxM: 0.012 })
    expect(bracketPermissibleRange('loadOffsetM', ch.designLimits)).toBeNull()
    const bad: BracketDesignLimits = { ...ch.designLimits, widthM: { minM: 0.05, maxM: 0.04, stepM: 0.001 } }
    expect(bracketPermissibleRange('widthM', bad)).toEqual({ minM: 0.04, maxM: 0.04 })
  })

  it('clampBracketParam returns the same object for unknown params and non-finite values; normalizes −0', () => {
    expect(clampBracketParam(base, 'loadOffsetM', 1, ch.designLimits)).toBe(base)
    expect(clampBracketParam(base, 'thicknessM', Number.NaN, ch.designLimits)).toBe(base)
    const zeroLimits: BracketDesignLimits = { ...ch.designLimits, innerRadiusM: { minM: -1, maxM: 1, stepM: 0.0005 } }
    expect(Object.is(clampBracketParam(base, 'innerRadiusM', -0, zeroLimits).innerRadiusM, 0)).toBe(true)
  })
})
