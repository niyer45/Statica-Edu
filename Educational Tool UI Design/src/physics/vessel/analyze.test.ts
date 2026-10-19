import { describe, expect, it } from 'vitest'
import { vessel, vesselChallenge } from '../../../test/fixtures/vessel'
import { PhysicsInvariantError } from '../analyze'
import { analyzeVessel, VesselInvariantError, VESSEL_MODEL_ID, VESSEL_MODEL_VERSION } from './analyze'
import { VESSEL_ASSUMPTIONS, VESSEL_SOURCE_NOTE, VESSEL_UNSUPPORTED_EFFECTS } from './constants'
import { headMembraneStress, headsMass, hoopStress, internalVolume, longitudinalStress, overallLength, shellMass } from './formulas'

// Pressure vessel analysis (task 69; MM-03, MM-10, PVS-10, PVS-11).

const ch = vesselChallenge()

describe('vessel formulas', () => {
  it('restate the thin-wall results on simple numbers', () => {
    expect(hoopStress(2, 3, 0.5)).toBe(12)
    expect(longitudinalStress(2, 3, 0.5)).toBe(6)
    expect(headMembraneStress(2, 3, 0.5)).toBe(6)
    expect(internalVolume(1, 0)).toBeCloseTo((4 / 3) * Math.PI, 15)
    expect(internalVolume(1, 2)).toBeCloseTo(2 * Math.PI + (4 / 3) * Math.PI, 15)
    expect(overallLength(1, 0.5, 0.01)).toBeCloseTo(2.02, 15)
    expect(shellMass(1, 1, 1, 1)).toBeCloseTo(3 * Math.PI, 15)
    expect(headsMass(1, 1, 1)).toBeCloseTo((4 / 3) * Math.PI * 7, 14)
  })
})

describe('analyzeVessel', () => {
  it('names the model, is deep-frozen and lists the assumptions and unsupported effects', () => {
    const a = analyzeVessel(ch.initialDesign, ch)
    expect(a.modelId).toBe(VESSEL_MODEL_ID)
    expect(a.modelVersion).toBe(VESSEL_MODEL_VERSION)
    expect(Object.isFrozen(a)).toBe(true)
    expect(a.unsupportedEffects).toBe(VESSEL_UNSUPPORTED_EFFECTS)
    expect(a.assumptions).toBe(VESSEL_ASSUMPTIONS)
    expect(a.unsupportedEffects.join(' ')).toMatch(/discontinuity \(bending\) stresses where the heads meet the shell/)
    expect(a.assumptions).toContain(VESSEL_SOURCE_NOTE)
    expect(VESSEL_SOURCE_NOTE).toMatch(/edition and equation numbers pending engineering review/)
    expect(VESSEL_SOURCE_NOTE).not.toMatch(/\d/)
  })

  it('stores the allowable stress and the radius-to-thickness ratios', () => {
    const a = analyzeVessel(ch.referenceDesign!, ch)
    expect(a.allowableStressPa).toBe(125e6)
    expect(a.innerRadiusM).toBe(0.2)
    expect(a.shellRadiusRatio).toBeCloseTo(0.2 / 0.0065, 12)
    expect(a.headRadiusRatio).toBeCloseTo(0.2 / 0.0035, 12)
    expect(a.massKg).toBe(a.shellMassKg + a.headsMassKg)
  })

  it('throws a typed invariant error naming the first non-finite or non-positive field', () => {
    const broken = { ...ch, pressurePa: Number.NaN }
    expect(() => analyzeVessel(ch.initialDesign, broken)).toThrow(VesselInvariantError)
    expect(() => analyzeVessel(ch.initialDesign, broken)).toThrow(/hoopStressPa/)
    try {
      analyzeVessel(vessel('z', 0, 0.5, 0.004, 0.002), ch)
      throw new Error('expected an invariant error')
    } catch (e) {
      expect(e).toBeInstanceOf(PhysicsInvariantError)
      expect((e as VesselInvariantError).field).toBe('innerRadiusM')
      expect((e as Error).name).toBe('VesselInvariantError')
    }
    const noDensity = { ...ch, material: { ...ch.material, densityKgM3: 0 } }
    expect(() => analyzeVessel(ch.initialDesign, noDensity)).toThrow(/shellMassKg/)
  })

  it('is applicable with warnings only when no not-applicable reason exists', () => {
    const warn = analyzeVessel(vessel('w', 0.2, 1.2, 0.006, 0.003), ch)
    expect(warn.applicable).toBe(true)
    expect(warn.warnings.map((w) => w.code)).toEqual(['THIN_WALL_SHELL'])
    const na = analyzeVessel(vessel('n', 0.2, 0.6, 0.012, 0.012), ch)
    expect(na.applicable).toBe(false)
  })
})
