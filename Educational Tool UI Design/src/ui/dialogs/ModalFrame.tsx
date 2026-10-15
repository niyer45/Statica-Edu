import { useId, type ReactNode } from 'react'
import Icon from '../icons/Icon'

// Interim template `.modal-backdrop .modal` frame shared by the dialog stubs (task 13.3).
// Task 22.1 replaces it with the `Dialog` primitive (focus trap, Escape, focus restore).

export default function ModalFrame({
  title,
  icon,
  onClose,
  children,
}: {
  title: string
  icon: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-icon">
          <Icon name={icon} size={23} />
        </div>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  )
}
