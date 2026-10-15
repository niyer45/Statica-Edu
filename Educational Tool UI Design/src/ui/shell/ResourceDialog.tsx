import Icon from '../icons/Icon'

// Help & resources dialog (task 13.5; Req 34.8, 34.9). Names the product "Statica" and
// describes work as local to this session (no account or cloud sync).

export const ABOUT_TITLE = 'About Statica'

export interface ResourceDialogProps {
  title: string
  onClose: () => void
  onExplore: () => void
}

export default function ResourceDialog({ title, onClose, onExplore }: ResourceDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <button type="button" className="modal-close" aria-label="Close resources" onClick={onClose}>
          ×
        </button>
        <div className="modal-icon">
          <Icon name="book" size={23} />
        </div>
        <h2>{title}</h2>
        <p>
          Statica connects a growing challenge library, learning paths, design workspaces, and reflection. Start with
          the available cantilever challenge to inspect, predict, modify, test, compare, and explain.
        </p>
        <p>
          Preview challenges and freeform tools show how this learning space can grow. They do not yet include validated
          simulations. All current work is local to this session; no account or cloud sync is required.
        </p>
        <button type="button" className="primary modal-primary" onClick={onExplore}>
          Explore challenges
          <Icon name="arrow" size={15} />
        </button>
      </section>
    </div>
  )
}
