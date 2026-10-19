import { useEffect, useRef, useState, type FormEvent } from 'react'
import { moduleStatus, type LearnProgress } from '../../learn/progress'
import type { LearnModule, LearnStep } from '../../learn/types'
import { Formula } from '../dialogs/Reference'
import Icon from '../icons/Icon'
import Demo from './demos'
import './learn.css'

// Module player (task 67; LRN-02, LRN-03, LRN-06, LRN-09). Steps in order: concept, then a
// prediction the learner commits, then the demonstration, takeaway and optional equations. The
// final "Apply it" screen opens the matching challenge in Guided mode. Predictions are never
// scored; a different answer only explains what the model shows.

export interface ModulePageProps {
  module: LearnModule
  path: readonly string[]
  progress: LearnProgress
  onPredict: (stepId: string, optionId: string) => void
  onBack: () => void
  onApply: () => void
}

function StepView({ step, index, total, answer, onPredict }: { step: LearnStep; index: number; total: number; answer: string | undefined; onPredict: (optionId: string) => void }) {
  const [choice, setChoice] = useState<string | null>(null)
  const committed = answer !== undefined
  const matched = answer === step.question.answerId
  const correct = step.question.options.find((o) => o.id === step.question.answerId)!
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (choice !== null) onPredict(choice)
  }
  return (
    <>
      <p className="learn-eyebrow">
        Step {index + 1} of {total}
      </p>
      <ul className="learn-concept">
        {step.concept.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <form className="learn-predict" onSubmit={submit}>
        <fieldset disabled={committed}>
          <legend>
            <span>Predict</span>
            {step.question.prompt}
          </legend>
          {step.question.options.map((o) => (
            <label key={o.id} className={committed && o.id === answer ? 'chosen' : undefined}>
              <input type="radio" name={`predict-${step.id}`} value={o.id} checked={committed ? o.id === answer : choice === o.id} onChange={() => setChoice(o.id)} />
              {o.label}
            </label>
          ))}
        </fieldset>
        {!committed && (
          <button type="submit" className="primary" disabled={choice === null}>
            Check my prediction
          </button>
        )}
      </form>
      <div className="learn-feedback" role="status">
        {committed && (
          <>
            <p className={matched ? 'learn-match' : 'learn-differ'}>
              <Icon name={matched ? 'check' : 'bulb'} size={16} />
              {matched ? 'Your prediction matches the model.' : `The model gives a different answer: ${correct.label.toLowerCase()}.`}
            </p>
            <p>{step.question.explanation}</p>
          </>
        )}
      </div>
      {committed && (
        <>
          <section className="learn-try" aria-label="Try it">
            <h3>Try it</h3>
            <p>{step.tryIt}</p>
            <Demo kind={step.demo} />
          </section>
          <p className="learn-takeaway">
            <strong>Takeaway</strong>
            {step.takeaway}
          </p>
          <details className="learn-advanced">
            <summary>Show the equations</summary>
            {step.advanced.map((a) => (
              <Formula key={a.tex} tex={a.tex} text={a.text} caption={a.caption} />
            ))}
          </details>
        </>
      )}
    </>
  )
}

export default function ModulePage({ module, path, progress, onPredict, onBack, onApply }: ModulePageProps) {
  const status = moduleStatus(module, progress)
  const steps = module.steps
  // Index steps.length is the "Apply it" screen.
  const [current, setCurrent] = useState(() => status.nextStep)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [current])
  const go = (i: number) => {
    moved.current = true
    setCurrent(i)
  }
  const step = steps[current]
  const answered = step === undefined || progress[step.id] !== undefined
  return (
    <div className="learn-module">
      <nav className="learn-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={onBack}>
          Learn
        </button>
        {path.map((p) => (
          <span key={p}>{p}</span>
        ))}
      </nav>
      <header className="learn-header">
        <p className="learn-eyebrow">Module · {module.time}</p>
        <h1>{module.title}</h1>
        <p>{module.summary}</p>
        <p className="learn-progress" aria-label="Module progress">
          {status.completed} of {status.total} steps done
        </p>
      </header>
      <div className="learn-layout">
        <ol className="learn-steps" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button type="button" aria-current={i === current ? 'step' : undefined} onClick={() => go(i)}>
                <span className={`learn-step-mark${progress[s.id] !== undefined ? ' done' : ''}`} aria-hidden="true">
                  {progress[s.id] !== undefined ? <Icon name="check" size={12} /> : i + 1}
                </span>
                {s.title}
                {progress[s.id] !== undefined && <span className="sr-only">{', done'}</span>}
              </button>
            </li>
          ))}
          <li>
            <button type="button" aria-current={current === steps.length ? 'step' : undefined} onClick={() => go(steps.length)}>
              <span className="learn-step-mark" aria-hidden="true">
                <Icon name="arrow" size={12} />
              </span>
              Apply it
            </button>
          </li>
        </ol>
        <section className="learn-step panel" aria-labelledby="learn-step-title">
          <h2 id="learn-step-title" ref={heading} tabIndex={-1}>
            {step ? step.title : 'Apply it'}
          </h2>
          {step ? (
            <StepView key={step.id} step={step} index={current} total={steps.length} answer={progress[step.id]} onPredict={(o) => onPredict(step.id, o)} />
          ) : (
            <div className="learn-apply">
              <h3>What you found</h3>
              <ul className="learn-concept">
                {steps.map((s) => (
                  <li key={s.id}>{s.takeaway}</li>
                ))}
              </ul>
              <h3>{module.apply.title}</h3>
              <p>{module.apply.text}</p>
              {!status.done && <p className="learn-hint">You can open the challenge now, or finish the remaining steps first.</p>}
              <div className="learn-actions">
                <button type="button" className="primary" onClick={onApply}>
                  Open {module.apply.title} in Guided mode
                  <Icon name="arrow" size={14} />
                </button>
                <button type="button" className="secondary" onClick={onBack}>
                  Back to Learn
                </button>
              </div>
            </div>
          )}
          <div className="learn-nav">
            {current > 0 && (
              <button type="button" className="secondary" onClick={() => go(current - 1)}>
                <Icon name="back" size={14} />
                Previous
              </button>
            )}
            {current < steps.length && (
              <button type="button" className="primary" disabled={!answered} onClick={() => go(current + 1)}>
                {current === steps.length - 1 ? 'Apply it' : 'Next step'}
                <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
