import { describe, expect, it } from 'vitest'
import { bracketChallenge, worksheetFixture } from '../../../test/fixtures/bracket'
import type { BracketDesignLimits } from '../../challenge/bracket/types'
import { applyBracketEdit, bracketPermissibleRange, clampBracketParam, isBracketParam } from './edit'

// Bracket edits (task 46.2; MBR-05, MBR-12, MM-09, design.md "An edit that would make d > D is
// rejected, and the draft stays unchanged").

const ch = bracketChallenge()
const base = worksheetFixture('baseline').design

describe('applyBracketEdit', () => {
  it('sets each parameter in clamp and strict mode', () => {
    for (const mode of ['clamp', 'strict'] as const) {
      expect(applyBracketEdit(base, { type: 'setParam', param: 'rootDepthM', valueM: 0.032, mode }, ch)).toEqual({ ok: true, value: { ...base, rootDepthM: 0.032 } })
      expect(applyBracketEdit(base, { type: 'setParam', param: 'armDepthM', valueM: 0.025, mode }, ch)).toEqual({ ok: true, value: { ...base, armDepthM: 0.025 } })
      expect(applyBracketEdit(base, { type: 'setParam', param: 'stepLocationM', valueM: 0.19, mode }, ch)).toEqual({ ok: true, value: { ...base, stepLocationM: 0.19 } })
      expect(applyBracketEdit(base, { type: 'setParam', param: 'filletRadiusM', valueM: 0.0025, mode }, ch)).toEqual({ ok: true, value: { ...base, filletRadiusM: 0.0025 } })
    }
  })

  it('clamps out-of-range values into the configured range in clamp mode', () => {
    const r = applyBracketEdit(base, { type: 'setParam', param: 'stepLocationM', valueM: 0.5, mode: 'clamp' }, ch)
    expect(r).toEqual({ ok: true, value: { ...base, stepLocationM: 0.24 } })
    const f = applyBracketEdit(base, { type: 'setParam', param: 'filletRadiusM', valueM: -1, mode: 'clamp' }, ch)
    expect(f).toEqual({ ok: true, value: { ...base, filletRadiusM: 0.0005 } })
  })

  it('rejects out-of-range values in strict mode with the validator errors', () => {
    const r = applyBracketEdit(base, { type: 'setParam', param: 'stepLocationM', valueM: 0.5, mode: 'strict' }, ch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    const n = applyBracketEdit(base, { type: 'setParam', param: 'filletRadiusM', valueM: Number.NaN, mode: 'strict' }, ch)
    expect(!n.ok && n.error.map((e) => e.code)).toEqual(['NON_FINITE'])
  })

  it('rejects any edit that would make d > D, in both modes, without moving the other depth', () => {
    for (const mode of ['clamp', 'strict'] as const) {
      const up = applyBracketEdit(base, { type: 'setParam', param: 'armDepthM', valueM: 0.031, mode }, ch)
      expect(!up.ok && up.error.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
      const down = applyBracketEdit(base, { type: 'setParam', param: 'rootDepthM', valueM: 0.019, mode }, ch)
      expect(!down.ok && down.error.map((e) => e.code)).toEqual(['ARM_DEEPER_THAN_ROOT'])
    }
    // Clamp mode still clamps first: a huge arm depth clamps to 50 mm, which exceeds D = 30 mm.
    const huge = applyBracketEdit(base, { type: 'setParam', param: 'armDepthM', valueM: 1, mode: 'clamp' }, ch)
    expect(!huge.ok && huge.error[0].message).toContain('arm 50 mm, root 30 mm')
  })

  it('allows d = D (uniform bar) and keeps a and r editable then', () => {
    const u = applyBracketEdit(base, { type: 'setParam', param: 'armDepthM', valueM: 0.03, mode: 'strict' }, ch)
    expect(u.ok).toBe(true)
    if (!u.ok) return
    const r = applyBracketEdit(u.value, { type: 'setParam', param: 'filletRadiusM', valueM: 0.004, mode: 'strict' }, ch)
    const a = applyBracketEdit(u.value, { type: 'setParam', param: 'stepLocationM', valueM: 0.2, mode: 'clamp' }, ch)
    expect(r.ok && r.value.filletRadiusM).toBe(0.004)
    expect(a.ok && a.value.stepLocationM).toBe(0.2)
  })

  it('leaves the parameter unchanged for a non-finite clamp value', () => {
    const r = applyBracketEdit(base, { type: 'setParam', param: 'rootDepthM', valueM: Number.POSITIVE_INFINITY, mode: 'clamp' }, ch)
    expect(r).toEqual({ ok: true, value: base })
    expect(r.ok && r.value).not.toBe(base)
  })

  it('rejects unknown and locked parameters with UNKNOWN_PARAM', () => {
    for (const param of ['lengthM', 'materialId', 'thicknessM', 'widthM']) {
      const r = applyBracketEdit(base, { type: 'setParam', param, valueM: 0.02, mode: 'clamp' }, ch)
      expect(r).toEqual({ ok: false, error: [{ code: 'UNKNOWN_PARAM', param, message: `"${param}" is not an adjustable dimension of the bracket.` }] })
    }
  })

  it('never mutates the draft', () => {
    const before = structuredClone(base)
    applyBracketEdit(base, { type: 'setParam', param: 'rootDepthM', valueM: 0.04, mode: 'clamp' }, ch)
    applyBracketEdit(base, { type: 'setParam', param: 'armDepthM', valueM: 0.04, mode: 'strict' }, ch)
    expect(base).toEqual(before)
  })
})

describe('edit helpers', () => {
  it('isBracketParam recognizes the four dimensions only', () => {
    expect(['rootDepthM', 'armDepthM', 'stepLocationM', 'filletRadiusM'].every(isBracketParam)).toBe(true)
    expect(isBracketParam('lengthM')).toBe(false)
  })

  it('bracketPermissibleRange is the configured range; degenerate ranges collapse', () => {
    expect(bracketPermissibleRange('filletRadiusM', ch.designLimits)).toEqual({ minM: 0.0005, maxM: 0.01 })
    expect(bracketPermissibleRange('lengthM', ch.designLimits)).toBeNull()
    const bad: BracketDesignLimits = { ...ch.designLimits, rootDepthM: { minM: 0.05, maxM: 0.04, stepM: 0.0005 } }
    expect(bracketPermissibleRange('rootDepthM', bad)).toEqual({ minM: 0.04, maxM: 0.04 })
  })

  it('clampBracketParam returns the same object for unknown params and non-finite values; normalizes −0', () => {
    expect(clampBracketParam(base, 'lengthM', 1, ch.designLimits)).toBe(base)
    expect(clampBracketParam(base, 'rootDepthM', Number.NaN, ch.designLimits)).toBe(base)
    const zeroLimits: BracketDesignLimits = { ...ch.designLimits, filletRadiusM: { minM: -1, maxM: 1, stepM: 0.0005 } }
    expect(Object.is(clampBracketParam(base, 'filletRadiusM', -0, zeroLimits).filletRadiusM, 0)).toBe(true)
  })
})
