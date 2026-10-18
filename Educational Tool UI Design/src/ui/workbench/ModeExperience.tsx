import { observations, type GuidedResult } from '../../evaluation/guided/plan'
import Icon from '../icons/Icon'
import { useModelStore } from '../state/store'
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

const STATE_TEXT = { complete: 'complete', current: 'current step', locked: 'locked' } as const

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
  return (
    <section className="guided-instructions" aria-label="Guided experiments">
      <p className="guided-mode-label">
        <strong>Guided experiments</strong> · {progress.complete ? `All ${total} steps complete` : `Step ${progress.current + 1} of ${total}`}
      </p>
      <ol className="guidance-steps" aria-label="Experiment steps">
        {plan.steps.map((s, i) => {
          const state = i < progress.current ? 'complete' : i === progress.current ? 'current' : 'locked'
          return (
            <li key={s.id} className={state} aria-current={state === 'current' ? 'step' : undefined}>
              {state === 'complete' ? <Icon name="check" size={11} /> : state === 'locked' ? <Icon name="lock" size={11} /> : null}
              {i + 1}. {s.title}
              <span className="sr-only">, {STATE_TEXT[state]}</span>
            </li>
          )
        })}
      </ol>
      {step !== undefined ? (
        <>
          <h2>{step.title}</h2>
          <p>{step.instruction}</p>
          <p className="guided-focus">
            Editable now: <strong>{step.focus}</strong>
            {step.unlocks === 'all' ? '.' : '. Other parameters stay locked until a later step.'}
          </p>
          <details key={step.id}>
            <summary>Hint</summary>
            <p>{step.hint}</p>
          </details>
        </>
      ) : (
        <>
          <h2>All experiments complete</h2>
          <p>Every parameter is unlocked. Open Explain & submit to record your design and what your experiments showed.</p>
        </>
      )}
      {notMet !== undefined && (
        <p className="guided-result">
          Iteration {notMet.iteration} did not complete this step yet. Change only {step!.focus.toLowerCase()} as asked, then Run Test.
        </p>
      )}
      {notMet === undefined && last !== undefined && lastStep !== undefined && (
        <p className="guided-result">
          <Icon name="check" size={11} /> {lastStep.title} complete: {iterationName(history, last.resultId)}
          {last.comparedWithId !== undefined && <> compared with {iterationName(history, last.comparedWithId)}</>}
          {seen.length > 0 ? `. ${seen.map((o) => `${o.label} ${o.change === 'unavailable' ? 'not available' : o.change === 'unchanged' ? 'did not change' : o.change}`).join('; ')}.` : '.'}
        </p>
      )}
    </section>
  )
}

export default function ModeExperience() {
  const { active } = useGuided()
  return active ? (
    <GuidedExperiments />
  ) : (
    <p className="parametric-context">
      <strong>Parametric · Open design.</strong> Every parameter is editable from the start. Meet all the checks in The challenge panel.
    </p>
  )
}
