import { BRACKET_KT_SOURCE_NOTE } from '../../physics/bracket/constants'
import type { BracketAnalysis } from '../../physics/bracket/types'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { BRACKET_CONSTRAINT_ORDER } from './constraints'
import type { BracketComparable, BracketConstraintResult } from './types'

// Grounded bracket explanation facts (task 46.2; MBR-03, MBR-12, MBR-19, MBR-20, MM-14). Same
// grounding rule as the beam (evaluation/explain.ts, Property 27): every number in a fact's
// `text` is `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and
// every basis value is copied from a stored analysis, is a ratio of two such values, or (mass
// change) their difference in grams. Labels and fixed sentences contain no digits. The beam fact
// generators are unchanged.

export const BRACKET_MODEL_LIMITS_FACT_ID = 'model.idealizedBracket'

/**
 * The single idealized-model fact included in every bracket evaluation. No numbers. It discloses
 * that the Kt coefficients come from secondary copies pending printed-edition verification
 * (MBR-20, D-41) and that Kt is a local elastic peak (MBR-03).
 */
export function bracketModelLimitsFact(): ExplanationFact {
  return {
    id: BRACKET_MODEL_LIMITS_FACT_ID,
    text:
      'Based on the idealized stepped-bar bending model, using ' +
      `${BRACKET_KT_SOURCE_NOTE}. Kt is a local elastic peak at the fillet; it does not change ` +
      'the moment, the deflection or the root stress. Effects such as fatigue and clamp or bolt-hole stress concentrations are not modeled.',
    basis: {},
  }
}

/** MBR-12 summary wording for a uniform bar. */
export const NO_STEP_TEXT = 'No step: stress concentration not applied.'

/**
 * Facts for one evaluated result, in a fixed order:
 *   1. one utilization fact per numeric constraint whose value, limit and utilization are finite
 *      (an absent peak stress has none); the bool applicability constraint is reported by its
 *      pass flag only;
 *   2. `single.peakLocation` when a peak stress exists (no numbers);
 *   3. `single.noStep` for a uniform bar, or `single.ktFitUndefined` when the fit does not cover
 *      the step (no numbers);
 *   4. exactly one model-limitation fact, last.
 */
export function explainBracketSingle(
  constraints: readonly BracketConstraintResult[],
  a: Pick<BracketAnalysis, 'status' | 'peakLocation' | 'stepNominalStressPa'>,
): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  for (const c of constraints) {
    if (c.unit === 'bool' || c.value === undefined || c.utilization === undefined) continue
    if (![c.value, c.limit, c.utilization].every(Number.isFinite)) continue
    const where = c.passed ? 'within its limit' : 'over its limit'
    facts.push({
      id: `single.utilization.${c.id}`,
      text: `${c.label} is ${formatBasis(c.utilization)} times its limit in this model (${where}).`,
      basis: { value: c.value, limit: c.limit, utilization: c.utilization },
    })
  }
  if (a.peakLocation !== undefined) {
    facts.push({
      id: 'single.peakLocation',
      text:
        a.peakLocation === 'step'
          ? 'The peak stress is at the step, where the fillet concentrates the local bending stress.'
          : 'The peak stress is at the root, where the bending moment is largest.',
      basis: {},
    })
  }
  if (a.stepNominalStressPa === undefined) {
    facts.push({ id: 'single.noStep', text: NO_STEP_TEXT, basis: {} })
  } else if (a.status === 'ktFitUndefined') {
    facts.push({
      id: 'single.ktFitUndefined',
      text: 'The shoulder-fillet curve fit does not cover this step, so Kt and the peak stress are not computed.',
      basis: {},
    })
  }
  facts.push(bracketModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')
const LOCATION_NAMES = { root: 'the root', step: 'the step' } as const

/** Ratio of two optional stored values, or undefined when either is absent or non-finite. */
function ratio(next: number | undefined, prev: number | undefined): number | undefined {
  if (next === undefined || prev === undefined) return undefined
  const r = next / prev
  return Number.isFinite(r) ? r : undefined
}

/**
 * Grounded facts for a prev → next change between two tested brackets, in a fixed order:
 *   1. `change.peakLocation`  if both locations exist and differ, no numbers;
 *   2. `change.kt`            Kt ratio (basis { rKt }), if both Kt values exist;
 *   3. `change.stepNominal`   step nominal stress ratio (basis { rStepNominal }), if both exist;
 *   4. `change.peakStress`    peak stress ratio (basis { rPeak }), if both exist;
 *   5. `change.mass`          mass change in grams (basis { deltaMassG }), if finite;
 *   6. `change.constraint.<id>` per constraint whose pass state changed, fixed order, no numbers;
 *   7. `model.idealizedBracket` exactly once, last.
 * Reads stored values only; same inputs always give identical facts.
 */
export function explainBracketChange(prev: BracketComparable, next: BracketComparable): ExplanationFact[] {
  const p = prev.analysis
  const n = next.analysis
  const facts: ExplanationFact[] = []

  if (p.peakLocation !== undefined && n.peakLocation !== undefined && p.peakLocation !== n.peakLocation) {
    facts.push({
      id: 'change.peakLocation',
      text: `The peak stress moved from ${LOCATION_NAMES[p.peakLocation]} to ${LOCATION_NAMES[n.peakLocation]}.`,
      basis: {},
    })
  }

  const rKt = ratio(n.ktStep, p.ktStep)
  if (rKt !== undefined) {
    facts.push({
      id: 'change.kt',
      text: `Kt at the step changed by ×${formatBasis(rKt)}; in this model Kt depends only on the fillet radius and the two depths.`,
      basis: { rKt },
    })
  }

  const rStepNominal = ratio(n.stepNominalStressPa, p.stepNominalStressPa)
  if (rStepNominal !== undefined) {
    facts.push({
      id: 'change.stepNominal',
      text:
        `Nominal stress at the step changed by ×${formatBasis(rStepNominal)}; it follows the bending moment ` +
        'at the shoulder, which falls toward the tip, and the arm depth.',
      basis: { rStepNominal },
    })
  }

  const rPeak = ratio(n.peakStressPa, p.peakStressPa)
  if (rPeak !== undefined) {
    facts.push({
      id: 'change.peakStress',
      text: `Peak stress changed by ×${formatBasis(rPeak)}.`,
      basis: { rPeak },
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
