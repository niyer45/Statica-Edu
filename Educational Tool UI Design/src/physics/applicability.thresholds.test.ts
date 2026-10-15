import { describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../challenge/content'
import type { Challenge } from '../challenge/types'
import { orientedEnvelope } from '../geometry/envelope'
import type { BeamDesign, Orientation, Section } from '../geometry/sections'
import { analyze, PhysicsInvariantError } from './analyze'
import { checkApplicability } from './applicability'
import { APPLICABILITY_CODES, THRESHOLDS, type ApplicabilityCode } from './constants'
import { REL_TOL } from './tolerance'
import type { ApplicabilityInput, ApplicabilityIssue } from './types'

// Unit tests for applicability thresholds (Req 9.3, 10.3–10.7, 10.9).
//
// checkApplicability does not validate designs, so each case uses a deliberately unphysical
// design whose only triggered metric is the one under test:
// - δ and σ are passed directly (0 unless the case drives LARGE_DEFLECTION / PLASTICITY).
// - lengthM is chosen per case so DEPTH_SPAN stays tiny unless it is the metric under test.
// - Geometry is solved from the target metric value; the test recomputes the metric from the
//   design with the spec formula and asserts it is within ±0.5·REL_TOL·threshold of the target,
//   so the expected classification is unambiguous even where floating hits are not exact.

if (!bundledChallengeResult.ok) throw new Error('bundled challenge failed to load')
const ch: Challenge = bundledChallengeResult.value
const YIELD = ch.material.yieldStressPa
if (!ch.referenceDesign) throw new Error('bundled challenge has no reference design')
const REF: BeamDesign = ch.referenceDesign

interface Case {
  design: BeamDesign
  input: ApplicabilityInput
}

const design = (section: Section, lengthM: number, orientationDeg: Orientation = 0): BeamDesign => ({
  id: 'd',
  section,
  orientationDeg,
  lengthM,
  materialId: ch.material.id,
})

const ZERO: ApplicabilityInput = { tipDeflectionM: 0, nominalMaxStressPa: 0 }
const tinyCircle = { kind: 'circle', diameterM: 0.01 } as const

/** Builds a case whose `code` metric is (approximately) `target` and every other metric is safe. */
const BUILDERS: Readonly<Record<ApplicabilityCode, (target: number) => Case>> = {
  // Circle of diameter `target` on L = 1: envelope height / L = target exactly.
  DEPTH_SPAN: (target) => ({ design: design({ kind: 'circle', diameterM: target }, 1), input: ZERO }),
  // L = 1, δ = target: δ / L = target exactly.
  LARGE_DEFLECTION: (target) => ({
    design: design(tinyCircle, 1),
    input: { tipDeflectionM: target, nominalMaxStressPa: 0 },
  }),
  // σ = target · σ_yield, so σ / σ_yield ≈ target.
  PLASTICITY: (target) => ({
    design: design(tinyCircle, 1),
    input: { tipDeflectionM: 0, nominalMaxStressPa: target * YIELD },
  }),
  // D = 1, t_wall = 1 / target, d = D − 2·t_wall; L = 1000 keeps DEPTH_SPAN at 0.001.
  TUBE_SLENDERNESS: (target) => ({
    design: design({ kind: 'tube', outerDiameterM: 1, innerDiameterM: 1 - 2 / target }, 1000),
    input: ZERO,
  }),
  // tf = tw = 1, b = 2·target + 1 → (b − tw)/(2·tf) ≈ target; h = 3 → web ratio 1.
  FLANGE_OUTSTAND: (target) => ({
    design: design(
      { kind: 'iSection', widthM: 2 * target + 1, heightM: 3, flangeThicknessM: 1, webThicknessM: 1 },
      1000,
    ),
    input: ZERO,
  }),
  // tf = tw = 1, h = target + 2 → (h − 2·tf)/tw ≈ target; b = 3 → outstand 1.
  // L = 10000 keeps DEPTH_SPAN ≤ 0.0123 even at h ≈ 122.
  WEB_SLENDERNESS: (target) => ({
    design: design(
      { kind: 'iSection', widthM: 3, heightM: target + 2, flangeThicknessM: 1, webThicknessM: 1 },
      10000,
    ),
    input: ZERO,
  }),
  // Width 1, height `target` at 0° (long side vertical): envelope height / width = target exactly.
  RECT_ASPECT: (target) => ({
    design: design({ kind: 'rectangle', widthM: 1, heightM: target }, 1000),
    input: ZERO,
  }),
}

/** Independent recomputation of a metric from the spec formula (Req 10.1, 10.2). */
function metric(code: ApplicabilityCode, { design: d, input }: Case): number {
  const env = orientedEnvelope(d.section, d.orientationDeg)
  const s = d.section
  switch (code) {
    case 'DEPTH_SPAN':
      return env.heightYM / d.lengthM
    case 'LARGE_DEFLECTION':
      return input.tipDeflectionM / d.lengthM
    case 'PLASTICITY':
      return input.nominalMaxStressPa / YIELD
    case 'TUBE_SLENDERNESS':
      if (s.kind !== 'tube') throw new Error('expected tube')
      return s.outerDiameterM / ((s.outerDiameterM - s.innerDiameterM) / 2)
    case 'FLANGE_OUTSTAND':
      if (s.kind !== 'iSection') throw new Error('expected iSection')
      return (s.widthM - s.webThicknessM) / (2 * s.flangeThicknessM)
    case 'WEB_SLENDERNESS':
      if (s.kind !== 'iSection') throw new Error('expected iSection')
      return (s.heightM - 2 * s.flangeThicknessM) / s.webThicknessM
    case 'RECT_ASPECT':
      return env.heightYM / env.widthZM
  }
}

const fmt = (x: number): string => String(Number(x.toPrecision(3)))
const codesOf = (issues: readonly ApplicabilityIssue[]) => issues.map((i) => i.code)

type Expected = 'none' | 'warning' | 'notApplicable'

describe.each(APPLICABILITY_CODES.map((code) => [code] as const))('%s thresholds', (code) => {
  const { warning, notApplicable: na, effect } = THRESHOLDS[code]
  const points: [string, number, number, Expected][] = [
    // [label, target, threshold the target is measured against, expected outcome]
    ['at warning threshold', warning, warning, 'none'],
    ['within REL_TOL above warning (1 + 1e-15)', warning * (1 + 1e-15), warning, 'none'],
    ['just above warning (1 + 1e-8)', warning * (1 + 1e-8), warning, 'warning'],
    ['at not-applicable threshold', na, na, 'warning'],
    ['within REL_TOL above not-applicable (1 + 1e-15)', na * (1 + 1e-15), na, 'warning'],
    ['just above not-applicable (1 + 1e-8)', na * (1 + 1e-8), na, 'notApplicable'],
  ]

  it.each(points)('%s', (_label, target, ref, expected) => {
    const c = BUILDERS[code](target)
    const value = metric(code, c)
    // Construction accuracy: computed metric is within ±0.5·REL_TOL·threshold of the target.
    expect(Math.abs(value - target)).toBeLessThanOrEqual(0.5 * REL_TOL * ref)

    const r = checkApplicability(c.design, c.input, ch)
    const all = [...r.warnings, ...r.notApplicable]
    // Only the metric under test may produce an issue, and at most once (Req 10.7).
    expect(all.every((i) => i.code === code)).toBe(true)
    expect(all.length).toBeLessThanOrEqual(1)

    if (expected === 'none') {
      expect(all).toEqual([]) // Req 10.6
      return
    }
    const list = expected === 'warning' ? r.warnings : r.notApplicable
    const other = expected === 'warning' ? r.notApplicable : r.warnings
    const threshold = expected === 'warning' ? warning : na
    expect(other).toEqual([])
    expect(list).toHaveLength(1)
    const [issue] = list
    expect(issue.code).toBe(code)
    expect(issue.value).toBe(value)
    expect(issue.threshold).toBe(threshold)
    expect(issue.message).toContain(effect)
    expect(issue.message).toContain(fmt(value))
    expect(issue.message).toContain(fmt(threshold))
    expect(issue.message).toContain(expected === 'warning' ? 'caution level' : 'model limit')
  })
})

it('literal example from Req 10.6: DEPTH_SPAN 0.1000000000000001 against 0.10 records nothing', () => {
  const c = BUILDERS.DEPTH_SPAN(0.1000000000000001)
  expect(metric('DEPTH_SPAN', c)).toBe(0.1000000000000001)
  expect(checkApplicability(c.design, c.input, ch)).toEqual({ warnings: [], notApplicable: [] })
})

describe('combined issues and non-evaluated metrics', () => {
  const bigInput: ApplicabilityInput = { tipDeflectionM: 1, nominalMaxStressPa: 10 * YIELD }

  it('every triggered code appears once, in APPLICABILITY_CODES order, across both lists', () => {
    // Tube: D/L = 0.5 (NA), δ/L = 1 (NA), σ/σy = 10 (NA), D/t = 50 (warning).
    const d = design({ kind: 'tube', outerDiameterM: 1, innerDiameterM: 0.96 }, 2)
    const r = checkApplicability(d, bigInput, ch)
    expect(codesOf(r.notApplicable)).toEqual(['DEPTH_SPAN', 'LARGE_DEFLECTION', 'PLASTICITY'])
    expect(codesOf(r.warnings)).toEqual(['TUBE_SLENDERNESS'])
  })

  it.each<[string, BeamDesign, ApplicabilityCode[]]>([
    // Circle: none of the four kind-specific metrics exist.
    ['circle', design({ kind: 'circle', diameterM: 1 }, 1), []],
    // Very slender tube: FLANGE/WEB/RECT never evaluated.
    ['tube', design({ kind: 'tube', outerDiameterM: 1, innerDiameterM: 0.999 }, 1), ['TUBE_SLENDERNESS']],
    // Very slender I-section: TUBE/RECT never evaluated.
    [
      'iSection',
      design({ kind: 'iSection', widthM: 100, heightM: 1000, flangeThicknessM: 1, webThicknessM: 1 }, 1),
      ['FLANGE_OUTSTAND', 'WEB_SLENDERNESS'],
    ],
    // Rectangle 50 wide × 1 high at 0°: envelope height < width, so RECT_ASPECT not evaluated.
    ['rectangle flat at 0°', design({ kind: 'rectangle', widthM: 50, heightM: 1 }, 1), []],
    // Same rectangle tall (1 × 50) rotated 90°: envelope height 1 < width 50, not evaluated.
    ['rectangle tall at 90°', design({ kind: 'rectangle', widthM: 1, heightM: 50 }, 1, 90), []],
    // Square: envelope height = width, not evaluated.
    ['square', design({ kind: 'rectangle', widthM: 1, heightM: 1 }, 1), []],
  ])('%s records nothing for non-evaluated metrics (Req 10.3)', (_label, d, kindCodes) => {
    const r = checkApplicability(d, bigInput, ch)
    const all = codesOf([...r.warnings, ...r.notApplicable])
    expect([...all].sort()).toEqual(
      ['DEPTH_SPAN', 'LARGE_DEFLECTION', 'PLASTICITY', ...kindCodes].sort(),
    )
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('analyze metadata and invariants', () => {
  const NINE = [
    'torsion',
    'shear deformation',
    'local buckling',
    'lateral-torsional buckling',
    'plasticity',
    'large deflection',
    'root stress concentrations',
    'joint/fastener compliance',
    'self-weight',
  ]

  it.each<[string, BeamDesign]>([
    ['baseline', ch.initialDesign],
    ['reference', REF],
    // Reference section on a 0.2 m span: depth/span 0.3 → not applicable.
    ['not-applicable design', { ...REF, lengthM: 0.2 }],
  ])('%s: unsupportedEffects lists exactly the nine effects (Req 10.9)', (_label, d) => {
    const a = analyze(d, ch)
    expect([...a.unsupportedEffects]).toEqual(NINE)
    expect(a.modelId).toBe('eulerBernoulliCantileverTipForce')
  })

  it('not-applicable design still carries metadata and applicable = false', () => {
    const a = analyze({ ...REF, lengthM: 0.2 }, ch)
    expect(a.applicable).toBe(false)
    expect(codesOf(a.notApplicableReasons)).toContain('DEPTH_SPAN')
  })

  it('throws PhysicsInvariantError naming the field for a forced non-finite input (Req 9.3)', () => {
    // Infinite span: section properties stay finite, so massKg = ρ·A·L is the first bad field.
    const forced = { ...ch.initialDesign, lengthM: Number.POSITIVE_INFINITY }
    let caught: unknown
    try {
      analyze(forced, ch)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(PhysicsInvariantError)
    const err = caught as PhysicsInvariantError
    expect(err.field).toBe('massKg')
    expect(err.value).toBe(Number.POSITIVE_INFINITY)
  })

  it('throws PhysicsInvariantError for a NaN section dimension', () => {
    const forced: BeamDesign = { ...ch.initialDesign, section: { kind: 'circle', diameterM: NaN } }
    expect(() => analyze(forced, ch)).toThrow(PhysicsInvariantError)
  })
})
