import { BRACKET_SOURCE_NOTE } from '../../physics/bracket/constants'
import type { BracketAnalysis } from '../../physics/bracket/types'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { BRACKET_CONSTRAINT_ORDER } from './constraints'
import type { BracketComparable, BracketConstraintResult } from './types'

// Grounded bracket explanation facts (task 55 L-bracket; MM-14). Same grounding rule as the beam
// (evaluation/explain.ts, Property 27): every number in a fact's `text` is
// `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and every basis
// value is copied from a stored analysis, is a ratio of two such values, or (mass change) their
// difference in grams. Labels and fixed sentences contain no digits. The beam fact generators are
// unchanged.

export const BRACKET_MODEL_LIMITS_FACT_ID = 'model.idealizedBracket'

/** The single idealized-model fact included in every bracket evaluation. No numbers. */
export function bracketModelLimitsFact(): ExplanationFact {
  return {
    id: BRACKET_MODEL_LIMITS_FACT_ID,
    text:
      'Based on an idealized bolted L-bracket model: statics for the bend moment and the bolt tension, the ' +
      `${BRACKET_SOURCE_NOTE}, and beam deflection for the arm and flange. ` +
      'Bolt preload, prying from flange flexibility, the wall fixing, bolt-hole stress concentrations and fatigue are not modeled.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result, in a fixed order:
 *   1. one utilization fact per numeric constraint whose value, limit and utilization are finite;
 *      the bool applicability constraint is reported by its pass flag only;
 *   2. `single.curvedBeam`: how much the inner bend raises the stress over the straight-beam value
 *      (basis { curvedBeamFactor }), when finite;
 *   3. exactly one model-limitation fact, last.
 */
export function explainBracketSingle(
  constraints: readonly BracketConstraintResult[],
  a: Pick<BracketAnalysis, 'curvedBeamFactor'>,
): ExplanationFact[] {
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
  if (Number.isFinite(a.curvedBeamFactor)) {
    facts.push({
      id: 'single.curvedBeam',
      text: `The inner bend raises the bending stress to ×${formatBasis(a.curvedBeamFactor)} the straight-beam value; a larger inner radius relative to the thickness lowers this factor.`,
      basis: { curvedBeamFactor: a.curvedBeamFactor },
    })
  }
  facts.push(bracketModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/** Ratio of two stored values, or undefined when it is not finite. */
function ratio(next: number, prev: number): number | undefined {
  const r = next / prev
  return Number.isFinite(r) ? r : undefined
}

/**
 * Grounded facts for a prev → next change between two tested brackets, in a fixed order:
 *   1. `change.curvedBeam`   curved-beam factor ratio (basis { rFactor });
 *   2. `change.bendStress`   bend stress ratio (basis { rStress });
 *   3. `change.boltTension`  bolt tension ratio (basis { rBolt });
 *   4. `change.deflection`   deflection ratio (basis { rDeflection });
 *   5. `change.mass`         mass change in grams (basis { deltaMassG });
 *   6. `change.constraint.<id>` per constraint whose pass state changed, fixed order, no numbers;
 *   7. `model.idealizedBracket` exactly once, last.
 * Each numeric fact is omitted when its value is not finite. Reads stored values only; the same
 * inputs always give identical facts.
 */
export function explainBracketChange(prev: BracketComparable, next: BracketComparable): ExplanationFact[] {
  const p = prev.analysis
  const n = next.analysis
  const facts: ExplanationFact[] = []

  const rFactor = ratio(n.curvedBeamFactor, p.curvedBeamFactor)
  if (rFactor !== undefined) {
    facts.push({
      id: 'change.curvedBeam',
      text: `The curved-beam factor at the bend changed by ×${formatBasis(rFactor)}; it depends only on the inner radius relative to the thickness.`,
      basis: { rFactor },
    })
  }

  const rStress = ratio(n.bendStressPa, p.bendStressPa)
  if (rStress !== undefined) {
    facts.push({
      id: 'change.bendStress',
      text: `Bend stress changed by ×${formatBasis(rStress)}.`,
      basis: { rStress },
    })
  }

  const rBolt = ratio(n.boltTensionN, p.boltTensionN)
  if (rBolt !== undefined) {
    facts.push({
      id: 'change.boltTension',
      text: `Bolt tension changed by ×${formatBasis(rBolt)}; it follows the distance from the heel to the bolt row.`,
      basis: { rBolt },
    })
  }

  const rDeflection = ratio(n.deflectionM, p.deflectionM)
  if (rDeflection !== undefined) {
    facts.push({
      id: 'change.deflection',
      text: `Deflection at the load changed by ×${formatBasis(rDeflection)}.`,
      basis: { rDeflection },
    })
  }

  const deltaMassG = (n.massKg - p.massKg) * 1000
  if (Number.isFinite(deltaMassG)) {
    const sign = deltaMassG > 0 && formatBasis(deltaMassG) !== '0.00' ? '+' : ''
    facts.push({
      id: 'change.mass',
      text: `Mass changed by ${sign}${formatBasis(deltaMassG)} g.`,
      basis: { deltaMassG },
    })
  }

  for (const id of BRACKET_CONSTRAINT_ORDER) {
    const pc = prev.evaluation.constraints.find((c) => c.id === id)
    const nc = next.evaluation.constraints.find((c) => c.id === id)
    if (!pc || !nc || pc.passed === nc.passed) continue
    facts.push({
      id: `change.constraint.${id}`,
      text: `${nc.label}: ${passWord(pc.passed)} → ${passWord(nc.passed)}.`,
      basis: {},
    })
  }

  facts.push(bracketModelLimitsFact())
  return facts
}
