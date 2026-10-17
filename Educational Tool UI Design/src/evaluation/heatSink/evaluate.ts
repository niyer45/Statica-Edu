import { deepFreeze } from '../../challenge/deepFreeze'
import type { HeatSinkChallenge } from '../../challenge/heatSink/types'
import type { HeatSinkDesign } from '../../geometry/heatSink/design'
import type { HeatSinkAnalysis } from '../../physics/heatSink/types'
import type { EvaluationStatus } from '../types'
import { evaluateHeatSinkConstraints, heatSinkEfficiency } from './constraints'
import { explainHeatSinkSingle } from './explain'
import type { HeatSinkEvaluation } from './types'

// Heat sink evaluation (task 48.2; HSK-07, MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply, otherwise accepted iff every constraint
// passes; warnings never affect it. A not-applicable design is therefore never Accepted.

/**
 * Evaluates a heat sink analysis against the challenge limits.
 *
 * Precondition: `a = analyzeHeatSink(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions: 5
 * constraint results in fixed order, `failures` = failed ids in that order, `accepted ⇔ status
 * === 'accepted'`, unclamped margins, grounded facts with exactly one model-limitation fact.
 * Inputs are not mutated; the result is deep-frozen.
 */
export function evaluateHeatSink(d: HeatSinkDesign, a: HeatSinkAnalysis, ch: HeatSinkChallenge): Readonly<HeatSinkEvaluation> {
  void d
  const constraints = evaluateHeatSinkConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus =
    a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: heatSinkEfficiency(a, ch),
    facts: explainHeatSinkSingle(constraints),
  })
}
