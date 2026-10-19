import { FATIGUE_SOURCE_NOTE } from '../../physics/fatigue/constants'
import type { FatigueAnalysis } from '../../physics/fatigue/types'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { FATIGUE_CONSTRAINT_ORDER } from './constraints'
import type { FatigueComparable, FatigueConstraintResult } from './types'

// Grounded fatigue explanation facts (task 70; MM-14). Same grounding rule as the beam
// (evaluation/explain.ts, Property 27): every number in a fact's `text` is `formatBasis(v)` of a
// finite value stored in that fact's `basis`, and every basis value is copied from a stored
// analysis/evaluation or is a ratio of two such values (mass change: their difference in grams).
// Labels and fixed sentences contain no digits.

export const FATIGUE_MODEL_LIMITS_FACT_ID = 'model.idealizedFatigue'

/** The single model-limitation fact included in every fatigue evaluation. No numbers. */
export function fatigueModelLimitsFact(): ExplanationFact {
  return {
    id: FATIGUE_MODEL_LIMITS_FACT_ID,
    text:
      `Based on ${FATIGUE_SOURCE_NOTE}. ` +
      'These are screening estimates with real scatter, not a certification; corrosion, temperature, residual stresses, variable loads and other stress raisers are not modeled.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result, in a fixed order:
 *   1. one utilization fact per numeric constraint with finite value, limit and utilization;
 *   2. `single.notch`: Kt and Kf (basis { kt, kf });
 *   3. `single.life`: the life regime, with the predicted cycles when finite (basis { cycles });
 *   4. exactly one model-limitation fact, last.
 */
export function explainFatigueSingle(constraints: readonly FatigueConstraintResult[], a: Pick<FatigueAnalysis, 'stressConcentrationKt' | 'fatigueNotchFactorKf' | 'lifeRegime' | 'predictedLifeCycles'>): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  for (const c of constraints) {
    if (c.unit === 'bool') continue
    if (![c.value, c.limit, c.utilization].every(Number.isFinite)) continue
    const where = c.passed ? 'within its limit' : 'past its limit'
    const text =
      c.bound === 'lower'
        ? `${c.label}: the required minimum is ${formatBasis(c.utilization)} times this design's value in this model (${where}).`
        : `${c.label} is ${formatBasis(c.utilization)} times its limit in this model (${where}).`
    facts.push({
      id: `single.utilization.${c.id}`,
      text,
      basis: { value: c.value, limit: c.limit, utilization: c.utilization },
    })
  }
  if (Number.isFinite(a.stressConcentrationKt) && Number.isFinite(a.fatigueNotchFactorKf)) {
    facts.push({
      id: 'single.notch',
      text: `The fillet raises the stress by Kt ${formatBasis(a.stressConcentrationKt)} in theory; with the material's notch sensitivity the fatigue notch factor is Kf ${formatBasis(a.fatigueNotchFactorKf)}.`,
      basis: { kt: a.stressConcentrationKt, kf: a.fatigueNotchFactorKf },
    })
  }
  if (a.lifeRegime === 'finite' && a.predictedLifeCycles !== undefined && Number.isFinite(a.predictedLifeCycles)) {
    const thousands = a.predictedLifeCycles / 1000
    facts.push({
      id: 'single.life',
      text: `The S-N line predicts failure after about ${formatBasis(thousands)} thousand cycles at this stress.`,
      basis: { thousandCycles: thousands },
    })
  } else if (a.lifeRegime === 'infinite') {
    facts.push({ id: 'single.life', text: 'The equivalent reversed stress is at or below the endurance limit, so this model predicts no fatigue failure.', basis: {} })
  }
  facts.push(fatigueModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

function ratio(next: number, prev: number): number | undefined {
  const r = next / prev
  return Number.isFinite(r) ? r : undefined
}

/**
 * Grounded facts for a prev → next change between two tested spindles, in a fixed order:
 *   1. `change.kf`        Kf ratio (basis { rKf });
 *   2. `change.endurance` endurance-limit ratio (basis { rSe });
 *   3. `change.stress`    alternating local stress ratio (basis { rStress });
 *   4. `change.fatigue`   fatigue safety factor ratio (basis { rFatigue });
 *   5. `change.mass`      mass change in grams (basis { deltaMassG });
 *   6. `change.constraint.<id>` per constraint whose pass state changed, no numbers;
 *   7. the model-limitation fact, last.
 */
export function explainFatigueChange(prev: FatigueComparable, next: FatigueComparable): ExplanationFact[] {
  const p = prev.analysis
  const n = next.analysis
  const facts: ExplanationFact[] = []
  const rKf = ratio(n.fatigueNotchFactorKf, p.fatigueNotchFactorKf)
  if (rKf !== undefined) facts.push({ id: 'change.kf', text: `The fatigue notch factor at the fillet changed by ×${formatBasis(rKf)}; it follows the fillet radius and the size of the step.`, basis: { rKf } })
  const rSe = ratio(n.enduranceLimitPa, p.enduranceLimitPa)
  if (rSe !== undefined) facts.push({ id: 'change.endurance', text: `The endurance limit changed by ×${formatBasis(rSe)}; it follows the surface finish and, slightly, the neck diameter.`, basis: { rSe } })
  const rStress = ratio(n.alternatingStressPa, p.alternatingStressPa)
  if (rStress !== undefined) facts.push({ id: 'change.stress', text: `The alternating stress at the fillet changed by ×${formatBasis(rStress)}.`, basis: { rStress } })
  const rFatigue = ratio(n.fatigueSafetyFactor, p.fatigueSafetyFactor)
  if (rFatigue !== undefined) facts.push({ id: 'change.fatigue', text: `The fatigue safety factor changed by ×${formatBasis(rFatigue)}.`, basis: { rFatigue } })
  const deltaMassG = (n.massKg - p.massKg) * 1000
  if (Number.isFinite(deltaMassG)) {
    const sign = deltaMassG > 0 && formatBasis(deltaMassG) !== '0.00' ? '+' : ''
    facts.push({ id: 'change.mass', text: `Mass changed by ${sign}${formatBasis(deltaMassG)} g.`, basis: { deltaMassG } })
  }
  for (const id of FATIGUE_CONSTRAINT_ORDER) {
    const pc = prev.evaluation.constraints.find((c) => c.id === id)
    const nc = next.evaluation.constraints.find((c) => c.id === id)
    if (!pc || !nc || pc.passed === nc.passed) continue
    facts.push({ id: `change.constraint.${id}`, text: `${nc.label}: ${passWord(pc.passed)} → ${passWord(nc.passed)}.`, basis: {} })
  }
  facts.push(fatigueModelLimitsFact())
  return facts
}
