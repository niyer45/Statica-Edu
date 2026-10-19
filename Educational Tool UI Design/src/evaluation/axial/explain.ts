import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { AXIAL_CONSTRAINT_ORDER } from './constraints'
import type { AxialComparable, AxialConstraintResult } from './types'

// Grounded Stress and Strain I explanation facts (task 72; SSR-16, MM-14). Same grounding rule as
// the beam (evaluation/explain.ts, Property 27): every number in a fact's `text` is
// `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and every basis
// value is copied from a stored analysis / constraint result or is a ratio of two such values.
// Labels, material short names (digit-free, loader rule) and fixed sentences contain no digits.

export const AXIAL_MODEL_LIMITS_FACT_ID = 'model.idealizedRod'

/** The single idealized-model fact included in every evaluation. No numbers. */
export function axialModelLimitsFact(): ExplanationFact {
  return {
    id: AXIAL_MODEL_LIMITS_FACT_ID,
    text: 'Based on the idealized linear-elastic rod model; yielding, stress concentrations at the end fittings and fatigue are not modeled.',
    basis: {},
  }
}

/**
 * Facts for one evaluated result: one utilization fact per numeric check (fixed order) whose
 * value, limit and utilization are finite, then exactly one model-limitation fact, last.
 */
export function explainRodSingle(constraints: readonly AxialConstraintResult[]): ExplanationFact[] {
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
  facts.push(axialModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/**
 * Grounded facts for a prev → next change between two tested rods, in a fixed order:
 *   1. `change.areaAndStress`        area and stress ratios (basis { rArea, rStress }), if both finite;
 *   2. `change.stiffnessAndStretch`  E and elongation ratios (basis { rModulus, rStretch }), if both finite;
 *   3. `change.mass`                 mass ratio (basis { rMass }), if finite;
 *   4. `change.material`             if the material changed, named by short names, no numbers;
 *   5. `change.constraint.<id>`      per check whose pass state changed, fixed order, no numbers;
 *   6. `model.idealizedRod`          exactly once, last.
 * `names` maps material ids to digit-free short names. Reads stored values only.
 */
export function explainRodChange(prev: AxialComparable, next: AxialComparable, names: (materialId: string) => string): ExplanationFact[] {
  const rArea = next.analysis.areaM2 / prev.analysis.areaM2
  const rStress = next.analysis.stressPa / prev.analysis.stressPa
  const rModulus = next.analysis.elasticModulusPa / prev.analysis.elasticModulusPa
  const rStretch = next.analysis.elongationM / prev.analysis.elongationM
  const rMass = next.analysis.massKg / prev.analysis.massKg
  const facts: ExplanationFact[] = []

  if (Number.isFinite(rArea) && Number.isFinite(rStress)) {
    facts.push({
      id: 'change.areaAndStress',
      text: `Cross-sectional area changed by ×${formatBasis(rArea)}; the stress is the load divided by the area, so it changed by ×${formatBasis(rStress)}, whatever the material.`,
      basis: { rArea, rStress },
    })
  }
  if (Number.isFinite(rModulus) && Number.isFinite(rStretch)) {
    facts.push({
      id: 'change.stiffnessAndStretch',
      text: `Young's modulus changed by ×${formatBasis(rModulus)} and the elongation by ×${formatBasis(rStretch)}: stretch falls as the modulus and the area grow.`,
      basis: { rModulus, rStretch },
    })
  }
  if (Number.isFinite(rMass)) {
    facts.push({ id: 'change.mass', text: `Mass changed by ×${formatBasis(rMass)}.`, basis: { rMass } })
  }

  const pm = prev.designSnapshot.materialId
  const nm = next.designSnapshot.materialId
  if (pm !== nm) {
    facts.push({ id: 'change.material', text: `Material changed from ${names(pm)} to ${names(nm)}.`, basis: {} })
  }

  for (const id of AXIAL_CONSTRAINT_ORDER) {
    const p = prev.evaluation.constraints.find((c) => c.id === id)
    const n = next.evaluation.constraints.find((c) => c.id === id)
    if (!p || !n || p.passed === n.passed) continue
    facts.push({ id: `change.constraint.${id}`, text: `${n.label}: ${passWord(p.passed)} → ${passWord(n.passed)}.`, basis: {} })
  }

  facts.push(axialModelLimitsFact())
  return facts
}
