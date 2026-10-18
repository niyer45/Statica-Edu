// Feature: mounting-bracket-1, Property 4: Bracket scaling laws
// **Validates: task 55 L-bracket (scaling)**
//
// Stresses, deflections and the bolt tension are linear in P; deflections ∝ 1/E; mass is
// independent of P and E; the curved-beam factor, the lever arm and R/c are independent of P, E
// and w; stresses and deflections ∝ 1/w, mass ∝ w, the bolt tension is independent of w. Each case
// scales one input by k with every other input unchanged (relative 1e-12, or bitwise identical
// where the quantity does not depend on the input).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge, relClose } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import type { BracketChallenge } from '../../challenge/bracket/types'
import { analyzeBracket } from './analyze'
import type { BracketAnalysis } from './types'

const ch = bracketChallenge()
const REL = 1e-12
const arbK = fc.double({ min: 0.25, max: 4, noNaN: true })

const withForce = (k: number): BracketChallenge => ({ ...ch, load: { ...ch.load, forceN: ch.load.forceN * k } })
const withModulus = (k: number): BracketChallenge => ({ ...ch, material: { ...ch.material, elasticModulusPa: ch.material.elasticModulusPa * k } })

const STRESSES = ['nominalBendStressPa', 'bendStressPa'] as const
const DEFLECTIONS = ['armDeflectionM', 'flangeRotationDeflectionM', 'deflectionM'] as const
const GEOMETRIC = ['curvedBeamFactor', 'bendRadiusRatio', 'boltLeverArmM'] as const

function expectScaled(a: BracketAnalysis, b: BracketAnalysis, keys: readonly (keyof BracketAnalysis)[], factor: number): void {
  for (const k of keys) expect(relClose(b[k] as number, factor * (a[k] as number), REL), k).toBe(true)
}
function expectSame(a: BracketAnalysis, b: BracketAnalysis, keys: readonly (keyof BracketAnalysis)[]): void {
  for (const k of keys) expect(Object.is(b[k], a[k]), k).toBe(true)
}

describe('Property 4: scaling laws', () => {
  it('stresses, deflections, moment and bolt tension are linear in P; mass and geometry are independent of P', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbK, (d, k) => {
        const a = analyzeBracket(d, ch)
        const b = analyzeBracket(d, withForce(k))
        expectScaled(a, b, [...STRESSES, ...DEFLECTIONS, 'bendMomentNm', 'boltTensionN'], k)
        expectSame(a, b, ['massKg', 'bendRadiusRatio', 'boltLeverArmM'])
        expect(relClose(b.curvedBeamFactor, a.curvedBeamFactor, REL)).toBe(true)
      }),
    )
  })

  it('deflections ∝ 1/E; stresses, bolt tension, mass and geometry are independent of E', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbK, (d, k) => {
        const a = analyzeBracket(d, ch)
        const b = analyzeBracket(d, withModulus(k))
        expectScaled(a, b, DEFLECTIONS, 1 / k)
        expectSame(a, b, [...STRESSES, ...GEOMETRIC, 'boltTensionN', 'massKg'])
      }),
    )
  })

  it('stresses and deflections ∝ 1/w and mass ∝ w; bolt tension and geometry are independent of w', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbK, (d, k) => {
        const a = analyzeBracket(d, ch)
        const b = analyzeBracket({ ...d, widthM: d.widthM * k }, ch)
        expectScaled(a, b, [...STRESSES, ...DEFLECTIONS], 1 / k)
        expectScaled(a, b, ['massKg'], k)
        expectSame(a, b, ['boltTensionN', 'bendRadiusRatio', 'boltLeverArmM', 'bendMomentNm'])
        expect(relClose(b.curvedBeamFactor, a.curvedBeamFactor, REL)).toBe(true)
      }),
    )
  })
})
