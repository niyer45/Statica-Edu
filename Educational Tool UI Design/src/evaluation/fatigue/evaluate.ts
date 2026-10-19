import { deepFreeze } from '../../challenge/deepFreeze'
import type { FatigueChallenge } from '../../challenge/fatigue/types'
import type { FatigueDesign } from '../../geometry/fatigue/design'
import type { FatigueAnalysis } from '../../physics/fatigue/types'
import type { EvaluationStatus } from '../types'
import { evaluateFatigueConstraints, fatigueEfficiency } from './constraints'
import { explainFatigueSingle } from './explain'
import type { FatigueEvaluation } from './types'

// Fatigue evaluation (task 70; MM-11). Shared acceptance semantics: modelNotApplicable when the
// model does not apply, otherwise accepted iff every constraint passes. "Accepted" means "meets
// this challenge's educational limits", not a real-world fatigue certification.

/** Evaluates a spindle analysis against the challenge limits. Precondition: `a = analyzeFatigue(d, ch)`. */
export function evaluateFatigue(d: FatigueDesign, a: FatigueAnalysis, ch: FatigueChallenge): Readonly<FatigueEvaluation> {
  void d
  const constraints = evaluateFatigueConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus = a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: fatigueEfficiency(a, ch),
    facts: explainFatigueSingle(constraints, a),
  })
}
