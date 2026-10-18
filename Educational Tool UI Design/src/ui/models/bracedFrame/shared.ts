import type { BracedFrameChallenge } from '../../../challenge/bracedFrame/types'
import { BRACED_FRAME_CONSTRAINT_ORDER } from '../../../evaluation/bracedFrame/constraints'
import type { BracedFrameConstraintId, BracedFrameConstraintResult, BracedFrameConstraintUnit, BracedFrameEvaluation } from '../../../evaluation/bracedFrame/types'
import type { BracedFrameDesign } from '../../../geometry/bracedFrame/design'
import { FRAME_MEMBER_LABELS, STOREY_DIAGONALS, type DiagonalId, type FrameMemberId, type FrameStorey } from '../../../geometry/bracedFrame/template'
import type { BracedFrameMemberResult } from '../../../physics/bracedFrame/types'
import type { BracedFrameAction, BracedFrameSession } from '../../../state/bracedFrameModel'
import { formatMm, nToKn } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Braced Frame I UI (task 49.3; braced-frame-1 BFR-06, BFR-16). Display
// formatting only; every value shown comes from a stored frame analysis/evaluation or the
// challenge config. A mechanism has no drift, force or utilization: those are shown as not
// applicable, never as numbers (MM-10).

export type StudentBracedFrameChallenge = Omit<BracedFrameChallenge, 'referenceDesign'>

/** The active frame store; the model UI registry guarantees the active model is the frame. */
export const useFrameStore = () => useModelStore<BracedFrameSession, BracedFrameAction, StudentBracedFrameChallenge>()

/** Shown in place of a quantity a mechanism does not define. */
export const NOT_APPLICABLE = 'Not applicable'
export const MECHANISM_TEXT = 'Unstable mechanism'

/** Id of the latest-test text summary that describes the frame drawing (3D canvas or SVG). */
export const FRAME_SUMMARY_ID = 'frame-view-summary'
/** Shown (and announced once) when the 3D frame view cannot run. */
export const FRAME_FALLBACK_NOTICE = '3D view is unavailable. Use the 2D elevation and the member force table instead.'

/** Display text for a stored frame constraint value or limit. */
export function formatFrame(value: number, unit: BracedFrameConstraintUnit): string {
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'ratio') return `${(value * 100).toFixed(1)}%`
  if (unit === 'kg') return `${value.toFixed(1)} kg`
  return ''
}

/** Magnitude in kN with one decimal (the sense is reported separately). */
export function formatKn(n: number): string {
  return `${nToKn(Math.abs(n)).toFixed(1)} kN`
}

export const SENSE_LABELS: Readonly<Record<BracedFrameMemberResult['sense'], string>> = { tension: 'Tension', compression: 'Compression', zero: '≈ 0' }
/** One-letter pattern key used on the drawing next to the line pattern (T / C / 0). */
export const SENSE_KEYS: Readonly<Record<BracedFrameMemberResult['sense'], string>> = { tension: 'T', compression: 'C', zero: '0' }
export const MODE_LABELS: Readonly<Record<BracedFrameMemberResult['mode'], string>> = {
  tensionYield: 'Tension yield',
  compressionYield: 'Compression yield',
  euler: 'Euler buckling',
}

/** Mid-sentence form of the governing mode ("limited by Euler buckling"). */
export const MODE_PHRASES: Readonly<Record<BracedFrameMemberResult['mode'], string>> = {
  tensionYield: 'tension yield',
  compressionYield: 'compression yield',
  euler: 'Euler buckling',
}

/** Force text: "75.0 kN compression", or "≈ 0" for a zero-force member (never "−0"). */
export function forceText(m: Readonly<BracedFrameMemberResult>): string {
  return m.sense === 'zero' ? '≈ 0' : `${formatKn(m.forceN)} ${m.sense}`
}

/** Sentence-case member name ("Lower left column"). */
export function memberName(id: FrameMemberId): string {
  const label = FRAME_MEMBER_LABELS[id]
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const DIAGONAL_DIRECTIONS: Readonly<Record<DiagonalId, string>> = {
  diag1a: 'bottom left to top right',
  diag1b: 'bottom right to top left',
  diag2a: 'bottom left to top right',
  diag2b: 'bottom right to top left',
}

/** Accessible toggle name, e.g. "Storey 1 diagonal, bottom left to top right" (BFR-16). */
export function diagonalToggleName(id: DiagonalId): string {
  return `Storey ${id.charAt(4)} diagonal, ${DIAGONAL_DIRECTIONS[id]}`
}

/** "single diagonal" / "X-braced" / "no diagonal" for one storey of a design. */
function storeyBracing(d: Readonly<BracedFrameDesign>, storey: FrameStorey): string {
  const n = STOREY_DIAGONALS[storey].filter((id) => d.members[id].present).length
  return n === 0 ? 'no diagonal' : n === 1 ? 'single diagonal' : 'X-braced'
}

/** Short bracing summary of a design, e.g. "Lower: single diagonal · Upper: no diagonal". */
export function bracingSummary(d: Readonly<BracedFrameDesign>): string {
  return `Lower: ${storeyBracing(d, 1)} · Upper: ${storeyBracing(d, 2)}`
}

/** "storey 2" / "storeys 1 and 2" for unbraced-storey sentences. */
export function storeyList(storeys: readonly FrameStorey[]): string {
  return storeys.length === 1 ? `storey ${storeys[0]}` : `storeys ${storeys.join(' and ')}`
}

/** "Unstable: storey 2 has no diagonal" (BFR-16), from the stored topological fact. */
export function unstableText(storeys: readonly FrameStorey[]): string {
  if (storeys.length === 0) return 'Unstable: the frame is a mechanism'
  return `Unstable: ${storeyList(storeys)} ${storeys.length === 1 ? 'has' : 'have'} no diagonal`
}

/**
 * Every constraint in reporting order; a constraint the evaluation omits (roof drift and
 * utilization of a mechanism) is returned with `result: undefined` so it can be shown as not
 * applicable instead of being silently dropped.
 */
export function constraintRows(e: Readonly<BracedFrameEvaluation>): { id: BracedFrameConstraintId; result?: BracedFrameConstraintResult }[] {
  return BRACED_FRAME_CONSTRAINT_ORDER.map((id) => ({ id, result: e.constraints.find((c) => c.id === id) }))
}

/** Short check names for the goal card and history metrics (task 56); full labels stay in Test details. */
export const CHECK_LABELS: Readonly<Record<Exclude<BracedFrameConstraintId, 'applicability'>, string>> = {
  stability: 'Stability',
  roofDrift: 'Roof drift',
  utilization: 'Member utilization',
  mass: 'Mass',
}

/** Display value of a stored bool constraint. */
export function boolText(c: Readonly<BracedFrameConstraintResult>): string {
  if (c.id === 'stability') return c.passed ? 'Stable' : MECHANISM_TEXT
  return c.passed ? 'Applicable' : 'Not applicable'
}
