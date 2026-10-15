import { Fragment } from 'react'
import { selectTestCount } from '../../state/selectors'
import Icon from '../icons/Icon'
import { useSession } from '../state/store'

// Template `.workflow` stepper (task 13.3; Req 35.5).
// Inspect → Modify & predict → Test & compare → Explain & submit. "Test & compare" is
// complete once history holds a Test_Result with iteration ≥ 1; "Explain & submit" once a
// submission is recorded. Each state is also given as text (visually hidden), not color only.

export type StepState = 'complete' | 'active' | 'upcoming'

export interface Step {
  label: string
  state: StepState
}

/** Step states from the session (pure; exported for tests). */
export function workflowSteps(testCount: number, submitted: boolean): Step[] {
  const tested = testCount >= 1
  return [
    { label: 'Inspect', state: 'complete' },
    { label: 'Modify & predict', state: tested ? 'complete' : 'active' },
    { label: 'Test & compare', state: tested ? 'complete' : 'upcoming' },
    { label: 'Explain & submit', state: submitted ? 'complete' : tested ? 'active' : 'upcoming' },
  ]
}

const STATE_TEXT: Record<StepState, string> = {
  complete: 'complete',
  active: 'current step',
  upcoming: 'not started',
}

export default function WorkflowStepper() {
  const s = useSession()
  const steps = workflowSteps(selectTestCount(s), s.submission !== undefined)
  return (
    // Template markup is spans inside `.workflow`; list semantics come from roles so the
    // decorative `.step-line` separators (aria-hidden) can stay between items.
    <div className="workflow" role="list" aria-label="Workflow">
      {steps.map((step, i) => (
        <Fragment key={step.label}>
          {i > 0 && <span className="step-line" aria-hidden="true" />}
          <span
            role="listitem"
            className={`step ${step.state === 'upcoming' ? '' : step.state}`}
            aria-current={step.state === 'active' ? 'step' : undefined}
          >
            <b aria-hidden="true">{step.state === 'complete' ? <Icon name="check" size={12} /> : i + 1}</b>
            {step.label}
            <span className="sr-only">, {STATE_TEXT[step.state]}</span>
          </span>
        </Fragment>
      ))}
    </div>
  )
}
