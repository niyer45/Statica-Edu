import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from 'react'
import Dialog from '../dialogs/Dialog'
import Icon from '../icons/Icon'

// Guided stepper row and modal step dialog (task 78; task 78.3, WD-30 to WD-36; task 78.4, WD-40 to
// WD-47, which supersedes the non-modal popover of WD-10 to WD-13).
//
// - A horizontal stepper lists the Guided steps (an ordered list in a `nav`). The current step is
//   a button (`aria-haspopup="dialog"`) that opens the step dialog; completed and locked steps are
//   plain items. When every step is met the "All N steps complete" text is that button.
// - The step dialog is the shared modal `ui/dialogs/Dialog`: body portal, `aria-modal`, focus trap,
//   Escape, dimmed backdrop. Initial focus is the dialog's first focusable (its Close button), as in
//   every other dialog. A backdrop click does not dismiss it: "Got it", Close or Escape do, and focus
//   then returns to the current step button.
// - It opens when the workbench becomes visible (entering a challenge in Guided, including reload
//   and resume) and whenever `autoOpenKey` changes (a new step, or all steps complete). A failed attempt does not change the key. It never
//   opens on top of another dialog: while one is open it waits and opens when that one closes.
// - `feedback` is one short line directly under the row; it adds no live region. Open/closed state is
//   UI state only and is never persisted.

export type StepState = 'complete' | 'current' | 'locked'

export interface StepperStep {
  id: string
  title: string
  state: StepState
}

const STATE_TEXT: Record<StepState, string> = { complete: 'completed', current: 'current step', locked: 'locked' }
const KIND = 'guided-step'

/** True while any dialog other than a step dialog is in the document. */
function otherDialogOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some((d) => d.getAttribute('data-dialog-kind') !== KIND && !d.closest('[hidden]'))
}

/**
 * Tracks the two document conditions the dialog depends on: whether another dialog is open, and
 * whether the row is visible (the workbench stays mounted but `hidden` while another page is shown,
 * Req 34.6, so "entering the challenge" is the host becoming visible).
 */
function useDocumentState(row: RefObject<HTMLElement | null>): { blocked: boolean; visible: boolean } {
  const [blocked, setBlocked] = useState(otherDialogOpen)
  const [visible, setVisible] = useState(false)
  useLayoutEffect(() => {
    const sync = () => {
      setBlocked(otherDialogOpen())
      setVisible(row.current !== null && row.current.closest('[hidden]') === null)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })
    return () => observer.disconnect()
  }, [row])
  return { blocked, visible }
}

export interface GuidedStepDialogProps {
  /** The Guided steps in order, each with its state. */
  steps: ReadonlyArray<StepperStep>
  /** Set when every step is met, e.g. "All 4 steps complete"; it becomes the opening button. */
  completeLabel?: string
  /** Accessible name of the dialog, e.g. "Step 2 of 4: Grow the circle". */
  label: string
  /** The dialog heading (the step title). */
  title: string
  /** Changes whenever the dialog should open again by itself. */
  autoOpenKey: string
  /** One short line under the stepper row after an attempt that did not meet the step. */
  feedback?: ReactNode
  /** Dialog content under the heading (the current step only). */
  children: ReactNode
}

export default function GuidedStepDialog({ steps, completeLabel, label, title, autoOpenKey, feedback, children }: GuidedStepDialogProps) {
  const [wanted, setWanted] = useState(true)
  const [seenKey, setSeenKey] = useState(autoOpenKey)
  if (seenKey !== autoOpenKey) {
    // Derived during render (no effect, no extra paint): a new step reopens it.
    setSeenKey(autoOpenKey)
    setWanted(true)
  }
  const row = useRef<HTMLElement>(null)
  const { blocked, visible } = useDocumentState(row)
  // Entering the challenge (the workbench becoming visible) opens it again.
  useEffect(() => {
    if (visible) setWanted(true)
  }, [visible])
  const shown = wanted && visible && !blocked
  const toggle = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  const close = () => {
    returnFocus.current = true
    setWanted(false)
  }
  // Runs after the dialog's own cleanup (which restores its opener), so the step button wins.
  useEffect(() => {
    if (!shown && returnFocus.current) {
      returnFocus.current = false
      toggle.current?.focus()
    }
  }, [shown])

  return (
    <section ref={row} className="guided-instructions" aria-label="Guided experiments">
      <nav className="guided-stepper" aria-label="Guided steps">
        <ol>
          {steps.map((s, i) => (
            <li key={s.id} className={`guided-step ${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
              {s.state === 'current' ? (
                <button ref={toggle} type="button" className="guided-step-body" aria-haspopup="dialog" onClick={() => setWanted(true)}>
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
          <button ref={toggle} type="button" className="guided-complete" aria-haspopup="dialog" onClick={() => setWanted(true)}>
            <Icon name="check" size={12} />
            {completeLabel}
          </button>
        )}
      </nav>
      {feedback !== undefined && <p className="guided-feedback">{feedback}</p>}
      {shown && (
        <Dialog title={title} ariaLabel={label} icon="book" kind={KIND} dismissOnBackdrop={false} onClose={close}>
          {children}
          <button type="button" className="primary modal-primary" onClick={close}>Got it</button>
        </Dialog>
      )}
    </section>
  )
}
