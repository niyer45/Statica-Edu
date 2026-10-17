// Feature: mounting-bracket-1, Property 7: Bracket explanation facts are grounded
// **Validates: MBR-19, MM-14**
//
// For any two valid tested brackets (stepped, uniform or outside the Kt fit), every number in every
// single-result and change fact equals formatBasis(v, FACT_DIGITS) for some finite value v in that
// fact's basis, and the model-limitation fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracketDesign, bracketChallenge } from '../../../test/fixtures/bracket'
import { assertProperty } from '../../../test/pbt'
import { analyzeBracket } from '../../physics/bracket/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateBracket } from './evaluate'
import { BRACKET_MODEL_LIMITS_FACT_ID, explainBracketChange } from './explain'
import type { BracketComparable } from './types'

const ch = bracketChallenge()

function tested(d: BracketComparable['designSnapshot']): BracketComparable {
  const analysis = analyzeBracket(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateBracket(d, analysis, ch) }
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
  expect(facts.filter((f) => f.id === BRACKET_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(BRACKET_MODEL_LIMITS_FACT_ID)
}

describe('Property 7: grounded bracket facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(
      fc.property(arbBracketDesign(ch), arbBracketDesign(ch), (a, b) => {
        const prev = tested(a)
        const next = tested(b)
        expectGrounded(prev.evaluation.facts)
        expectGrounded(explainBracketChange(prev, next))
      }),
    )
  })
})
