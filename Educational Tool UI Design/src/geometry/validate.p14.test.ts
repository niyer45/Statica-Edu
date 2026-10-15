// Feature: engineering-intuition-mvp, Property 14: Hostile input rejection
//
// Validator half of Property 14 (task 5.4). The runTest / reducer half is added in task 19.13.
// ∀ section with at least one field from arbHostileNumber (or with d ≥ D, h ≤ 2tf, tw > b):
// validateSection returns at least one well-formed error, never throws, and never mutates input.
//
// **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 17.2**

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  arbHostileNumber,
  arbInvalidSection,
  arbParamFor,
  arbSectionOfKind,
  bundledChallenge,
  SECTION_KINDS,
  SECTION_PARAMS,
} from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { deepFreeze } from '../challenge/deepFreeze'
import type { SectionKind, SectionLimits } from '../challenge/types'
import type { BeamDesign, GeometryError, GeometryErrorCode, Section } from './sections'
import { validateDesign, validateSection } from './validate'

const ch = bundledChallenge()
const limits: SectionLimits = ch.sectionLimits

/** Margin for stepping clearly past a rule boundary (well above GEOM_TOL). */
const MARGIN = 1e-6

const ALL_CODES: ReadonlySet<GeometryErrorCode> = new Set<GeometryErrorCode>([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'INNER_NOT_LESS_THAN_OUTER',
  'WALL_TOO_THIN',
  'FLANGES_OVERLAP',
  'WEB_WIDER_THAN_FLANGE',
  'FLANGE_TOO_THIN',
  'WEB_TOO_THIN',
  'SECTION_NOT_ALLOWED',
  'LOCKED_FIELD_CHANGED',
  'BAD_ORIENTATION',
])

/** Codes that describe a section dimension; these must name a parameter of the section's kind. */
const DIMENSION_CODES: ReadonlySet<GeometryErrorCode> = new Set<GeometryErrorCode>([
  'NON_FINITE',
  'NON_POSITIVE',
  'BELOW_MIN',
  'ABOVE_MAX',
  'INNER_NOT_LESS_THAN_OUTER',
  'WALL_TOO_THIN',
  'FLANGES_OVERLAP',
  'WEB_WIDER_THAN_FLANGE',
  'FLANGE_TOO_THIN',
  'WEB_TOO_THIN',
])

/** A generated hostile case: the section plus what the validator must report about it. */
interface HostileCase {
  label: string
  section: Section
  /** If set, at least one error must reference this parameter. */
  param?: string
  /** If set, at least one error must have this code (and `param`, when given). */
  code?: GeometryErrorCode
}

function between(lo: number, hi: number): fc.Arbitrary<number> {
  return fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true })
}

/** The code a hostile value must produce on its own parameter, where it is unambiguous. */
function expectedHostileCode(param: string, v: number): GeometryErrorCode | undefined {
  if (!Number.isFinite(v)) return 'NON_FINITE'
  if (v < 0) return 'NON_POSITIVE' // includes negatives; −0 is handled below
  if (v === 0 && param !== 'innerDiameterM') return 'NON_POSITIVE' // 0 and −0
  return undefined // huge / tiny positives: range or coupled rule, checked via `param`
}

/** Hostile number in one specific param of one specific kind (valid tube inner diameters excluded). */
function arbHostileIn(kind: SectionKind, param: string): fc.Arbitrary<HostileCase> {
  return arbSectionOfKind(kind, limits).chain((s) => {
    const D = s.kind === 'tube' ? s.outerDiameterM : Number.POSITIVE_INFINITY
    const values =
      param === 'innerDiameterM'
        ? arbHostileNumber.filter((v) => !(Number.isFinite(v) && v >= 0 && v < D))
        : arbHostileNumber
    return values.map((v) => ({
      label: `hostile ${kind}.${param}`,
      section: { ...s, [param]: v } as Section,
      param,
      code: expectedHostileCode(param, v),
    }))
  })
}

/** Tube with d ≥ D (including d = D exactly). */
const arbTubeInnerNotLess: fc.Arbitrary<HostileCase> = arbSectionOfKind('tube', limits).chain((s) => {
  const D = s.outerDiameterM
  return fc.oneof(fc.constant(D), between(D, 2 * D)).map((d) => ({
    label: 'tube d ≥ D',
    section: { ...s, innerDiameterM: d },
    param: 'innerDiameterM',
    code: 'INNER_NOT_LESS_THAN_OUTER' as const,
  }))
})

/** I-section with h ≤ 2tf (tf ∈ [h/2, h]). */
const arbFlangesMeet: fc.Arbitrary<HostileCase> = arbSectionOfKind('iSection', limits).chain((s) =>
  between(s.heightM / 2, s.heightM).map((tf) => ({
    label: 'iSection h ≤ 2tf',
    section: { ...s, flangeThicknessM: tf },
    param: 'flangeThicknessM',
    code: 'FLANGES_OVERLAP' as const,
  })),
)

/** I-section with h − 2tf below minClear but h > 2tf. */
const arbClearWebTooSmall: fc.Arbitrary<HostileCase> = arbSectionOfKind('iSection', limits).chain((s) => {
  const minClear = limits.iSection.minClearWebHeightM
  // clear web ∈ [MARGIN, minClear − 2·MARGIN] ⇒ tf = (h − clear) / 2
  return between(MARGIN, minClear - 2 * MARGIN).map((clear) => ({
    label: 'iSection h − 2tf < minClear',
    section: { ...s, flangeThicknessM: (s.heightM - clear) / 2 },
    param: 'flangeThicknessM',
    code: 'FLANGES_OVERLAP' as const,
  }))
})

/** I-section with tw > b + margin. */
const arbWebWiderThanFlange: fc.Arbitrary<HostileCase> = arbSectionOfKind('iSection', limits).chain((s) =>
  between(MARGIN, s.widthM).map((delta) => ({
    label: 'iSection tw > b',
    section: { ...s, webThicknessM: s.widthM + delta },
    param: 'webThicknessM',
    code: 'WEB_WIDER_THAN_FLANGE' as const,
  })),
)

/** Shared invalid-section arbitrary (hostile param, out of range, bad tube, bad I-section). */
const arbSharedInvalid: fc.Arbitrary<HostileCase> = arbInvalidSection(limits).map((section) => ({
  label: 'arbInvalidSection',
  section,
}))

const NAMED_CASES: { label: string; arb: fc.Arbitrary<HostileCase> }[] = [
  ...SECTION_KINDS.flatMap((kind) =>
    SECTION_PARAMS[kind].map((param) => ({ label: `hostile ${kind}.${param}`, arb: arbHostileIn(kind, param) })),
  ),
  { label: 'tube d ≥ D', arb: arbTubeInnerNotLess },
  { label: 'iSection h ≤ 2tf', arb: arbFlangesMeet },
  { label: 'iSection h − 2tf < minClear', arb: arbClearWebTooSmall },
  { label: 'iSection tw > b', arb: arbWebWiderThanFlange },
  { label: 'arbInvalidSection', arb: arbSharedInvalid },
]

/** Hostile number in a random param of a random kind (exercises arbParamFor). */
const arbHostileAnyParam: fc.Arbitrary<HostileCase> = fc
  .constantFrom(...SECTION_KINDS)
  .chain((kind) => arbParamFor(kind).chain((param) => arbHostileIn(kind, param)))

const arbHostileCase: fc.Arbitrary<HostileCase> = fc.oneof(...NAMED_CASES.map((c) => c.arb), arbHostileAnyParam)

function assertWellFormed(errors: GeometryError[], kind: SectionKind): void {
  const params: readonly string[] = SECTION_PARAMS[kind]
  for (const e of errors) {
    expect(ALL_CODES.has(e.code)).toBe(true)
    expect(typeof e.message).toBe('string')
    expect(e.message.trim().length).toBeGreaterThan(0)
    if (DIMENSION_CODES.has(e.code)) {
      expect(typeof e.param).toBe('string')
      expect(params).toContain(e.param)
    }
  }
}

/** Core check for one case: ≥ 1 well-formed error, no throw, no mutation, expected code/param. */
function checkCase(c: HostileCase): void {
  const snapshot = structuredClone(c.section)
  const frozen = deepFreeze(c.section)

  let errors: GeometryError[] = []
  expect(() => {
    errors = validateSection(frozen, limits)
  }).not.toThrow()

  expect(errors.length).toBeGreaterThan(0)
  assertWellFormed(errors, c.section.kind)
  if (c.param !== undefined) {
    expect(errors.some((e) => e.param === c.param)).toBe(true)
  }
  if (c.code !== undefined) {
    expect(errors.some((e) => e.code === c.code && (c.param === undefined || e.param === c.param))).toBe(true)
  }
  // Exclusivity (Req 5.2, 5.3): a NON_FINITE / NON_POSITIVE param gets exactly that one error.
  if ((c.code === 'NON_FINITE' || c.code === 'NON_POSITIVE') && c.param !== undefined) {
    expect(errors.filter((e) => e.param === c.param)).toHaveLength(1)
  }

  expect(c.section).toEqual(snapshot)
}

describe('Property 14: hostile input rejection (validateSection)', () => {
  it.each(NAMED_CASES)('$label: returns ≥ 1 well-formed error, never throws, never mutates', ({ arb }) => {
    assertProperty(
      fc.property(arb, (c) => {
        checkCase(c)
      }),
    )
  })

  it('any hostile case (fc.oneof over all named cases): returns ≥ 1 well-formed error', () => {
    assertProperty(
      fc.property(arbHostileCase, (c) => {
        checkCase(c)
      }),
    )
  })

  it('validateDesign also rejects a design containing a hostile section, without mutating it', () => {
    assertProperty(
      fc.property(arbHostileCase, (c) => {
        const design: BeamDesign = { ...ch.initialDesign, section: c.section }
        const snapshot = structuredClone(design)
        const frozen = deepFreeze(design)

        let errors: GeometryError[] = []
        expect(() => {
          errors = validateDesign(frozen, ch)
        }).not.toThrow()

        expect(errors.length).toBeGreaterThan(0)
        assertWellFormed(errors, c.section.kind)
        expect(design).toEqual(snapshot)
      }),
    )
  })
})
