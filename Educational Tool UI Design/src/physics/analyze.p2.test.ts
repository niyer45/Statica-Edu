// Feature: engineering-intuition-mvp, Property 2: Deflection formula
//
// **Validates: Requirements 9.1, 9.5**
//
// For every valid design: analyze(d, ch).tipDeflectionM ≈ F·L³/(3·E·I_bend) using the
// analysis's own bendingInertiaM4, deflectionShape(F, L, E, I, L) ≈ tipDeflectionM
// (relative 1e-12), deflectionShape(…, 0) === 0, and the shape is monotone non-decreasing
// over sorted sample points on [0, L] (random samples plus both endpoints).

import fc from 'fast-check'
import { describe, it } from 'vitest'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import { analyze } from './analyze'
import { deflectionShape } from './beam'

const REL = 1e-12

function relClose(a: number, b: number, rel = REL): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
}

/** Sample fractions in [0, 1]; mapped to x = t·L and combined with the endpoints 0 and L. */
const arbFractions = fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 0, maxLength: 30 })

function checkDeflection(d: BeamDesign, ch: Challenge, fractions: readonly number[]): void {
  const F = ch.load.forceN
  const E = ch.material.elasticModulusPa
  const L = d.lengthM
  const a = analyze(d, ch)
  const I = a.bendingInertiaM4

  const expected = (F * L ** 3) / (3 * E * I)
  if (!relClose(a.tipDeflectionM, expected)) {
    throw new Error(`tipDeflectionM ${a.tipDeflectionM} ≠ F·L³/(3EI) ${expected}`)
  }

  const atTip = deflectionShape(F, L, E, I, L)
  if (!relClose(atTip, a.tipDeflectionM)) {
    throw new Error(`deflectionShape(L) ${atTip} ≠ tipDeflectionM ${a.tipDeflectionM}`)
  }

  const atRoot = deflectionShape(F, L, E, I, 0)
  if (atRoot !== 0) throw new Error(`deflectionShape(0) = ${atRoot}, expected 0`)

  const xs = [0, L, ...fractions.map((t) => t * L)].sort((p, q) => p - q)
  let prev = -Infinity
  let prevX = Number.NaN
  for (const x of xs) {
    const w = deflectionShape(F, L, E, I, x)
    if (!(w >= prev)) {
      throw new Error(`shape not monotone: w(${prevX}) = ${prev} > w(${x}) = ${w}`)
    }
    prev = w
    prevX = x
  }
}

describe('Property 2: Deflection formula', () => {
  const ch = bundledChallenge()

  it('tip deflection matches F·L³/(3EI) and the shape is consistent and monotone (bundled challenge)', () => {
    assertProperty(fc.property(arbDesign(ch), arbFractions, (d, fractions) => checkDeflection(d, ch, fractions)))
  })

  it('holds for modified challenges with other forces and elastic moduli', () => {
    const arbChallenge = fc
      .record({
        forceN: fc.double({ min: 1, max: 1e5, noNaN: true }),
        elasticModulusPa: fc.double({ min: 1e9, max: 4e11, noNaN: true }),
      })
      .map(({ forceN, elasticModulusPa }) => {
        const c = structuredClone(bundledChallenge())
        c.load.forceN = forceN
        c.material.elasticModulusPa = elasticModulusPa
        return c
      })
    assertProperty(
      fc.property(arbChallenge, arbDesign(ch), arbFractions, (c, d, fractions) => checkDeflection(d, c, fractions)),
    )
  })
})
