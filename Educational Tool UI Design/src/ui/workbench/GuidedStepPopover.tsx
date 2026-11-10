import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Icon from '../icons/Icon'

// Non-modal popover for the Guided step (task 78; WD-05, WD-10 to WD-13). A compact chip is
// always visible; the popover holds the step instruction and its extras.
//
// - It opens automatically on first mount and whenever `autoOpenKey` changes (a new step, or a
//   new attempt that did not meet it), and it never moves focus: the design controls stay usable.
// - There is no focus trap and no backdrop (so `ui/dialogs/Dialog` cannot be reused). Escape and
//   Close dismiss it. Focus goes back to the chip only if it was inside the popover.
// - The chip toggles it (`aria-expanded`, `aria-controls`). The popover is `role="group"` with a
//   name, not a dialog, and adds no live region: step changes are announced elsewhere, through the
//   single `ui/a11y/LiveRegion`.
// - Open/closed is UI state only and is never persisted.

export interface GuidedStepPopoverProps {
  /** Text of the always-visible chip, e.g. "Step 1 of 4: Grow the circle". */
  chipLabel: string
  /** Accessible name of the popover. */
  label: string
  /** Changes whenever the popover should open again by itself. */
  autoOpenKey: string
  /** Always-visible content beside the chip (the lock line). */
  strip?: ReactNode
  /** Popover content. */
  children: ReactNode
}

export default function GuidedStepPopover({ chipLabel, label, autoOpenKey, strip, children }: GuidedStepPopoverProps) {
  const popoverId = useId()
  const [open, setOpen] = useState(true)
  const [seenKey, setSeenKey] = useState(autoOpenKey)
  if (seenKey !== autoOpenKey) {
    // Derived during render (no effect, no extra paint): a new step or attempt reopens it.
    setSeenKey(autoOpenKey)
    setOpen(true)
  }
  const chip = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)

  const dismiss = () => {
    const inside = popover.current?.contains(document.activeElement) ?? false
    setOpen(false)
    if (inside) chip.current?.focus()
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

  return (
    <section className="guided-instructions" aria-label="Guided experiments">
      <div className="guided-strip">
        <button ref={chip} type="button" className="guided-chip" aria-expanded={open} aria-controls={popoverId} onClick={() => (open ? dismiss() : setOpen(true))}>
          <Icon name="tune" size={12} />
          {chipLabel}
        </button>
        {strip}
      </div>
      <div ref={popover} id={popoverId} className="guided-popover" role="group" aria-label={label} hidden={!open}>
        <button type="button" className="guided-popover-close" onClick={dismiss}>
          Close
        </button>
        {children}
      </div>
    </section>
  )
}
