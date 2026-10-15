// Feature: engineering-intuition-mvp, Property 5: Force linearity
// **Validates: Requirements 9.8**
//
// ∀ valid design d, ∀ k ∈ [0.1, 10]: analyzing with the challenge tip force scaled by k
// scales tipDeflectionM and nominalMaxStressPa by k (relative 1e-12) and leaves massKg
// bitwise identical. Includes k = 2 (spec §8: doubling F doubles deflection and stress).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { analyze } from './analyze'

const REL = 1e-12

/** |a − b| ≤ rel · max(|a|, |b|). */
function relClose(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

const ch = bundledChallenge()

/** Mutable copy of the challenge with load.forceN multiplied by k; nothing else changes. */
function withForceScaled(base: Challenge, k: number): Challenge {
  const copy = structuredClone(base)
  copy.load.forceN = base.load.forceN * k
  return copy
}

const arbK = fc.oneof(
  fc.constant(2),
  fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
)

function checkLinearity(d: BeamDesign, k: number): void {
  const a = analyze(d, ch)
  const b = analyze(d, withForceScaled(ch, k))
  expect(relClose(b.tipDeflectionM, k * a.tipDeflectionM, REL), 'tipDeflectionM').toBe(true)
  expect(relClose(b.nominalMaxStressPa, k * a.nominalMaxStressPa, REL), 'nominalMaxStressPa').toBe(true)
  expect(Object.is(b.massKg, a.massKg), 'massKg bitwise').toBe(true)
}

describe('Property 5: force linearity', () => {
  it('scaling F by k ∈ [0.1, 10] scales δ and σ by k and leaves m bitwise identical', () => {
    assertProperty(fc.property(arbDesign(ch), arbK, (d, k) => checkLinearity(d, k)))
  })

  it('doubling F doubles δ and σ (spec §8), mass unchanged, for every design', () => {
    assertProperty(fc.property(arbDesign(ch), (d) => checkLinearity(d, 2)))
  })

  it('example: initial design at k = 2 and the range endpoints', () => {
    for (const k of [0.1, 2, 10]) checkLinearity(ch.initialDesign, k)
  })

  it('the scaled challenge copy differs from the original only in forceN', () => {
    const scaled = withForceScaled(ch, 2)
    expect(scaled.load.forceN).toBe(2 * ch.load.forceN)
    expect({ ...scaled, load: { ...scaled.load, forceN: ch.load.forceN } }).toEqual(ch)
  })
})
