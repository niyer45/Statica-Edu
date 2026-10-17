import { useState } from 'react'
import type { SessionState } from '../../state/session'
import { selectTestCount } from '../../state/selectors'
import { useSession } from '../state/store'
import { useModelUi } from '../models/registry'
import WorkflowStepper from './WorkflowStepper'

export type GuidanceStep = 'inspect' | 'experiment' | 'compare' | 'explain'

/** Recommended focus only: browsing guidance never awards completion or changes a design. */
export function recommendedStep(session: SessionState): GuidanceStep {
  if (session.submission) return 'explain'
  if (session.draftStatus === 'draft') return 'experiment'
  if (session.reflectionAnswer.trim()) return 'explain'
  return selectTestCount(session) ? 'compare' : 'inspect'
}

function GuidedInstructions() {
  const session = useSession()
  const { guidance } = useModelUi()
  const phase = recommendedStep(session)
  const [browsed, setBrowsed] = useState<{ step: GuidanceStep; session: SessionState } | null>(null)
  // Actual session changes reset the recommended focus; browsing does not change progress.
  const active = browsed?.session === session ? browsed.step : phase
  const current = guidance.steps.find((step) => step.id === active)!
  const experiment = guidance.experiment(session)
  return (
    <section className="guided-instructions" aria-label="Guided instructions">
      <div className="guidance-steps" role="group" aria-label="Guidance steps">
        {guidance.steps.map((step, index) => (
          <button key={step.id} type="button" aria-pressed={active === step.id}
            onClick={() => setBrowsed({ step: step.id, session })}>
            {index + 1}. {step.title}
          </button>
        ))}
      </div>
      <h2>{current.title}</h2>
      <p>{current.instruction}</p>
      <details key={active}>
        <summary>Hint & suggested experiment</summary>
        <p>{current.hint}</p>
        {active === 'experiment' && experiment !== undefined && <p>{experiment}</p>}
      </details>
    </section>
  )
}

export default function ModeExperience() {
  const session = useSession()
  const { copy } = useModelUi()
  return (
    <>
      {session.mode === 'parametric' && <p className="parametric-context">{copy.parametricLabel}</p>}
      {session.mode === 'guided' && <><WorkflowStepper /><GuidedInstructions /></>}
    </>
  )
}
