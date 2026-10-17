import { formatBasis, SAME_MASS_TOL, SECTION_KIND_NAMES } from '../explain'
import type { ExplanationFact } from '../types'
import { TORSION_CONSTRAINT_ORDER } from './constraints'
import type { TorsionComparable, TorsionConstraintResult } from './types'

// Grounded torsion explanation facts (task 47.2; TSH-15, MM-14). Same grounding rule as the
// beam (evaluation/explain.ts, Property 27): every number in a fact's `text` is
// `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and every basis
// value is copied from a stored analysis / constraint result or is a ratio of two such values.
// Labels and fixed sentences contain no digits. The beam fact generators are unchanged.

export const TORSION_MODEL_LIMITS_FACT_ID = 'model.idealizedShaft'

/** Twist ratio below which a same-mass change counts as a twist drop (mirrors the beam's 0.98). */
export const TWIST_DROP_RATIO = 0.98

/** The single idealized-model fact included in every torsion evaluation. No numbers. */
export function torsionModelLimitsFact(): ExplanationFact {
  return {
    id: TORSION_MODEL_LIMITS_FACT_ID,
    text: 'Based on the idealized shaft torsion model; effects such as stress concentrations and fatigue are not modeled.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result: one utilization fact per numeric constraint (fixed order) whose
 * value, limit and utilization are finite, then exactly one model-limitation fact, last. The bool
 * applicability constraint is reported by its pass flag only.
 */
export function explainShaftSingle(constraints: readonly TorsionConstraintResult[]): ExplanationFact[] {
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
  facts.push(torsionModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/**
 * Grounded facts for a prev → next change between two tested shafts, in a fixed order:
 *   1. `change.torsionalStiffness` J and twist ratios (basis { rJ, rTwist }), if both finite;
 *   2. `change.massAndTwist`       mass and twist ratios (basis { rMass, rTwist }), if both finite;
 *   3. `change.sameMass`           only if |rMass − 1| ≤ 0.02 and rTwist < 0.98 (basis { rMass, rTwist });
 *   4. `change.section`            if the section kind changed, no numbers;
 *   5. `change.constraint.<id>`    per constraint whose pass state changed, fixed order, no numbers;
 *   6. `model.idealizedShaft`      exactly once, last.
 * Reads stored values only; same inputs always give identical facts.
 */
export function explainTorsionChange(prev: TorsionComparable, next: TorsionComparable): ExplanationFact[] {
  const rJ = next.analysis.polarMomentM4 / prev.analysis.polarMomentM4
  const rTwist = next.analysis.twistRad / prev.analysis.twistRad
  const rMass = next.analysis.massKg / prev.analysis.massKg
  const facts: ExplanationFact[] = []

  if (Number.isFinite(rJ) && Number.isFinite(rTwist)) {
    facts.push({
      id: 'change.torsionalStiffness',
      text:
        // "inversely with J" rather than "1/J": a literal 1 would be an ungrounded number.
        `Polar moment (J) changed by ×${formatBasis(rJ)}; in this model, the angle of twist ` +
        `scales inversely with J, so twist changed by ×${formatBasis(rTwist)}.`,
      basis: { rJ, rTwist },
    })
  }

  if (Number.isFinite(rMass) && Number.isFinite(rTwist)) {
    facts.push({
      id: 'change.massAndTwist',
      text: `Mass changed by ×${formatBasis(rMass)} while the angle of twist changed by ×${formatBasis(rTwist)}.`,
      basis: { rMass, rTwist },
    })
    if (Math.abs(rMass - 1) <= SAME_MASS_TOL && rTwist < TWIST_DROP_RATIO) {
      facts.push({
        id: 'change.sameMass',
        text:
          `Mass stayed about the same (×${formatBasis(rMass)}) while twist dropped ` +
          `(×${formatBasis(rTwist)}): in this model, material moved farther from the shaft's axis.`,
        basis: { rMass, rTwist },
      })
    }
  }

  const pk = prev.designSnapshot.section.kind
  const nk = next.designSnapshot.section.kind
  if (pk !== nk) {
    facts.push({
      id: 'change.section',
      text: `Section changed from ${SECTION_KIND_NAMES[pk]} to ${SECTION_KIND_NAMES[nk]}.`,
      basis: {},
    })
  }

  for (const id of TORSION_CONSTRAINT_ORDER) {
    const p = prev.evaluation.constraints.find((c) => c.id === id)
    const n = next.evaluation.constraints.find((c) => c.id === id)
    if (!p || !n || p.passed === n.passed) continue
    facts.push({
      id: `change.constraint.${id}`,
      text: `${n.label}: ${passWord(p.passed)} → ${passWord(n.passed)}.`,
      basis: {},
    })
  }

  facts.push(torsionModelLimitsFact())
  return facts
}
