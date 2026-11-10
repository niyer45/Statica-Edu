import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../icons/Icon'

export interface DialogProps {
  title: string
  icon?: string
  onClose: () => void
  children: ReactNode
  /** Accessible name when it must differ from the visible heading (task 78.4: "Step N of M: <title>"). */
  ariaLabel?: string
  /** A backdrop click closes by default; false makes the dialog close only through its own controls. */
  dismissOnBackdrop?: boolean
  /** Marks the dialog (`data-dialog-kind`) so a queued dialog can tell its own from others. */
  kind?: string
}

/** Shared template-styled modal with a focus trap and opener restoration (task 22.1). */
export default function Dialog({ title, icon = 'book', onClose, children, ariaLabel, dismissOnBackdrop = true, kind }: DialogProps) {
  const titleId = useId()
  const dialog = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current!
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter((node) => !node.closest('[hidden], [inert]'))
    ;(focusable()[0] ?? element).focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0] ?? element, last = items[items.length - 1] ?? element
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    const focusin = (event: FocusEvent) => { if (!element.contains(event.target as Node)) (focusable()[0] ?? element).focus() }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin)
      const target = opener?.isConnected && !opener.closest('[hidden]') ? opener : document.querySelector<HTMLElement>('.run-test')
      target?.focus()
    }
  }, [])
  return createPortal(<div className="modal-backdrop" onClick={dismissOnBackdrop ? () => close.current() : undefined}>
    <section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabel === undefined ? titleId : undefined} data-dialog-kind={kind} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
      <div className="modal-icon"><Icon name={icon} size={23} /></div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </section>
  </div>, document.body)
}
