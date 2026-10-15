// Feature: engineering-intuition-mvp, Property 27: Grounded facts
// **Validates: Requirements 13.1, 13.2**
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BeamDesign } from '../geometry/sections'
import { analyze } from '../physics/analyze'
import { arbDesign, bundledChallenge } from '../../test/arbitraries'
import { assertProperty } from '../../test/pbt'
import { CONSTRAINT_LABELS } from './constraints'
import { evaluate } from './evaluate'
import {
  FACT_DIGITS,
  MODEL_LIMITS_FACT_ID,
  ORIENTATION_DIGITS,
  SECTION_KIND_NAMES,
  explainChange,
  explainSingle,
  formatBasis,
} from './explain'
import type { ExplanationFact, TestResult } from './types'

const ch = bundledChallenge()

function toResult(d: BeamDesign, iteration: number): TestResult {
  const analysis = analyze(d, ch)
  const evaluation = evaluate(d, analysis, ch)
  return {
    id: `r${iteration}`,
    iteration,
    designSnapshot: d,
    analysis,
    evaluation,
    accepted: evaluation.accepted,
    failures: evaluation.failures,
    timestamp: '2024-01-01T00:00:00.000Z',
  }
}

/**
 * Number tokens in fact text. Matches an optional sign, digits, and an optional fraction, so
 * "×7.20" → "7.20", "0°" → "0", and a sentence-ending "0.14." → "0.14". Only `text` is
 * scanned (never ids), and labels/fixed sentences contain no digits (asserted below).
 */
const NUMBER_TOKEN = /-?\d+(?:\.\d+)?/g

function expectGrounded(f: ExplanationFact): void {
  const values = Object.values(f.basis)
  for (const v of values) expect(Number.isFinite(v), `${f.id}: non-finite basis ${v}`).toBe(true)
  // No exponent notation or other digit forms the token regex would split.
  expect(f.text, `${f.id}: exponent notation`).not.toMatch(/\d[eE][+-]?\d/)
  for (const tok of f.text.match(NUMBER_TOKEN) ?? []) {
    const d = tok.includes('.') ? tok.split('.')[1].length : 0
    expect([0, FACT_DIGITS], `${f.id}: token ${tok} has ${d} decimals`).toContain(d)
    expect(
      values.some((v) => formatBasis(v, d) === tok),
      `${f.id}: token "${tok}" not grounded in basis ${JSON.stringify(f.basis)}`,
    ).toBe(true)
  }
}

function expectOneModelFact(fs: ExplanationFact[]): void {
  expect(fs.filter((f) => f.id === MODEL_LIMITS_FACT_ID)).toHaveLength(1)
}

/** Single-result facts: basis = { value, limit, utilization } of the matching constraint result. */
function expectSingleBasis(r: TestResult, fs: ExplanationFact[]): void {
  for (const f of fs) {
    if (f.id === MODEL_LIMITS_FACT_ID) {
      expect(f.basis).toEqual({})
      continue
    }
    const prefix = 'single.utilization.'
    expect(f.id.startsWith(prefix)).toBe(true)
    const c = r.evaluation.constraints.find((x) => x.id === f.id.slice(prefix.length))
    expect(c, `${f.id}: no matching constraint`).toBeDefined()
    expect(f.basis).toEqual({ value: c!.value, limit: c!.limit, utilization: c!.utilization })
  }
}

/** Comparison facts: ratios equal next/prev of the analysis fields; degrees equal orientations. */
function expectChangeBasis(p: TestResult, n: TestResult, fs: ExplanationFact[]): void {
  const ratio = (k: 'bendingInertiaM4' | 'tipDeflectionM' | 'massKg') => n.analysis[k] / p.analysis[k]
  const expected: Record<string, number> = {
    rI: ratio('bendingInertiaM4'),
    rDelta: ratio('tipDeflectionM'),
    rMass: ratio('massKg'),
    prevOrientationDeg: p.designSnapshot.orientationDeg,
    nextOrientationDeg: n.designSnapshot.orientationDeg,
  }
  for (const f of fs) {
    for (const [k, v] of Object.entries(f.basis)) {
      expect(k in expected, `${f.id}: unexpected basis key ${k}`).toBe(true)
      expect(v, `${f.id}.${k}`).toBe(expected[k])
    }
    if (f.id.startsWith('change.constraint.') || f.id === MODEL_LIMITS_FACT_ID) expect(f.basis).toEqual({})
  }
}

describe('Property 27: Grounded facts (Req 13.1, 13.2)', () => {
  it('labels and section names contain no digits; digit constants are as documented', () => {
    for (const label of Object.values(CONSTRAINT_LABELS)) expect(label).not.toMatch(/\d/)
    for (const name of Object.values(SECTION_KIND_NAMES)) expect(name).not.toMatch(/\d/)
    expect(ORIENTATION_DIGITS).toBe(0)
    expect([0, FACT_DIGITS]).toContain(ORIENTATION_DIGITS)
  })

  it('every fact (single and change) is grounded in its basis, and basis matches the results', () => {
    assertProperty(
      fc.property(arbDesign(ch), arbDesign(ch), (dp, dn) => {
        const p = toResult(dp, 0)
        const n = toResult(dn, 1)

        for (const r of [p, n]) {
          const single = r.evaluation.facts
          expect(single).toEqual(explainSingle(r.analysis, r.evaluation.constraints))
          single.forEach(expectGrounded)
          expectOneModelFact(single)
          expectSingleBasis(r, single)
        }

        const change = explainChange(p, n)
        change.forEach(expectGrounded)
        expectOneModelFact(change)
        expectChangeBasis(p, n, change)
        expect(explainChange(p, n)).toEqual(change) // deterministic (Req 13.9)
      }),
    )
  })
})
