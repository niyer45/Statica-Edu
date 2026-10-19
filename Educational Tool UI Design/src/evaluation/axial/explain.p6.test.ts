// Feature: stress-strain-1, Property 6: Rod explanation facts are grounded
// **Validates: SSR-16, MM-14**
//
// For any two valid tested rods, every number in every single-result and change fact equals
// formatBasis(v, FACT_DIGITS) for some finite value v in that fact's basis, and the
// model-limitation fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbAxialDesign, axialChallenge } from '../../../test/fixtures/axial'
import { assertProperty } from '../../../test/pbt'
import { analyzeRod } from '../../physics/axial/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateRod } from './evaluate'
import { AXIAL_MODEL_LIMITS_FACT_ID, explainRodChange } from './explain'
import type { AxialComparable } from './types'

const ch = axialChallenge()
const names = (id: string) => ch.materials.find((m) => m.id === id)!.shortName

function tested(d: AxialComparable['designSnapshot']): AxialComparable {
  const analysis = analyzeRod(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateRod(d, analysis, ch) }
}

function expectGrounded(facts: readonly ExplanationFact[]): void {
  for (const f of facts) {
    const allowed = Object.values(f.basis).map((v) => {
      expect(Number.isFinite(v)).toBe(true)
      return formatBasis(v, FACT_DIGITS)
    })
    for (const token of f.text.match(/-?\d+(?:\.\d+)?/g) ?? []) expect(allowed, `${f.id}: ${f.text}`).toContain(token)
  }
  expect(facts.filter((f) => f.id === AXIAL_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(AXIAL_MODEL_LIMITS_FACT_ID)
}

describe('Property 6: grounded rod facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(fc.property(arbAxialDesign(ch), arbAxialDesign(ch), (a, b) => {
      const prev = tested(a)
      const next = tested(b)
      expectGrounded(prev.evaluation.facts)
      expectGrounded(explainRodChange(prev, next, names))
    }))
  })
})
