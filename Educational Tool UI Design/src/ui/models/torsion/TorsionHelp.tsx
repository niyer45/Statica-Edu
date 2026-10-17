import { TORSION_UNSUPPORTED_EFFECTS } from '../../../physics/torsion/constants'
import Dialog from '../../dialogs/Dialog'

// Torsion reference (task 47.3; TSH-12). Static explanatory text only, no computed numbers.

export default function TorsionHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Torsional stiffness" icon="book" onClose={onClose}>
      <p>
        A circular shaft resists twisting through its polar moment J. Material far from the center counts much more than material near
        it, so a hollow tube can be stiff without being heavy.
      </p>
      <div className="formula">
        φ = TL / GJ <span>More J → less twist</span>
      </div>
      <div className="formula">
        τ = T·r / J <span>Peak shear stress at the outer surface</span>
      </div>
      <p>This idealized model does not include: {TORSION_UNSUPPORTED_EFFECTS.join(', ')}.</p>
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
