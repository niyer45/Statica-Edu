import { describe, expect, it } from 'vitest'
import { shaft, solid, torsionChallenge, tube } from '../../../test/fixtures/torsion'
import { torsionDesignSchema, torsionSectionSchema, type TorsionDesign, type TorsionSection } from './design'
import { validateTorsionDesign, validateTorsionSection } from './validate'

// Torsion geometry validation (task 47.2; TSH-04, TSH-13 invalid-input rejection, MM-09).

const ch = torsionChallenge()
const limits = ch.sectionLimits
const codes = (s: unknown) => validateTorsionSection(s as TorsionSection, limits).map((e) => `${e.param} ${e.code}`)
const designCodes = (d: unknown) => validateTorsionDesign(d as TorsionDesign, ch).map((e) => `${e.param} ${e.code}`)

describe('validateTorsionSection', () => {
  it('accepts the baseline, reference and range edges', () => {
    for (const s of [solid(0.03), tube(0.05, 0.044), solid(0.01), solid(0.06), tube(0.015, 0), tube(0.06, 0.056), tube(0.015, 0.011)]) {
      expect(validateTorsionSection(s, limits)).toEqual([])
    }
  })

  it('accepts a zero bore, including −0', () => {
    expect(codes(tube(0.03, 0))).toEqual([])
    expect(codes(tube(0.03, -0))).toEqual([])
  })

  it('rejects out-of-range diameters within GEOM_TOL bounds', () => {
    expect(codes(solid(0.0099))).toEqual(['diameterM BELOW_MIN'])
    expect(codes(solid(0.0601))).toEqual(['diameterM ABOVE_MAX'])
    expect(codes(solid(0.01 - 5e-10))).toEqual([])
    expect(codes(tube(0.0149, 0))).toEqual(['outerDiameterM BELOW_MIN'])
    expect(codes(tube(0.0605, 0.05))).toEqual(['outerDiameterM ABOVE_MAX'])
  })

  it('rejects d ≥ D (exact) and walls under 2 mm (TSH-04)', () => {
    expect(codes(tube(0.03, 0.03))).toEqual(['innerDiameterM INNER_NOT_LESS_THAN_OUTER'])
    expect(codes(tube(0.03, 0.031))).toEqual(['innerDiameterM INNER_NOT_LESS_THAN_OUTER'])
    expect(codes(tube(0.03, 0.0261))).toEqual(['innerDiameterM WALL_TOO_THIN'])
    expect(codes(tube(0.03, 0.026))).toEqual([])
  })

  it('still applies coupled rules to out-of-range diameters', () => {
    expect(codes(tube(0.07, 0.068))).toEqual(['outerDiameterM ABOVE_MAX', 'innerDiameterM WALL_TOO_THIN'])
  })

  it('reports exactly one error for non-finite or non-positive values and skips coupled rules', () => {
    expect(codes(solid(Number.NaN))).toEqual(['diameterM NON_FINITE'])
    expect(codes(solid(Number.POSITIVE_INFINITY))).toEqual(['diameterM NON_FINITE'])
    expect(codes(solid(0))).toEqual(['diameterM NON_POSITIVE'])
    expect(codes(solid(-0.03))).toEqual(['diameterM NON_POSITIVE'])
    expect(codes(tube(Number.NaN, 0.02))).toEqual(['outerDiameterM NON_FINITE'])
    expect(codes(tube(0.03, -0.001))).toEqual(['innerDiameterM NON_POSITIVE'])
    expect(codes({ kind: 'tube', outerDiameterM: 0.03 })).toEqual(['innerDiameterM NON_FINITE'])
    expect(codes({ kind: 'circle', diameterM: '0.03' })).toEqual(['diameterM NON_FINITE'])
  })

  it('rejects any kind outside circle/tube and non-object sections', () => {
    expect(codes({ kind: 'rectangle', widthM: 0.02, heightM: 0.02 })).toEqual(['kind SECTION_NOT_ALLOWED'])
    expect(codes({ kind: 'iSection' })).toEqual(['kind SECTION_NOT_ALLOWED'])
    expect(codes({ diameterM: 0.03 })).toEqual(['kind SECTION_NOT_ALLOWED'])
    expect(codes(null)).toEqual(['kind SECTION_NOT_ALLOWED'])
    expect(codes('circle')).toEqual(['kind SECTION_NOT_ALLOWED'])
  })

  it('writes messages in millimetres and names unusual values', () => {
    expect(validateTorsionSection(solid(0.005), limits)[0].message).toBe('Diameter must be at least 10 mm (got 5 mm).')
    expect(validateTorsionSection(tube(0.03, 0.0261), limits)[0].message).toContain('wall 1.95 mm must be at least 2 mm')
    expect(validateTorsionSection(tube(0.03, -0.001), limits)[0].message).toBe('Inner diameter must be zero or greater (got -1 mm).')
    expect(validateTorsionSection(solid(-0), limits)[0].message).toBe('Diameter must be greater than zero (got 0 mm).')
    expect(validateTorsionSection({ kind: 'circle' } as TorsionSection, limits)[0].message).toContain('got missing')
    expect(validateTorsionSection({ kind: 'circle', diameterM: Number.NaN }, limits)[0].message).toContain('got NaN')
    expect(validateTorsionSection({ kind: 'rectangle' } as unknown as TorsionSection, limits)[0].message).toContain(
      'Section type "rectangle" is not available for a shaft',
    )
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(validateTorsionSection({ kind: cyclic } as unknown as TorsionSection, limits)[0].message).toContain('Section type object')
  })

  it('does not mutate its input', () => {
    const s = Object.freeze(tube(0.03, 0.0261))
    expect(() => validateTorsionSection(s, limits)).not.toThrow()
  })
})

describe('validateTorsionDesign', () => {
  it('accepts the configured initial and reference designs', () => {
    expect(validateTorsionDesign(ch.initialDesign, ch)).toEqual([])
    expect(validateTorsionDesign(ch.referenceDesign as TorsionDesign, ch)).toEqual([])
  })

  it('rejects locked-field changes (lengthM, then materialId) with strict equality', () => {
    const d = shaft('x', solid(0.03))
    expect(designCodes({ ...d, lengthM: 0.8000001 })).toEqual(['lengthM LOCKED_FIELD_CHANGED'])
    expect(designCodes({ ...d, lengthM: 1, materialId: 'aluminum' })).toEqual([
      'lengthM LOCKED_FIELD_CHANGED',
      'materialId LOCKED_FIELD_CHANGED',
    ])
    expect(validateTorsionDesign({ ...d, materialId: 'aluminum' }, ch)[0].message).toBe(
      'Material is fixed by the challenge and cannot be changed (expected "steel-educational", got "aluminum").',
    )
    expect(validateTorsionDesign({ ...d, lengthM: 1 }, ch)[0].message).toContain('Shaft length is fixed')
  })

  it('reports SECTION_NOT_ALLOWED alone for a disallowed or unknown kind', () => {
    const circleOnly = { ...ch, allowedSections: ['circle' as const] }
    expect(validateTorsionDesign(shaft('x', tube(0.05, 0.044)), circleOnly).map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED'])
    expect(validateTorsionDesign(shaft('x', tube(0.05, 0.044)), circleOnly)[0].message).toBe(
      'Section type "tube" is not allowed in this challenge (allowed: circle).',
    )
    expect(designCodes({ ...shaft('x', solid(0.03)), section: { kind: 'rectangle', widthM: 1, heightM: 1 } })).toEqual([
      'kind SECTION_NOT_ALLOWED',
    ])
  })

  it('orders section errors before locked-field errors', () => {
    expect(designCodes({ ...shaft('x', tube(0.03, 0.03)), lengthM: 2 })).toEqual([
      'innerDiameterM INNER_NOT_LESS_THAN_OUTER',
      'lengthM LOCKED_FIELD_CHANGED',
    ])
  })

  it('is total over untrusted values', () => {
    for (const v of [null, undefined, 1, 'design', [], {}]) {
      const errs = validateTorsionDesign(v as unknown as TorsionDesign, ch)
      expect(errs.map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED', 'LOCKED_FIELD_CHANGED'])
    }
  })

  it('rejects each TSH-13 invalid-input class before analysis', () => {
    const invalid: [string, unknown][] = [
      ['d ≥ D', shaft('x', tube(0.04, 0.04))],
      ['wall < 2 mm', shaft('x', tube(0.04, 0.0365))],
      ['diameter below range', shaft('x', solid(0.0095))],
      ['outer diameter above range', shaft('x', tube(0.065, 0.05))],
      ['non-finite', shaft('x', solid(Number.NaN))],
      ['kind outside circle/tube', { ...shaft('x', solid(0.03)), section: { kind: 'iSection' } }],
      ['locked length', { ...shaft('x', solid(0.03)), lengthM: 0.5 }],
      ['locked material', { ...shaft('x', solid(0.03)), materialId: 'other' }],
    ]
    for (const [name, d] of invalid) expect(designCodes(d).length, name).toBeGreaterThan(0)
  })
})

describe('torsion design schemas', () => {
  it('parse valid designs and reject unknown keys, orientation and negative bores', () => {
    expect(torsionDesignSchema.safeParse(ch.initialDesign).success).toBe(true)
    expect(torsionSectionSchema.safeParse(tube(0.05, 0)).success).toBe(true)
    expect(torsionSectionSchema.safeParse(tube(0.05, -0.001)).success).toBe(false)
    expect(torsionSectionSchema.safeParse({ kind: 'rectangle', widthM: 1, heightM: 1 }).success).toBe(false)
    expect(torsionDesignSchema.safeParse({ ...ch.initialDesign, orientationDeg: 0 }).success).toBe(false)
  })
})
