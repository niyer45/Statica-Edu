import { deepFreeze } from '../../challenge/deepFreeze'
import type { ColumnChallenge } from '../../challenge/column/types'
import type { ColumnDesign } from '../../geometry/column/design'
import type { ColumnAnalysis } from '../../physics/column/types'
import type { EvaluationStatus } from '../types'
import { columnEfficiency, evaluateColumnConstraints } from './constraints'
import { explainColumnSingle } from './explain'
import type { ColumnEvaluation } from './types'

// Column evaluation (task 68; CBK-07, MM-11). Shared acceptance semantics: status is
// modelNotApplicable when the model does not apply, otherwise accepted iff every constraint passes;
// warnings never affect it. A not-applicable design is therefore never Accepted. "Accepted" means
// "meets this challenge's educational limits", not real-world approval.

/**
 * Evaluates a column analysis against the challenge limits.
 *
 * Precondition: `a = analyzeColumn(d, ch)`. `d` is accepted to keep the registry signature
 * (`evaluate(d, a, ch)`); every value read comes from the stored analysis. Postconditions: 4
 * constraint results in fixed order, `failures` = failed ids in that order, `accepted ⇔ status ===
 * 'accepted'`, unclamped margins, grounded facts with exactly one model-limitation fact. Inputs are
 * not mutated; the result is deep-frozen.
 */
export function evaluateColumn(d: ColumnDesign, a: ColumnAnalysis, ch: ColumnChallenge): Readonly<ColumnEvaluation> {
  void d
  const constraints = evaluateColumnConstraints(a, ch)
  const failures = constraints.filter((c) => !c.passed).map((c) => c.id)
  const status: EvaluationStatus = a.applicable !== true ? 'modelNotApplicable' : failures.length === 0 ? 'accepted' : 'notAccepted'
  return deepFreeze({
    status,
    accepted: status === 'accepted',
    constraints,
    failures,
    efficiency: columnEfficiency(a, ch),
    facts: explainColumnSingle(constraints),
  })
}
