import { deepFreeze } from '../../challenge/deepFreeze'
import type { BracedFrameChallenge } from '../../challenge/bracedFrame/types'
import type { BracedFrameDesign } from '../../geometry/bracedFrame/design'
import type { BracedFrameAnalysis } from '../../physics/bracedFrame/types'
import type { EvaluationStatus } from '../types'
import { bracedFrameEfficiency, evaluateBracedFrameConstraints } from './constraints'
import { explainBracedFrameSingle } from './explain'
import type { BracedFrameEvaluation } from './types'

// Braced frame evaluation (task 49.2; BFR-07, MM-10, MM-11). Shared acceptance semantics: status
// is modelNotApplicable when the model does not apply (a mechanism, or a screen above its
// not-applicable threshold), otherwise accepted iff every constraint passes; warnings never
// affect it. A mechanism is therefore never Accepted: its stability constraint fails, its drift
// and utilization constraints are absent, and its status is modelNotApplicable.

/**
 * Evaluates a braced-frame analysis against the challenge limits.
 *
 * Precondition: `a = analyzeBracedFrame(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions:
 * constraint results in fixed order (5 solved, 3 mechanism), `failures` = failed ids in that
 * order, `accepted ⇔ status === 'accepted'`, unclamped margins, grounded facts with exactly one
 * model-limitation fact. Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateBracedFrame(d: BracedFrameDesign, a: BracedFrameAnalysis, ch: BracedFrameChallenge): Readonly<BracedFrameEvaluation> {
  void d
  const constraints = evaluateBracedFrameConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus =
    a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: bracedFrameEfficiency(a, ch),
    facts: explainBracedFrameSingle(a, constraints),
  })
}
