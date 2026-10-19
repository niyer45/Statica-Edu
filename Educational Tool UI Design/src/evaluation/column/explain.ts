import { COLUMN_SOURCE_NOTE } from '../../physics/column/constants'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { COLUMN_CONSTRAINT_ORDER } from './constraints'
import type { ColumnComparable, ColumnConstraintResult } from './types'

// Grounded column explanation facts (task 68; CBK-02, MM-14). Same grounding rule as the beam
// (evaluation/explain.ts, Property 27): every number in a fact's `text` is
// `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and every basis
// value is copied from a stored analysis or constraint, is a ratio of two such values, or (mass
// change) their difference. Labels and fixed sentences contain no digits.

export const COLUMN_MODEL_LIMITS_FACT_ID = 'model.idealizedColumn'

/** The single idealized-model fact included in every column evaluation. No numbers. */
export function columnModelLimitsFact(): ExplanationFact {
  return {
    id: COLUMN_MODEL_LIMITS_FACT_ID,
    text:
      'Based on an idealized straight column with ideal pins at both ends and a load along its axis: the ' +
      `${COLUMN_SOURCE_NOTE}. ` +
      'Real columns are slightly crooked and loaded slightly off-center, so they buckle below this load; inelastic buckling and local wall buckling are screened only.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result, in a fixed order:
 *   1. one fact per numeric constraint whose value, limit and utilization are finite: for the
 *      buckling minimum, how the critical load compares with the required load (basis { value,
 *      limit, ratio = value / limit }); for maxima, the utilization (basis { value, limit,
 *      utilization }); the bool applicability constraint is reported by its pass flag only;
 *   2. `single.stiffnessNotStrength`: when buckling fails while the axial stress passes, the
 *      lesson in words (basis { utilization } of the stress check);
 *   3. exactly one model-limitation fact, last.
 */
export function explainColumnSingle(constraints: readonly ColumnConstraintResult[]): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  for (const c of constraints) {
    if (c.unit === 'bool') continue
    if (![c.value, c.limit, c.utilization].every(Number.isFinite)) continue
    if (c.sense === 'min') {
      const ratio = c.value / c.limit
      if (!Number.isFinite(ratio)) continue
      const where = c.passed ? 'meets the requirement' : 'falls short of the requirement'
      facts.push({
        id: `single.utilization.${c.id}`,
        text: `${c.label} is ${formatBasis(ratio)} times the required value in this model (${where}).`,
        basis: { value: c.value, limit: c.limit, ratio },
      })
      continue
    }
    const where = c.passed ? 'within its limit' : 'over its limit'
    facts.push({
      id: `single.utilization.${c.id}`,
      text: `${c.label} is ${formatBasis(c.utilization)} times its limit in this model (${where}).`,
      basis: { value: c.value, limit: c.limit, utilization: c.utilization },
    })
  }
  const buckling = constraints.find((c) => c.id === 'buckling')
  const stress = constraints.find((c) => c.id === 'axialStress')
  if (buckling && stress && !buckling.passed && stress.passed && Number.isFinite(stress.utilization)) {
    facts.push({
      id: 'single.stiffnessNotStrength',
      text: `The column buckles although its axial stress is only ${formatBasis(stress.utilization)} times the allowable: it is strong enough but not stiff enough.`,
      basis: { utilization: stress.utilization },
    })
  }
  facts.push(columnModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/** Ratio of two stored values, or undefined when it is not finite. */
function ratio(next: number, prev: number): number | undefined {
  const r = next / prev
  return Number.isFinite(r) ? r : undefined
}

/**
 * Grounded facts for a prev → next change between two tested columns, in a fixed order:
 *   1. `change.criticalLoad`   critical load ratio (basis { rLoad });
 *   2. `change.secondMoment`   second-moment ratio; with the length fixed the critical load follows
 *                              it exactly (basis { rI });
 *   3. `change.area`           area ratio (basis { rArea });
 *   4. `change.loadPerMass`    critical load per kilogram ratio (basis { rPerKg });
 *   5. `change.mass`           mass change in kilograms (basis { deltaMassKg });
 *   6. `change.constraint.<id>` per constraint whose pass state changed, fixed order, no numbers;
 *   7. `model.idealizedColumn` exactly once, last.
 * Each numeric fact is omitted when its value is not finite. Reads stored values only; the same
 * inputs always give identical facts.
 */
export function explainColumnChange(prev: ColumnComparable, next: ColumnComparable): ExplanationFact[] {
  const p = prev.analysis
  const n = next.analysis
  const facts: ExplanationFact[] = []

  const rLoad = ratio(n.criticalLoadN, p.criticalLoadN)
  if (rLoad !== undefined) {
    facts.push({ id: 'change.criticalLoad', text: `Critical buckling load changed by ×${formatBasis(rLoad)}.`, basis: { rLoad } })
  }
  const rI = ratio(n.secondMomentM4, p.secondMomentM4)
  if (rI !== undefined) {
    facts.push({
      id: 'change.secondMoment',
      text: `Second moment of area changed by ×${formatBasis(rI)}; with the length fixed, the critical load follows it exactly.`,
      basis: { rI },
    })
  }
  const rArea = ratio(n.areaM2, p.areaM2)
  if (rArea !== undefined) {
    facts.push({ id: 'change.area', text: `Cross-section area changed by ×${formatBasis(rArea)}, and the mass with it.`, basis: { rArea } })
  }
  const rPerKg = ratio(n.criticalLoadPerMassNPerKg, p.criticalLoadPerMassNPerKg)
  if (rPerKg !== undefined) {
    facts.push({
      id: 'change.loadPerMass',
      text: `Critical load per kilogram changed by ×${formatBasis(rPerKg)}: material farther from the center buys more buckling resistance.`,
      basis: { rPerKg },
    })
  }
  const deltaMassKg = n.massKg - p.massKg
  if (Number.isFinite(deltaMassKg)) {
    const sign = deltaMassKg > 0 && formatBasis(deltaMassKg) !== '0.00' ? '+' : ''
    facts.push({ id: 'change.mass', text: `Mass changed by ${sign}${formatBasis(deltaMassKg)} kg.`, basis: { deltaMassKg } })
  }

  for (const id of COLUMN_CONSTRAINT_ORDER) {
    const pc = prev.evaluation.constraints.find((c) => c.id === id)
    const nc = next.evaluation.constraints.find((c) => c.id === id)
    if (!pc || !nc || pc.passed === nc.passed) continue
    facts.push({ id: `change.constraint.${id}`, text: `${nc.label}: ${passWord(pc.passed)} → ${passWord(nc.passed)}.`, basis: {} })
  }

  facts.push(columnModelLimitsFact())
  return facts
}
