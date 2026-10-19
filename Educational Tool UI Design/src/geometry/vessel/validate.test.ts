import { describe, expect, it } from 'vitest'
import { vessel, vesselChallenge } from '../../../test/fixtures/vessel'
import { VESSEL_PARAMS } from './design'
import { validateVesselDesign, validateVesselDimensions, VESSEL_ERROR_CODES, VESSEL_PARAM_LABELS } from './validate'

// Pressure vessel geometry validator (task 69; MM-09).

const ch = vesselChallenge()

describe('validateVesselDesign', () => {
  it('accepts the baseline, the reference and the range corners', () => {
    expect(validateVesselDesign(ch.initialDesign, ch)).toEqual([])
    expect(validateVesselDesign(ch.referenceDesign!, ch)).toEqual([])
    expect(validateVesselDesign(vessel('lo', 0.2, 0.1, 0.001, 0.001), ch)).toEqual([])
    expect(validateVesselDesign(vessel('hi', 0.5, 1.2, 0.012, 0.012), ch)).toEqual([])
  })

  it('reports one error per parameter in the fixed order, with mm messages', () => {
    const d = vessel('bad', 0.1, 1.5, Number.NaN, -0.001)
    expect(validateVesselDesign(d, ch).map((e) => [e.code, e.param])).toEqual([
      ['BELOW_MIN', 'innerDiameterM'],
      ['ABOVE_MAX', 'shellLengthM'],
      ['NON_FINITE', 'shellThicknessM'],
      ['NON_POSITIVE', 'headThicknessM'],
    ])
    expect(validateVesselDesign(d, ch)[0]!.message).toBe('Inner diameter must be at least 200 mm (got 100 mm).')
    expect(validateVesselDesign(d, ch)[1]!.message).toBe('Shell length must be at most 1200 mm (got 1500 mm).')
  })

  it('treats a missing or non-number dimension as non-finite and a changed material as locked', () => {
    const d = { ...ch.initialDesign, innerDiameterM: undefined, materialId: 'al' } as unknown as typeof ch.initialDesign
    expect(validateVesselDesign(d, ch).map((e) => e.code)).toEqual(['NON_FINITE', 'LOCKED_FIELD_CHANGED'])
    expect(validateVesselDesign(d, ch)[0]!.message).toMatch(/got missing/)
    expect(validateVesselDesign(d, ch)[1]!.message).toMatch(/^Material is fixed/)
    const weird = { ...ch.initialDesign, shellLengthM: 'long' } as unknown as typeof ch.initialDesign
    expect(validateVesselDesign(weird, ch)[0]!.message).toContain('"long"')
  })

  it('is total over non-object input', () => {
    expect(validateVesselDimensions(null as unknown as typeof ch.initialDesign, ch.designLimits)).toHaveLength(4)
  })

  it('accepts values within the geometry tolerance of a bound', () => {
    expect(validateVesselDesign(vessel('t', 0.5 + 1e-12, 0.5, 0.004, 0.002), ch)).toEqual([])
  })

  it('labels every parameter and lists every code', () => {
    for (const p of VESSEL_PARAMS) expect(VESSEL_PARAM_LABELS[p]).toMatch(/^[A-Z][a-z ]+$/)
    expect(VESSEL_ERROR_CODES).toContain('UNKNOWN_PARAM')
  })
})
