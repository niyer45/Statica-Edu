import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Icon from '../icons/Icon'

// Guided stepper row and non-modal step popover (task 78; WD-05, WD-10 to WD-13, amended by
// task 78.3, WD-30 to WD-36).
//
// - A horizontal stepper lists the Guided steps (an ordered list in a `nav`). The current step
//   is a button that toggles the popover (`aria-expanded`, `aria-controls`); completed and
//   locked steps are plain items. When every step is met the "All N steps complete" text is the
//   toggle.
// - The popover opens automatically on first mount and whenever `autoOpenKey` changes (a new
//   step, or a new attempt that did not meet it), and it never moves focus: the design controls
//   stay usable.
// - There is no focus trap and no backdrop (so `ui/dialogs/Dialog` cannot be reused). Escape and
//   Close dismiss it. Focus goes back to the toggle only if it was inside the popover.
// - The popover is `role="group"` with a name, not a dialog, and adds no live region: step
//   changes are announced elsewhere, through the single `ui/a11y/LiveRegion`. It renders in flow
//   under the row, so it never covers the challenge band or the 3D view (D-26).
// - Open/closed is UI state only and is never persisted.

export type StepState = 'complete' | 'current' | 'locked'

export interface StepperStep {
  id: string
  title: string
  state: StepState
}

const STATE_TEXT: Record<StepState, string> = { complete: 'completed', current: 'current step', locked: 'locked' }

export interface GuidedStepPopoverProps {
  /** The Guided steps in order, each with its state. */
  steps: ReadonlyArray<StepperStep>
  /** Set when every step is met, e.g. "All 4 steps complete"; it becomes the toggle. */
  completeLabel?: string
  /** Accessible name of the popover. */
  label: string
  /** Changes whenever the popover should open again by itself. */
  autoOpenKey: string
  /** Popover content (the current step only). */
  children: ReactNode
}

export default function GuidedStepPopover({ steps, completeLabel, label, autoOpenKey, children }: GuidedStepPopoverProps) {
  const popoverId = useId()
  const [open, setOpen] = useState(true)
  const [seenKey, setSeenKey] = useState(autoOpenKey)
  if (seenKey !== autoOpenKey) {
    // Derived during render (no effect, no extra paint): a new step or attempt reopens it.
    setSeenKey(autoOpenKey)
    setOpen(true)
  }
  const toggle = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)

  const dismiss = () => {
    const inside = popover.current?.contains(document.activeElement) ?? false
    setOpen(false)
    if (inside) toggle.current?.focus()
  }
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      // A modal dialog on top handles Escape itself (capture + stopPropagation).
      if (event.key === 'Escape' && !event.defaultPrevented) dismissRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const onToggle = () => (open ? dismiss() : setOpen(true))

  return (
    <section className="guided-instructions" aria-label="Guided experiments">
      <nav className="guided-stepper" aria-label="Guided steps">
        <ol>
          {steps.map((s, i) => (
            <li key={s.id} className={`guided-step ${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
              {s.state === 'current' ? (
                <button ref={toggle} type="button" className="guided-step-body" aria-expanded={open} aria-controls={popoverId} onClick={onToggle}>
                  <span className="guided-step-dot" aria-hidden="true">{i + 1}</span>
                  <span className="guided-step-label">{s.title}</span>
                  <span className="sr-only">, {STATE_TEXT[s.state]}</span>
                </button>
              ) : (
                <span className="guided-step-body">
                  <span className="guided-step-dot" aria-hidden="true">{s.state === 'complete' ? <Icon name="check" size={11} /> : i + 1}</span>
                  <span className="guided-step-label">{s.title}</span>
                  {s.state === 'locked' && <Icon name="lock" size={10} />}
                  <span className="sr-only">, {STATE_TEXT[s.state]}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
        {completeLabel !== undefined && (
          <button ref={toggle} type="button" className="guided-complete" aria-expanded={open} aria-controls={popoverId} onClick={onToggle}>
            <Icon name="check" size={12} />
            {completeLabel}
          </button>
        )}
      </nav>
      <div ref={popover} id={popoverId} className="guided-popover" role="group" aria-label={label} hidden={!open}>
        <button type="button" className="guided-popover-close" onClick={dismiss}>
          Close
        </button>
        {children}
      </div>
    </section>
  )
}
