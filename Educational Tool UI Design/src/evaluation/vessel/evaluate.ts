import { deepFreeze } from '../../challenge/deepFreeze'
import type { VesselChallenge } from '../../challenge/vessel/types'
import type { VesselDesign } from '../../geometry/vessel/design'
import type { VesselAnalysis } from '../../physics/vessel/types'
import type { EvaluationStatus } from '../types'
import { evaluateVesselConstraints, vesselEfficiency } from './constraints'
import { explainVesselSingle } from './explain'
import type { VesselEvaluation } from './types'

// Pressure vessel evaluation (task 69; MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply, otherwise accepted iff every constraint
// passes; warnings never affect it. A not-applicable design is therefore never Accepted.
// "Accepted" means "meets this challenge's educational limits", not real-world approval or a
// pressure-vessel code check.

/**
 * Evaluates a vessel analysis against the challenge limits.
 *
 * Precondition: `a = analyzeVessel(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions: 7
 * constraint results in fixed order, `failures` = failed ids in that order, `accepted ⇔ status
 * === 'accepted'`, unclamped margins, grounded facts with exactly one model-limitation fact.
 * Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateVessel(d: VesselDesign, a: VesselAnalysis, ch: VesselChallenge): Readonly<VesselEvaluation> {
  void d
  const constraints = evaluateVesselConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus =
    a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: vesselEfficiency(a, ch),
    facts: explainVesselSingle(constraints, a),
  })
}
