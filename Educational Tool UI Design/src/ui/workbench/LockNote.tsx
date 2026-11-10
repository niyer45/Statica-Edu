import Icon from '../icons/Icon'

// Mark for a control that is locked in the current Guided step (tasks 58, 78). The full sentence
// is no longer repeated under every control: the strip above the workbench carries one line
// (`guided-lock-line`), and each locked control shows a small lock icon here. The node keeps the
// `id` the control already points at with `aria-describedby`, and holds the reason as text for
// assistive technology, so the lock is never conveyed by colour alone (the control itself is
// also read-only or disabled).

export default function LockNote({ id, reason }: { id: string; reason: string }) {
  return (
    <span id={id} className="guided-lock-mark">
      <Icon name="lock" size={10} />
      <span className="sr-only">{reason}</span>
    </span>
  )
}
