import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../bundled'
import { catalog } from '../catalog'
import beamJson from '../challenges/cantilever-beam-1.json'
import frameJson from '../challenges/braced-frame-1.json'
import torsionJson from '../challenges/torsion-shaft-1.json'
import { loadChallenge } from '../loader'
import { loadTorsionChallenge } from '../torsion/loader'
import { BRACED_FRAME_CROSS_FIELD_RULES, bracedFrameCrossFieldIssues, loadBracedFrameChallenge } from './loader'
import { BRACED_FRAME_LOCKED_FIELDS, BRACED_FRAME_MODEL_REF, type BracedFrameChallenge } from './types'

// Braced Frame I config loader (task 49.2; BFR-01–BFR-09, BFR-15, MM-02, MM-06).

type Json = Record<string, unknown>
const clone = (): Json => structuredClone(frameJson) as Json

function load(mutate: (c: Json) => void) {
  const c = clone()
  mutate(c)
  return loadBracedFrameChallenge(c)
}

function issuesOf(mutate: (c: Json) => void) {
  const r = load(mutate)
  if (r.ok) throw new Error('expected the config to be rejected')
  return r.error
}

const rules = (mutate: (c: Json) => void) => issuesOf(mutate).map((i) => `${i.path} ${i.rule}`)
const at = (c: Json, p: string): Json => p.split('.').reduce<Json>((o, k) => o[k] as Json, c)

describe('loadBracedFrameChallenge: bundled-format config', () => {
  const r = loadBracedFrameChallenge(frameJson)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  const ch = r.value

  it('defines the identity and learning settings (BFR-01, BFR-08, BFR-09)', () => {
    expect(ch.id).toBe('braced-frame-1')
    // Version 2 (task 59): the baseline changed, so saves move to a new storage key (MM-04).
    expect(ch.version).toBe(2)
    expect(ch.title).toBe('Braced Frame I')
    expect(ch.model).toEqual(BRACED_FRAME_MODEL_REF)
    expect(ch.model).toEqual({ id: 'pinJointedBracedFrame', version: 1 })
    expect(ch.difficulty).toBe('advanced')
    expect(ch.allowedModes).toEqual(['guided', 'parametric'])
    expect(ch.predictionPolicy.requiredOnIterations).toEqual([1, 3])
    expect(ch.reflectionPrompt.text).toBe(
      'Using your tested designs, explain how the diagonals changed the path the sideways load took to the supports, and why you strengthened some members but not others.',
    )
  })

  it('states the pin-jointed idealization in the challenge statement (BFR-01)', () => {
    expect(ch.statement).toContain(
      'This frame is modeled as pin-jointed: every joint is a hinge, so members carry only tension or compression. Without a diagonal, a storey of this idealized frame cannot resist sideways load. Real frames with welded or bolted joints have some bending resistance that this model ignores.',
    )
  })

  it('defines the fixed values and locked fields (BFR-03)', () => {
    expect(ch.frame).toEqual({ template: 'oneBayTwoStorey', bayWidthM: 4, storeyHeightM: 3 })
    expect(ch.supports).toBe('pinnedBases')
    expect(ch.material).toEqual({ id: 'steel-educational', name: 'Steel (educational nominal)', elasticModulusPa: 200e9, yieldStressPa: 250e6, densityKgM3: 7850 })
    expect(ch.lockedFields).toEqual([...BRACED_FRAME_LOCKED_FIELDS])
  })

  it('defines the four-size CHS catalog and the designs (BFR-04, BFR-05)', () => {
    expect(ch.sections.map((s) => [s.id, s.outerDiameterM, s.wallM])).toEqual([
      ['CHS48.3x3.2', 0.0483, 0.0032],
      ['CHS60.3x4.0', 0.0603, 0.004],
      ['CHS76.1x4.0', 0.0761, 0.004],
      ['CHS88.9x5.0', 0.0889, 0.005],
    ])
    const m = ch.initialDesign.members
    expect([m.diag1a.present, m.diag1b.present, m.diag2a.present, m.diag2b.present]).toEqual([false, true, false, true])
    expect(Object.fromEntries(Object.entries(m).map(([id, x]) => [id, x.sectionId]))).toEqual({
      col1L: 'CHS48.3x3.2', col1R: 'CHS48.3x3.2', col2L: 'CHS88.9x5.0', col2R: 'CHS88.9x5.0', beam1: 'CHS88.9x5.0', beam2: 'CHS88.9x5.0',
      diag1a: 'CHS60.3x4.0', diag1b: 'CHS48.3x3.2', diag2a: 'CHS60.3x4.0', diag2b: 'CHS48.3x3.2',
    })
    const ref = ch.referenceDesign!.members
    expect([ref.diag1a.present, ref.diag1b.present, ref.diag2a.present, ref.diag2b.present]).toEqual([true, false, true, false])
  })

  it('defines the constraints and visualization (BFR-07, BFR-16)', () => {
    expect(ch.constraints).toEqual({ maxRoofDriftM: 0.012, maxUtilization: 1, maxMassKg: 200 })
    expect(ch.constraints.maxRoofDriftM).toBe(6 / 500)
    expect(ch.visualization).toEqual({ displacementExaggeration: 50, maxVisualDisplacementM: 0.6 })
  })

  it('returns a deep-frozen fresh object', () => {
    expect(Object.isFrozen(ch)).toBe(true)
    expect(Object.isFrozen(ch.initialDesign.members.diag1a)).toBe(true)
    expect(Object.isFrozen(ch.sections[0])).toBe(true)
    expect(Object.isFrozen(ch.loads)).toBe(true)
    expect(ch).not.toBe(frameJson)
    expect(Object.isFrozen(frameJson)).toBe(false)
  })

  it('accepts the same config as a JSON string', () => {
    const s = loadBracedFrameChallenge(JSON.stringify(frameJson))
    expect(s.ok && s.value).toEqual(ch)
  })

  it('is bundled and linked from catalog card 005 (owner-approved activation); only the bundled registry imports the raw config (MM-06, BFR-18)', () => {
    expect(Object.keys(BUNDLED_CHALLENGE_JSON)).toContain('braced-frame-1')
    expect(catalog.find((e) => e.id === '005')).toMatchObject({ available: true, challengeId: 'braced-frame-1' })
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const runtime: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const file = path.join(dir, entry)
        if (statSync(file).isDirectory()) walk(file)
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) runtime.push(file)
      }
    }
    walk(src)
    const registry = path.join(src, 'challenge', 'bundled.ts')
    for (const file of runtime) {
      if (file === registry) expect(readFileSync(file, 'utf8')).toContain('braced-frame-1.json')
      else expect(readFileSync(file, 'utf8'), file).not.toContain('braced-frame-1.json')
    }
  })

  it('is not a beam or torsion config, and those are not braced-frame configs (MM-02)', () => {
    expect(loadChallenge(frameJson).ok).toBe(false)
    expect(loadTorsionChallenge(frameJson).ok).toBe(false)
    expect(loadBracedFrameChallenge(beamJson).ok).toBe(false)
    expect(loadBracedFrameChallenge(torsionJson).ok).toBe(false)
  })
})

describe('loadBracedFrameChallenge: structural rejection', () => {
  it('reports invalid JSON text as a single JSON_PARSE issue', () => {
    const r = loadBracedFrameChallenge('{ not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.map((i) => i.rule)).toEqual(['JSON_PARSE'])
  })

  it('reports a non-Error parse failure detail', () => {
    const original = JSON.parse
    JSON.parse = () => {
      throw 'boom'
    }
    try {
      const r = loadBracedFrameChallenge('{}')
      expect(!r.ok && r.error[0]).toMatchObject({ rule: 'JSON_PARSE', message: 'Input is not valid JSON: boom' })
    } finally {
      JSON.parse = original
    }
  })

  it('never throws for hostile input', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('trap') }, ownKeys: () => { throw 'trap' } })
    const r = loadBracedFrameChallenge(hostile)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error[0].rule).toBe('UNEXPECTED')
    const r2 = loadBracedFrameChallenge(new Proxy({}, { ownKeys: () => { throw 'plain' } }))
    expect(!r2.ok && r2.error[0].message).toContain('plain')
  })

  it('requires the exact model identity, never falling back to another model (MM-02)', () => {
    expect(rules((c) => delete c.model)).toContain('model invalid_type')
    expect(rules((c) => (c.model = { id: 'circularShaftTorsion', version: 1 }))).toContain('model.id invalid_literal')
    expect(rules((c) => (c.model = { id: 'pinJointedBracedFrame', version: 2 }))).toContain('model.version invalid_literal')
  })

  it('rejects unknown keys at any level, one issue per key', () => {
    expect(rules((c) => (c.extra = 1))).toEqual(['extra unrecognized_keys'])
    expect(rules((c) => (at(c, 'frame').columns = 3))).toEqual(['frame.columns unrecognized_keys'])
    expect(rules((c) => (at(c, 'initialDesign.members.col1L').present = true))).toEqual(['initialDesign.members.col1L.present unrecognized_keys'])
    expect(rules((c) => (at(c, 'initialDesign.members').diag3a = { present: true, sectionId: 'CHS60.3x4.0' }))).toEqual(['initialDesign.members.diag3a unrecognized_keys'])
  })

  it('rejects other templates, non-positive dimensions and non-finite numbers', () => {
    expect(rules((c) => (at(c, 'frame').template = 'twoBayTwoStorey'))).toContain('frame.template invalid_literal')
    expect(rules((c) => (at(c, 'frame').bayWidthM = 0))).toContain('frame.bayWidthM too_small')
    expect(rules((c) => (at(c, 'frame').storeyHeightM = -3))).toContain('frame.storeyHeightM too_small')
    expect(rules((c) => (at(c, 'sections.0').wallM = 0))).toContain('sections.0.wallM too_small')
    expect(rules((c) => (at(c, 'material').elasticModulusPa = Number.POSITIVE_INFINITY))).toContain('material.elasticModulusPa not_finite')
    expect(rules((c) => (at(c, 'loads.0').fxN = Number.NaN))).toContain('loads.0.fxN invalid_type')
    expect(rules((c) => (c.sections = []))).toContain('sections too_small')
    expect(rules((c) => (c.loads = []))).toContain('loads too_small')
  })

  it('rejects missing members, non-boolean presence and unknown joints structurally', () => {
    expect(rules((c) => delete at(c, 'initialDesign.members').beam2)).toContain('initialDesign.members.beam2 invalid_type')
    expect(rules((c) => (at(c, 'initialDesign.members.diag1a').present = 'yes'))).toContain('initialDesign.members.diag1a.present invalid_type')
    expect(rules((c) => (at(c, 'loads.0').jointId = 'j7'))).toContain('loads.0.jointId invalid_enum_value')
  })
})

describe('loadBracedFrameChallenge: cross-field rules (invalid configs rejected before analysis)', () => {
  const R = BRACED_FRAME_CROSS_FIELD_RULES

  it('rejects a wall of at least half the diameter (t ≥ D/2)', () => {
    expect(rules((c) => (at(c, 'sections.1').wallM = 0.03015))).toEqual([`sections.1.wallM ${R.SECTION_WALL_TOO_THICK}`])
    expect(rules((c) => (at(c, 'sections.1').wallM = 0.04))).toEqual([`sections.1.wallM ${R.SECTION_WALL_TOO_THICK}`])
  })

  it('rejects duplicate section ids', () => {
    expect(rules((c) => (at(c, 'sections.3').id = 'CHS48.3x3.2'))).toEqual(
      expect.arrayContaining([`sections.3.id ${R.SECTION_DUPLICATE_ID}`]),
    )
  })

  it('rejects designs that use an unknown section id', () => {
    expect(rules((c) => (at(c, 'initialDesign.members.col1R').sectionId = 'CHS114.3x6.3'))).toEqual([`initialDesign.members.col1R ${R.DESIGN_INVALID}`])
    expect(rules((c) => (at(c, 'referenceDesign.members.diag2b').sectionId = 'nope'))).toEqual([`referenceDesign.members.diag2b ${R.DESIGN_INVALID}`])
  })

  it('rejects loads on supports, duplicate joints and an all-zero load case', () => {
    expect(rules((c) => (at(c, 'loads.0').jointId = 'j1'))).toEqual([`loads.0.jointId ${R.LOAD_ON_SUPPORT}`])
    expect(rules((c) => (at(c, 'loads.1').jointId = 'j3'))).toEqual([`loads.1.jointId ${R.LOAD_DUPLICATE_JOINT}`])
    expect(rules((c) => (c.loads = [{ jointId: 'j3', fxN: 0, fyN: 0 }]))).toEqual([`loads ${R.LOADS_ALL_ZERO}`])
  })

  it('rejects designs with another material and a missing locked field', () => {
    expect(rules((c) => (at(c, 'initialDesign').materialId = 'aluminium'))).toEqual([`initialDesign.materialId ${R.DESIGN_MATERIAL_MISMATCH}`])
    expect(rules((c) => (c.lockedFields = ['frame', 'supports', 'loads', 'materialId']))).toEqual([`lockedFields ${R.LOCKED_FIELD_MISSING}`])
  })

  it('accepts a config without a reference design', () => {
    expect(load((c) => delete c.referenceDesign).ok).toBe(true)
  })

  it('reports every violation, in rule order', () => {
    const r = loadBracedFrameChallenge(frameJson)
    if (!r.ok) throw new Error('bundled config must load')
    const broken: BracedFrameChallenge = {
      ...r.value,
      sections: [{ id: 'x', label: 'x', outerDiameterM: 0.01, wallM: 0.01 }],
      loads: [{ jointId: 'j2', fxN: 0, fyN: 0 }],
      lockedFields: [],
    }
    expect(bracedFrameCrossFieldIssues(broken).map((i) => i.rule)).toEqual([
      R.SECTION_WALL_TOO_THICK,
      R.LOAD_ON_SUPPORT,
      R.LOADS_ALL_ZERO,
      ...Array<string>(20).fill(R.DESIGN_INVALID),
      ...Array<string>(5).fill(R.LOCKED_FIELD_MISSING),
    ])
  })
})
