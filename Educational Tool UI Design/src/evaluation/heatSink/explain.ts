import { formatBasis, SAME_MASS_TOL } from '../explain'
import type { ExplanationFact } from '../types'
import { HEAT_SINK_CONSTRAINT_ORDER } from './constraints'
import type { HeatSinkComparable, HeatSinkConstraintResult } from './types'

// Grounded heat sink explanation facts (task 48.2; HSK-15, MM-14). Same grounding rule as the
// beam (evaluation/explain.ts, Property 27): every number in a fact's `text` is
// `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and every basis
// value is copied from a stored analysis / constraint result, is a ratio of two such values, or
// (temperature only) is the absolute difference between a stored value and its limit. Labels and
// fixed sentences contain no digits. The beam and torsion fact generators are unchanged.

export const HEAT_SINK_MODEL_LIMITS_FACT_ID = 'model.idealizedHeatSink'

/** Rise ratio below which a same-mass change counts as a temperature drop (mirrors the beam's 0.98). */
export const RISE_DROP_RATIO = 0.98

/** The single idealized-model fact included in every heat sink evaluation. No numbers. */
export function heatSinkModelLimitsFact(): ExplanationFact {
  return {
    id: HEAT_SINK_MODEL_LIMITS_FACT_ID,
    text:
      'Based on the idealized plate-fin heat sink model with a given convection coefficient; ' +
      'effects such as airflow between the fins and radiation are not modeled.',
    basis: {},
  }
}

/** One fact per numeric constraint; see explainHeatSinkSingle for the wording per bound. */
function constraintFact(c: HeatSinkConstraintResult): ExplanationFact | null {
  if (![c.value, c.limit, c.utilization].every(Number.isFinite)) return null
  const where = c.passed ? 'within its limit' : 'over its limit'
  if (c.id === 'baseTemperature') {
    // A kelvin ratio is not meaningful to students; quote the distance from the limit instead.
    const marginK = Math.abs(c.limit - c.value)
    const side = c.value <= c.limit ? 'below' : 'above'
    return {
      id: `single.utilization.${c.id}`,
      text: `${c.label} is ${formatBasis(marginK)} K ${side} its limit in this model (${where}).`,
      basis: { value: c.value, limit: c.limit, marginK },
    }
  }
  if (c.bound === 'lower') {
    const ratio = c.value / c.limit
    return {
      id: `single.utilization.${c.id}`,
      text: `${c.label} is ${formatBasis(ratio)} times its minimum in this model (${c.passed ? 'meets its minimum' : 'below its minimum'}).`,
      basis: { value: c.value, limit: c.limit, ratio },
    }
  }
  return {
    id: `single.utilization.${c.id}`,
    text: `${c.label} is ${formatBasis(c.utilization)} times its limit in this model (${where}).`,
    basis: { value: c.value, limit: c.limit, utilization: c.utilization },
  }
}

/**
 * Facts for one evaluated result: one fact per numeric constraint (fixed order) whose value, limit
 * and utilization are finite, then exactly one model-limitation fact, last. Wording:
 *   baseTemperature  distance from the limit in kelvin (basis { value, limit, marginK })
 *   finGap           gap / minimum ratio (basis { value, limit, ratio })
 *   others           utilization (basis { value, limit, utilization })
 * The bool applicability constraint is reported by its pass flag only.
 */
export function explainHeatSinkSingle(constraints: readonly HeatSinkConstraintResult[]): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  for (const c of constraints) {
    if (c.unit === 'bool') continue
    const f = constraintFact(c)
    if (f) facts.push(f)
  }
  facts.push(heatSinkModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/**
 * Grounded facts for a prev → next change between two tested heat sinks, in a fixed order:
 *   1. `change.effectiveArea`   η_o·A_t and rise ratios (basis { rArea, rRise }), if both finite;
 *   2. `change.massAndRise`     mass and rise ratios (basis { rMass, rRise }), if both finite;
 *   3. `change.sameMass`        only if |rMass − 1| ≤ 0.02 and rRise < 0.98 (basis { rMass, rRise });
 *   4. `change.finEfficiency`   previous and next η_f (basis { prev, next }), if both finite and different;
 *   5. `change.constraint.<id>` per constraint whose pass state changed, fixed order, no numbers;
 *   6. `model.idealizedHeatSink` exactly once, last.
 * Reads stored values only; same inputs always give identical facts.
 */
export function explainHeatSinkChange(prev: HeatSinkComparable, next: HeatSinkComparable): ExplanationFact[] {
  const rArea = next.analysis.effectiveAreaM2 / prev.analysis.effectiveAreaM2
  const rRise = next.analysis.baseTemperatureRiseK / prev.analysis.baseTemperatureRiseK
  const rMass = next.analysis.massKg / prev.analysis.massKg
  const facts: ExplanationFact[] = []

  if (Number.isFinite(rArea) && Number.isFinite(rRise)) {
    facts.push({
      id: 'change.effectiveArea',
      text:
        `Effective surface area (fin-efficiency weighted) changed by ×${formatBasis(rArea)}; in this model, ` +
        `the convective part of the temperature rise scales inversely with it, so the base temperature rise ` +
        `changed by ×${formatBasis(rRise)}.`,
      basis: { rArea, rRise },
    })
  }

  if (Number.isFinite(rMass) && Number.isFinite(rRise)) {
    facts.push({
      id: 'change.massAndRise',
      text: `Mass changed by ×${formatBasis(rMass)} while the base temperature rise changed by ×${formatBasis(rRise)}.`,
      basis: { rMass, rRise },
    })
    if (Math.abs(rMass - 1) <= SAME_MASS_TOL && rRise < RISE_DROP_RATIO) {
      facts.push({
        id: 'change.sameMass',
        text:
          `Mass stayed about the same (×${formatBasis(rMass)}) while the base temperature rise dropped ` +
          `(×${formatBasis(rRise)}): in this model, the same metal was arranged into more useful fin surface.`,
        basis: { rMass, rRise },
      })
    }
  }

  const pEta = prev.analysis.finEfficiency
  const nEta = next.analysis.finEfficiency
  if (Number.isFinite(pEta) && Number.isFinite(nEta) && pEta !== nEta) {
    facts.push({
      id: 'change.finEfficiency',
      text: `Fin efficiency changed from ${formatBasis(pEta)} to ${formatBasis(nEta)}; in this model, fin efficiency falls as fins get taller or thinner.`,
      basis: { prev: pEta, next: nEta },
    })
  }

  for (const id of HEAT_SINK_CONSTRAINT_ORDER) {
    const p = prev.evaluation.constraints.find((c) => c.id === id)
    const n = next.evaluation.constraints.find((c) => c.id === id)
    if (!p || !n || p.passed === n.passed) continue
    facts.push({
      id: `change.constraint.${id}`,
      text: `${n.label}: ${passWord(p.passed)} → ${passWord(n.passed)}.`,
      basis: {},
    })
  }

  facts.push(heatSinkModelLimitsFact())
  return facts
}
