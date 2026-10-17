import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../bundled'
import { catalog } from '../catalog'
import beamJson from '../challenges/cantilever-beam-1.json'
import torsionJson from '../challenges/torsion-shaft-1.json'
import vibrationJson from '../challenges/vibration-isolation-1.json'
import { loadChallenge } from '../loader'
import { loadTorsionChallenge } from '../torsion/loader'
import { loadVibrationChallenge, VIBRATION_CROSS_FIELD_RULES, vibrationCrossFieldIssues } from './loader'
import { VIBRATION_LOCKED_FIELDS, VIBRATION_MODEL_REF, type VibrationChallenge } from './types'

// Vibration Isolation I config loader (task 50.2; VIB-01–VIB-09, VIB-13 config-level rejection,
// MM-02, MM-06).

type Json = Record<string, unknown>
const clone = (): Json => structuredClone(vibrationJson) as Json

function load(mutate: (c: Json) => void) {
  const c = clone()
  mutate(c)
  return loadVibrationChallenge(c)
}

function issuesOf(mutate: (c: Json) => void) {
  const r = load(mutate)
  if (r.ok) throw new Error('expected the config to be rejected')
  return r.error
}

const rules = (mutate: (c: Json) => void) => issuesOf(mutate).map((i) => `${i.path} ${i.rule}`)
const at = (c: Json, path: string): Json => path.split('.').reduce<Json>((o, k) => o[k] as Json, c)

describe('loadVibrationChallenge: bundled-format config', () => {
  const r = loadVibrationChallenge(vibrationJson)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  const ch = r.value

  it('defines the identity and learning settings (VIB-01, VIB-08, VIB-09)', () => {
    expect(ch.id).toBe('vibration-isolation-1')
    expect(ch.version).toBe(1)
    expect(ch.title).toBe('Vibration Isolation I')
    expect(ch.model).toEqual(VIBRATION_MODEL_REF)
    expect(ch.model).toEqual({ id: 'sdofBaseIsolation', version: 1 })
    expect(ch.difficulty).toBe('advanced')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.reflectionPrompt.text).toBe(
      'Using your tested designs, explain how changing the mount stiffness and damping moved the natural frequency and changed the vibration reaching the component, its sag and its resonance peak.',
    )
  })

  it('says the model is steady-state frequency response, not a simulation over time (VIB-02)', () => {
    expect(ch.statement).toContain('steady-state frequency response')
    expect(ch.statement).toContain('does not simulate motion over time')
  })

  it('defines the fixed values and locked fields (VIB-03)', () => {
    expect(ch.component).toEqual({ massKg: 50 })
    expect(ch.excitation).toEqual({ kind: 'baseDisplacement', amplitudeM: 0.0002, operatingBandHz: { minHz: 25, maxHz: 50 }, runUpFromHz: 0 })
    expect(ch.mount).toEqual({ linearStrokeM: 0.02 })
    expect(ch.lockedFields).toEqual([...VIBRATION_LOCKED_FIELDS])
  })

  it('defines the stiffness range, the five materials and the designs (VIB-04, VIB-05)', () => {
    expect(ch.stiffnessLimits).toEqual({ minNPerM: 20000, maxNPerM: 2000000, stepNPerM: 500 })
    expect(ch.materials.map((m) => [m.id, m.name, m.dampingRatio])).toEqual([
      ['steelSpring', 'Steel coil spring', 0.02],
      ['naturalRubber', 'Natural rubber', 0.05],
      ['neoprene', 'Neoprene', 0.1],
      ['butylRubber', 'Butyl rubber', 0.2],
      ['highDampingElastomer', 'Highly damped elastomer', 0.3],
    ])
    expect(ch.initialDesign).toEqual({ id: 'baseline', stiffnessNPerM: 1800000, materialId: 'naturalRubber' })
    expect(ch.referenceDesign).toEqual({ id: 'reference', stiffnessNPerM: 85000, materialId: 'neoprene' })
  })

  it('defines the constraints in SI units and the display settings (VIB-07, VIB-14)', () => {
    expect(ch.constraints).toEqual({
      maxWorstInBandTransmissibility: 0.12,
      maxStaticDeflectionM: 0.008,
      maxPeakTransmissibility: 6,
      maxRelativeDisplacementM: 0.0015,
    })
    expect(ch.visualization).toEqual({ chartMaxHz: 60, chartSamples: 241, maxVisualSagPx: 24 })
  })

  it('returns a deep-frozen fresh object', () => {
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.excitation.operatingBandHz)).toBe(true)
    expect(Object.isFrozen(ch.materials[0])).toBe(true)
    expect(Object.isFrozen(ch.lockedFields)).toBe(true)
    expect(ch).not.toBe(vibrationJson)
    expect(Object.isFrozen(vibrationJson)).toBe(false)
  })

  it('accepts the same config as a JSON string', () => {
    const s = loadVibrationChallenge(JSON.stringify(vibrationJson))
    expect(s.ok && s.value).toEqual(ch)
  })

  it('stays unlinked: not bundled, not runnable from the catalog (MM-06, VIB-16)', () => {
    expect(Object.keys(BUNDLED_CHALLENGE_JSON)).not.toContain('vibration-isolation-1')
    expect(catalog.some((e) => e.available && e.challengeId === 'vibration-isolation-1')).toBe(false)
    expect(catalog.find((e) => e.title === 'Vibration Isolation I')?.available).toBe(false)
  })

  it('is neither a beam nor a torsion config, and neither of those loads as vibration (MM-02)', () => {
    expect(loadChallenge(vibrationJson).ok).toBe(false)
    expect(loadTorsionChallenge(vibrationJson).ok).toBe(false)
    expect(loadVibrationChallenge(beamJson).ok).toBe(false)
    expect(loadVibrationChallenge(torsionJson).ok).toBe(false)
  })
})

describe('loadVibrationChallenge: structural rejection', () => {
  it('reports invalid JSON text as a single JSON_PARSE issue', () => {
    const r = loadVibrationChallenge('{ not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.rule)).toEqual(['JSON_PARSE'])
  })

  it('reports a non-Error parse failure detail', () => {
    const original = JSON.parse
    JSON.parse = () => {
      throw 'boom'
    }
    try {
      const r = loadVibrationChallenge('{}')
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
    expect(rules((c) => (c.model = { id: 'sdofBaseIsolation', version: 2 }))).toEqual(['model.version invalid_literal'])
  })

  it('reports one issue per unknown key at any depth', () => {
    expect(
      rules((c) => {
        c.extra = 1
        at(c, 'component').dampingNsPerM = 400
        at(c, 'initialDesign').massKg = 50
      }).sort(),
    ).toEqual(['component.dampingNsPerM unrecognized_keys', 'extra unrecognized_keys', 'initialDesign.massKg unrecognized_keys'])
  })

  it('rejects ζ ≤ 0 or ζ > 1 but accepts ζ = 1 (VIB-13 config level)', () => {
    expect(rules((c) => ((c.materials as Json[])[0].dampingRatio = 0))).toEqual(['materials.0.dampingRatio too_small'])
    expect(rules((c) => ((c.materials as Json[])[1].dampingRatio = -0.05))).toEqual(['materials.1.dampingRatio too_small'])
    expect(rules((c) => ((c.materials as Json[])[4].dampingRatio = 1.01))).toEqual(['materials.4.dampingRatio too_big'])
    expect(load((c) => ((c.materials as Json[])[4].dampingRatio = 1)).ok).toBe(true)
  })

  it('rejects non-positive Y, m and stroke (VIB-13 config level)', () => {
    expect(rules((c) => (at(c, 'excitation').amplitudeM = 0))).toEqual(['excitation.amplitudeM too_small'])
    expect(rules((c) => (at(c, 'component').massKg = -50))).toEqual(['component.massKg too_small'])
    expect(rules((c) => (at(c, 'mount').linearStrokeM = 0))).toEqual(['mount.linearStrokeM too_small'])
    expect(rules((c) => (at(c, 'excitation.operatingBandHz').minHz = 0))).toEqual(['excitation.operatingBandHz.minHz too_small'])
    expect(rules((c) => (at(c, 'constraints').maxPeakTransmissibility = Number.POSITIVE_INFINITY))).toEqual(['constraints.maxPeakTransmissibility not_finite'])
  })

  it('requires runUpFromHz = 0, base displacement excitation and a non-empty material list', () => {
    expect(rules((c) => (at(c, 'excitation').runUpFromHz = 5))).toEqual(['excitation.runUpFromHz invalid_literal'])
    expect(rules((c) => (at(c, 'excitation').kind = 'force'))).toEqual(['excitation.kind invalid_literal'])
    expect(rules((c) => (c.materials = []))).toEqual(['materials too_small'])
  })

  it('requires an integer chart sample count of at least 2', () => {
    expect(rules((c) => (at(c, 'visualization').chartSamples = 1))).toEqual(['visualization.chartSamples too_small'])
    expect(rules((c) => (at(c, 'visualization').chartSamples = 2.5))).toEqual(['visualization.chartSamples invalid_type'])
  })

  it('treats referenceDesign as optional and rejects unknown locked fields', () => {
    const r = load((c) => delete c.referenceDesign)
    expect(r.ok && r.value.referenceDesign).toBeUndefined()
    expect(rules((c) => (c.lockedFields = [...VIBRATION_LOCKED_FIELDS, 'materialId']))).toEqual(['lockedFields.4 invalid_enum_value'])
  })

  it('never throws for hostile input', () => {
    const hostile = clone()
    Object.defineProperty(hostile, 'id', {
      enumerable: true,
      get() {
        throw new Error('trap')
      },
    })
    const r = loadVibrationChallenge(hostile)
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
    expect(loadVibrationChallenge(proxy).ok).toBe(false)
    for (const v of [null, undefined, 42, [], 'null']) expect(loadVibrationChallenge(v).ok).toBe(false)
  })
})

describe('loadVibrationChallenge: cross-field rules', () => {
  const R = VIBRATION_CROSS_FIELD_RULES

  it('requires minHz < maxHz (VIB-13 config level)', () => {
    expect(rules((c) => (at(c, 'excitation.operatingBandHz').minHz = 50))).toEqual([`excitation.operatingBandHz ${R.BAND_MIN_NOT_BELOW_MAX}`])
    expect(rules((c) => (at(c, 'excitation.operatingBandHz').minHz = 55))).toEqual([`excitation.operatingBandHz ${R.BAND_MIN_NOT_BELOW_MAX}`])
  })

  it('requires minNPerM < maxNPerM', () => {
    expect(rules((c) => (at(c, 'stiffnessLimits').minNPerM = 2000000))).toEqual([
      `stiffnessLimits ${R.STIFFNESS_MIN_NOT_BELOW_MAX}`,
      // The 85 kN/m reference is now below the minimum; the 1800 kN/m baseline too.
      `initialDesign.stiffnessNPerM ${R.DESIGN_INVALID}`,
      `referenceDesign.stiffnessNPerM ${R.DESIGN_INVALID}`,
    ])
  })

  it('requires unique material ids and digit-free names', () => {
    expect(rules((c) => ((c.materials as Json[])[2].id = 'steelSpring'))).toEqual([
      `materials.2.id ${R.DUPLICATE_MATERIAL_ID}`,
      // The reference names neoprene, which no longer exists.
      `referenceDesign.materialId ${R.DESIGN_INVALID}`,
    ])
    expect(rules((c) => ((c.materials as Json[])[0].name = 'Mount 1'))).toEqual([`materials.0.name ${R.MATERIAL_NAME_HAS_DIGIT}`])
    expect(load((c) => ((c.materials as Json[])[0].name = 'Mount A')).ok).toBe(true)
  })

  it('requires the chart to cover the operating band', () => {
    expect(rules((c) => (at(c, 'visualization').chartMaxHz = 45))).toEqual([`visualization.chartMaxHz ${R.CHART_BELOW_BAND}`])
    expect(load((c) => (at(c, 'visualization').chartMaxHz = 50)).ok).toBe(true)
  })

  it('requires designs within the stiffness range with a listed material', () => {
    expect(rules((c) => (at(c, 'initialDesign').stiffnessNPerM = 19500))).toEqual([`initialDesign.stiffnessNPerM ${R.DESIGN_INVALID}`])
    expect(rules((c) => (at(c, 'referenceDesign').stiffnessNPerM = 2000500))).toEqual([`referenceDesign.stiffnessNPerM ${R.DESIGN_INVALID}`])
    expect(rules((c) => (at(c, 'initialDesign').materialId = 'cork'))).toEqual([`initialDesign.materialId ${R.DESIGN_INVALID}`])
  })

  it('requires every locked field (VIB-03)', () => {
    expect(rules((c) => (c.lockedFields = ['massKg', 'amplitudeM']))).toEqual([
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
    ])
  })

  it('reports nothing for the bundled-format config', () => {
    const r = loadVibrationChallenge(vibrationJson)
    expect(r.ok && vibrationCrossFieldIssues(r.value as VibrationChallenge)).toEqual([])
  })
})
