import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../bundled'
import { catalog } from '../catalog'
import beamJson from '../challenges/cantilever-beam-1.json'
import columnJson from '../challenges/column-buckling-1.json'
import torsionJson from '../challenges/torsion-shaft-1.json'
import { loadChallenge } from '../loader'
import { loadTorsionChallenge } from '../torsion/loader'
import { COLUMN_CROSS_FIELD_RULES, loadColumnChallenge } from './loader'
import { COLUMN_LOCKED_FIELDS, COLUMN_MODEL_REF } from './types'

// Column Buckling I config loader (task 68; CBK-01–CBK-07, MM-02, MM-06).

type Json = Record<string, unknown>
const clone = (): Json => structuredClone(columnJson) as Json

function issuesOf(mutate: (c: Json) => void) {
  const c = clone()
  mutate(c)
  const r = loadColumnChallenge(c)
  if (r.ok) throw new Error('expected the config to be rejected')
  return r.error
}

const rules = (mutate: (c: Json) => void) => issuesOf(mutate).map((i) => `${i.path} ${i.rule}`)
const at = (c: Json, path: string): Json => path.split('.').reduce<Json>((o, k) => o[k] as Json, c)

describe('loadColumnChallenge: bundled config', () => {
  const r = loadColumnChallenge(columnJson)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  const ch = r.value

  it('defines the identity and learning settings (CBK-01, CBK-09, CBK-10)', () => {
    expect(ch.id).toBe('column-buckling-1')
    expect(ch.version).toBe(1)
    expect(ch.title).toBe('Column Buckling I')
    expect(ch.model).toEqual(COLUMN_MODEL_REF)
    expect(ch.model).toEqual({ id: 'eulerColumnBuckling', version: 1 })
    expect(ch.difficulty).toBe('introductory')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.reflectionPrompt.text).toMatch(/buckled even though its axial stress was low/)
    expect(ch.statement).toMatch(/pinned at both ends/)
  })

  it('defines the fixed values and locked fields (CBK-04)', () => {
    expect(ch.lengthM).toBe(2)
    expect(ch.support).toBe('pinnedPinned')
    expect(ch.load).toEqual({ forceN: 10000, direction: 'down', location: 'centroid' })
    expect(ch.material).toEqual({
      id: 'al-educational',
      name: 'Aluminum (educational nominal)',
      elasticModulusPa: 69e9,
      densityKgM3: 2700,
      allowableStressPa: 120e6,
      yieldStressPa: 240e6,
    })
    expect(ch.lockedFields).toEqual([...COLUMN_LOCKED_FIELDS])
    expect(ch.constraints).toEqual({ minBucklingSafetyFactor: 2, maxAxialStressPa: 120e6, maxMassKg: 2.5 })
  })

  it('defines the ranges, default wall and designs (CBK-05, CBK-06)', () => {
    expect(ch.sectionLimits).toEqual({
      solid: { diameterM: { minM: 0.01, maxM: 0.06, stepM: 0.0005 } },
      tube: { outerDiameterM: { minM: 0.015, maxM: 0.08, stepM: 0.0005 }, wallThicknessM: { minM: 0.001, maxM: 0.006, stepM: 0.0005 } },
    })
    expect(ch.sectionDefaults).toEqual({ tubeWallM: 0.003 })
    expect(ch.allowedSections).toEqual(['solid', 'tube'])
    expect(ch.initialDesign).toEqual({ id: 'baseline', section: { kind: 'solid', diameterM: 0.0245 }, lengthM: 2, materialId: 'al-educational' })
    expect(ch.referenceDesign).toEqual({ id: 'reference', section: { kind: 'tube', outerDiameterM: 0.06, wallThicknessM: 0.002 }, lengthM: 2, materialId: 'al-educational' })
  })

  it('is deep-frozen and a fresh object', () => {
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.sectionLimits.tube.wallThicknessM)).toBe(true)
    expect(ch).not.toBe(columnJson)
  })

  it('is bundled and linked from the available catalog card 007 (MM-06, D-58)', () => {
    expect(BUNDLED_CHALLENGE_JSON['column-buckling-1']).toBe(columnJson)
    expect(catalog.find((e) => e.id === '007')).toMatchObject({
      title: 'Column Buckling I',
      discipline: 'Structures',
      difficulty: 'introductory',
      available: true,
      challengeId: 'column-buckling-1',
      art: 'column',
    })
  })

  it('is neither a beam nor a torsion config, and neither of those is a column config (MM-02)', () => {
    expect(loadChallenge(columnJson).ok).toBe(false)
    expect(loadTorsionChallenge(columnJson).ok).toBe(false)
    expect(loadColumnChallenge(beamJson).ok).toBe(false)
    expect(loadColumnChallenge(torsionJson).ok).toBe(false)
  })
})

describe('loadColumnChallenge: rejections', () => {
  const R = COLUMN_CROSS_FIELD_RULES

  it('reports a JSON parse failure as one issue and accepts the same text when valid', () => {
    const bad = loadColumnChallenge('{ not json')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.map((i) => i.rule)).toEqual(['JSON_PARSE'])
    expect(loadColumnChallenge(JSON.stringify(columnJson)).ok).toBe(true)
  })

  it('requires exactly the eulerColumnBuckling v1 model identity', () => {
    expect(rules((c) => (c.model = { id: 'eulerColumnBuckling', version: 2 }))).toEqual(['model.version invalid_literal'])
    expect(rules((c) => (c.model = { id: 'circularShaftTorsion', version: 1 }))).toEqual(['model.id invalid_literal'])
    expect(rules((c) => delete c.model)).toEqual(['model invalid_type'])
  })

  it('reports each unknown key, at any depth', () => {
    expect(rules((c) => {
      c.effectiveLengthFactor = 0.7
      at(c, 'material').poisson = 0.33
    })).toEqual(['material.poisson unrecognized_keys', 'effectiveLengthFactor unrecognized_keys'])
  })

  it('offers only pinned ends and a concentric downward load', () => {
    expect(rules((c) => (c.support = 'fixedFree'))).toEqual(['support invalid_literal'])
    expect(rules((c) => (at(c, 'load').location = 'eccentric'))).toEqual(['load.location invalid_literal'])
  })

  it('applies the cross-field rules with stable ids', () => {
    expect(rules((c) => (at(c, 'sectionLimits.tube.outerDiameterM').minM = 0.1))).toEqual([
      `sectionLimits.tube.outerDiameterM ${R.RANGE_MIN_GT_MAX}`,
      `referenceDesign.section.outerDiameterM ${R.DESIGN_INVALID}`,
    ])
    expect(rules((c) => (at(c, 'sectionLimits.tube.outerDiameterM').minM = 0.012))).toEqual([`sectionLimits.tube ${R.TUBE_BORE_CLOSED}`])
    expect(rules((c) => (at(c, 'sectionDefaults').tubeWallM = 0.008))).toEqual([`sectionDefaults.tubeWallM ${R.DEFAULT_OUT_OF_RANGE}`])
    expect(rules((c) => (at(c, 'initialDesign').lengthM = 3))).toEqual([`initialDesign.lengthM ${R.DESIGN_LENGTH_MISMATCH}`])
    expect(rules((c) => (at(c, 'referenceDesign').materialId = 'steel'))).toEqual([`referenceDesign.materialId ${R.DESIGN_MATERIAL_MISMATCH}`])
    expect(rules((c) => (c.allowedSections = ['tube']))).toEqual([`initialDesign.section.kind ${R.DESIGN_SECTION_NOT_ALLOWED}`])
    expect(rules((c) => (at(c, 'initialDesign.section').diameterM = 0.07))).toEqual([`initialDesign.section.diameterM ${R.DESIGN_INVALID}`])
    expect(rules((c) => (c.lockedFields = ['lengthM', 'materialId', 'forceN']))).toEqual([`lockedFields ${R.LOCKED_FIELD_MISSING}`])
  })

  it('never throws on hostile input', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('boom') } })
    const r = loadColumnChallenge(hostile)
    expect(r.ok).toBe(false)
    expect(loadColumnChallenge(null).ok).toBe(false)
  })
})
