// Feature: mounting-bracket-1, Property 4: Bracket scaling laws
// **Validates: MBR-17 (scaling)**
//
// Stresses and δ are linear in F; δ ∝ 1/E; mass is independent of F and E; Kt and the peak
// location are independent of F, E and b; σ ∝ 1/b, δ ∝ 1/b and m ∝ b. Each case scales one input by
// k with every other input unchanged (relative 1e-12, or bitwise identical where the quantity does
// not depend on the input).
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
const withThickness = (k: number): BracketChallenge => ({ ...ch, thicknessM: ch.thicknessM * k })

const STRESSES = ['rootStressPa', 'stepNominalStressPa', 'stepPeakStressPa', 'peakStressPa'] as const

function expectScaled(a: BracketAnalysis, b: BracketAnalysis, keys: readonly (keyof BracketAnalysis)[], factor: number): void {
  for (const k of keys) {
    const x = a[k]
    const y = b[k]
    expect(typeof y, k).toBe(typeof x)
    if (typeof x === 'number') expect(relClose(y as number, factor * x, REL), k).toBe(true)
  }
}

describe('Property 4: scaling laws', () => {
  it('stresses and δ are linear in F; m, Kt and the location are independent of F', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbK, (d, k) => {
        const a = analyzeBracket(d, ch)
        const b = analyzeBracket(d, withForce(k))
        expectScaled(a, b, [...STRESSES, 'tipDeflectionM', 'rootMomentNm', 'stepMomentNm'], k)
        expect(Object.is(b.massKg, a.massKg)).toBe(true)
        expect(b.ktStep).toBe(a.ktStep)
        expect(b.peakLocation).toBe(a.peakLocation)
      }),
    )
  })

  it('δ ∝ 1/E; stresses, m, Kt and the location are independent of E', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbK, (d, k) => {
        const a = analyzeBracket(d, ch)
        const b = analyzeBracket(d, withModulus(k))
        expectScaled(a, b, ['tipDeflectionM'], 1 / k)
        for (const s of STRESSES) expect(Object.is(b[s], a[s]), s).toBe(true)
        expect(Object.is(b.massKg, a.massKg)).toBe(true)
        expect(b.ktStep).toBe(a.ktStep)
        expect(b.peakLocation).toBe(a.peakLocation)
      }),
    )
  })

  it('σ ∝ 1/b, δ ∝ 1/b, m ∝ b; Kt and the location are independent of b', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbK, (d, k) => {
        const a = analyzeBracket(d, ch)
        const b = analyzeBracket(d, withThickness(k))
        expectScaled(a, b, [...STRESSES, 'tipDeflectionM'], 1 / k)
        expectScaled(a, b, ['massKg'], k)
        expect(b.ktStep).toBe(a.ktStep)
        expect(b.peakLocation).toBe(a.peakLocation)
      }),
    )
  })
})
