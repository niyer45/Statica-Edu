import { deepFreeze } from '../../challenge/deepFreeze'
import type { AxialChallenge } from '../../challenge/axial/types'
import type { AxialDesign } from '../../geometry/axial/design'
import type { AxialAnalysis } from '../../physics/axial/types'
import type { EvaluationStatus } from '../types'
import { axialEfficiency, evaluateAxialConstraints } from './constraints'
import { explainRodSingle } from './explain'
import type { AxialEvaluation } from './types'

// Stress and Strain I evaluation (task 72; SSR-07, MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply (the rod has yielded), otherwise accepted iff
// every check passes; warnings never affect it. A not-applicable design is never Accepted.

/**
 * Evaluates a rod analysis against the challenge limits.
 *
 * Precondition: `a = analyzeRod(d, ch)`. `d` keeps the registry signature (`evaluate(d, a, ch)`);
 * every value read comes from the stored analysis (the stress limit from its stored yield
 * strength). Postconditions: 4 results in fixed order, `failures` = failed ids in that order,
 * `accepted ⇔ status === 'accepted'`, unclamped margins, grounded facts with exactly one
 * model-limitation fact. Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateRod(d: AxialDesign, a: AxialAnalysis, ch: AxialChallenge): Readonly<AxialEvaluation> {
  void d
  const constraints = evaluateAxialConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus = a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: axialEfficiency(a, ch),
    facts: explainRodSingle(constraints),
  })
}
