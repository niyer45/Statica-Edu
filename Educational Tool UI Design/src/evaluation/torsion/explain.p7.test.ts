// Feature: torsion-shaft-1, Property 7: Torsion explanation facts are grounded
// **Validates: TSH-15, MM-14**
//
// For any two valid tested shafts, every number in every single-result and change fact equals
// formatBasis(v, FACT_DIGITS) for some finite value v in that fact's basis, and the model-limitation
// fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbTorsionDesign, torsionChallenge } from '../../../test/fixtures/torsion'
import { assertProperty } from '../../../test/pbt'
import { analyzeShaft } from '../../physics/torsion/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateShaft } from './evaluate'
import { explainTorsionChange, TORSION_MODEL_LIMITS_FACT_ID } from './explain'
import type { TorsionComparable } from './types'

const ch = torsionChallenge()

function tested(d: TorsionComparable['designSnapshot']): TorsionComparable {
  const analysis = analyzeShaft(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateShaft(d, analysis, ch) }
}

function expectGrounded(facts: readonly ExplanationFact[]): void {
  for (const f of facts) {
    const allowed = Object.values(f.basis).map((v) => {
      expect(Number.isFinite(v)).toBe(true)
      return formatBasis(v, FACT_DIGITS)
    })
    for (const token of f.text.match(/-?\d+(?:\.\d+)?/g) ?? []) {
      expect(allowed, `${f.id}: ${f.text}`).toContain(token)
    }
  }
  expect(facts.filter((f) => f.id === TORSION_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(TORSION_MODEL_LIMITS_FACT_ID)
}

describe('Property 7: grounded torsion facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(
      fc.property(arbTorsionDesign(ch), arbTorsionDesign(ch), (a, b) => {
        const prev = tested(a)
        const next = tested(b)
        expectGrounded(prev.evaluation.facts)
        expectGrounded(explainTorsionChange(prev, next))
      }),
    )
  })
})
