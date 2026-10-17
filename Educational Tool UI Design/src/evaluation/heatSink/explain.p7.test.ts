// Feature: heat-sink-1, Property 7: Heat sink explanation facts are grounded
// **Validates: HSK-15, MM-14**
//
// For any two valid tested heat sinks, every number in every single-result and change fact equals
// formatBasis(v, FACT_DIGITS) for some finite value v in that fact's basis, and the model-limitation
// fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbHeatSinkDesign, heatSinkChallenge } from '../../../test/fixtures/heatSink'
import { assertProperty } from '../../../test/pbt'
import { analyzeHeatSink } from '../../physics/heatSink/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateHeatSink } from './evaluate'
import { explainHeatSinkChange, HEAT_SINK_MODEL_LIMITS_FACT_ID } from './explain'
import type { HeatSinkComparable } from './types'

const ch = heatSinkChallenge()

function tested(d: HeatSinkComparable['designSnapshot']): HeatSinkComparable {
  const analysis = analyzeHeatSink(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateHeatSink(d, analysis, ch) }
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
  expect(facts.filter((f) => f.id === HEAT_SINK_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(HEAT_SINK_MODEL_LIMITS_FACT_ID)
}

describe('Property 7: grounded heat sink facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(
      fc.property(arbHeatSinkDesign(ch), arbHeatSinkDesign(ch), (a, b) => {
        const prev = tested(a)
        const next = tested(b)
        expectGrounded(prev.evaluation.facts)
        expectGrounded(explainHeatSinkChange(prev, next))
      }),
    )
  })
})
