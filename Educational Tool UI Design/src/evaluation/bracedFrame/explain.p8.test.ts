// Feature: braced-frame-1, Property 8: Braced frame explanation facts are grounded
// **Validates: MM-14, BFR-17**
//
// For any two tested designs (mechanisms included), every number in every single-result and change
// fact equals formatBasis(v, FACT_DIGITS) for some finite value v in that fact's basis, no fact
// mentions the reference design, and the model-limitation fact appears exactly once, last.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { arbBracedFrameDesign, bracedFrameChallenge } from '../../../test/fixtures/bracedFrame'
import { assertProperty } from '../../../test/pbt'
import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import { analyzeBracedFrame } from '../../physics/bracedFrame/analyze'
import { FACT_DIGITS, formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { evaluateBracedFrame } from './evaluate'
import { BRACED_FRAME_MODEL_LIMITS_FACT_ID, explainBracedFrameChange } from './explain'
import type { BracedFrameComparable } from './types'

const ch = bracedFrameChallenge()

function tested(d: BracedFrameDesign): BracedFrameComparable {
  const analysis = analyzeBracedFrame(d, ch)
  return { designSnapshot: d, analysis, evaluation: evaluateBracedFrame(d, analysis, ch) }
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
    expect(f.text).not.toMatch(/reference/i)
  }
  expect(facts.filter((f) => f.id === BRACED_FRAME_MODEL_LIMITS_FACT_ID)).toHaveLength(1)
  expect(facts.at(-1)?.id).toBe(BRACED_FRAME_MODEL_LIMITS_FACT_ID)
}

describe('Property 8: grounded braced-frame facts', () => {
  it('holds for single-result and change facts', () => {
    assertProperty(
      fc.property(arbBracedFrameDesign(), arbBracedFrameDesign(), (a, b) => {
        const prev = tested(a)
        const next = tested(b)
        expectGrounded(prev.evaluation.facts)
        expectGrounded(explainBracedFrameChange(prev, next))
      }),
    )
  })
})
