import { FRAME_MEMBER_IDS, FRAME_MEMBER_LABELS, FRAME_STOREY_LABELS, STOREY_DIAGONALS, type FrameStorey } from '../../geometry/bracedFrame/template'
import type { BracedFrameAnalysis, BracedFrameMemberResult, BracedFrameSolvedAnalysis } from '../../physics/bracedFrame/types'
import { formatBasis } from '../explain'
import type { ExplanationFact } from '../types'
import { BRACED_FRAME_CONSTRAINT_ORDER } from './constraints'
import type { BracedFrameComparable, BracedFrameConstraintResult } from './types'

// Grounded braced-frame explanation facts (task 49.2; design "Integration notes", MM-14). Same
// grounding rule as the beam (evaluation/explain.ts, Property 27): every number in a fact's
// `text` is `formatBasis(v, FACT_DIGITS)` of a finite value stored in that fact's `basis`, and
// every basis value is copied from a stored analysis / constraint result or is a ratio of two
// such values. Member and storey labels and fixed sentences contain no digits. Facts never
// claim that one diagonal direction is always best, and never mention the reference design.

export const BRACED_FRAME_MODEL_LIMITS_FACT_ID = 'model.idealizedFrame'

/** Relative agreement below which two stored force sets count as unchanged (BFR-14 scale). */
export const FORCES_UNCHANGED_REL_TOL = 1e-9

/** The single idealized-model fact included in every frame evaluation. No numbers. */
export function bracedFrameModelLimitsFact(): ExplanationFact {
  return {
    id: BRACED_FRAME_MODEL_LIMITS_FACT_ID,
    text: 'Based on the idealized pin-jointed frame model; effects such as rigid joints, load reversal and second-order (P-Δ) effects are not modeled.',
    basis: {},
  }
}

/** "lower storey has" / "upper storey has" / "lower and upper storeys have". */
function storeysHave(storeys: readonly FrameStorey[]): string {
  if (storeys.length === 1) return `${FRAME_STOREY_LABELS[storeys[0]]} has`
  return `${storeys.map((s) => FRAME_STOREY_LABELS[s].replace(' storey', '')).join(' and ')} storeys have`
}

function mechanismText(storeys: readonly FrameStorey[]): string {
  return storeys.length > 0
    ? `This pin-jointed frame is a mechanism: the ${storeysHave(storeys)} no diagonal, so the frame cannot resist sideways load and no displacements or member forces are defined.`
    : 'This pin-jointed frame is a mechanism, so no displacements or member forces are defined.'
}

const MODE_TEXT: Readonly<Record<BracedFrameMemberResult['mode'], string>> = Object.freeze({
  tensionYield: 'tension yield',
  compressionYield: 'compression yield',
  euler: 'Euler buckling',
})

const SENSE_TEXT: Readonly<Record<BracedFrameMemberResult['sense'], string>> = Object.freeze({
  tension: 'in tension',
  compression: 'in compression',
  zero: 'carrying almost no force',
})

/**
 * Facts for one evaluated result, in a fixed order:
 *   1. `single.mechanism`               for a mechanism (topological fact, no numbers);
 *   2. `single.utilization.<id>`        per numeric constraint with finite value/limit/utilization;
 *   3. `single.governingMember`         for a solved frame (basis { utilization });
 *   4. `model.idealizedFrame`           exactly once, last.
 */
export function explainBracedFrameSingle(a: BracedFrameAnalysis, constraints: readonly BracedFrameConstraintResult[]): ExplanationFact[] {
  const facts: ExplanationFact[] = []
  if (a.status === 'mechanism') facts.push({ id: 'single.mechanism', text: mechanismText(a.unbracedStoreys), basis: {} })
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
  if (a.status === 'solved') {
    const m = a.members[a.governingMemberId]
    if (m !== undefined && Number.isFinite(m.utilization)) {
      facts.push({
        id: 'single.governingMember',
        text:
          `The governing member is the ${FRAME_MEMBER_LABELS[a.governingMemberId]}, ${SENSE_TEXT[m.sense]} and limited by ` +
          `${MODE_TEXT[m.mode]}, at ${formatBasis(m.utilization)} times its capacity.`,
        basis: { utilization: m.utilization },
      })
    }
  }
  facts.push(bracedFrameModelLimitsFact())
  return facts
}

const passWord = (passed: boolean): string => (passed ? 'pass' : 'fail')

/** True when both designs have exactly one diagonal per storey and the same diagonals. */
function sameDeterminateTopology(prev: BracedFrameComparable, next: BracedFrameComparable): boolean {
  return ([1, 2] as const).every((storey) => {
    const ids = STOREY_DIAGONALS[storey]
    const p = ids.filter((id) => prev.designSnapshot.members[id].present)
    const n = ids.filter((id) => next.designSnapshot.members[id].present)
    return p.length === 1 && n.length === 1 && p[0] === n[0]
  })
}

/** Stored forces of two solved results agree within FORCES_UNCHANGED_REL_TOL × max|N|. */
function forcesUnchanged(p: BracedFrameSolvedAnalysis, n: BracedFrameSolvedAnalysis): boolean {
  const ids = FRAME_MEMBER_IDS.filter((id) => p.members[id] !== undefined || n.members[id] !== undefined)
  const forces = ids.map((id) => [p.members[id]?.forceN, n.members[id]?.forceN] as const)
  if (forces.some(([a, b]) => a === undefined || b === undefined)) return false
  const scale = forces.reduce((mx, [a, b]) => Math.max(mx, Math.abs(a as number), Math.abs(b as number)), 0)
  return forces.every(([a, b]) => Math.abs((a as number) - (b as number)) <= FORCES_UNCHANGED_REL_TOL * scale)
}

function sectionsChanged(prev: BracedFrameComparable, next: BracedFrameComparable): boolean {
  return FRAME_MEMBER_IDS.some((id) => prev.designSnapshot.members[id].sectionId !== next.designSnapshot.members[id].sectionId)
}

/**
 * Grounded facts for a prev → next change between two tested frames, in a fixed order:
 *   1. `change.stability`             if the status changed (mechanism ↔ solved), no numbers;
 *   2. `change.roofDrift`             roof drift ratio (basis { rDrift }), both solved;
 *   3. `change.mass`                  mass ratio (basis { rMass });
 *   4. `change.governingMember`       both solved and the governing member changed, no numbers; or
 *      `change.governingUtilization`  same governing member, its utilization ratio (basis { rUtilization });
 *   5. `change.forcesUnchanged`       both solved, same single-diagonal topology, sections changed and
 *                                     every stored force unchanged (statically determinate), no numbers;
 *   6. `change.constraint.<id>`       per constraint present in both whose pass state changed, fixed order;
 *   7. `model.idealizedFrame`         exactly once, last.
 * Reads stored values only; same inputs always give identical facts.
 */
export function explainBracedFrameChange(prev: BracedFrameComparable, next: BracedFrameComparable): ExplanationFact[] {
  const pa = prev.analysis
  const na = next.analysis
  const facts: ExplanationFact[] = []

  if (pa.status !== na.status) {
    facts.push(
      na.status === 'mechanism'
        ? {
            id: 'change.stability',
            text: na.unbracedStoreys.length > 0 ? `The frame became a mechanism: the ${storeysHave(na.unbracedStoreys)} no diagonal.` : 'The frame became a mechanism.',
            basis: {},
          }
        : { id: 'change.stability', text: 'The frame is stable again: every storey has a diagonal to carry the sideways load.', basis: {} },
    )
  }

  if (pa.status === 'solved' && na.status === 'solved') {
    const rDrift = na.roofDriftM / pa.roofDriftM
    if (Number.isFinite(rDrift)) {
      facts.push({ id: 'change.roofDrift', text: `Roof drift changed by ×${formatBasis(rDrift)}.`, basis: { rDrift } })
    }
  }

  const rMass = na.massKg / pa.massKg
  if (Number.isFinite(rMass)) facts.push({ id: 'change.mass', text: `Mass changed by ×${formatBasis(rMass)}.`, basis: { rMass } })

  if (pa.status === 'solved' && na.status === 'solved') {
    if (pa.governingMemberId !== na.governingMemberId) {
      facts.push({
        id: 'change.governingMember',
        text: `The governing member changed from the ${FRAME_MEMBER_LABELS[pa.governingMemberId]} to the ${FRAME_MEMBER_LABELS[na.governingMemberId]}.`,
        basis: {},
      })
    } else {
      const rUtilization = na.maxUtilization / pa.maxUtilization
      if (Number.isFinite(rUtilization)) {
        facts.push({
          id: 'change.governingUtilization',
          text: `The governing member is still the ${FRAME_MEMBER_LABELS[na.governingMemberId]}; its utilization changed by ×${formatBasis(rUtilization)}.`,
          basis: { rUtilization },
        })
      }
    }
    if (sameDeterminateTopology(prev, next) && sectionsChanged(prev, next) && forcesUnchanged(pa, na)) {
      facts.push({
        id: 'change.forcesUnchanged',
        text: 'Member forces did not change when sections changed: with one diagonal per storey this frame is statically determinate, so equilibrium alone sets the forces.',
        basis: {},
      })
    }
  }

  for (const id of BRACED_FRAME_CONSTRAINT_ORDER) {
    const p = prev.evaluation.constraints.find((c) => c.id === id)
    const n = next.evaluation.constraints.find((c) => c.id === id)
    if (!p || !n || p.passed === n.passed) continue
    facts.push({ id: `change.constraint.${id}`, text: `${n.label}: ${passWord(p.passed)} → ${passWord(n.passed)}.`, basis: {} })
  }

  facts.push(bracedFrameModelLimitsFact())
  return facts
}
