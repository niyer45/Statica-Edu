import Icon from '../icons/Icon'

// Visible reason beside a control that is locked in the current Guided step (task 58). The lock
// is also conveyed by the control itself (read-only or disabled), never by color alone.

export default function LockNote({ id, reason }: { id: string; reason: string }) {
  return (
    <p id={id} className="field-note guided-lock">
      <Icon name="lock" size={10} /> {reason}
    </p>
  )
}
