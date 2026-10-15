import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge } from '../challenge/types'
import { GEOM_TOL, type BeamDesign, type GeometryError, type Section } from './sections'
import { validateDesign, validateSection } from './validate'

// Unit tests for the geometry validator (task 5.6; Req 4.3, 5.1–5.15, 7.8).
// Grouped by requirement criterion; each describe/it name cites the criterion it covers.

const range = (minM: number, maxM: number, stepM = 0.0005) => ({ minM, maxM, stepM })

// Challenge fixture following the design data table (independent of the bundled JSON).
const ch: Challenge = {
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
  constraints: { maxMassKg: 1.2, maxDeflectionM: 0.004, maxStressPa: 120e6, maxWidthM: 0.08, maxHeightM: 0.08 },
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
const lim = ch.sectionLimits

const reference: Section = { kind: 'iSection', heightM: 0.06, widthM: 0.04, flangeThicknessM: 0.004, webThicknessM: 0.003 }
const baseline: Section = { kind: 'circle', diameterM: 0.03 }
const design = (section: Section, extra: Partial<BeamDesign> = {}): BeamDesign => ({
  id: 'd', section, orientationDeg: 0, lengthM: 0.6, materialId: 'al-6061-t6', ...extra,
})
/** Builds a design from untyped (hostile) field values, as an import or persisted state could. */
const rawDesign = (fields: Record<string, unknown>): BeamDesign => ({ ...design(baseline), ...fields }) as unknown as BeamDesign
const isec = (p: Partial<Extract<Section, { kind: 'iSection' }>>): Section => ({ ...reference, ...p } as Section)
const tube = (D: number, d: number): Section => ({ kind: 'tube', outerDiameterM: D, innerDiameterM: d })
const codes = (errs: GeometryError[]) => errs.map((e) => `${e.code}:${e.param ?? ''}`)

describe('Req 5.1 / 5.12: each of the four section kinds with valid dimensions has no errors', () => {
  it.each<[string, Section]>([
    ['baseline circle Ø30', baseline],
    ['tube D50 d40', tube(0.05, 0.04)],
    ['solid tube d = 0', tube(0.03, 0)],
    ['tube d = −0', tube(0.03, -0)],
    ['rectangle 15×45', { kind: 'rectangle', widthM: 0.015, heightM: 0.045 }],
    ['reference I-section', reference],
  ])('%s', (_, s) => {
    expect(validateSection(s, lim)).toEqual([])
  })

  it('Req 5.12: validateDesign returns [] for valid designs at 0° and 90°', () => {
    expect(validateDesign(design(baseline), ch)).toEqual([])
    expect(validateDesign(design(reference, { orientationDeg: 90 }), ch)).toEqual([])
    expect(validateDesign(design(tube(0.05, 0.04), { orientationDeg: 90 }), ch)).toEqual([])
  })
})

describe('Req 5.2–5.9 / 5.14: one example per error code, with param and a message naming the rule', () => {
  it.each<[string, Section, string, RegExp]>([
    ['5.2 NON_FINITE (NaN)', { kind: 'circle', diameterM: NaN }, 'NON_FINITE:diameterM', /Diameter must be a finite number/],
    ['5.2 NON_FINITE (+Infinity)', { kind: 'rectangle', widthM: Infinity, heightM: 0.02 }, 'NON_FINITE:widthM', /Width must be a finite number/],
    ['5.2 NON_FINITE (−Infinity)', { kind: 'rectangle', widthM: 0.02, heightM: -Infinity }, 'NON_FINITE:heightM', /Height must be a finite number/],
    ['5.3 NON_POSITIVE (0)', { kind: 'rectangle', widthM: 0.02, heightM: 0 }, 'NON_POSITIVE:heightM', /Height must be greater than zero/],
    ['5.3 NON_POSITIVE (−0)', { kind: 'circle', diameterM: -0 }, 'NON_POSITIVE:diameterM', /greater than zero/],
    ['5.3 NON_POSITIVE (negative inner d)', tube(0.03, -0.001), 'NON_POSITIVE:innerDiameterM', /Inner diameter must be zero or greater/],
    ['5.4 BELOW_MIN', { kind: 'circle', diameterM: 0.004 }, 'BELOW_MIN:diameterM', /at least 5 mm/],
    ['5.4 ABOVE_MAX', tube(0.2, 0.1), 'ABOVE_MAX:outerDiameterM', /Outer diameter must be at most 100 mm/],
    ['5.5 INNER_NOT_LESS_THAN_OUTER', tube(0.03, 0.03), 'INNER_NOT_LESS_THAN_OUTER:innerDiameterM', /smaller than the outer diameter/],
    ['5.6 WALL_TOO_THIN', tube(0.03, 0.028), 'WALL_TOO_THIN:innerDiameterM', /wall is too thin.*at least 2 mm/],
    ['5.7 FLANGES_OVERLAP', isec({ flangeThicknessM: 0.029 }), 'FLANGES_OVERLAP:flangeThicknessM', /Flanges overlap/],
    ['5.8 WEB_WIDER_THAN_FLANGE', isec({ webThicknessM: 0.041 }), 'WEB_WIDER_THAN_FLANGE:webThicknessM', /not be wider than the flange width/],
    ['5.9 FLANGE_TOO_THIN', isec({ flangeThicknessM: 0.002 }), 'FLANGE_TOO_THIN:flangeThicknessM', /Flange thickness must be at least 3 mm/],
    ['5.9 WEB_TOO_THIN', isec({ webThicknessM: 0.002 }), 'WEB_TOO_THIN:webThicknessM', /Web thickness must be at least 3 mm/],
  ])('%s', (_, s, expected, message) => {
    const errs = validateSection(s, lim)
    expect(codes(errs)).toEqual([expected])
    expect(errs[0].message).toMatch(message)
  })

  it('Req 5.5 / 5.6: INNER_NOT_LESS_THAN_OUTER suppresses WALL_TOO_THIN (wall rule applies only when d < D)', () => {
    expect(codes(validateSection(tube(0.03, 0.05), lim))).toEqual(['INNER_NOT_LESS_THAN_OUTER:innerDiameterM'])
  })
})

describe('Req 5.4 / 5.6–5.9: GEOM_TOL boundaries', () => {
  const t = 2 * GEOM_TOL
  it('5.4 range bounds: exact and within GEOM_TOL pass, 2·GEOM_TOL outside fails', () => {
    expect(validateSection({ kind: 'circle', diameterM: 0.005 }, lim)).toEqual([])
    expect(validateSection({ kind: 'circle', diameterM: 0.1 }, lim)).toEqual([])
    expect(validateSection({ kind: 'circle', diameterM: 0.005 - GEOM_TOL / 2 }, lim)).toEqual([])
    expect(validateSection({ kind: 'circle', diameterM: 0.1 + GEOM_TOL / 2 }, lim)).toEqual([])
    expect(codes(validateSection({ kind: 'circle', diameterM: 0.005 - t }, lim))).toEqual(['BELOW_MIN:diameterM'])
    expect(codes(validateSection({ kind: 'circle', diameterM: 0.1 + t }, lim))).toEqual(['ABOVE_MAX:diameterM'])
  })

  it('5.6 tube minimum wall', () => {
    expect(validateSection(tube(0.03, 0.026), lim)).toEqual([])
    expect(codes(validateSection(tube(0.03, 0.026 + 2 * t), lim))).toEqual(['WALL_TOO_THIN:innerDiameterM'])
  })

  it('5.7–5.9 I-section clear web, web ≤ flange width, minimum thicknesses', () => {
    expect(validateSection(isec({ flangeThicknessM: 0.0285 }), lim)).toEqual([])
    expect(codes(validateSection(isec({ flangeThicknessM: 0.0285 + t }), lim))).toEqual(['FLANGES_OVERLAP:flangeThicknessM'])
    expect(validateSection(isec({ webThicknessM: 0.04 }), lim)).toEqual([])
    expect(codes(validateSection(isec({ webThicknessM: 0.04 + t }), lim))).toEqual(['WEB_WIDER_THAN_FLANGE:webThicknessM'])
    expect(validateSection(isec({ flangeThicknessM: 0.003, webThicknessM: 0.003 }), lim)).toEqual([])
    expect(codes(validateSection(isec({ flangeThicknessM: 0.003 - t, webThicknessM: 0.003 - t }), lim))).toEqual([
      'FLANGE_TOO_THIN:flangeThicknessM',
      'WEB_TOO_THIN:webThicknessM',
    ])
  })
})

describe('Req 5.2 / 5.3: exclusivity and untrusted input', () => {
  it('a non-finite or non-positive param gets exactly one error and skips coupled rules', () => {
    expect(codes(validateSection(tube(NaN, 0.02), lim))).toEqual(['NON_FINITE:outerDiameterM'])
    expect(codes(validateSection(tube(0.03, Infinity), lim))).toEqual(['NON_FINITE:innerDiameterM'])
    expect(codes(validateSection(isec({ flangeThicknessM: 0 }), lim))).toEqual(['NON_POSITIVE:flangeThicknessM'])
    expect(codes(validateSection(isec({ widthM: -0.04 }), lim))).toEqual(['NON_POSITIVE:widthM'])
    expect(codes(validateSection(isec({ heightM: -Infinity }), lim))).toEqual(['NON_FINITE:heightM'])
  })

  it('each bad param in the same section gets its own single error', () => {
    expect(codes(validateSection(tube(NaN, -0.001), lim))).toEqual(['NON_FINITE:outerDiameterM', 'NON_POSITIVE:innerDiameterM'])
  })

  it('missing, non-number fields and unknown kinds do not throw', () => {
    const missing = { kind: 'rectangle', widthM: 0.02 } as unknown as Section
    expect(codes(validateSection(missing, lim))).toEqual(['NON_FINITE:heightM'])
    const str = { kind: 'circle', diameterM: '0.03' } as unknown as Section
    expect(codes(validateSection(str, lim))).toEqual(['NON_FINITE:diameterM'])
    const hex = { kind: 'hexagon', sideM: 0.01 } as unknown as Section
    expect(codes(validateSection(hex, lim))).toEqual(['SECTION_NOT_ALLOWED:kind'])
    expect(codes(validateSection(null as unknown as Section, lim))).toEqual(['SECTION_NOT_ALLOWED:kind'])
  })
})

describe('Req 5.10: SECTION_NOT_ALLOWED', () => {
  const circleOnly: Challenge = { ...ch, allowedSections: ['circle'] }

  it('is the only section error and suppresses dimension errors on a section with bad dims', () => {
    const errs = validateDesign(design(isec({ widthM: NaN, heightM: 0.5, flangeThicknessM: 0.001, webThicknessM: -1 })), circleOnly)
    expect(codes(errs)).toEqual(['SECTION_NOT_ALLOWED:kind'])
    expect(errs[0].message).toMatch(/"iSection" is not allowed.*allowed: circle/)
  })

  it('does not suppress BAD_ORIENTATION or LOCKED_FIELD_CHANGED', () => {
    const d = design(tube(0.03, 0.05), { orientationDeg: 45 as unknown as 0, materialId: 'steel' })
    expect(codes(validateDesign(d, circleOnly))).toEqual([
      'SECTION_NOT_ALLOWED:kind',
      'BAD_ORIENTATION:orientationDeg',
      'LOCKED_FIELD_CHANGED:materialId',
    ])
  })

  it.each<[string, unknown]>([
    ['unknown kind', { kind: 'hexagon', sideM: 0.01 }],
    ['missing section', undefined],
    ['null section', null],
  ])('also reported for %s', (_, section) => {
    const errs = validateDesign(rawDesign({ section }), ch)
    expect(codes(errs)).toEqual(['SECTION_NOT_ALLOWED:kind'])
    expect(errs[0].message).toMatch(/not recognized/)
  })
})

describe('Req 5.11 / 7.8: BAD_ORIENTATION', () => {
  it.each([45, NaN, 90.0000001, -0.5, '90', '0', undefined, null, Infinity])('rejects %s', (o) => {
    const errs = validateDesign(rawDesign({ orientationDeg: o }), ch)
    expect(codes(errs)).toEqual(['BAD_ORIENTATION:orientationDeg'])
    expect(errs[0].message).toMatch(/exactly 0° or 90°/)
  })

  it('Req 7.8: an imported design with orientation 180 is rejected (validator portion)', () => {
    const imported = JSON.parse(JSON.stringify({ ...design(reference), orientationDeg: 180 })) as BeamDesign
    expect(codes(validateDesign(imported, ch))).toEqual(['BAD_ORIENTATION:orientationDeg'])
  })
})

describe('Req 4.3: LOCKED_FIELD_CHANGED once per differing locked field, strict equality', () => {
  it('lengthM alone, including a 1e-15 difference (no tolerance)', () => {
    const errs = validateDesign(design(baseline, { lengthM: 0.6 + 1e-15 }), ch)
    expect(codes(errs)).toEqual(['LOCKED_FIELD_CHANGED:lengthM'])
    expect(errs[0].message).toMatch(/Beam length is fixed by the challenge/)
  })

  it('materialId alone', () => {
    const errs = validateDesign(design(baseline, { materialId: 'steel' }), ch)
    expect(codes(errs)).toEqual(['LOCKED_FIELD_CHANGED:materialId'])
    expect(errs[0].message).toMatch(/Material is fixed by the challenge/)
  })

  it('both at once, lengthM first', () => {
    expect(codes(validateDesign(design(baseline, { lengthM: 1, materialId: 'steel' }), ch))).toEqual([
      'LOCKED_FIELD_CHANGED:lengthM',
      'LOCKED_FIELD_CHANGED:materialId',
    ])
  })

  it.each<[string, Record<string, unknown>, string]>([
    ['lengthM NaN', { lengthM: NaN }, 'lengthM'],
    ['lengthM as string', { lengthM: '0.6' }, 'lengthM'],
    ['lengthM missing', { lengthM: undefined }, 'lengthM'],
    ['materialId missing', { materialId: undefined }, 'materialId'],
    ['materialId wrong type', { materialId: 1 }, 'materialId'],
  ])('hostile value: %s', (_, fields, param) => {
    expect(codes(validateDesign(rawDesign(fields), ch))).toEqual([`LOCKED_FIELD_CHANGED:${param}`])
  })
})

describe('Req 5.13: multiple violations in one list, stable order', () => {
  it('reports every violation across section, orientation and locked fields', () => {
    const bad = design(isec({ widthM: 0.005, heightM: 0.2, flangeThicknessM: 0.001, webThicknessM: 0.01 }), {
      orientationDeg: 45 as unknown as 0,
      lengthM: 0.7,
      materialId: 'steel',
    })
    const expected = [
      'BELOW_MIN:widthM',
      'ABOVE_MAX:heightM',
      'WEB_WIDER_THAN_FLANGE:webThicknessM',
      'FLANGE_TOO_THIN:flangeThicknessM',
      'BAD_ORIENTATION:orientationDeg',
      'LOCKED_FIELD_CHANGED:lengthM',
      'LOCKED_FIELD_CHANGED:materialId',
    ]
    const first = validateDesign(bad, ch)
    expect(codes(first)).toEqual(expected)
    expect(validateDesign(structuredClone(bad), ch)).toEqual(first)
    expect(validateDesign(bad, ch)).toEqual(first)
  })

  it('an out-of-range (finite, positive) param still feeds coupled rules', () => {
    expect(codes(validateSection(tube(0.2, 0.199), lim))).toEqual(['ABOVE_MAX:outerDiameterM', 'WALL_TOO_THIN:innerDiameterM'])
  })

  it('all four I-section coupled rules in fixed order', () => {
    // tf = 0.001 is too thin; h = 0.004 leaves 0.002 clear web; tw = 0.002 > b and too thin.
    const s = isec({ widthM: 0.0015, heightM: 0.004, flangeThicknessM: 0.001, webThicknessM: 0.002 })
    expect(codes(validateSection(s, lim))).toEqual([
      'BELOW_MIN:widthM',
      'BELOW_MIN:heightM',
      'FLANGES_OVERLAP:flangeThicknessM',
      'WEB_WIDER_THAN_FLANGE:webThicknessM',
      'FLANGE_TOO_THIN:flangeThicknessM',
      'WEB_TOO_THIN:webThicknessM',
    ])
  })
})

describe('Req 5.14: every error has a known code, a param, and a non-empty message', () => {
  const allCodes = new Set([
    'NON_FINITE', 'NON_POSITIVE', 'BELOW_MIN', 'ABOVE_MAX', 'INNER_NOT_LESS_THAN_OUTER', 'WALL_TOO_THIN',
    'FLANGES_OVERLAP', 'WEB_WIDER_THAN_FLANGE', 'FLANGE_TOO_THIN', 'WEB_TOO_THIN', 'SECTION_NOT_ALLOWED',
    'BAD_ORIENTATION', 'LOCKED_FIELD_CHANGED',
  ])
  it.each<[string, BeamDesign]>([
    ['bad I-section', design(isec({ widthM: NaN, heightM: 0.004, flangeThicknessM: 0.001, webThicknessM: 0.002 }), { lengthM: 1 })],
    ['bad tube', design(tube(0.2, 0.3), { orientationDeg: 1 as unknown as 0, materialId: 'x' })],
  ])('%s', (_, d) => {
    const errs = validateDesign(d, ch)
    expect(errs.length).toBeGreaterThan(1)
    for (const e of errs) {
      expect(allCodes.has(e.code)).toBe(true)
      expect(e.param).toBeTruthy()
      expect(e.message.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('Req 5.15: input is left unmodified', () => {
  it('does not mutate or throw on a deep-frozen design and challenge', () => {
    const d = deepFreeze(design(tube(0.03, 0.029), { orientationDeg: 45 as unknown as 0, lengthM: 2 }))
    const frozenCh = deepFreeze(structuredClone(ch))
    const before = structuredClone(d)
    const chBefore = structuredClone(frozenCh)
    expect(() => validateDesign(d, frozenCh)).not.toThrow()
    expect(() => validateSection(d.section, frozenCh.sectionLimits)).not.toThrow()
    expect(d).toEqual(before)
    expect(frozenCh).toEqual(chBefore)
  })

  it('does not mutate an unfrozen design', () => {
    const d = design(isec({ flangeThicknessM: 0.001 }), { materialId: 'steel' })
    const before = structuredClone(d)
    validateDesign(d, ch)
    expect(d).toEqual(before)
  })
})

describe('bundled challenge', () => {
  const bundled = fileURLToPath(new URL('../challenge/challenges/cantilever-beam-1.json', import.meta.url))
  it.runIf(existsSync(bundled))('Req 5.12: initial and reference designs are valid', () => {
    const json = JSON.parse(readFileSync(bundled, 'utf8')) as Challenge
    expect(validateDesign(json.initialDesign, json)).toEqual([])
    if (json.referenceDesign) expect(validateDesign(json.referenceDesign, json)).toEqual([])
  })
})
