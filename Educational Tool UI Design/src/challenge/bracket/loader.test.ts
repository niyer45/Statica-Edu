import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../bundled'
import { catalog } from '../catalog'
import beamJson from '../challenges/cantilever-beam-1.json'
import bracketJson from '../challenges/mounting-bracket-1.json'
import torsionJson from '../challenges/torsion-shaft-1.json'
import { loadChallenge } from '../loader'
import { loadTorsionChallenge } from '../torsion/loader'
import { BRACKET_CROSS_FIELD_RULES, bracketCrossFieldIssues, loadBracketChallenge } from './loader'
import { BRACKET_LOCKED_FIELDS, BRACKET_MODEL_REF, type BracketChallenge } from './types'

// Mounting Bracket I config loader (task 46.2; MBR-01–MBR-10, MBR-13, MM-02, MM-06).

type Json = Record<string, unknown>
const clone = (): Json => structuredClone(bracketJson) as Json

function load(mutate: (c: Json) => void) {
  const c = clone()
  mutate(c)
  return loadBracketChallenge(c)
}

function issuesOf(mutate: (c: Json) => void) {
  const r = load(mutate)
  if (r.ok) throw new Error('expected the config to be rejected')
  return r.error
}

const rules = (mutate: (c: Json) => void) => issuesOf(mutate).map((i) => `${i.path} ${i.rule}`)
const at = (c: Json, path: string): Json => path.split('.').reduce<Json>((o, k) => o[k] as Json, c)

describe('loadBracketChallenge: bundled-format config', () => {
  const r = loadBracketChallenge(bracketJson)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  const ch = r.value

  it('defines the identity and learning settings (MBR-01, MBR-09, MBR-10)', () => {
    expect(ch.id).toBe('mounting-bracket-1')
    expect(ch.version).toBe(1)
    expect(ch.title).toBe('Mounting Bracket I')
    expect(ch.model).toEqual(BRACKET_MODEL_REF)
    expect(ch.model).toEqual({ id: 'steppedBarBracket', version: 1 })
    expect(ch.difficulty).toBe('intermediate')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.reflectionPrompt.text).toBe(
      'Using your tested designs, explain where the peak stress occurred, how the fillet radius and the step location changed it, and why adding material everywhere was not the answer.',
    )
  })

  it('defines the fixed values and locked fields (MBR-04)', () => {
    expect(ch.lengthM).toBe(0.3)
    expect(ch.thicknessM).toBe(0.01)
    expect(ch.support).toBe('wallClamp')
    expect(ch.load).toEqual({ forceN: 300, location: 'freeEnd', direction: 'down' })
    expect(ch.material).toEqual({
      id: 'al-educational',
      name: 'Aluminum (educational nominal)',
      elasticModulusPa: 69e9,
      densityKgM3: 2700,
      allowableStressPa: 120e6,
      yieldStressPa: 240e6,
    })
    expect(ch.lockedFields).toEqual([...BRACKET_LOCKED_FIELDS])
  })

  it('defines the adjustable ranges and designs (MBR-05, MBR-06)', () => {
    expect(ch.designLimits).toEqual({
      rootDepthM: { minM: 0.015, maxM: 0.05, stepM: 0.0005 },
      armDepthM: { minM: 0.01, maxM: 0.05, stepM: 0.0005 },
      stepLocationM: { minM: 0.06, maxM: 0.24, stepM: 0.005 },
      filletRadiusM: { minM: 0.0005, maxM: 0.01, stepM: 0.0005 },
    })
    expect(ch.initialDesign).toEqual({ id: 'baseline', rootDepthM: 0.03, armDepthM: 0.02, stepLocationM: 0.15, filletRadiusM: 0.001, materialId: 'al-educational' })
    expect(ch.referenceDesign).toEqual({ id: 'reference', rootDepthM: 0.03, armDepthM: 0.02, stepLocationM: 0.175, filletRadiusM: 0.003, materialId: 'al-educational' })
  })

  it('defines the constraints in SI units (MBR-08)', () => {
    expect(ch.constraints).toEqual({ maxPeakStressPa: 120e6, maxTipDeflectionM: 0.0024, maxMassKg: 0.215, maxEnvelopeDepthM: 0.04 })
  })

  it('has no Kt coefficients, branch rule or screen thresholds in the configuration (MBR-13)', () => {
    const text = JSON.stringify(bracketJson)
    for (const word of ['kt', 'coefficient', 'threshold', 'branch', 'warning']) expect(text.toLowerCase()).not.toContain(word)
    expect(rules((c) => (c.ktCoefficients = []))).toEqual(['ktCoefficients unrecognized_keys'])
  })

  it('returns a deep-frozen fresh object', () => {
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.initialDesign)).toBe(true)
    expect(Object.isFrozen(ch.designLimits.rootDepthM)).toBe(true)
    expect(Object.isFrozen(ch.lockedFields)).toBe(true)
    expect(ch).not.toBe(bracketJson)
    expect(Object.isFrozen(bracketJson)).toBe(false)
  })

  it('accepts the same config as a JSON string', () => {
    const s = loadBracketChallenge(JSON.stringify(bracketJson))
    expect(s.ok && s.value).toEqual(ch)
  })

  it('stays unlinked: not bundled, not runnable from the catalog, its config never imported by UI code (MM-06, MBR-20)', () => {
    expect(Object.keys(BUNDLED_CHALLENGE_JSON)).not.toContain('mounting-bracket-1')
    expect(catalog.some((e) => e.available && e.challengeId === 'mounting-bracket-1')).toBe(false)
    const bundled = readFileSync(new URL('../bundled.ts', import.meta.url), 'utf8')
    const catalogSource = readFileSync(new URL('../catalog.ts', import.meta.url), 'utf8')
    expect(bundled).not.toContain('mounting-bracket-1.json')
    expect(catalogSource).not.toContain('mounting-bracket-1.json')
    const uiRoot = fileURLToPath(new URL('../../ui', import.meta.url))
    const uiFiles = readdirSync(uiRoot, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f))
    expect(uiFiles.length).toBeGreaterThan(0)
    // Since 46.3 the bracket UI (ui/models/bracket/, registered in ui/models/registry.ts) reads the
    // bracket modules; no other UI file does, and no UI file imports the raw config.
    const bracketUiDir = path.join('models', 'bracket') + path.sep
    expect(uiFiles.some((f) => f.startsWith(bracketUiDir))).toBe(true)
    for (const f of uiFiles) {
      const text = readFileSync(path.join(uiRoot, f), 'utf8')
      expect(text, f).not.toMatch(/mounting-bracket-1\.json/)
      if (!f.startsWith(bracketUiDir)) expect(text, f).not.toMatch(/\/bracket\/|bracketModel/)
    }
  })

  it('is neither a beam nor a torsion config, and neither of those is a bracket config (MM-02)', () => {
    expect(loadChallenge(bracketJson).ok).toBe(false)
    expect(loadTorsionChallenge(bracketJson).ok).toBe(false)
    expect(loadBracketChallenge(beamJson).ok).toBe(false)
    expect(loadBracketChallenge(torsionJson).ok).toBe(false)
  })
})

describe('loadBracketChallenge: structural rejection', () => {
  it('reports invalid JSON text as a single JSON_PARSE issue', () => {
    const r = loadBracketChallenge('{ not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.rule)).toEqual(['JSON_PARSE'])
  })

  it('reports a non-Error parse failure detail', () => {
    const original = JSON.parse
    JSON.parse = () => {
      throw 'boom'
    }
    try {
      const r = loadBracketChallenge('{}')
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
    expect(rules((c) => (c.model = { id: 'steppedBarBracket', version: 2 }))).toEqual(['model.version invalid_literal'])
  })

  it('reports one issue per unknown key at any depth', () => {
    expect(
      rules((c) => {
        c.extra = 1
        at(c, 'material').shearModulusPa = 26e9
        at(c, 'initialDesign').lengthM = 0.3
      }).sort(),
    ).toEqual(['extra unrecognized_keys', 'initialDesign.lengthM unrecognized_keys', 'material.shearModulusPa unrecognized_keys'])
  })

  it('rejects non-positive and non-finite numbers', () => {
    expect(rules((c) => (c.thicknessM = 0))).toEqual(['thicknessM too_small'])
    expect(rules((c) => (at(c, 'load').forceN = -1))).toEqual(['load.forceN too_small'])
    expect(rules((c) => (at(c, 'constraints').maxPeakStressPa = Number.POSITIVE_INFINITY))).toEqual(['constraints.maxPeakStressPa not_finite'])
    expect(rules((c) => (at(c, 'initialDesign').filletRadiusM = 0))).toEqual(['initialDesign.filletRadiusM too_small'])
  })

  it('treats referenceDesign as optional', () => {
    const r = load((c) => delete c.referenceDesign)
    expect(r.ok && r.value.referenceDesign).toBeUndefined()
  })

  it('rejects other supports, load placements and unknown locked fields', () => {
    expect(rules((c) => (c.support = 'fixedRoot'))).toEqual(['support invalid_literal'])
    expect(rules((c) => (at(c, 'load').location = 'midspan'))).toEqual(['load.location invalid_literal'])
    expect(rules((c) => (c.lockedFields = ['lengthM', 'thicknessM', 'materialId', 'forceN', 'support', 'torqueNm']))).toEqual([
      'lockedFields.5 invalid_enum_value',
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
    const r = loadBracketChallenge(hostile)
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
    expect(loadBracketChallenge(proxy).ok).toBe(false)
    for (const v of [null, undefined, 42, [], 'null']) expect(loadBracketChallenge(v).ok).toBe(false)
  })
})

describe('loadBracketChallenge: cross-field rules', () => {
  const R = BRACKET_CROSS_FIELD_RULES

  it('rejects inverted ranges', () => {
    expect(rules((c) => (at(c, 'designLimits.filletRadiusM').minM = 0.02))).toEqual([
      `designLimits.filletRadiusM ${R.RANGE_MIN_GT_MAX}`,
      // Both designs' radii are now below the inverted minimum.
      `initialDesign.filletRadiusM ${R.DESIGN_INVALID}`,
      `referenceDesign.filletRadiusM ${R.DESIGN_INVALID}`,
    ])
  })

  it('requires the step range to leave an arm before the tip', () => {
    expect(rules((c) => (at(c, 'designLimits.stepLocationM').maxM = 0.3))).toEqual([`designLimits.stepLocationM ${R.STEP_BEYOND_LENGTH}`])
    expect(rules((c) => (c.lengthM = 0.2))).toEqual([`designLimits.stepLocationM ${R.STEP_BEYOND_LENGTH}`])
  })

  it('requires designs to match the locked material and the dimension rules', () => {
    expect(rules((c) => (at(c, 'referenceDesign').materialId = 'steel'))).toEqual([`referenceDesign.materialId ${R.DESIGN_MATERIAL_MISMATCH}`])
    expect(rules((c) => (at(c, 'initialDesign').armDepthM = 0.035))).toEqual([`initialDesign.armDepthM ${R.DESIGN_INVALID}`])
    expect(rules((c) => (at(c, 'initialDesign').stepLocationM = 0.25))).toEqual([`initialDesign.stepLocationM ${R.DESIGN_INVALID}`])
  })

  it('accepts a uniform-bar initial design (d = D)', () => {
    expect(load((c) => (at(c, 'initialDesign').armDepthM = 0.03)).ok).toBe(true)
  })

  it('requires every locked field (MBR-04)', () => {
    expect(rules((c) => (c.lockedFields = ['lengthM', 'materialId', 'support']))).toEqual([
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
      `lockedFields ${R.LOCKED_FIELD_MISSING}`,
    ])
  })

  it('reports nothing for the bundled-format config', () => {
    const r = loadBracketChallenge(bracketJson)
    expect(r.ok && bracketCrossFieldIssues(r.value as BracketChallenge)).toEqual([])
  })
})
