import type { Challenge } from '../challenge/types'
import { orientedEnvelope } from '../geometry/envelope'
import type { BeamDesign } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'
import type { Analysis } from '../physics/types'
import { withinLimit } from './tolerance'
import type { ConstraintId, ConstraintResult, ConstraintUnit } from './types'

// Constraint checks (Req 11.1–11.8). Pure; never throws for typed inputs, including
// analyses with non-finite numbers (those constraints fail, all 7 are still returned).

/** Fixed reporting order (Req 11.1). */
export const CONSTRAINT_ORDER: readonly ConstraintId[] = [
  'deflection',
  'stress',
  'mass',
  'envelopeWidth',
  'envelopeHeight',
  'featureGeometry',
  'applicability',
]

/** Student-facing labels. Contain no digits, so fact texts that quote them stay grounded. */
export const CONSTRAINT_LABELS: Readonly<Record<ConstraintId, string>> = {
  deflection: 'Tip deflection',
  stress: 'Nominal bending stress',
  mass: 'Mass',
  envelopeWidth: 'Envelope width',
  envelopeHeight: 'Envelope height',
  featureGeometry: 'Feature geometry',
  applicability: 'Model applicability',
}

function numeric(id: ConstraintId, value: number, limit: number, unit: ConstraintUnit): ConstraintResult {
  return {
    id,
    label: CONSTRAINT_LABELS[id],
    value,
    limit,
    unit,
    passed: withinLimit(value, limit),
    utilization: value / limit,
  }
}

/** Bool constraints: value 1 (holds) or 0, limit 1, utilization = value / limit. */
function bool(id: ConstraintId, holds: boolean): ConstraintResult {
  const value = holds ? 1 : 0
  return { id, label: CONSTRAINT_LABELS[id], value, limit: 1, unit: 'bool', passed: holds, utilization: value }
}

/** Oriented envelope, or NaN extents when the section cannot be measured (untrusted data). */
function safeEnvelope(d: BeamDesign): { widthZM: number; heightYM: number } {
  try {
    const env = orientedEnvelope(d.section, d.orientationDeg)
    if (env && typeof env.widthZM === 'number' && typeof env.heightYM === 'number') return env
  } catch {
    // fall through
  }
  return { widthZM: Number.NaN, heightYM: Number.NaN }
}

/**
 * Returns exactly 7 constraint results in `CONSTRAINT_ORDER`.
 * featureGeometry re-runs `validateDesign` on `d` (Req 11.7); applicability mirrors `a.applicable`.
 */
export function evaluateConstraints(d: BeamDesign, a: Analysis, ch: Challenge): ConstraintResult[] {
  const k = ch.constraints
  const env = safeEnvelope(d)
  return [
    numeric('deflection', a.tipDeflectionM, k.maxDeflectionM, 'm'),
    numeric('stress', a.nominalMaxStressPa, k.maxStressPa, 'Pa'),
    numeric('mass', a.massKg, k.maxMassKg, 'kg'),
    numeric('envelopeWidth', env.widthZM, k.maxWidthM, 'm'),
    numeric('envelopeHeight', env.heightYM, k.maxHeightM, 'm'),
    bool('featureGeometry', validateDesign(d, ch).length === 0),
    bool('applicability', a.applicable === true),
  ]
}
