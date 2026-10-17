import { deepFreeze } from '../../challenge/deepFreeze'
import type { BracketChallenge } from '../../challenge/bracket/types'
import type { BracketDesign } from '../../geometry/bracket/design'
import type { BracketAnalysis } from '../../physics/bracket/types'
import type { EvaluationStatus } from '../types'
import { bracketEfficiency, evaluateBracketConstraints } from './constraints'
import { explainBracketSingle } from './explain'
import type { BracketEvaluation } from './types'

// Bracket evaluation (task 46.2; MBR-08, MBR-16, MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply (including an undefined Kt fit, MM-10),
// otherwise accepted iff every constraint passes; warnings never affect it. A not-applicable
// design is therefore never Accepted. "Accepted" means "meets this challenge's educational
// limits" (MBR-16), not real-world approval.

/**
 * Evaluates a bracket analysis against the challenge limits.
 *
 * Precondition: `a = analyzeBracket(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions: 5
 * constraint results in fixed order, `failures` = failed ids in that order, `accepted ⇔ status
 * === 'accepted'`, unclamped margins, grounded facts with exactly one model-limitation fact.
 * Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateBracket(d: BracketDesign, a: BracketAnalysis, ch: BracketChallenge): Readonly<BracketEvaluation> {
  void d
  const constraints = evaluateBracketConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus =
    a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: bracketEfficiency(a, ch),
    facts: explainBracketSingle(constraints, a),
  })
}
