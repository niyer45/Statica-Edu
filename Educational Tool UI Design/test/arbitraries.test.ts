import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { validateDesign, validateSection } from '../src/geometry/validate'
import {
  HOSTILE_SPECIALS,
  POLLUTION_KEYS,
  SECTION_KINDS,
  SECTION_PARAMS,
  arbAnyJson,
  arbAnySection,
  arbDesign,
  arbHostileNumber,
  arbInvalidSection,
  arbParamFor,
  arbSectionOfKind,
  arbValidSection,
  bundledChallenge,
} from './arbitraries'
import { FIXED_SEED, assertProperty } from './pbt'

const ch = bundledChallenge()
const limits = ch.sectionLimits

/** Draws a large fixed-seed sample (independent of PBT_RUNS) for inclusion checks. */
const sample = <T>(arb: fc.Arbitrary<T>, n = 2000): T[] => fc.sample(arb, { seed: FIXED_SEED, numRuns: n })

describe('shared arbitraries', () => {
  it('arbValidSection outputs pass validateSection', () => {
    assertProperty(
      fc.property(arbValidSection(limits), (s) => {
        expect(validateSection(s, limits)).toEqual([])
      }),
    )
  })

  it('arbSectionOfKind produces the requested kind, including tube d = 0', () => {
    for (const kind of SECTION_KINDS) {
      expect(sample(arbSectionOfKind(kind, limits), 200).every((s) => s.kind === kind)).toBe(true)
    }
    const tubes = sample(arbSectionOfKind('tube', limits), 500)
    expect(tubes.some((t) => t.innerDiameterM === 0)).toBe(true)
    expect(tubes.some((t) => t.innerDiameterM > 0)).toBe(true)
  })

  it('arbDesign outputs pass validateDesign for the bundled challenge', () => {
    assertProperty(
      fc.property(arbDesign(ch), (d) => {
        expect(validateDesign(d, ch)).toEqual([])
      }),
    )
  })

  it('arbInvalidSection outputs fail validateSection with at least one error', () => {
    assertProperty(
      fc.property(arbInvalidSection(limits), (s) => {
        expect(validateSection(s, limits).length).toBeGreaterThan(0)
      }),
    )
  })

  it('arbAnySection never makes validateSection throw', () => {
    assertProperty(
      fc.property(arbAnySection(limits), (s) => {
        expect(Array.isArray(validateSection(s, limits))).toBe(true)
      }),
    )
  })

  it('arbHostileNumber includes every listed special value and negatives', () => {
    const values = sample(arbHostileNumber)
    for (const special of HOSTILE_SPECIALS) {
      expect(values.some((v) => Object.is(v, special)), String(special)).toBe(true)
    }
    expect(values.some((v) => Number.isFinite(v) && v < 0)).toBe(true)
  })

  it('arbParamFor covers exactly the parameters of each kind', () => {
    for (const kind of SECTION_KINDS) {
      const seen = new Set<string>(sample(arbParamFor(kind), 200))
      expect([...seen].sort()).toEqual([...SECTION_PARAMS[kind]].sort())
    }
  })

  it('arbAnyJson includes own prototype-pollution keys', () => {
    const values = sample(arbAnyJson)
    for (const key of POLLUTION_KEYS) {
      const hit = values.some(
        (v) => typeof v === 'object' && v !== null && Object.prototype.hasOwnProperty.call(v, key),
      )
      expect(hit, key).toBe(true)
    }
  })
})
