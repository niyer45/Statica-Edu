// Feature: fatigue-analysis-1, Property 7: Fatigue explanation facts are grounded
// **Validates: task 70, MM-14**
//
// For any two valid tested spindles, every number in every single-result and change fact equals
// formatBasis(v, FACT_DIGITS) for some finite value v in that fact's basis, and the
// model-limitation fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbFatigueDesign, fatigueChallenge } from '../../../test/fixtures/fatigue'
import { assertProperty } from '../../../test/pbt'
import { analyzeFatigue } from '../../physics/fatigue/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateFatigue } from './evaluate'
import { explainFatigueChange, FATIGUE_MODEL_LIMITS_FACT_ID } from './explain'
import type { FatigueComparable } from './types'

const ch = fatigueChallenge()

function tested(d: FatigueComparable['designSnapshot']): FatigueComparable {
  const analysis = analyzeFatigue(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateFatigue(d, analysis, ch) }
}

function expectGrounded(facts: readonly ExplanationFact[]): void {
  for (const f of facts) {
    const allowed = Object.values(f.basis).map((v) => {
      expect(Number.isFinite(v)).toBe(true)
      return formatBasis(v, FACT_DIGITS)
    })
    // "S-N" is a name, not a number; strip it before looking for numerals.
    for (const token of f.text.replace(/S-N/g, '').match(/-?\d+(?:\.\d+)?/g) ?? []) expect(allowed, `${f.id}: ${f.text}`).toContain(token)
  }
  expect(facts.filter((f) => f.id === FATIGUE_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(FATIGUE_MODEL_LIMITS_FACT_ID)
}

describe('Property 7: grounded fatigue facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(
      fc.property(arbFatigueDesign(ch), arbFatigueDesign(ch), (a, b) => {
        const prev = tested(a)
        const next = tested(b)
        expectGrounded(prev.evaluation.facts)
        expectGrounded(explainFatigueChange(prev, next))
      }),
    )
  })
})
