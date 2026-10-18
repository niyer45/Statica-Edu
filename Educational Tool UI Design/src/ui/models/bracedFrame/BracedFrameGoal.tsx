import GoalChecklist, { type GoalCheck } from '../GoalChecklist'
import { boolText, CHECK_LABELS, constraintRows, formatFrame, MODE_PHRASES, memberName, NOT_APPLICABLE, unstableText, useFrameStore } from './shared'

// Braced Frame I goal card (task 56): the goal, what to change, and the four stored checks of the
// latest test. Roof drift and utilization of a mechanism are not defined, so they show
// "Not applicable" (N/A), never a number or a fail (MM-10). The full constraint labels stay in the
// challenge panel's Test details table.

export const FRAME_GOAL = 'Brace and size the frame so every check passes.'
export const FRAME_CHANGE = 'Change the diagonals and member sizes, then Run Test.'

export default function BracedFrameGoal() {
  const { state } = useFrameStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis, evaluation } = latest
  const checks: GoalCheck[] = constraintRows(evaluation).flatMap(({ id, result: c }): GoalCheck[] => {
    if (id === 'applicability') return []
    const label = CHECK_LABELS[id]
    if (c === undefined) return [{ id, label, status: 'na', value: <span>{NOT_APPLICABLE}</span> }]
    const value =
      c.unit === 'bool' ? (
        <span>{boolText(c)}</span>
      ) : (
        <>
          <span>{formatFrame(c.value, c.unit)}</span> / <span>{formatFrame(c.limit, c.unit)}</span>
        </>
      )
    return [{ id, label, status: c.passed ? 'pass' : 'fail', value }]
  })
  const governing = analysis.status === 'solved' ? analysis.members[analysis.governingMemberId] : undefined
  return (
    <GoalChecklist
      goal={FRAME_GOAL}
      change={FRAME_CHANGE}
      testLabel={latest.iteration === 0 ? 'Baseline' : `Iteration ${latest.iteration}`}
      draft={state.draftStatus === 'draft'}
      checks={checks}
    >
      {analysis.status === 'mechanism' ? (
        <p className="goal-note frame-goal-unstable">{unstableText(analysis.unbracedStoreys)}.</p>
      ) : (
        governing !== undefined && (
          <p className="goal-note frame-governing">
            Governing member: {memberName(analysis.governingMemberId)}, {governing.sense === 'zero' ? 'almost no force' : governing.sense},{' '}
            {MODE_PHRASES[governing.mode]}.
          </p>
        )
      )}
      {evaluation.status === 'modelNotApplicable' && (
        <ul className="goal-alert" aria-label="Model applicability reasons">
          {analysis.notApplicableReasons.map((r) => (
            <li key={r.code}>{r.message}</li>
          ))}
        </ul>
      )}
      {analysis.warnings.length > 0 && (
        <ul className="goal-alert" aria-label="Model warnings">
          {analysis.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      )}
    </GoalChecklist>
  )
}
