import Icon from '../icons/Icon'
import ModalFrame from './ModalFrame'

// STUB (task 13.3): the template help / "Section stiffness" modal moved here unchanged in
// content (no computed numbers). Task 22.2 moves it onto the `Dialog` primitive.

export default function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <ModalFrame title="Section stiffness" icon="book" onClose={onClose}>
      <p>
        Material farther from a section's neutral axis contributes more to its second moment of area.
        Increasing this property reduces bending deflection.
      </p>
      <div className="formula">
        δ = FL³ / 3EI <span>More I → less bending</span>
      </div>
      <p>
        This model assumes a straight, slender, linearly elastic beam with a fixed root. Local buckling,
        torsion, joints, and stress concentrations are not modeled.
      </p>
      <div className="help-limits">
        Applicability screening: span/depth ≥ 10 and deflection/span ≤ 1/20. These are conservative
        educational thresholds, not certification rules.
      </div>
      <button type="button" className="primary modal-primary" onClick={onClose}>
        Back to design
        <Icon name="arrow" size={15} />
      </button>
    </ModalFrame>
  )
}
