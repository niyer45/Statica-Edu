import { useState } from 'react'
import type { SessionState } from '../../state/session'
import { selectTestCount } from '../../state/selectors'
import { useSession } from '../state/store'
import WorkflowStepper from './WorkflowStepper'

export type GuidanceStep = 'inspect' | 'experiment' | 'compare' | 'explain'

/** Recommended focus only: browsing guidance never awards completion or changes a design. */
export function recommendedStep(session: SessionState): GuidanceStep {
  if (session.submission) return 'explain'
  if (session.draftStatus === 'draft') return 'experiment'
  if (session.reflectionAnswer.trim()) return 'explain'
  return selectTestCount(session) ? 'compare' : 'inspect'
}

const STEPS: readonly { id: GuidanceStep; title: string; instruction: string; hint: string }[] = [
  { id: 'inspect', title: 'Inspect', instruction: 'Read the challenge and its limits. Find which requirement the Baseline misses before editing.', hint: 'Expand Some things are fixed. to inspect the load, span, material and support. Accepted applies to this idealized model, not a real-world safety approval.' },
  { id: 'experiment', title: 'Experiment', instruction: 'Change one section dimension or orientation. Predict what will happen, then Run Test to record the result.', hint: 'Change one thing at a time so you can explain its effect. The dotted outline stays on the latest tested design until you run another test.' },
  { id: 'compare', title: 'Compare', instruction: 'Choose designs in Design history, then open Compare results. Select a design to inspect its values against Baseline.', hint: 'Look for a stiffness and mass tradeoff. Restore copies a tested design into the draft; the recorded results remain unchanged.' },
  { id: 'explain', title: 'Explain', instruction: 'Use your tested values to explain one design decision. Open Explain & submit to record a design and reflection.', hint: 'A submitted attempt can still be Not accepted. Explain remaining failures and one effect the idealized beam model does not include.' },
]

function GuidedInstructions() {
  const session = useSession()
  const phase = recommendedStep(session)
  const [browsed, setBrowsed] = useState<{ step: GuidanceStep; session: SessionState } | null>(null)
  // Actual session changes reset the recommended focus; browsing does not change progress.
  const active = browsed?.session === session ? browsed.step : phase
  const current = STEPS.find((step) => step.id === active)!
  const round = session.draft.section.kind === 'circle' || session.draft.section.kind === 'tube'
  const experiment = round
    ? 'Try a diameter change and compare stiffness with mass. For a tube, consider both the outer diameter and wall thickness.'
    : 'Try rotating a rectangle or I-section before adding material. Compare the tested deflection, stress and mass.'
  return (
    <section className="guided-instructions" aria-label="Guided instructions">
      <div className="guidance-steps" role="group" aria-label="Guidance steps">
        {STEPS.map((step, index) => (
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
        {active === 'experiment' && <p>{experiment}</p>}
      </details>
    </section>
  )
}

export default function ModeExperience() {
  const session = useSession()
  return (
    <>
      {session.mode === 'parametric' && <p className="parametric-context">Direct section and dimension editing</p>}
      {session.mode === 'guided' && <><WorkflowStepper /><GuidedInstructions /></>}
    </>
  )
}
