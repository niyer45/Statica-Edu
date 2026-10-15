import { deepFreeze } from '../challenge/deepFreeze'
import type { SectionKind } from '../challenge/types'
import type { Analysis } from '../physics/types'
import { CONSTRAINT_LABELS, CONSTRAINT_ORDER } from './constraints'
import type {
  ComparedMetric,
  ComparisonDelta,
  ConstraintChange,
  ConstraintResult,
  ExplanationFact,
  MetricDelta,
  SectionState,
  TestResult,
} from './types'

// Grounded explanation facts (Req 13).
//
// Grounding rule (Req 13.1, 13.2; Property 27): every number in a fact's `text` is produced
// by `formatBasis(basisValue, FACT_DIGITS)` from a value stored in that fact's `basis`, and
// every basis value is finite and copied unchanged from an Analysis / constraint result
// (or, for comparisons, a ratio of two such values). Labels and fixed sentences contain
// no digits. To check a fact, extract every number in `text` and confirm it equals
// `formatBasis(v, d)` for some `v` in `basis`, where d is the number of decimals shown
// and d ∈ {0, FACT_DIGITS}. All quantities use FACT_DIGITS; the only 0-decimal numbers
// are orientation degrees ("0°" / "90°") in the section-change fact (see section 4).
//
// Sections:
//   1. Formatting helpers (shared)
//   2. Shared facts (model limitation)
//   3. Single-result facts: explainSingle (task 10.1)
//   4. Comparison facts: compareResults / explainChange (task 10.7, appended below)

// ---------------------------------------------------------------------------
// 1. Formatting helpers

/** Decimal places used for every number rendered in fact text. */
export const FACT_DIGITS = 2

/**
 * Formats a basis value for fact text: `toFixed(digits)`, locale-independent, with a
 * negative zero result ("-0.00") shown unsigned. Only call with finite values.
 */
export function formatBasis(value: number, digits: number = FACT_DIGITS): string {
  const text = value.toFixed(digits)
  return /^-0(?:\.0*)?$/.test(text) ? text.slice(1) : text
}

// ---------------------------------------------------------------------------
// 2. Shared facts

export const MODEL_LIMITS_FACT_ID = 'model.idealizedBeam'

/** The single idealized-model fact included in every Evaluation (Req 13.8). No numbers. */
export function modelLimitsFact(): ExplanationFact {
  return {
    id: MODEL_LIMITS_FACT_ID,
    text: 'Based on the idealized beam model; effects such as local buckling are not modeled.',
    basis: {},
  }
}

// ---------------------------------------------------------------------------
// 3. Single-result facts

/**
 * Facts for one evaluated result, in a deterministic order:
 *   - one utilization fact per numeric constraint (fixed constraint order) whose
 *     value, limit, and utilization are all finite; basis = { value, limit, utilization }
 *     copied from the constraint result, text quotes only the utilization;
 *   - exactly one model-limitation fact, last.
 * Boolean constraints (featureGeometry, applicability) are reported by their pass flag
 * only and get no utilization fact. `a` is accepted for future single-result facts and
 * to keep the signature from the design.
 */
export function explainSingle(a: Analysis, constraints: readonly ConstraintResult[]): ExplanationFact[] {
  void a
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
  facts.push(modelLimitsFact())
  return facts
}

// ---------------------------------------------------------------------------
// 4. Comparison facts (task 10.7)
//
// Orientation in fact text: the section-change fact quotes orientations as "0°" / "90°".
// Those numbers are stored in the fact's basis (prevOrientationDeg / nextOrientationDeg,
// copied from ComparisonDelta.section) and rendered with `formatBasis(v, 0)`. So the
// full grounding rule is: every number token in `text` equals `formatBasis(v, d)` for
// some `v` in `basis`, where d is the number of decimals shown in the token and
// d ∈ {0, FACT_DIGITS} (Req 13.2: "rounded to the number of decimal places shown").
// Ratio facts always use FACT_DIGITS; only orientation degrees use 0 decimals.

/** Decimal places for orientation degrees in fact text. */
export const ORIENTATION_DIGITS = 0

/** Mass ratio tolerance and deflection-drop threshold for the same-mass fact (Req 13.4, 13.5). */
export const SAME_MASS_TOL = 0.02
export const DEFLECTION_DROP_RATIO = 0.98

/** Display names for section kinds (match the Workspace template). Contain no digits. */
export const SECTION_KIND_NAMES: Readonly<Record<SectionKind, string>> = {
  circle: 'Solid circle',
  tube: 'Hollow circle',
  rectangle: 'Rectangle',
  iSection: 'I-section',
}

const COMPARED_METRICS: readonly ComparedMetric[] = [
  'areaM2',
  'bendingInertiaM4',
  'massKg',
  'tipDeflectionM',
  'nominalMaxStressPa',
]

function metricDelta(prev: number, next: number): MetricDelta {
  return { prev, next, delta: next - prev, ratio: next / prev }
}

function sectionState(r: TestResult): SectionState {
  return { kind: r.designSnapshot.section.kind, orientationDeg: r.designSnapshot.orientationDeg }
}

/**
 * Pure, deterministic comparison of two results (prev → next). Metrics are copied from the
 * two analyses (ratios may be non-finite if a prev value is 0; not clamped). Constraint
 * changes list only constraints whose pass state differs, in CONSTRAINT_ORDER; a
 * constraint missing from either evaluation is skipped. Result is deep-frozen.
 */
export function compareResults(prev: TestResult, next: TestResult): ComparisonDelta {
  const metrics = {} as Record<ComparedMetric, MetricDelta>
  for (const m of COMPARED_METRICS) metrics[m] = metricDelta(prev.analysis[m], next.analysis[m])

  const constraintChanges: ConstraintChange[] = []
  for (const id of CONSTRAINT_ORDER) {
    const p = prev.evaluation.constraints.find((c) => c.id === id)
    const n = next.evaluation.constraints.find((c) => c.id === id)
    if (!p || !n || p.passed === n.passed) continue
    constraintChanges.push({ id, label: CONSTRAINT_LABELS[id], prevPassed: p.passed, nextPassed: n.passed })
  }

  const ps = sectionState(prev)
  const ns = sectionState(next)
  return deepFreeze({
    prevId: prev.id,
    nextId: next.id,
    metrics,
    constraintChanges,
    section: { prev: ps, next: ns, changed: ps.kind !== ns.kind || ps.orientationDeg !== ns.orientationDeg },
    status: { prev: prev.evaluation.status, next: next.evaluation.status },
  })
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/**
 * Grounded facts for a prev → next change, in a fixed order with fixed ids:
 *   1. `change.stiffness`   I and δ ratios (basis { rI, rDelta }), if both finite;
 *   2. `change.sameMass`    only if |rMass − 1| ≤ 0.02 and rDelta < 0.98 (basis { rMass, rDelta });
 *   3. `change.section`     if kind or orientation changed (basis { prevOrientationDeg, nextOrientationDeg });
 *   4. `change.constraint.<id>` per constraint whose pass state changed, CONSTRAINT_ORDER, no numbers;
 *   5. `model.idealizedBeam` exactly once, last.
 * Same inputs always give identical facts (Req 13.9).
 */
export function explainChange(prev: TestResult, next: TestResult): ExplanationFact[] {
  const cmp = compareResults(prev, next)
  const rI = cmp.metrics.bendingInertiaM4.ratio
  const rDelta = cmp.metrics.tipDeflectionM.ratio
  const rMass = cmp.metrics.massKg.ratio
  const facts: ExplanationFact[] = []

  if (Number.isFinite(rI) && Number.isFinite(rDelta)) {
    facts.push({
      id: 'change.stiffness',
      text:
        // "inversely with I" rather than "1/I": a literal 1 would be an ungrounded number.
        `Bending stiffness (I) changed by ×${formatBasis(rI)}; in this model, tip deflection ` +
        `scales inversely with I, so deflection changed by ×${formatBasis(rDelta)}.`,
      basis: { rI, rDelta },
    })
  }

  if (
    Number.isFinite(rMass) &&
    Number.isFinite(rDelta) &&
    Math.abs(rMass - 1) <= SAME_MASS_TOL &&
    rDelta < DEFLECTION_DROP_RATIO
  ) {
    facts.push({
      id: 'change.sameMass',
      text:
        `Mass stayed about the same (×${formatBasis(rMass)}) while deflection dropped ` +
        `(×${formatBasis(rDelta)}): in this model, material moved farther from the bending axis.`,
      basis: { rMass, rDelta },
    })
  }

  if (cmp.section.changed) {
    const p = cmp.section.prev
    const n = cmp.section.next
    const deg = (o: number) => `${formatBasis(o, ORIENTATION_DIGITS)}°`
    facts.push({
      id: 'change.section',
      text:
        `Section changed from ${SECTION_KIND_NAMES[p.kind]} at ${deg(p.orientationDeg)} ` +
        `to ${SECTION_KIND_NAMES[n.kind]} at ${deg(n.orientationDeg)}.`,
      basis: { prevOrientationDeg: p.orientationDeg, nextOrientationDeg: n.orientationDeg },
    })
  }

  for (const c of cmp.constraintChanges) {
    facts.push({
      id: `change.constraint.${c.id}`,
      text: `${c.label}: ${passWord(c.prevPassed)} → ${passWord(c.nextPassed)}.`,
      basis: {},
    })
  }

  facts.push(modelLimitsFact())
  return facts
}
