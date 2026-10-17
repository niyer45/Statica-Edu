import { deepFreeze } from '../../challenge/deepFreeze'
import type { TorsionChallenge } from '../../challenge/torsion/types'
import type { TorsionDesign } from '../../geometry/torsion/design'
import type { TorsionAnalysis } from '../../physics/torsion/types'
import type { EvaluationStatus } from '../types'
import { evaluateTorsionConstraints, torsionEfficiency } from './constraints'
import { explainShaftSingle } from './explain'
import type { TorsionEvaluation } from './types'

// Torsion evaluation (task 47.2; TSH-07, MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply, otherwise accepted iff every constraint
// passes; warnings never affect it. A not-applicable design is therefore never Accepted.

/**
 * Evaluates a torsion analysis against the challenge limits.
 *
 * Precondition: `a = analyzeShaft(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions: 5
 * constraint results in fixed order, `failures` = failed ids in that order, `accepted ⇔ status
 * === 'accepted'`, unclamped margins, grounded facts with exactly one model-limitation fact.
 * Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateShaft(d: TorsionDesign, a: TorsionAnalysis, ch: TorsionChallenge): Readonly<TorsionEvaluation> {
  void d
  const constraints = evaluateTorsionConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus =
    a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: torsionEfficiency(a, ch),
    facts: explainShaftSingle(constraints),
  })
}
