import { describe, expect, it } from 'vitest'
import pressureVesselJson from '../challenges/pressure-vessel-1.json'
import { loadVesselChallenge, VESSEL_CROSS_FIELD_RULES } from './loader'
import { allowableStressPa, VESSEL_LOCKED_FIELDS, VESSEL_MODEL_REF } from './types'

// Pressure Vessel I challenge loader (task 69; PVS-01–PVS-07, MM-02).

const clone = (): Record<string, any> => JSON.parse(JSON.stringify(pressureVesselJson)) // eslint-disable-line @typescript-eslint/no-explicit-any
const rules = (json: unknown) => {
  const r = loadVesselChallenge(json)
  return r.ok ? [] : r.error.map((i) => i.rule)
}

describe('loadVesselChallenge', () => {
  it('loads the bundled config, deep-frozen, with the vessel model identity', () => {
    const r = loadVesselChallenge(pressureVesselJson)
    if (!r.ok) throw new Error(JSON.stringify(r.error))
    expect(r.value.model).toEqual(VESSEL_MODEL_REF)
    expect(r.value.id).toBe('pressure-vessel-1')
    expect(r.value.version).toBe(1)
    expect(r.value.difficulty).toBe('intermediate')
    expect(r.value.allowedModes).toEqual(['guided', 'parametric'])
    expect(Object.isFrozen(r.value)).toBe(true)
    expect(Object.isFrozen(r.value.designLimits.innerDiameterM)).toBe(true)
    expect(r.value).not.toBe(pressureVesselJson)
    expect(allowableStressPa(r.value)).toBe(125e6)
    expect(r.value.lockedFields).toEqual([...VESSEL_LOCKED_FIELDS])
  })

  it('accepts JSON text and reports a parse failure as one issue', () => {
    expect(loadVesselChallenge(JSON.stringify(pressureVesselJson)).ok).toBe(true)
    expect(rules('{')).toEqual(['JSON_PARSE'])
  })

  it('requires exactly the vessel model identity (MM-02), never falling back', () => {
    const missing = clone()
    delete missing.model
    expect(loadVesselChallenge(missing).ok).toBe(false)
    const other = clone()
    other.model = { id: 'boltedLBracket', version: 1 }
    expect(loadVesselChallenge(other).ok).toBe(false)
    const version = clone()
    version.model.version = 2
    expect(loadVesselChallenge(version).ok).toBe(false)
  })

  it('rejects unknown keys at any level, one issue per key', () => {
    const c = clone()
    c.extra = 1
    c.material.allowableStressPa = 125e6
    c.designLimits.innerDiameterM.other = 1
    const r = loadVesselChallenge(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.path).sort()).toEqual(['designLimits.innerDiameterM.other', 'extra', 'material.allowableStressPa'])
  })

  it('rejects a head shape other than hemispherical and non-positive constants', () => {
    const heads = clone()
    heads.heads = 'ellipsoidal'
    expect(loadVesselChallenge(heads).ok).toBe(false)
    const pressure = clone()
    pressure.pressurePa = 0
    expect(loadVesselChallenge(pressure).ok).toBe(false)
  })

  it.each([
    ['a range with min > max', (c: Record<string, any>) => { c.designLimits.shellLengthM.minM = 2 }, VESSEL_CROSS_FIELD_RULES.RANGE_MIN_GT_MAX], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a design factor below one', (c: Record<string, any>) => { c.designFactor = 0.5 }, VESSEL_CROSS_FIELD_RULES.DESIGN_FACTOR_BELOW_ONE], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a design in another material', (c: Record<string, any>) => { c.referenceDesign.materialId = 'al' }, VESSEL_CROSS_FIELD_RULES.DESIGN_MATERIAL_MISMATCH], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['an out-of-range initial design', (c: Record<string, any>) => { c.initialDesign.headThicknessM = 0.02 }, VESSEL_CROSS_FIELD_RULES.DESIGN_INVALID], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['a missing locked field', (c: Record<string, any>) => { c.lockedFields = ['materialId', 'pressurePa', 'heads'] }, VESSEL_CROSS_FIELD_RULES.LOCKED_FIELD_MISSING], // eslint-disable-line @typescript-eslint/no-explicit-any
  ])('reports %s with its rule id', (_name, mutate, rule) => {
    const c = clone()
    mutate(c)
    expect(rules(c)).toContain(rule)
  })

  it('accepts a config without a reference design', () => {
    const c = clone()
    delete c.referenceDesign
    expect(loadVesselChallenge(c).ok).toBe(true)
  })

  it('never throws on hostile input', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('boom') }, ownKeys: () => { throw new Error('boom') } })
    expect(loadVesselChallenge(hostile).ok).toBe(false)
    expect(loadVesselChallenge(null).ok).toBe(false)
    expect(loadVesselChallenge(42).ok).toBe(false)
  })
})
