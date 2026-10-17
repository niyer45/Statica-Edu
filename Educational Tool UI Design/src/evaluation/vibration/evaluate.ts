import { deepFreeze } from '../../challenge/deepFreeze'
import type { VibrationChallenge } from '../../challenge/vibration/types'
import type { VibrationDesign } from '../../geometry/vibration/design'
import type { VibrationAnalysis } from '../../physics/vibration/types'
import type { EvaluationStatus } from '../types'
import { evaluateVibrationConstraints, vibrationEfficiency } from './constraints'
import { explainIsolatorSingle } from './explain'
import type { VibrationEvaluation } from './types'

// Vibration evaluation (task 50.2; VIB-07, MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply, otherwise accepted iff every constraint
// passes; warnings never affect it. A not-applicable design is therefore never Accepted.

/**
 * Evaluates a vibration analysis against the challenge limits.
 *
 * Precondition: `a = analyzeIsolator(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions: 5
 * constraint results in fixed order, `failures` = failed ids in that order, `accepted ⇔ status
 * === 'accepted'`, unclamped margins, grounded facts with exactly one model-limitation fact.
 * Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateIsolator(d: VibrationDesign, a: VibrationAnalysis, ch: VibrationChallenge): Readonly<VibrationEvaluation> {
  void d
  const constraints = evaluateVibrationConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus =
    a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: vibrationEfficiency(a, ch),
    facts: explainIsolatorSingle(constraints),
  })
}
