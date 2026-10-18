import { useId, type ReactNode } from 'react'
import './goalChecklist.css'

// Compact goal card (task 56): one short goal, what the learner changes, and the stored pass/fail
// checks of the latest test, shown at the top of a model's design view so it is near the top of
// the page at every width (the design view is the first region on narrow screens). Presentation
// only: every value and pass/fail state is passed in from a stored evaluation. State is carried
// by text (Pass / Fail / N/A) as well as colour.

export type CheckStatus = 'pass' | 'fail' | 'na'

export interface GoalCheck {
  id: string
  label: string
  status: CheckStatus
  /** Stored value (and limit) display, e.g. `<span>8.72 mm</span> / <span>12.00 mm</span>`. */
  value: ReactNode
}

const MARKS: Readonly<Record<CheckStatus, string>> = { pass: '✓ Pass', fail: '✗ Fail', na: '– N/A' }

export interface GoalChecklistProps {
  goal: string
  /** What the learner edits, e.g. "Change: diagonals and member sizes. Then Run Test." */
  change: string
  /** "Baseline" / "Iteration 2": the stored test the checks come from. */
  testLabel: string
  /** True when the draft differs from the latest test, so the checks are out of date. */
  draft: boolean
  checks: readonly GoalCheck[]
  /** Short, decisive extra lines (governing member, applicability reasons, warnings). */
  children?: ReactNode
}

export default function GoalChecklist({ goal, change, testLabel, draft, checks, children }: GoalChecklistProps) {
  const id = useId()
  const passed = checks.filter((c) => c.status === 'pass').length
  return (
    <section className="goal-card" aria-labelledby={`${id}-goal`}>
      <h3 id={`${id}-goal`} className="goal-heading">
        Goal
      </h3>
      <p className="goal-text">{goal}</p>
      <p className="goal-change">{change}</p>
      <p className="goal-checks-head">
        <span>
          Checks · {testLabel}
          {draft && <span className="goal-draft"> · Run Test to update</span>}
        </span>
        <strong>
          {passed} of {checks.length} pass
        </strong>
      </p>
      <ul aria-label="Design requirements" className="goal-checks">
        {checks.map((c) => (
          <li key={c.id} className={`goal-check goal-check-${c.status}`}>
            <span className="goal-mark">{MARKS[c.status]}</span>
            <span className="goal-label">{c.label}</span>
            <span className="goal-value">{c.value}</span>
          </li>
        ))}
      </ul>
      {children}
    </section>
  )
}
