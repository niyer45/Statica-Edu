import { BRACKET_UNSUPPORTED_EFFECTS } from '../../../physics/bracket/constants'
import Dialog from '../../dialogs/Dialog'
import { BRACKET_KT_DISCLOSURE } from './shared'

// Bracket reference (task 46.3; MBR-03, MBR-15, MBR-16, MBR-20, D-41). Static explanatory text
// only, no computed numbers. Discloses the secondary-copy source of the Kt coefficients.

export default function BracketHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Stress concentration" icon="book" onClose={onClose}>
      <p>
        The tip force bends the bracket. The bending moment is largest at the wall and falls to zero at the tip, so the deep root
        and the thinner arm each carry a different share of it. Stress is checked at two sections: the root, and the step where the
        arm begins.
      </p>
      <div className="formula">
        σ = 6M / (b·h²) <span>Nominal bending stress in a section of depth h</span>
      </div>
      <div className="formula">
        σ_step = Kt · σ_nominal <span>A sharp shoulder fillet raises the local stress at the step</span>
      </div>
      <p>
        Kt is a local elastic peak at the fillet. It does not change the moment, the deflection or the root stress. A larger fillet
        radius lowers Kt; moving the step toward the tip puts it where the moment is lower. The peak stress is the larger of the root
        and step values, and it is compared with the allowable stress. Kt is only defined inside the range of its published curve
        fit; outside it the model is not applicable and no peak stress is reported.
      </p>
      <p>{BRACKET_KT_DISCLOSURE}</p>
      <p>This idealized model does not include: {BRACKET_UNSUPPORTED_EFFECTS.join(', ')}.</p>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits (peak elastic stress within the allowable), not a
        real-world approval. Warnings and model applicability are shown for the latest tested design. These are educational screening
        checks, not certification rules.
      </div>
    </Dialog>
  )
}
