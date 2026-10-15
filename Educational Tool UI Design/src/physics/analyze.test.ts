import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge } from '../challenge/types'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import { MODEL_ID, PhysicsInvariantError, analyze } from './analyze'
import { ASSUMPTIONS, UNSUPPORTED_EFFECTS } from './constants'
import type { Analysis } from './types'

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value
const L = ch.initialDesign.lengthM

const design = (section: Section, orientationDeg: Orientation = 0): BeamDesign => ({
  id: 'd',
  section,
  orientationDeg,
  lengthM: L,
  materialId: ch.material.id,
})

const mm = (x: number) => x / 1000
const iSection = (h: number, b: number, tf: number, tw: number): Section => ({
  kind: 'iSection',
  heightM: mm(h),
  widthM: mm(b),
  flangeThicknessM: mm(tf),
  webThicknessM: mm(tw),
})
const rect = (b: number, h: number): Section => ({ kind: 'rectangle', widthM: mm(b), heightM: mm(h) })

/**
 * Table value check. The design table prints 3–4 significant figures, so the allowed
 * error is relative 1e-3 or half a unit in the last printed digit, whichever is larger.
 * `printed` is the value as written in the table (string keeps its precision).
 */
function expectTable(actual: number, printed: string, scale = 1) {
  const expected = Number(printed)
  const digits = printed.replace(/e.*$/i, '').split('.')[1]?.length ?? 0
  const exp = /e(-?\d+)/i.exec(printed)
  const halfUnit = 0.5 * 10 ** (-digits + (exp ? Number(exp[1]) : 0))
  const tol = Math.max(1e-3 * Math.abs(expected), halfUnit)
  expect(Math.abs(actual * scale - expected)).toBeLessThanOrEqual(tol)
}

interface Row {
  name: string
  d: BeamDesign
  A?: string
  m?: string
  I?: string
  deflMm?: string
  sigmaMPa?: string
  warnings: string[]
  notApplicable: string[]
}

const rows: Row[] = [
  {
    name: 'baseline',
    d: design({ kind: 'circle', diameterM: mm(30) }),
    A: '7.069e-4', m: '1.145', I: '3.976e-8', deflMm: '7.87', sigmaMPa: '67.9',
    warnings: [], notApplicable: [],
  },
  {
    name: 'reference',
    d: design(iSection(60, 40, 4, 3)),
    A: '4.760e-4', m: '0.771', I: '2.865e-7', deflMm: '1.09', sigmaMPa: '18.9',
    warnings: [], notApplicable: [],
  },
  {
    name: 'tubeSameMass',
    d: design({ kind: 'tube', outerDiameterM: mm(50), innerDiameterM: mm(40) }),
    A: '7.069e-4', m: '1.145', I: '1.811e-7', deflMm: '1.73', sigmaMPa: '24.8',
    warnings: [], notApplicable: [],
  },
  {
    name: 'rectTall',
    d: design(rect(15, 45), 0),
    A: '6.750e-4', m: '1.094', I: '1.139e-7', deflMm: '2.75', sigmaMPa: '35.6',
    warnings: [], notApplicable: [],
  },
  {
    name: 'rectFlat',
    d: design(rect(15, 45), 90),
    A: '6.750e-4', m: '1.094', I: '1.266e-8', deflMm: '24.7', sigmaMPa: '106.7',
    warnings: ['LARGE_DEFLECTION'], notApplicable: [],
  },
  {
    name: 'heavySquare',
    d: design(rect(40, 40)),
    A: '1.600e-3', m: '2.592', I: '2.133e-7', deflMm: '1.47', sigmaMPa: '16.9',
    warnings: [], notApplicable: [],
  },
  {
    name: 'wideI',
    d: design(iSection(60, 90, 4, 3)),
    A: '8.760e-4', m: '1.419', I: '6.006e-7', deflMm: '0.52', sigmaMPa: '9.0',
    warnings: ['FLANGE_OUTSTAND'], notApplicable: [],
  },
  {
    name: 'tinyCircle',
    d: design({ kind: 'circle', diameterM: mm(5) }),
    A: '1.963e-5', m: '0.032', I: '3.068e-11',
    warnings: [], notApplicable: ['LARGE_DEFLECTION', 'PLASTICITY'],
  },
]

const codes = (issues: readonly { code: string }[]) => issues.map((i) => i.code)

function isDeepFrozen(x: unknown): boolean {
  if (x === null || typeof x !== 'object') return true
  if (!Object.isFrozen(x)) return false
  return Object.values(x).every(isDeepFrozen)
}

describe('analyze: verified fixtures', () => {
  for (const r of rows) {
    it(`${r.name}`, () => {
      const a = analyze(r.d, ch)
      if (r.A) expectTable(a.areaM2, r.A)
      if (r.m) expectTable(a.massKg, r.m)
      if (r.I) expectTable(a.bendingInertiaM4, r.I)
      if (r.deflMm) expectTable(a.tipDeflectionM, r.deflMm, 1000)
      if (r.sigmaMPa) expectTable(a.nominalMaxStressPa, r.sigmaMPa, 1e-6)
      expect(a.maxMomentNm).toBeCloseTo(ch.load.forceN * L, 9)
      expect(codes(a.warnings)).toEqual(r.warnings)
      expect(codes(a.notApplicableReasons)).toEqual(r.notApplicable)
      expect(a.applicable).toBe(r.notApplicable.length === 0)
    })
  }

  it('tinyCircle: δ ≈ 1.02e4 mm and σ ≈ 1.47e4 MPa', () => {
    const a = analyze(rows[7].d, ch)
    expect(a.tipDeflectionM * 1000 / 1.02e4).toBeCloseTo(1, 2)
    expect(a.nominalMaxStressPa * 1e-6 / 1.47e4).toBeCloseTo(1, 2)
  })

  it('every fixture satisfies the analyze precondition', () => {
    // Every fixture is a valid design for the bundled challenge (the analyze precondition).
    for (const r of rows) expect(validateDesign(r.d, ch)).toEqual([])
  })
})

describe('analyze: metadata, immutability, invariants', () => {
  const baseline = rows[0].d

  it('reports model id, all 9 unsupported effects, and assumptions regardless of applicability', () => {
    for (const r of [rows[0], rows[7]]) {
      const a = analyze(r.d, ch)
      expect(a.modelId).toBe('eulerBernoulliCantileverTipForce')
      expect(a.modelId).toBe(MODEL_ID)
      expect(a.unsupportedEffects).toEqual([
        'torsion',
        'shear deformation',
        'local buckling',
        'lateral-torsional buckling',
        'plasticity',
        'large deflection',
        'root stress concentrations',
        'joint/fastener compliance',
        'self-weight',
      ])
      expect(a.unsupportedEffects).toEqual(UNSUPPORTED_EFFECTS)
      expect(a.assumptions).toEqual(ASSUMPTIONS)
      expect(a.assumptions.length).toBeGreaterThan(0)
    }
  })

  it('applicable stays true with warnings present (wideI)', () => {
    const a = analyze(rows[6].d, ch)
    expect(a.warnings.length).toBeGreaterThan(0)
    expect(a.applicable).toBe(true)
  })

  it('returns a deep-frozen result, including warnings and issues', () => {
    const a = analyze(rows[4].d, ch)
    expect(isDeepFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.warnings[0])).toBe(true)
    expect(isDeepFrozen(analyze(rows[7].d, ch))).toBe(true)
  })

  it('does not mutate a deep-frozen input and is deterministic', () => {
    const d = deepFreeze(structuredClone(baseline))
    const before = structuredClone(d)
    const a1: Analysis = analyze(d, ch)
    const a2 = analyze(structuredClone(baseline), ch)
    expect(d).toEqual(before)
    expect(a1).toEqual(a2)
  })

  it('extreme fibre is half the oriented envelope height', () => {
    expect(analyze(rows[3].d, ch).extremeFiberM).toBeCloseTo(mm(45) / 2, 12)
    expect(analyze(rows[4].d, ch).extremeFiberM).toBeCloseTo(mm(15) / 2, 12)
  })

  it('throws PhysicsInvariantError naming the field when the precondition is bypassed', () => {
    const bad = design({ kind: 'rectangle', widthM: 0.02, heightM: 0 })
    let err: unknown
    try {
      analyze(bad, ch)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(PhysicsInvariantError)
    expect(err).toBeInstanceOf(Error)
    expect((err as PhysicsInvariantError).field).toBe('areaM2')
    expect((err as PhysicsInvariantError).message).toContain('areaM2')
  })

  it('throws for a non-finite field (NaN diameter)', () => {
    expect(() => analyze(design({ kind: 'circle', diameterM: Number.NaN }), ch)).toThrow(
      PhysicsInvariantError,
    )
  })
})
