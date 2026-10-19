import { TORSION_UNSUPPORTED_EFFECTS } from '../../../physics/torsion/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'

// Torsion reference (task 47.3; TSH-12). Static explanatory text only, no computed numbers.

export default function TorsionHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Torsional stiffness" icon="book" onClose={onClose}>
      <Formula tex={String.raw`\varphi = \dfrac{T L}{G J}`} text="φ = TL ÷ GJ" caption="Angle of twist" />
      {/* Task 71 (D-61): the one idea of the introductory challenge, J, is shown as well. */}
      <Formula tex={String.raw`J = \dfrac{\pi\,(D^{4} - d^{4})}{32}`} text="J = π(D⁴ − d⁴) ÷ 32" caption="Polar moment of a tube; d = 0 for a solid shaft" />
      <Formula tex={String.raw`\tau_{\max} = \dfrac{T r}{J}`} text="τ = Tr ÷ J" caption="Peak shear stress, at the outer surface" />
      <KeyPoints
        points={[
          'The polar moment J grows quickly with the distance of material from the center.',
          'More J means less twist and lower stress.',
          'A hollow tube can be stiff without being heavy.',
        ]}
      />
      <FinePrint unsupported={TORSION_UNSUPPORTED_EFFECTS} />
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
