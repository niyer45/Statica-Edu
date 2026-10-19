// Feature: column-buckling-1, Property 7: Column explanation facts are grounded
// **Validates: task 68, MM-14**
//
// For any two valid tested columns, every number in every single-result and change fact equals
// formatBasis(v, FACT_DIGITS) for some finite value v in that fact's basis, and the model-limitation
// fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbColumnDesign, columnChallenge } from '../../../test/fixtures/column'
import { assertProperty } from '../../../test/pbt'
import { analyzeColumn } from '../../physics/column/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateColumn } from './evaluate'
import { COLUMN_MODEL_LIMITS_FACT_ID, explainColumnChange } from './explain'
import type { ColumnComparable } from './types'

const ch = columnChallenge()

function tested(d: ColumnComparable['designSnapshot']): ColumnComparable {
  const analysis = analyzeColumn(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateColumn(d, analysis, ch) }
}

function expectGrounded(facts: readonly ExplanationFact[]): void {
  for (const f of facts) {
    const allowed = Object.values(f.basis).map((v) => {
      expect(Number.isFinite(v)).toBe(true)
      return formatBasis(v, FACT_DIGITS)
    })
    for (const token of f.text.match(/-?\d+(?:\.\d+)?/g) ?? []) expect(allowed, `${f.id}: ${f.text}`).toContain(token)
  }
  expect(facts.filter((f) => f.id === COLUMN_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(COLUMN_MODEL_LIMITS_FACT_ID)
}

describe('Property 7: grounded column facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(
      fc.property(arbColumnDesign(ch), arbColumnDesign(ch), (a, b) => {
        const prev = tested(a)
        const next = tested(b)
        expectGrounded(prev.evaluation.facts)
        expectGrounded(explainColumnChange(prev, next))
      }),
    )
  })
})
