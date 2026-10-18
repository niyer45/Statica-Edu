import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../bundled'
import { catalog } from '../catalog'
import beamJson from '../challenges/cantilever-beam-1.json'
import torsionJson from '../challenges/torsion-shaft-1.json'
import { loadChallenge } from '../loader'
import { loadTorsionChallenge, TORSION_CROSS_FIELD_RULES, torsionCrossFieldIssues } from './loader'
import { TORSION_LOCKED_FIELDS, TORSION_MODEL_REF, type TorsionChallenge } from './types'

// Torsion Shaft I config loader (task 47.2; TSH-01–TSH-09, MM-02, MM-06).

type Json = Record<string, unknown>
const clone = (): Json => structuredClone(torsionJson) as Json

function load(mutate: (c: Json) => void) {
  const c = clone()
  mutate(c)
  return loadTorsionChallenge(c)
}

function issuesOf(mutate: (c: Json) => void) {
  const r = load(mutate)
  if (r.ok) throw new Error('expected the config to be rejected')
  return r.error
}

const rules = (mutate: (c: Json) => void) => issuesOf(mutate).map((i) => `${i.path} ${i.rule}`)
const at = (c: Json, path: string): Json => path.split('.').reduce<Json>((o, k) => o[k] as Json, c)

describe('loadTorsionChallenge: bundled-format config', () => {
  const r = loadTorsionChallenge(torsionJson)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  const ch = r.value

  it('defines the identity and learning settings (TSH-01, TSH-08, TSH-09)', () => {
    expect(ch.id).toBe('torsion-shaft-1')
    expect(ch.version).toBe(1)
    expect(ch.title).toBe('Torsion Shaft I')
    expect(ch.model).toEqual(TORSION_MODEL_REF)
    expect(ch.difficulty).toBe('intermediate')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.reflectionPrompt.text).toBe(
      "Using your tested designs, explain how moving material away from the shaft's center changed its twist, shear stress and mass.",
    )
  })

  it('defines the fixed values and locked fields (TSH-03)', () => {
    expect(ch.lengthM).toBe(0.8)
    expect(ch.torqueNm).toBe(400)
    expect(ch.support).toBe('fixedEnd')
    expect(ch.material).toEqual({
      id: 'steel-educational',
      name: 'Steel (educational nominal)',
      shearModulusPa: 79e9,
      densityKgM3: 7850,
      allowableShearStressPa: 80e6,
      yieldShearStressPa: 145e6,
    })
    expect(ch.lockedFields).toEqual([...TORSION_LOCKED_FIELDS])
  })

  it('defines the adjustable ranges, defaults and designs (TSH-04, TSH-05)', () => {
    expect(ch.allowedSections).toEqual(['circle', 'tube'])
    expect(ch.sectionLimits).toEqual({
      circle: { diameterM: { minM: 0.01, maxM: 0.06, stepM: 0.0005 } },
      tube: { outerDiameterM: { minM: 0.015, maxM: 0.06, stepM: 0.0005 }, minWallM: 0.002 },
    })
    expect(ch.sectionDefaults).toEqual({ tubeWallM: 0.004 })
    expect(ch.initialDesign.section).toEqual({ kind: 'circle', diameterM: 0.03 })
    expect(ch.referenceDesign?.section).toEqual({ kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0.044 })
  })

  it('defines the constraints, storing 1° as radians (TSH-07)', () => {
    expect(ch.constraints).toEqual({
      maxTwistRad: 0.017453292519943295,
      maxShearStressPa: 80e6,
      maxMassKg: 4.5,
      maxOuterDiameterM: 0.05,
    })
    expect(ch.constraints.maxTwistRad).toBe(Math.PI / 180)
    expect(ch.visualization).toEqual({ twistExaggerationFactor: 10, maxVisualTwistRad: Math.PI / 2 })
  })

  it('returns a deep-frozen fresh object', () => {
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.initialDesign.section)).toBe(true)
    expect(Object.isFrozen(ch.sectionLimits.tube.outerDiameterM)).toBe(true)
    expect(Object.isFrozen(ch.lockedFields)).toBe(true)
    expect(ch).not.toBe(torsionJson)
    expect(Object.isFrozen(torsionJson)).toBe(false)
  })

  it('accepts the same config as a JSON string', () => {
    const s = loadTorsionChallenge(JSON.stringify(torsionJson))
    expect(s.ok && s.value).toEqual(ch)
  })

  it('is bundled and linked from catalog card 003 since owner-approved activation (task 47.3, TSH-16)', () => {
    expect(Object.keys(BUNDLED_CHALLENGE_JSON)).toContain('torsion-shaft-1')
    expect(catalog.find((e) => e.id === '003')).toMatchObject({ available: true, challengeId: 'torsion-shaft-1' })
  })

  it('is not a beam config, and the beam config is not a torsion config (MM-02)', () => {
    expect(loadChallenge(torsionJson).ok).toBe(false)
    const asTorsion = loadTorsionChallenge(beamJson)
    expect(asTorsion.ok).toBe(false)
  })
})

describe('loadTorsionChallenge: structural rejection', () => {
  it('reports invalid JSON text as a single JSON_PARSE issue', () => {
    const r = loadTorsionChallenge('{ not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.rule)).toEqual(['JSON_PARSE'])
  })

  it('reports a non-Error parse failure detail', () => {
    const original = JSON.parse
    JSON.parse = () => {
      throw 'boom'
    }
    try {
      const r = loadTorsionChallenge('{}')
      expect(!r.ok && r.error[0].message).toContain('boom')
    } finally {
      JSON.parse = original
    }
  })

  it('requires the explicit model identity', () => {
    expect(rules((c) => delete c.model)).toEqual(['model invalid_type'])
  })

  it('rejects another model id or version, never falling back (MM-02)', () => {
    expect(rules((c) => (c.model = { id: 'eulerBernoulliCantileverTipForce', version: 1 }))).toEqual(['model.id invalid_literal'])
    expect(rules((c) => (c.model = { id: 'circularShaftTorsion', version: 2 }))).toEqual(['model.version invalid_literal'])
  })

  it('reports one issue per unknown key at any depth', () => {
    expect(
      rules((c) => {
        c.extra = 1
        at(c, 'material').elasticModulusPa = 200e9
        at(c, 'initialDesign').orientationDeg = 0
      }).sort(),
    ).toEqual(['extra unrecognized_keys', 'initialDesign.orientationDeg unrecognized_keys', 'material.elasticModulusPa unrecognized_keys'])
  })

  it('rejects section kinds outside circle/tube in designs and allowedSections', () => {
    expect(rules((c) => (c.allowedSections = ['circle', 'rectangle']))).toEqual(['allowedSections.1 invalid_enum_value'])
    expect(
      rules((c) => (at(c, 'initialDesign').section = { kind: 'rectangle', widthM: 0.02, heightM: 0.02 })),
    ).toEqual(['initialDesign.section.kind invalid_union_discriminator'])
  })

  it('rejects non-positive and non-finite numbers', () => {
    expect(rules((c) => (c.torqueNm = 0))).toEqual(['torqueNm too_small'])
    expect(rules((c) => (at(c, 'material').shearModulusPa = -1))).toEqual(['material.shearModulusPa too_small'])
    expect(rules((c) => (at(c, 'constraints').maxTwistRad = Number.POSITIVE_INFINITY))).toEqual(['constraints.maxTwistRad not_finite'])
  })

  it('accepts a zero-bore tube design but rejects a negative bore', () => {
    const ok = load((c) => (at(c, 'referenceDesign').section = { kind: 'tube', outerDiameterM: 0.05, innerDiameterM: 0 }))
    expect(ok.ok).toBe(true)
    expect(rules((c) => (at(c, 'referenceDesign.section').innerDiameterM = -0.001))).toEqual([
      'referenceDesign.section.innerDiameterM too_small',
    ])
  })

  it('treats referenceDesign as optional', () => {
    const r = load((c) => delete c.referenceDesign)
    expect(r.ok && r.value.referenceDesign).toBeUndefined()
  })

  it('rejects other supports and unknown locked fields', () => {
    expect(rules((c) => (c.support = 'fixedRoot'))).toEqual(['support invalid_literal'])
    expect(rules((c) => (c.lockedFields = ['lengthM', 'materialId', 'torqueNm', 'support', 'forceN']))).toEqual([
      'lockedFields.4 invalid_enum_value',
    ])
  })

  it('never throws for hostile input', () => {
    const hostile = clone()
    Object.defineProperty(hostile, 'id', {
      enumerable: true,
      get() {
        throw new Error('trap')
      },
    })
    const r = loadTorsionChallenge(hostile)
    expect(!r.ok && r.error.map((i) => i.rule)).toEqual(['UNEXPECTED'])
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw 'trap'
        },
        get() {
          throw 'trap'
        },
      },
    )
    expect(loadTorsionChallenge(proxy).ok).toBe(false)
    for (const v of [null, undefined, 42, [], 'null']) expect(loadTorsionChallenge(v).ok).toBe(false)
  })
})

describe('loadTorsionChallenge: cross-field rules', () => {
  const R = TORSION_CROSS_FIELD_RULES

  it('rejects inverted ranges', () => {
    expect(rules((c) => (at(c, 'sectionLimits.circle.diameterM').minM = 0.07))).toEqual([
      `sectionLimits.circle.diameterM ${R.RANGE_MIN_GT_MAX}`,
      // The baseline (D = 30 mm) is now below the inverted minimum.
      `initialDesign.section.diameterM ${R.DESIGN_INVALID}`,
    ])
    expect(rules((c) => (at(c, 'sectionLimits.tube.outerDiameterM').minM = 0.07))).toEqual([
      `sectionLimits.tube.outerDiameterM ${R.RANGE_MIN_GT_MAX}`,
      // The reference tube (D = 50 mm) is now below the inverted minimum.
      `referenceDesign.section.outerDiameterM ${R.DESIGN_INVALID}`,
    ])
  })

  it('enforces the 2 mm wall floor and a wall below D_min/2 (TSH-04)', () => {
    expect(rules((c) => (at(c, 'sectionLimits.tube').minWallM = 0.0015))).toEqual([`sectionLimits.tube.minWallM ${R.TUBE_WALL_MIN}`])
    expect(
      rules((c) => {
        at(c, 'sectionLimits.tube').minWallM = 0.0075
        at(c, 'sectionDefaults').tubeWallM = 0.008
      }),
    ).toEqual([
      `sectionLimits.tube.minWallM ${R.TUBE_WALL_TOO_THICK}`,
      // The 3 mm reference wall is now below the minimum wall.
      `referenceDesign.section.innerDiameterM ${R.DESIGN_INVALID}`,
    ])
  })

  it('keeps the default tube wall in [minWall, maxD/2)', () => {
    expect(rules((c) => (at(c, 'sectionDefaults').tubeWallM = 0.001))).toEqual([`sectionDefaults.tubeWallM ${R.DEFAULT_OUT_OF_RANGE}`])
    expect(rules((c) => (at(c, 'sectionDefaults').tubeWallM = 0.03))).toEqual([`sectionDefaults.tubeWallM ${R.DEFAULT_OUT_OF_RANGE}`])
    expect(load((c) => (at(c, 'sectionDefaults').tubeWallM = 0.002)).ok).toBe(true)
  })

  it('requires designs to match the locked length and material', () => {
    expect(rules((c) => (at(c, 'initialDesign').lengthM = 0.9))).toEqual([`initialDesign.lengthM ${R.DESIGN_LENGTH_MISMATCH}`])
    expect(rules((c) => (at(c, 'referenceDesign').materialId = 'aluminum'))).toEqual([
      `referenceDesign.materialId ${R.DESIGN_MATERIAL_MISMATCH}`,
    ])
    expect(rules((c) => (c.lengthM = 1))).toEqual([
      `initialDesign.lengthM ${R.DESIGN_LENGTH_MISMATCH}`,
      `referenceDesign.lengthM ${R.DESIGN_LENGTH_MISMATCH}`,
    ])
  })

  it('requires design sections to be allowed and geometrically valid', () => {
    expect(rules((c) => (c.allowedSections = ['circle']))).toEqual([`referenceDesign.section.kind ${R.DESIGN_SECTION_NOT_ALLOWED}`])
    expect(rules((c) => (at(c, 'initialDesign.section').diameterM = 0.005))).toEqual([
      `initialDesign.section.diameterM ${R.DESIGN_INVALID}`,
    ])
    expect(rules((c) => (at(c, 'referenceDesign.section').innerDiameterM = 0.047))).toEqual([
      `referenceDesign.section.innerDiameterM ${R.DESIGN_INVALID}`,
    ])
  })

  it('requires every locked field (TSH-03)', () => {
    expect(rules((c) => (c.lockedFields = ['lengthM', 'materialId']))).toEqual([
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
    ])
  })

  it('reports nothing for the bundled-format config', () => {
    const r = loadTorsionChallenge(torsionJson)
    expect(r.ok && torsionCrossFieldIssues(r.value as TorsionChallenge)).toEqual([])
  })
})
