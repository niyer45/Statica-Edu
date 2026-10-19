import { VESSEL_SOURCE_NOTE } from '../../physics/vessel/constants'
import type { VesselAnalysis } from '../../physics/vessel/types'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { VESSEL_CONSTRAINT_ORDER } from './constraints'
import type { VesselComparable, VesselConstraintResult } from './types'

// Grounded pressure vessel explanation facts (task 69; MM-14). Same grounding rule as the beam
// (evaluation/explain.ts, Property 27): every number in a fact's `text` is
// `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and every basis
// value is copied from a stored analysis, is a ratio of two such values, or (mass change) their
// difference. Labels and fixed sentences contain no digits.

export const VESSEL_MODEL_LIMITS_FACT_ID = 'model.idealizedVessel'

/** The single idealized-model fact included in every vessel evaluation. No numbers. */
export function vesselModelLimitsFact(): ExplanationFact {
  return {
    id: VESSEL_MODEL_LIMITS_FACT_ID,
    text:
      `Based on an idealized pressure vessel model: ${VESSEL_SOURCE_NOTE}. ` +
      'Stresses where the heads meet the shell, welds, nozzles, corrosion, supports and fatigue are not modeled, and this is not a pressure-vessel code check.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result, in a fixed order:
 *   1. one utilization fact per numeric constraint whose value, limit and utilization are finite
 *      (a maximum reports value ÷ limit, the volume minimum reports value ÷ required); the bool
 *      applicability constraint is reported by its pass flag only;
 *   2. `single.hoopToLongitudinal`: the stored hoop ÷ longitudinal ratio (basis { ratio });
 *   3. `single.headToHoop`: the stored head ÷ hoop ratio (basis { ratio });
 *   4. exactly one model-limitation fact, last.
 */
export function explainVesselSingle(
  constraints: readonly VesselConstraintResult[],
  a: Pick<VesselAnalysis, 'hoopStressPa' | 'longitudinalStressPa' | 'headStressPa'>,
): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  for (const c of constraints) {
    if (c.unit === 'bool') continue
    if (![c.value, c.limit, c.utilization].every(Number.isFinite)) continue
    if (c.bound === 'min') {
      const ratio = c.value / c.limit
      if (!Number.isFinite(ratio)) continue
      facts.push({
        id: `single.utilization.${c.id}`,
        text: `${c.label} is ${formatBasis(ratio)} times the required minimum in this model (${c.passed ? 'enough' : 'too small'}).`,
        basis: { value: c.value, limit: c.limit, ratio },
      })
      continue
    }
    facts.push({
      id: `single.utilization.${c.id}`,
      text: `${c.label} is ${formatBasis(c.utilization)} times its limit in this model (${c.passed ? 'within its limit' : 'over its limit'}).`,
      basis: { value: c.value, limit: c.limit, utilization: c.utilization },
    })
  }
  const hoopToLongitudinal = a.hoopStressPa / a.longitudinalStressPa
  if (Number.isFinite(hoopToLongitudinal)) {
    facts.push({
      id: 'single.hoopToLongitudinal',
      text: `The hoop stress is ×${formatBasis(hoopToLongitudinal)} the longitudinal stress, so the hoop stress governs the shell.`,
      basis: { ratio: hoopToLongitudinal },
    })
  }
  const headToHoop = a.headStressPa / a.hoopStressPa
  if (Number.isFinite(headToHoop)) {
    facts.push({
      id: 'single.headToHoop',
      text: `The head stress is ×${formatBasis(headToHoop)} the hoop stress; a hemispherical head carries the same pressure at half the stress of a shell with the same wall.`,
      basis: { ratio: headToHoop },
    })
  }
  facts.push(vesselModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/** Ratio of two stored values, or undefined when it is not finite. */
function ratio(next: number, prev: number): number | undefined {
  const r = next / prev
  return Number.isFinite(r) ? r : undefined
}

/**
 * Grounded facts for a prev → next change between two tested vessels, in a fixed order:
 *   1. `change.hoopStress`   hoop stress ratio (basis { rHoop });
 *   2. `change.headStress`   head stress ratio (basis { rHead });
 *   3. `change.volume`       volume ratio (basis { rVolume });
 *   4. `change.mass`         mass change in kilograms (basis { deltaMassKg });
 *   5. `change.constraint.<id>` per constraint whose pass state changed, fixed order, no numbers;
 *   6. `model.idealizedVessel` exactly once, last.
 * Each numeric fact is omitted when its value is not finite. Reads stored values only; the same
 * inputs always give identical facts.
 */
export function explainVesselChange(prev: VesselComparable, next: VesselComparable): ExplanationFact[] {
  const p = prev.analysis
  const n = next.analysis
  const facts: ExplanationFact[] = []

  const rHoop = ratio(n.hoopStressPa, p.hoopStressPa)
  if (rHoop !== undefined) {
    facts.push({
      id: 'change.hoopStress',
      text: `Hoop stress changed by ×${formatBasis(rHoop)}; it grows with the radius and falls with the shell thickness.`,
      basis: { rHoop },
    })
  }

  const rHead = ratio(n.headStressPa, p.headStressPa)
  if (rHead !== undefined) {
    facts.push({
      id: 'change.headStress',
      text: `Head stress changed by ×${formatBasis(rHead)}; it grows with the radius and falls with the head thickness.`,
      basis: { rHead },
    })
  }

  const rVolume = ratio(n.volumeM3, p.volumeM3)
  if (rVolume !== undefined) {
    facts.push({
      id: 'change.volume',
      text: `Internal volume changed by ×${formatBasis(rVolume)}.`,
      basis: { rVolume },
    })
  }

  const deltaMassKg = n.massKg - p.massKg
  if (Number.isFinite(deltaMassKg)) {
    const sign = deltaMassKg > 0 && formatBasis(deltaMassKg) !== '0.00' ? '+' : ''
    facts.push({
      id: 'change.mass',
      text: `Mass changed by ${sign}${formatBasis(deltaMassKg)} kg.`,
      basis: { deltaMassKg },
    })
  }

  for (const id of VESSEL_CONSTRAINT_ORDER) {
    const pc = prev.evaluation.constraints.find((c) => c.id === id)
    const nc = next.evaluation.constraints.find((c) => c.id === id)
    if (!pc || !nc || pc.passed === nc.passed) continue
    facts.push({
      id: `change.constraint.${id}`,
      text: `${nc.label}: ${passWord(pc.passed)} → ${passWord(nc.passed)}.`,
      basis: {},
    })
  }

  facts.push(vesselModelLimitsFact())
  return facts
}
