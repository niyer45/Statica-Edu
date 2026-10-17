import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../bundled'
import { catalog } from '../catalog'
import beamJson from '../challenges/cantilever-beam-1.json'
import heatSinkJson from '../challenges/heat-sink-1.json'
import torsionJson from '../challenges/torsion-shaft-1.json'
import { loadChallenge } from '../loader'
import { loadTorsionChallenge } from '../torsion/loader'
import { HEAT_SINK_CROSS_FIELD_RULES, heatSinkCrossFieldIssues, loadHeatSinkChallenge } from './loader'
import { HEAT_SINK_LOCKED_FIELDS, HEAT_SINK_MODEL_REF, type HeatSinkChallenge } from './types'

// Heat Sink I config loader (task 48.2; HSK-01–HSK-09, MM-02, MM-06).

type Json = Record<string, unknown>
const clone = (): Json => structuredClone(heatSinkJson) as Json

function load(mutate: (c: Json) => void) {
  const c = clone()
  mutate(c)
  return loadHeatSinkChallenge(c)
}

function issuesOf(mutate: (c: Json) => void) {
  const r = load(mutate)
  if (r.ok) throw new Error('expected the config to be rejected')
  return r.error
}

const rules = (mutate: (c: Json) => void) => issuesOf(mutate).map((i) => `${i.path} ${i.rule}`)
const at = (c: Json, path: string): Json => path.split('.').reduce<Json>((o, k) => o[k] as Json, c)

describe('loadHeatSinkChallenge: bundled-format config', () => {
  const r = loadHeatSinkChallenge(heatSinkJson)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  const ch = r.value

  it('defines the identity and learning settings (HSK-01, HSK-08, HSK-09)', () => {
    expect(ch.id).toBe('heat-sink-1')
    expect(ch.version).toBe(1)
    expect(ch.title).toBe('Heat Sink I')
    expect(ch.model).toEqual(HEAT_SINK_MODEL_REF)
    expect(ch.model).toEqual({ id: 'plateFinHeatSink', version: 1 })
    expect(ch.difficulty).toBe('intermediate')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.reflectionPrompt.text).toBe(
      'Using your tested designs, explain how changing the number, thickness and height of the fins changed the base temperature, the fin efficiency and the mass.',
    )
  })

  it('states that the convection coefficient is given, not computed (HSK-01)', () => {
    expect(ch.statement).toContain('convection coefficient is a given value')
    expect(ch.statement).toContain('not computed')
    expect(ch.statement).not.toMatch(/\d/)
  })

  it('defines the fixed values and locked fields, temperatures in kelvin (HSK-03)', () => {
    expect(ch.material).toEqual({
      id: 'aluminum-educational',
      name: 'Aluminum (educational nominal)',
      thermalConductivityWPerMK: 200,
      densityKgM3: 2700,
    })
    expect(ch.base).toEqual({ widthM: 0.06, depthM: 0.06, thicknessM: 0.004 })
    expect(ch.heatLoadW).toBe(25)
    expect(ch.ambientTemperatureK).toBe(298.15)
    expect(ch.convection).toEqual({
      coefficientWPerM2K: 25,
      kind: 'specifiedEffective',
      description: 'low-speed fan-assisted airflow, assumed uniform',
    })
    expect(ch.lockedFields).toEqual([...HEAT_SINK_LOCKED_FIELDS])
  })

  it('defines the adjustable ranges and designs (HSK-04, HSK-05)', () => {
    expect(ch.designLimits).toEqual({
      finCount: { min: 2, max: 20, step: 1 },
      finThicknessM: { minM: 0.001, maxM: 0.005, stepM: 0.0005 },
      finHeightM: { minM: 0.005, maxM: 0.045, stepM: 0.001 },
      minGeometricGapM: 0.001,
    })
    expect(ch.initialDesign).toEqual({ id: 'baseline', finCount: 4, finThicknessM: 0.003, finHeightM: 0.015, materialId: 'aluminum-educational' })
    expect(ch.referenceDesign).toEqual({ id: 'reference', finCount: 10, finThicknessM: 0.0015, finHeightM: 0.035, materialId: 'aluminum-educational' })
  })

  it('defines the constraints in SI, 55 °C stored as 328.15 K (HSK-07)', () => {
    expect(ch.constraints).toEqual({ maxBaseTemperatureK: 328.15, maxMassKg: 0.13, maxFinHeightM: 0.035, minFinGapM: 0.004 })
    expect(ch.visualization).toEqual({ profileSamplesXOverH: [0, 0.25, 0.5, 0.75, 1] })
  })

  it('returns a deep-frozen fresh object', () => {
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.initialDesign)).toBe(true)
    expect(Object.isFrozen(ch.designLimits.finThicknessM)).toBe(true)
    expect(Object.isFrozen(ch.visualization.profileSamplesXOverH)).toBe(true)
    expect(ch).not.toBe(heatSinkJson)
    expect(Object.isFrozen(heatSinkJson)).toBe(false)
  })

  it('accepts the same config as a JSON string', () => {
    const s = loadHeatSinkChallenge(JSON.stringify(heatSinkJson))
    expect(s.ok && s.value).toEqual(ch)
  })

  it('stays unlinked: not bundled, not runnable from the catalog (MM-06, HSK-16)', () => {
    expect(Object.keys(BUNDLED_CHALLENGE_JSON)).not.toContain('heat-sink-1')
    expect(catalog.some((e) => e.available && e.challengeId === 'heat-sink-1')).toBe(false)
    expect(catalog.find((e) => e.title === 'Heat Sink I')?.available).toBe(false)
  })

  it('is neither a beam nor a torsion config, and they are not heat sink configs (MM-02)', () => {
    expect(loadChallenge(heatSinkJson).ok).toBe(false)
    expect(loadTorsionChallenge(heatSinkJson).ok).toBe(false)
    expect(loadHeatSinkChallenge(beamJson).ok).toBe(false)
    expect(loadHeatSinkChallenge(torsionJson).ok).toBe(false)
  })
})

describe('loadHeatSinkChallenge: structural rejection', () => {
  it('reports invalid JSON text as a single JSON_PARSE issue', () => {
    const r = loadHeatSinkChallenge('{ not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.rule)).toEqual(['JSON_PARSE'])
  })

  it('reports a non-Error parse failure detail', () => {
    const original = JSON.parse
    JSON.parse = () => {
      throw 'boom'
    }
    try {
      const r = loadHeatSinkChallenge('{}')
      expect(!r.ok && r.error[0].message).toContain('boom')
    } finally {
      JSON.parse = original
    }
  })

  it('requires the explicit model identity', () => {
    expect(rules((c) => delete c.model)).toEqual(['model invalid_type'])
  })

  it('rejects another model id or version, never falling back (MM-02)', () => {
    expect(rules((c) => (c.model = { id: 'circularShaftTorsion', version: 1 }))).toEqual(['model.id invalid_literal'])
    expect(rules((c) => (c.model = { id: 'plateFinHeatSink', version: 2 }))).toEqual(['model.version invalid_literal'])
  })

  it('reports one issue per unknown key at any depth', () => {
    expect(
      rules((c) => {
        c.extra = 1
        at(c, 'material').elasticModulusPa = 69e9
        at(c, 'initialDesign').orientationDeg = 0
      }).sort(),
    ).toEqual(['extra unrecognized_keys', 'initialDesign.orientationDeg unrecognized_keys', 'material.elasticModulusPa unrecognized_keys'])
  })

  it('rejects a computed (non-specified) convection kind and a fin-count step other than 1', () => {
    expect(rules((c) => (at(c, 'convection').kind = 'naturalConvection'))).toEqual(['convection.kind invalid_literal'])
    expect(rules((c) => (at(c, 'designLimits.finCount').step = 2))).toEqual(['designLimits.finCount.step invalid_literal'])
    expect(rules((c) => (at(c, 'designLimits.finCount').min = 2.5))).toEqual(['designLimits.finCount.min invalid_type'])
  })

  it('rejects non-positive and non-finite numbers and out-of-range profile samples', () => {
    expect(rules((c) => (c.heatLoadW = 0))).toEqual(['heatLoadW too_small'])
    expect(rules((c) => (at(c, 'material').thermalConductivityWPerMK = -1))).toEqual(['material.thermalConductivityWPerMK too_small'])
    expect(rules((c) => (at(c, 'constraints').minFinGapM = Number.POSITIVE_INFINITY))).toEqual(['constraints.minFinGapM not_finite'])
    expect(rules((c) => (at(c, 'visualization').profileSamplesXOverH = [0, 1.5]))).toEqual(['visualization.profileSamplesXOverH.1 too_big'])
    expect(rules((c) => (at(c, 'visualization').profileSamplesXOverH = []))).toEqual(['visualization.profileSamplesXOverH too_small'])
  })

  it('treats referenceDesign as optional', () => {
    const r = load((c) => delete c.referenceDesign)
    expect(r.ok && r.value.referenceDesign).toBeUndefined()
  })

  it('rejects unknown locked fields', () => {
    expect(rules((c) => (c.lockedFields = [...HEAT_SINK_LOCKED_FIELDS, 'finCount']))).toEqual(['lockedFields.5 invalid_enum_value'])
  })

  it('never throws for hostile input', () => {
    const hostile = clone()
    Object.defineProperty(hostile, 'id', {
      enumerable: true,
      get() {
        throw new Error('trap')
      },
    })
    const r = loadHeatSinkChallenge(hostile)
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
    expect(loadHeatSinkChallenge(proxy).ok).toBe(false)
    for (const v of [null, undefined, 42, [], 'null']) expect(loadHeatSinkChallenge(v).ok).toBe(false)
  })
})

describe('loadHeatSinkChallenge: cross-field rules', () => {
  const R = HEAT_SINK_CROSS_FIELD_RULES

  it('rejects inverted ranges', () => {
    expect(rules((c) => (at(c, 'designLimits.finCount').min = 21))).toEqual([
      `designLimits.finCount ${R.RANGE_MIN_GT_MAX}`,
      // Both designs are now below the inverted minimum.
      `initialDesign.finCount ${R.DESIGN_INVALID}`,
      `referenceDesign.finCount ${R.DESIGN_INVALID}`,
    ])
    expect(rules((c) => (at(c, 'designLimits.finHeightM').minM = 0.05))).toEqual([
      `designLimits.finHeightM ${R.RANGE_MIN_GT_MAX}`,
      `initialDesign.finHeightM ${R.DESIGN_INVALID}`,
      `referenceDesign.finHeightM ${R.DESIGN_INVALID}`,
    ])
  })

  it('rejects a length range whose maximum is off the step grid', () => {
    expect(rules((c) => (at(c, 'designLimits.finThicknessM').maxM = 0.0052))).toEqual([`designLimits.finThicknessM ${R.RANGE_MAX_OFF_STEP}`])
  })

  it('requires at least two fins (HSK-04)', () => {
    expect(rules((c) => (at(c, 'designLimits.finCount').min = 1))).toEqual([`designLimits.finCount.min ${R.FIN_COUNT_MIN}`])
  })

  it('requires the temperature limit to be above ambient', () => {
    expect(rules((c) => (at(c, 'constraints').maxBaseTemperatureK = 298.15))).toEqual([
      `constraints.maxBaseTemperatureK ${R.TEMPERATURE_LIMIT_NOT_ABOVE_AMBIENT}`,
    ])
  })

  it('requires profile samples to increase strictly from 0 to 1', () => {
    for (const samples of [[0.25, 1], [0, 0.5], [0, 0.5, 0.5, 1], [0, 0.75, 0.5, 1]]) {
      expect(rules((c) => (at(c, 'visualization').profileSamplesXOverH = samples))).toEqual([
        `visualization.profileSamplesXOverH ${R.PROFILE_SAMPLES_INVALID}`,
      ])
    }
    expect(load((c) => (at(c, 'visualization').profileSamplesXOverH = [0, 1])).ok).toBe(true)
  })

  it('requires designs to match the locked material', () => {
    expect(rules((c) => (at(c, 'referenceDesign').materialId = 'copper'))).toEqual([`referenceDesign.materialId ${R.DESIGN_MATERIAL_MISMATCH}`])
  })

  it('requires designs to be geometrically valid, including the gap floor and step grid', () => {
    expect(rules((c) => (at(c, 'initialDesign').finCount = 1))).toEqual([`initialDesign.finCount ${R.DESIGN_INVALID}`])
    expect(rules((c) => (at(c, 'initialDesign').finThicknessM = 0.0032))).toEqual([`initialDesign.finThicknessM ${R.DESIGN_INVALID}`])
    expect(
      rules((c) => {
        at(c, 'referenceDesign').finCount = 20
        at(c, 'referenceDesign').finThicknessM = 0.003
      }),
    ).toEqual([`referenceDesign.finGapM ${R.DESIGN_INVALID}`])
  })

  it('requires every locked field (HSK-03)', () => {
    expect(rules((c) => (c.lockedFields = ['base', 'materialId', 'heatLoadW']))).toEqual([
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
    ])
  })

  it('reports nothing for the bundled-format config', () => {
    const r = loadHeatSinkChallenge(heatSinkJson)
    expect(r.ok && heatSinkCrossFieldIssues(r.value as HeatSinkChallenge)).toEqual([])
  })
})
