import { describe, expect, it } from 'vitest'
import { column, columnChallenge, solid, tube } from '../../../test/fixtures/column'
import type { ColumnDesign, ColumnSection } from './design'
import { COLUMN_ERROR_CODES, validateColumnDesign, validateColumnSection } from './validate'

// Column geometry validator (task 68; CBK-05, MM-09).

const ch = columnChallenge()
const L = ch.sectionLimits
const codes = (s: unknown) => validateColumnSection(s as ColumnSection, L).map((e) => `${e.param} ${e.code}`)

describe('validateColumnSection', () => {
  it('accepts in-range solid bars and tubes, including the range ends', () => {
    for (const s of [solid(0.01), solid(0.06), tube(0.015, 0.006), tube(0.08, 0.001), tube(0.06, 0.002)]) expect(codes(s)).toEqual([])
  })

  it('reports one error per parameter, in order: NON_FINITE, NON_POSITIVE, BELOW_MIN, ABOVE_MAX', () => {
    expect(codes(solid(Number.NaN))).toEqual(['diameterM NON_FINITE'])
    expect(codes({ kind: 'solid' })).toEqual(['diameterM NON_FINITE'])
    expect(codes(solid(0))).toEqual(['diameterM NON_POSITIVE'])
    expect(codes(solid(-0.01))).toEqual(['diameterM NON_POSITIVE'])
    expect(codes(solid(0.0099))).toEqual(['diameterM BELOW_MIN'])
    expect(codes(solid(0.0601))).toEqual(['diameterM ABOVE_MAX'])
    expect(codes(tube(0.09, 0.0005))).toEqual(['outerDiameterM ABOVE_MAX', 'wallThicknessM BELOW_MIN'])
    expect(codes(tube(Infinity, 0.007))).toEqual(['outerDiameterM NON_FINITE', 'wallThicknessM ABOVE_MAX'])
  })

  it('accepts values within GEOM_TOL of a range end', () => {
    expect(codes(solid(0.01 - 5e-10))).toEqual([])
    expect(codes(tube(0.08 + 5e-10, 0.006))).toEqual([])
  })

  it('rejects unknown or missing section kinds as SECTION_NOT_ALLOWED', () => {
    expect(codes({ kind: 'iSection', widthM: 0.05 })).toEqual(['kind SECTION_NOT_ALLOWED'])
    expect(codes({ kind: 'circle', diameterM: 0.03 })).toEqual(['kind SECTION_NOT_ALLOWED'])
    expect(codes(null)).toEqual(['kind SECTION_NOT_ALLOWED'])
  })
})

describe('validateColumnDesign', () => {
  it('accepts the bundled baseline and reference', () => {
    expect(validateColumnDesign(ch.initialDesign, ch)).toEqual([])
    expect(validateColumnDesign(ch.referenceDesign!, ch)).toEqual([])
  })

  it('rejects a disallowed kind alone, then locked-field changes (length, then material)', () => {
    const onlyTube = { ...ch, allowedSections: ['tube' as const] }
    expect(validateColumnDesign(column('s', solid(0.03)), onlyTube).map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED'])
    const changed: ColumnDesign = { ...column('x', solid(0.001)), lengthM: 1, materialId: 'steel' }
    expect(validateColumnDesign(changed, ch).map((e) => `${e.param} ${e.code}`)).toEqual([
      'diameterM BELOW_MIN',
      'lengthM LOCKED_FIELD_CHANGED',
      'materialId LOCKED_FIELD_CHANGED',
    ])
  })

  it('is total over untrusted input and never mutates it', () => {
    expect(validateColumnDesign(null as unknown as ColumnDesign, ch).map((e) => e.code)).toEqual(['SECTION_NOT_ALLOWED', 'LOCKED_FIELD_CHANGED', 'LOCKED_FIELD_CHANGED'])
    const d = Object.freeze(column('f', Object.freeze(tube(0.05, 0.002))))
    expect(validateColumnDesign(d, ch)).toEqual([])
  })

  it('every produced code is in the persistence table', () => {
    const produced = new Set<string>()
    for (const s of [solid(Number.NaN), solid(0), solid(0.001), solid(1), { kind: 'x' }]) for (const e of codes(s)) produced.add(e.split(' ')[1]!)
    produced.add('LOCKED_FIELD_CHANGED')
    for (const c of produced) expect(COLUMN_ERROR_CODES).toContain(c)
  })
})
