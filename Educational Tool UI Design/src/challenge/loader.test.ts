import { describe, expect, it } from 'vitest'
import { deepFreeze } from './deepFreeze'
import { CROSS_FIELD_RULES as R, loadChallenge } from './loader'
import type { SchemaIssue } from './types'

const range = (minM: number, maxM: number, stepM = 0.0005) => ({ minM, maxM, stepM })

// Valid fixture following the design data table (bundled JSON arrives in task 4.2).
const valid = {
  id: 'cantilever-beam-1',
  version: 1,
  title: 'Cantilever Beam I',
  difficulty: 'introductory',
  allowedModes: ['guided', 'parametric'],
  statement: 'Reduce the tip deflection.',
  material: {
    id: 'al-6061-t6',
    name: 'Aluminium 6061-T6',
    elasticModulusPa: 69e9,
    densityKgM3: 2700,
    allowableStressPa: 120e6,
    yieldStressPa: 240e6,
  },
  initialDesign: {
    id: 'baseline',
    section: { kind: 'circle', diameterM: 0.03 },
    orientationDeg: 0,
    lengthM: 0.6,
    materialId: 'al-6061-t6',
  },
  lockedFields: ['lengthM', 'materialId', 'forceN', 'support'],
  support: 'fixedRoot',
  load: { forceN: 300, location: 'freeEnd', direction: 'down' },
  constraints: {
    maxMassKg: 1.2,
    maxDeflectionM: 0.004,
    maxStressPa: 120e6,
    maxWidthM: 0.08,
    maxHeightM: 0.08,
  },
  sectionLimits: {
    circle: { diameterM: range(0.005, 0.1) },
    tube: { outerDiameterM: range(0.01, 0.1), minWallM: 0.002 },
    rectangle: { widthM: range(0.003, 0.1), heightM: range(0.003, 0.1) },
    iSection: {
      widthM: range(0.01, 0.1),
      heightM: range(0.01, 0.1),
      minFlangeThicknessM: 0.003,
      minWebThicknessM: 0.003,
      minClearWebHeightM: 0.003,
    },
  },
  sectionDefaults: { tubeWallM: 0.004, iSectionFlangeThicknessM: 0.004, iSectionWebThicknessM: 0.004 },
  allowedSections: ['circle', 'tube', 'rectangle', 'iSection'],
  predictionPolicy: { requiredOnIterations: [1, 3] },
  reflectionPrompt: { id: 'r1', text: 'Why did your change work?' },
  visualization: { exaggerationFactor: 15, maxVisualDeflectionFractionOfL: 0.3 },
  content: { conceptNotes: { inertia: 'Second moment of area.' }, collegeDetails: false },
}

const clone = (): Record<string, any> => structuredClone(valid)

function issuesOf(input: unknown): SchemaIssue[] {
  const r = loadChallenge(input)
  expect(r.ok).toBe(false)
  return r.ok ? [] : r.error
}

const pairs = (issues: SchemaIssue[]) => issues.map((i) => `${i.path}|${i.rule}`).sort()

describe('loadChallenge: valid input', () => {
  it('accepts an object and returns equal values', () => {
    const r = loadChallenge(clone())
    expect(r).toEqual({ ok: true, value: valid })
  })

  it('accepts a JSON string', () => {
    const r = loadChallenge(JSON.stringify(valid))
    expect(r.ok && r.value).toEqual(valid)
  })

  it('does not freeze or alias the caller input', () => {
    const input = clone()
    const r = loadChallenge(input)
    expect(Object.isFrozen(input)).toBe(false)
    expect(r.ok && r.value !== input && r.value.material !== input.material).toBe(true)
  })
})

describe('loadChallenge: parse and schema failures', () => {
  it('reports unparseable strings without throwing', () => {
    for (const bad of ['{', '', 'not json', '{"id": }']) {
      const issues = issuesOf(bad)
      expect(issues).toHaveLength(1)
      expect(issues[0]).toMatchObject({ path: '', rule: 'JSON_PARSE' })
      expect(issues[0].message.length).toBeGreaterThan(0)
    }
  })

  it('rejects non-object inputs without throwing', () => {
    for (const bad of [null, undefined, 42, [], 'null', '[]']) {
      expect(loadChallenge(bad).ok).toBe(false)
    }
  })

  it('reports each unknown key at every nesting level with its full path', () => {
    const c = clone()
    c.extra = 1
    c.material.foo = 1
    c.material.bar = 2
    c.initialDesign.section.extra = 1
    c.sectionLimits.tube.outerDiameterM.extra = 1
    c.sectionDefaults.extra = 1
    expect(pairs(issuesOf(c))).toEqual([
      'extra|unrecognized_keys',
      'initialDesign.section.extra|unrecognized_keys',
      'material.bar|unrecognized_keys',
      'material.foo|unrecognized_keys',
      'sectionDefaults.extra|unrecognized_keys',
      'sectionLimits.tube.outerDiameterM.extra|unrecognized_keys',
    ])
  })

  it('reports all zod failures, not just the first, with dotted paths', () => {
    const c = clone()
    c.version = 0
    c.material.densityKgM3 = -1
    c.allowedModes = []
    delete c.sectionDefaults
    const paths = issuesOf(c).map((i) => i.path).sort()
    expect(paths).toEqual(['allowedModes', 'material.densityKgM3', 'sectionDefaults', 'version'])
  })

  it('skips cross-field rules while the structure is invalid', () => {
    const c = clone()
    c.version = 0
    c.sectionLimits.tube.minWallM = 0.001 // would be TUBE_WALL_MIN
    expect(issuesOf(c).map((i) => i.rule)).not.toContain(R.TUBE_WALL_MIN)
  })
})

describe('loadChallenge: additional parse and unknown-key coverage (Req 3.2, 3.8, 3.10)', () => {
  it.each([
    ['truncated object', JSON.stringify(valid).slice(0, -1)],
    ['trailing comma', '{"id": "x",}'],
    ['single quotes', "{'id': 'x'}"],
    ['unquoted key', '{id: "x"}'],
    ['NaN literal', '{"version": NaN}'],
    ['comment', '{"id": "x" /* c */}'],
    ['whitespace only', '   \n\t '],
    ['two documents', '{} {}'],
    ['undefined literal', 'undefined'],
  ])('%s → single JSON_PARSE issue and no challenge', (_name, text) => {
    const r = loadChallenge(text)
    expect(r.ok).toBe(false)
    expect('value' in r).toBe(false)
    if (r.ok) return
    expect(r.error).toHaveLength(1)
    expect(r.error[0]).toMatchObject({ path: '', rule: 'JSON_PARSE' })
    expect(r.error[0].message).toMatch(/not valid JSON/)
  })

  it('reports valid-JSON non-object strings as schema issues, not parse issues', () => {
    for (const text of ['42', '"text"', 'true', 'null', '[]']) {
      const issues = issuesOf(text)
      expect(issues.length).toBeGreaterThan(0)
      expect(issues.map((i) => i.rule)).not.toContain('JSON_PARSE')
    }
  })

  it('returns an issue instead of throwing for hostile inputs', () => {
    const hostile = clone()
    Object.defineProperty(hostile, 'title', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    expect(() => loadChallenge(hostile)).not.toThrow()
    expect(issuesOf(hostile).length).toBeGreaterThan(0)
  })

  it('reports unknown keys in every remaining nested object with full paths', () => {
    const c = clone()
    c.referenceDesign = structuredClone(c.initialDesign)
    c.referenceDesign.section.zz = 1
    c.load.zz = 1
    c.constraints.zz = 1
    c.predictionPolicy.zz = 1
    c.reflectionPrompt.zz = 1
    c.visualization.zz = 1
    c.content.zz = 1
    c.sectionLimits.zz = 1
    c.sectionLimits.circle.zz = 1
    c.sectionLimits.iSection.heightM.zz = 1
    c.sectionLimits.rectangle.widthM.zz = 1
    c.initialDesign.zz = 1
    expect(pairs(issuesOf(c))).toEqual(
      [
        'constraints.zz',
        'content.zz',
        'initialDesign.zz',
        'load.zz',
        'predictionPolicy.zz',
        'referenceDesign.section.zz',
        'reflectionPrompt.zz',
        'sectionLimits.circle.zz',
        'sectionLimits.iSection.heightM.zz',
        'sectionLimits.rectangle.widthM.zz',
        'sectionLimits.zz',
        'visualization.zz',
      ]
        .map((p) => `${p}|unrecognized_keys`)
        .sort(),
    )
  })

  it('accepts arbitrary concept-note keys (a record, not a strict object)', () => {
    const c = clone()
    c.content.conceptNotes.anyNewTopic = 'text'
    expect(loadChallenge(c).ok).toBe(true)
  })

  it('reports unknown keys and other schema failures together, one entry each', () => {
    const c = clone()
    c.material.foo = 1
    c.load.forceN = -5
    c.support = 'pinned'
    expect(pairs(issuesOf(c))).toEqual(['load.forceN|too_small', 'material.foo|unrecognized_keys', 'support|invalid_literal'])
  })
})

describe('loadChallenge: section cross-field rules', () => {
  const rangePaths: [string, (c: Record<string, any>) => Record<string, number>][] = [
    ['sectionLimits.circle.diameterM', (c) => c.sectionLimits.circle.diameterM],
    ['sectionLimits.tube.outerDiameterM', (c) => c.sectionLimits.tube.outerDiameterM],
    ['sectionLimits.rectangle.widthM', (c) => c.sectionLimits.rectangle.widthM],
    ['sectionLimits.rectangle.heightM', (c) => c.sectionLimits.rectangle.heightM],
    ['sectionLimits.iSection.widthM', (c) => c.sectionLimits.iSection.widthM],
    ['sectionLimits.iSection.heightM', (c) => c.sectionLimits.iSection.heightM],
  ]

  it.each(rangePaths)('%s with max < min → RANGE_MIN_GT_MAX at that path', (path, get) => {
    const c = clone()
    get(c).maxM = get(c).minM * 0.5
    const issues = issuesOf(c)
    expect(pairs(issues)).toContain(`${path}|${R.RANGE_MIN_GT_MAX}`)
    expect(issues.filter((i) => i.rule === R.RANGE_MIN_GT_MAX)).toHaveLength(1)
  })

  it('I default tf below min → DEFAULT_OUT_OF_RANGE', () => {
    const c = clone()
    c.sectionDefaults.iSectionFlangeThicknessM = 0.0025
    expect(pairs(issuesOf(c))).toEqual([`sectionDefaults.iSectionFlangeThicknessM|${R.DEFAULT_OUT_OF_RANGE}`])
  })

  it('every rule id is stable and distinct', () => {
    const ids = Object.values(R)
    expect(new Set(ids).size).toBe(ids.length)
    for (const [k, v] of Object.entries(R)) expect(v).toBe(k)
  })

  const cases: [string, (c: Record<string, any>) => void, string, string][] = [
    ['range min > max', (c) => (c.sectionLimits.rectangle.widthM = range(0.05, 0.04)),
      'sectionLimits.rectangle.widthM', R.RANGE_MIN_GT_MAX],
    ['tube default wall below min', (c) => (c.sectionDefaults.tubeWallM = 0.0015),
      'sectionDefaults.tubeWallM', R.DEFAULT_OUT_OF_RANGE],
    ['tube default wall ≥ D/2', (c) => (c.sectionDefaults.tubeWallM = 0.05),
      'sectionDefaults.tubeWallM', R.DEFAULT_OUT_OF_RANGE],
    ['I default tf leaves no clear web', (c) => (c.sectionDefaults.iSectionFlangeThicknessM = 0.049),
      'sectionDefaults.iSectionFlangeThicknessM', R.DEFAULT_OUT_OF_RANGE],
    ['I default tw below min', (c) => (c.sectionDefaults.iSectionWebThicknessM = 0.002),
      'sectionDefaults.iSectionWebThicknessM', R.DEFAULT_OUT_OF_RANGE],
    ['I default tw > b', (c) => (c.sectionDefaults.iSectionWebThicknessM = 0.11),
      'sectionDefaults.iSectionWebThicknessM', R.DEFAULT_OUT_OF_RANGE],
    ['I min tf < 0.003', (c) => (c.sectionLimits.iSection.minFlangeThicknessM = 0.0029),
      'sectionLimits.iSection.minFlangeThicknessM', R.I_FLANGE_MIN],
    ['I min tw < 0.003', (c) => (c.sectionLimits.iSection.minWebThicknessM = 0.0029),
      'sectionLimits.iSection.minWebThicknessM', R.I_WEB_MIN],
    ['I min clear web < 0.003', (c) => (c.sectionLimits.iSection.minClearWebHeightM = 0.0029),
      'sectionLimits.iSection.minClearWebHeightM', R.I_CLEAR_WEB_MIN],
    ['I min h < 2tf + clear web', (c) => (c.sectionLimits.iSection.heightM.minM = 0.0085),
      'sectionLimits.iSection.heightM.minM', R.I_FLANGES_OVERLAP],
    ['I min tw > min b', (c) => {
      c.sectionLimits.iSection.widthM.minM = 0.003
      c.sectionLimits.iSection.minWebThicknessM = 0.0035
    }, 'sectionLimits.iSection.minWebThicknessM', R.I_WEB_WIDER_THAN_FLANGE],
    ['tube min wall < 0.002', (c) => (c.sectionLimits.tube.minWallM = 0.0019),
      'sectionLimits.tube.minWallM', R.TUBE_WALL_MIN],
    ['tube min wall ≥ min D / 2', (c) => (c.sectionLimits.tube.outerDiameterM.minM = 0.004),
      'sectionLimits.tube.minWallM', R.TUBE_WALL_TOO_THICK],
  ]

  it.each(cases)('%s → exactly one issue', (_name, mutate, path, rule) => {
    const c = clone()
    mutate(c)
    const issues = issuesOf(c)
    expect(pairs(issues)).toEqual([`${path}|${rule}`])
    expect(issues[0].message.length).toBeGreaterThan(0)
  })

  it('accepts boundary values exactly at the floors', () => {
    const c = clone()
    c.sectionLimits.iSection.heightM.minM = 0.009 // = 2·0.003 + 0.003
    c.sectionLimits.iSection.widthM.minM = 0.003 // = min tw
    c.sectionLimits.rectangle.widthM = range(0.05, 0.05)
    expect(loadChallenge(c).ok).toBe(true)
  })

  it('reports every violated rule at once', () => {
    const c = clone()
    for (const [, mutate] of [cases[0], cases[6], cases[7], cases[11]]) mutate(c)
    c.sectionLimits.circle.diameterM = range(0.2, 0.1)
    c.sectionDefaults.tubeWallM = 0.06
    expect(pairs(issuesOf(c))).toEqual([
      `sectionDefaults.tubeWallM|${R.DEFAULT_OUT_OF_RANGE}`,
      `sectionLimits.circle.diameterM|${R.RANGE_MIN_GT_MAX}`,
      `sectionLimits.iSection.minFlangeThicknessM|${R.I_FLANGE_MIN}`,
      `sectionLimits.iSection.minWebThicknessM|${R.I_WEB_MIN}`,
      `sectionLimits.rectangle.widthM|${R.RANGE_MIN_GT_MAX}`,
      `sectionLimits.tube.minWallM|${R.TUBE_WALL_MIN}`,
    ])
  })
})

describe('loadChallenge: freezing', () => {
  it('deep-freezes the result; assign, add and delete throw in strict mode and change nothing', () => {
    const r = loadChallenge(clone())
    if (!r.ok) throw new Error('expected ok')
    const ch = r.value as Record<string, any>
    const before = structuredClone(ch)

    expect(() => { ch.title = 'x' }).toThrow(TypeError)
    expect(() => { ch.material.densityKgM3 = 1 }).toThrow(TypeError)
    expect(() => { ch.sectionLimits.tube.outerDiameterM.minM = 1 }).toThrow(TypeError)
    expect(() => { ch.initialDesign.section.extra = 1 }).toThrow(TypeError)
    expect(() => { delete ch.content.conceptNotes.inertia }).toThrow(TypeError)
    expect(() => { ch.allowedModes.push('freeform') }).toThrow(TypeError)
    expect(() => { ch.predictionPolicy.requiredOnIterations[0] = 9 }).toThrow(TypeError)

    expect(ch).toEqual(before)
  })
})

describe('deepFreeze', () => {
  it('freezes nested objects/arrays, returns the same reference, and passes primitives through', () => {
    const x = { a: [{ b: 1 }], c: { d: { e: 2 } } }
    expect(deepFreeze(x)).toBe(x)
    expect(Object.isFrozen(x.a[0]) && Object.isFrozen(x.c.d) && Object.isFrozen(x.a)).toBe(true)
    expect(deepFreeze(3)).toBe(3)
    expect(deepFreeze(null)).toBe(null)
  })

  it('walks into already-frozen parents and tolerates cycles', () => {
    const inner = { v: 1 }
    const outer = Object.freeze({ inner })
    deepFreeze(outer)
    expect(Object.isFrozen(inner)).toBe(true)

    const cyc: Record<string, unknown> = {}
    cyc.self = cyc
    expect(() => deepFreeze(cyc)).not.toThrow()
    expect(Object.isFrozen(cyc)).toBe(true)
  })
})
