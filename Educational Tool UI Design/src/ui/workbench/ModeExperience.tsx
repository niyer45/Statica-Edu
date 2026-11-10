import { observations, type GuidedResult } from '../../evaluation/guided/plan'
import Icon from '../icons/Icon'
import { useModelStore } from '../state/store'
import Disclosure from './Disclosure'
import GuidedStepDialog, { type StepState } from './GuidedStepDialog'
import { useGuided } from './useGuided'

// Mode experience (task 58; replaces the task 44 Inspect/Experiment/Compare/Explain prompts).
//
// - Guided = structured experiments. An ordered list of single-variable steps from the model's
//   guided plan. Only the current step's parameters are editable (the Tools lock the rest and
//   the runtime rejects locked edits); a step is met by a tested result, evaluated by the pure
//   plan from stored history, so progress survives reload without a new persisted field. The
//   final step opens every parameter and is met by an Accepted test.
// - Parametric = open design. Every parameter editable from the start, no steps: the goal and
//   the checks stay in the challenge panel.
// Task 78: the locked controls share one line instead of one sentence each. Task 78.3: the steps are
// a stepper row and the lock line sits under "Editable now". Task 78.4: the current step's
// instruction is a modal dialog (GuidedStepDialog) that opens on entry and on each new step and is
// reopened from the current step; a failed attempt shows one line under the row.

function iterationName(history: ReadonlyArray<GuidedResult>, id: string | undefined): string {
  const r = history.find((x) => x.id === id)
  return r === undefined ? 'an earlier test' : r.iteration === 0 ? 'the Baseline' : `Iteration ${r.iteration}`
}

function GuidedExperiments() {
  const { history } = useModelStore<{ history: ReadonlyArray<GuidedResult> }, never, unknown>().state
  const { plan, progress, step } = useGuided()
  const total = plan.steps.length
  const last = progress.completions[progress.completions.length - 1]
  const lastIndex = last === undefined ? 0 : history.findIndex((r) => r.id === last.resultId)
  const latest = history[history.length - 1]!
  // A test recorded after the last met step that did not meet the current one.
  const notMet = step !== undefined && history.length - 1 > lastIndex ? latest : undefined
  const seen = last === undefined ? [] : observations(plan, last, history)
  const lastStep = last === undefined ? undefined : plan.steps.find((s) => s.id === last.stepId)
  const allDone = progress.complete || step === undefined
  const stepperSteps = plan.steps.map((s, i) => ({
    id: s.id,
    title: s.title,
    state: (allDone || i < progress.current ? 'complete' : i === progress.current ? 'current' : 'locked') as StepState,
  }))
  const notMetText = notMet !== undefined ? `Iteration ${notMet.iteration} did not complete this step yet. Change only ${step!.focus.toLowerCase()} as asked, then Run Test.` : undefined
  const locksSomething = step !== undefined && step.unlocks !== 'all'
  return (
    <GuidedStepDialog
      steps={stepperSteps}
      completeLabel={allDone ? `All ${total} steps complete` : undefined}
      label={step !== undefined ? `Step ${progress.current + 1} of ${total}: ${step.title}` : `All ${total} steps complete`}
      title={step !== undefined ? step.title : 'All experiments complete'}
      autoOpenKey={allDone ? 'done' : String(progress.current)}
      feedback={notMetText}
    >
      <div className="guided-body">
        {step !== undefined ? (
          <>
            <p>{step.instruction}</p>
            <p className="guided-focus">
              {locksSomething && <Icon name="lock" size={11} />}
              <span>
                Editable now: <strong>{step.focus}</strong>
                {step.unlocks === 'all' ? '.' : '. Other parameters stay locked until a later step.'}
              </span>
            </p>
            <Disclosure key={step.id} summary="Hint">
              <p>{step.hint}</p>
            </Disclosure>
          </>
        ) : (
          <p>Every parameter is unlocked. Open Explain & submit to record your design and what your experiments showed.</p>
        )}
        {notMetText !== undefined && <p className="guided-result">{notMetText}</p>}
        {notMet === undefined && last !== undefined && lastStep !== undefined && (
          <p className="guided-result">
            <Icon name="check" size={11} /> {lastStep.title} complete: {iterationName(history, last.resultId)}
            {last.comparedWithId !== undefined && <> compared with {iterationName(history, last.comparedWithId)}</>}
            {seen.length > 0 ? `. ${seen.map((o) => `${o.label} ${o.change === 'unavailable' ? 'not available' : o.change === 'unchanged' ? 'did not change' : o.change}`).join('; ')}.` : '.'}
          </p>
        )}
      </div>
    </GuidedStepDialog>
  )
}

// Parametric shows no panel here: its one explanatory sentence lives in the workbench chrome's
// "About this model" Disclosure (task 78, WD-03).
export default function ModeExperience() {
  const { active } = useGuided()
  return active ? <GuidedExperiments /> : null
}
