import type { VibrationChallenge } from '../../challenge/vibration/types'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { VIBRATION_CONSTRAINT_ORDER } from './constraints'
import type { VibrationComparable, VibrationConstraintResult } from './types'

// Grounded vibration explanation facts (task 50.2; design.md "Explanation facts", MM-14). Same
// grounding rule as the beam (evaluation/explain.ts, Property 27): every number in a fact's
// `text` is `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and
// every basis value is copied from a stored analysis / constraint result or is a ratio of two
// such values. Labels, fixed sentences and material names (loader rule) contain no digits.

export const VIBRATION_MODEL_LIMITS_FACT_ID = 'model.idealizedIsolator'

/** The single idealized-model fact included in every vibration evaluation. No numbers. */
export function vibrationModelLimitsFact(): ExplanationFact {
  return {
    id: VIBRATION_MODEL_LIMITS_FACT_ID,
    text:
      'Based on the idealized single-degree-of-freedom steady-state vibration model; effects such as ' +
      'rocking modes, run-up transients and elastomer stiffening are not modeled.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result: one utilization fact per numeric constraint (fixed order) whose
 * value, limit and utilization are finite, then exactly one model-limitation fact, last. The bool
 * applicability constraint is reported by its pass flag only.
 */
export function explainIsolatorSingle(constraints: readonly VibrationConstraintResult[]): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  for (const c of constraints) {
    if (c.unit === 'bool') continue
    if (![c.value, c.limit, c.utilization].every(Number.isFinite)) continue
    const where = c.passed ? 'within its limit' : 'over its limit'
    facts.push({
      id: `single.utilization.${c.id}`,
      text: `${c.label} is ${formatBasis(c.utilization)} times its limit in this model (${where}).`,
      basis: { value: c.value, limit: c.limit, utilization: c.utilization },
    })
  }
  facts.push(vibrationModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/**
 * Grounded facts for a prev → next change between two tested isolators, in a fixed order:
 *   1. `change.naturalFrequency` stiffness and f_n ratios (basis { rK, rFn }), if both finite;
 *   2. `change.staticDeflection` δ_st ratio (basis { rSag }), if finite;
 *   3. `change.worstInBand`      worst in-band TR ratio (basis { rTr }), if finite;
 *   4. `change.material`         if the damping ratio changed: material names and both ζ values
 *                                (basis { prevZeta, nextZeta });
 *   5. `change.constraint.<id>`  per constraint whose pass state changed, fixed order, no numbers;
 *   6. `model.idealizedIsolator` exactly once, last.
 * Reads stored values only (material names from the challenge); same inputs always give identical
 * facts.
 */
export function explainVibrationChange(
  prev: VibrationComparable,
  next: VibrationComparable,
  ch: Pick<VibrationChallenge, 'materials'>,
): ExplanationFact[] {
  const pa = prev.analysis
  const na = next.analysis
  const rK = na.stiffnessNPerM / pa.stiffnessNPerM
  const rFn = na.naturalFrequencyHz / pa.naturalFrequencyHz
  const rSag = na.staticDeflectionM / pa.staticDeflectionM
  const rTr = na.worstInBandTransmissibility / pa.worstInBandTransmissibility
  const facts: ExplanationFact[] = []

  if (Number.isFinite(rK) && Number.isFinite(rFn)) {
    facts.push({
      id: 'change.naturalFrequency',
      text:
        `Stiffness changed by ×${formatBasis(rK)}; in this model, the natural frequency scales with ` +
        `the square root of stiffness, so it changed by ×${formatBasis(rFn)}.`,
      basis: { rK, rFn },
    })
  }

  if (Number.isFinite(rSag)) {
    facts.push({
      id: 'change.staticDeflection',
      text: `Static deflection (sag) changed by ×${formatBasis(rSag)}; in this model, sag scales inversely with stiffness.`,
      basis: { rSag },
    })
  }

  if (Number.isFinite(rTr)) {
    facts.push({
      id: 'change.worstInBand',
      text: `The worst vibration transmitted in the operating band changed by ×${formatBasis(rTr)}.`,
      basis: { rTr },
    })
  }

  const prevZeta = pa.dampingRatio
  const nextZeta = na.dampingRatio
  if (Number.isFinite(prevZeta) && Number.isFinite(nextZeta) && prevZeta !== nextZeta) {
    const name = (id: string) => ch.materials.find((m) => m.id === id)?.name ?? 'another material'
    facts.push({
      id: 'change.material',
      text:
        `Mount material changed from ${name(prev.designSnapshot.materialId)} to ${name(next.designSnapshot.materialId)}: ` +
        `damping ratio ${formatBasis(prevZeta)} → ${formatBasis(nextZeta)}.`,
      basis: { prevZeta, nextZeta },
    })
  }

  for (const id of VIBRATION_CONSTRAINT_ORDER) {
    const p = prev.evaluation.constraints.find((c) => c.id === id)
    const n = next.evaluation.constraints.find((c) => c.id === id)
    if (!p || !n || p.passed === n.passed) continue
    facts.push({
      id: `change.constraint.${id}`,
      text: `${n.label}: ${passWord(p.passed)} → ${passWord(n.passed)}.`,
      basis: {},
    })
  }

  facts.push(vibrationModelLimitsFact())
  return facts
}
