import { describe, expect, it } from 'vitest'
import stressStrainJson from '../challenges/stress-strain-1.json'
import { AXIAL_CROSS_FIELD_RULES as R, loadAxialChallenge, ROD_MIN_SLENDERNESS } from './loader'
import { AXIAL_MODEL_REF, axialMaterial } from './types'

// Stress and Strain I loader (task 72; SSR-01–SSR-11, MM-02).

const raw = () => JSON.parse(JSON.stringify(stressStrainJson)) as Record<string, unknown> & {
  materials: Record<string, unknown>[]
  initialDesign: Record<string, unknown>
  referenceDesign: Record<string, unknown>
  diameterLimits: Record<string, number>
  lockedFields: string[]
}
const rules = (json: unknown) => {
  const r = loadAxialChallenge(json)
  return r.ok ? [] : r.error.map((i) => i.rule)
}

describe('loadAxialChallenge', () => {
  it('loads the bundled config, deep-frozen, with the explicit axialTieRod v1 identity', () => {
    const r = loadAxialChallenge(stressStrainJson)
    if (!r.ok) throw new Error(JSON.stringify(r.error))
    expect(r.value.model).toEqual(AXIAL_MODEL_REF)
    expect(r.value).toMatchObject({ id: 'stress-strain-1', version: 1, title: 'Stress and Strain I', difficulty: 'introductory' })
    expect(Object.isFrozen(r.value)).toBe(true)
    expect(Object.isFrozen(r.value.materials[0])).toBe(true)
    expect(r.value).not.toBe(stressStrainJson)
    expect(axialMaterial(r.value, 'titanium')?.shortName).toBe('Titanium')
    expect(axialMaterial(r.value, 'cork')).toBeUndefined()
  })

  it('accepts the same config as a JSON string, and reports a parse failure as one issue', () => {
    expect(loadAxialChallenge(JSON.stringify(stressStrainJson)).ok).toBe(true)
    expect(rules('{nope')).toEqual(['JSON_PARSE'])
  })

  it('refuses a missing or different model identity instead of falling back', () => {
    const missing = raw()
    delete missing.model
    expect(loadAxialChallenge(missing).ok).toBe(false)
    expect(loadAxialChallenge({ ...raw(), model: { id: 'axialTieRod', version: 2 } }).ok).toBe(false)
    expect(loadAxialChallenge({ ...raw(), model: { id: 'circularShaftTorsion', version: 1 } }).ok).toBe(false)
  })

  it('reports one issue per unknown key at any depth', () => {
    const c = raw()
    c.extra = 1
    c.materials[0]!.colour = 'grey'
    const r = loadAxialChallenge(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.path).sort()).toEqual(['extra', 'materials.0.colour'])
  })

  it('applies every cross-field rule with its own id', () => {
    const range = raw()
    range.diameterLimits = { minM: 0.03, maxM: 0.006, stepM: 0.0005 }
    expect(rules(range)).toContain(R.RANGE_MIN_GT_MAX)

    const dup = raw()
    dup.materials[1]!.id = 'steel'
    expect(rules(dup)).toContain(R.MATERIAL_ID_DUPLICATE)

    const digit = raw()
    digit.materials[1]!.shortName = 'Aluminium 6061'
    expect(rules(digit)).toEqual([R.MATERIAL_SHORT_NAME_HAS_DIGIT])

    const unlisted = raw()
    unlisted.referenceDesign.materialId = 'cork'
    expect(rules(unlisted)).toEqual([R.DESIGN_MATERIAL_NOT_LISTED])

    const outside = raw()
    outside.initialDesign.diameterM = 0.05
    expect(rules(outside)).toEqual([R.DESIGN_INVALID])

    const locked = raw()
    locked.lockedFields = ['lengthM', 'forceN', 'support']
    expect(rules(locked)).toEqual([R.LOCKED_FIELD_MISSING])

    const short = raw()
    short.lengthM = ROD_MIN_SLENDERNESS * 0.03 - 0.01
    expect(rules(short)).toEqual([R.ROD_TOO_SHORT])
    const exact = raw()
    exact.lengthM = ROD_MIN_SLENDERNESS * 0.03
    expect(rules(exact)).toEqual([])
  })

  it('requires a design factor of at least 1 and a non-empty material list', () => {
    expect(loadAxialChallenge({ ...raw(), designFactor: 0.5 }).ok).toBe(false)
    expect(loadAxialChallenge({ ...raw(), materials: [] }).ok).toBe(false)
  })

  it('never throws on hostile input', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('boom') }, ownKeys: () => { throw new Error('boom') } })
    const r = loadAxialChallenge(hostile)
    expect(r.ok).toBe(false)
    expect(loadAxialChallenge(null).ok).toBe(false)
  })
})
