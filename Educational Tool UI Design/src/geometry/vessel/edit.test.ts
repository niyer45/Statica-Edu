import { describe, expect, it } from 'vitest'
import { vesselChallenge } from '../../../test/fixtures/vessel'
import { applyVesselEdit, clampVesselParam, isVesselParam, vesselPermissibleRange } from './edit'

// Pressure vessel edit operations (task 69; MM-09).

const ch = vesselChallenge()
const d = ch.initialDesign

describe('vessel edits', () => {
  it('recognizes exactly the four parameters', () => {
    expect(['innerDiameterM', 'shellLengthM', 'shellThicknessM', 'headThicknessM'].every(isVesselParam)).toBe(true)
    expect(isVesselParam('materialId')).toBe(false)
    expect(isVesselParam('pressurePa')).toBe(false)
  })

  it('clamps into the configured range, ignores non-finite values and normalizes −0', () => {
    expect(clampVesselParam(d, 'innerDiameterM', 9, ch.designLimits).innerDiameterM).toBe(0.5)
    expect(clampVesselParam(d, 'shellLengthM', -1, ch.designLimits).shellLengthM).toBe(0.1)
    expect(clampVesselParam(d, 'headThicknessM', Number.NaN, ch.designLimits)).toBe(d)
    expect(clampVesselParam(d, 'nope', 1, ch.designLimits)).toBe(d)
    const loose = { ...ch.designLimits, shellThicknessM: { minM: -0.001, maxM: 0.012, stepM: 0.0005 } }
    expect(Object.is(clampVesselParam(d, 'shellThicknessM', -0, loose).shellThicknessM, 0)).toBe(true)
  })

  it('collapses a degenerate range to its upper bound', () => {
    const bad = { ...ch.designLimits, innerDiameterM: { minM: 0.6, maxM: 0.5, stepM: 0.01 } }
    expect(vesselPermissibleRange('innerDiameterM', bad)).toEqual({ minM: 0.5, maxM: 0.5 })
    expect(vesselPermissibleRange('materialId', bad)).toBeNull()
  })

  it('strict edits succeed iff the candidate validates; clamp edits always succeed', () => {
    const ok = applyVesselEdit(d, { type: 'setParam', param: 'shellThicknessM', valueM: 0.004, mode: 'strict' }, ch)
    expect(ok.ok && ok.value.shellThicknessM).toBe(0.004)
    expect(ok.ok && ok.value).not.toBe(d)
    const bad = applyVesselEdit(d, { type: 'setParam', param: 'shellThicknessM', valueM: 0.02, mode: 'strict' }, ch)
    expect(!bad.ok && bad.error.map((e) => e.code)).toEqual(['ABOVE_MAX'])
    const clamped = applyVesselEdit(d, { type: 'setParam', param: 'shellThicknessM', valueM: 0.02, mode: 'clamp' }, ch)
    expect(clamped.ok && clamped.value.shellThicknessM).toBe(0.012)
  })

  it('reports an unknown parameter by name', () => {
    const r = applyVesselEdit(d, { type: 'setParam', param: 'materialId', valueM: 1, mode: 'strict' }, ch)
    expect(!r.ok && r.error).toEqual([{ code: 'UNKNOWN_PARAM', param: 'materialId', message: '"materialId" is not an adjustable dimension of the vessel.' }])
  })
})
