import Icon from '../icons/Icon'
import ReflectionPrompt from '../panels/ReflectionPrompt'
import ModalFrame from './ModalFrame'

// STUB (task 13.3): the template submit modal moved here in look. Opened from the
// PageFooter "Explain & submit" button. Submit stays disabled until task 24.1 wires
// submission gating, the iteration selector, and the result view.

export default function SubmitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <ModalFrame title="Explain & submit" icon="check" onClose={onClose}>
      <ReflectionPrompt />
      <button type="button" className="primary modal-primary" disabled>
        Submit design & reflection
        <Icon name="arrow" size={16} />
      </button>
    </ModalFrame>
  )
}
