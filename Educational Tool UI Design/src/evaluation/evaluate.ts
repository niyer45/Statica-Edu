import { deepFreeze } from '../challenge/deepFreeze'
import type { Challenge } from '../challenge/types'
import type { BeamDesign } from '../geometry/sections'
import type { Analysis } from '../physics/types'
import { acceptanceStatus, failuresOf } from './acceptance'
import { evaluateConstraints } from './constraints'
import { efficiency } from './efficiency'
import { explainSingle } from './explain'
import type { Evaluation } from './types'

/**
 * Evaluates an analysis against the challenge limits (design "Constraint evaluation").
 *
 * Precondition: `a = analyze(d, ch)`. Postconditions: 7 constraint results in fixed order,
 * `failures` = failed ids in that order, status from `applicable` + failures only (warnings
 * ignored), `accepted ⇔ status === 'accepted'`, unclamped efficiency, grounded facts with
 * exactly one model-limitation fact. Inputs are not mutated; the result is deep-frozen.
 */
export function evaluate(d: BeamDesign, a: Analysis, ch: Challenge): Readonly<Evaluation> {
  const constraints = evaluateConstraints(d, a, ch)
  const failures = failuresOf(constraints)
  const status = acceptanceStatus(a.applicable, failures)
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: efficiency(a, ch),
    facts: explainSingle(a, constraints),
  })
}
