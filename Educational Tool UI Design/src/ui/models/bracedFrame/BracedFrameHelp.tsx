import { BRACED_FRAME_UNSUPPORTED_EFFECTS } from '../../../physics/bracedFrame/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'

// Pin-jointed frame reference (task 49.3; BFR-01, BFR-10, BFR-13). Static explanatory text only,
// no computed numbers. The full BFR-01 idealization sentence is in the challenge statement.

export default function BracedFrameHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Pin-jointed frame" icon="book" onClose={onClose}>
      <Formula tex={String.raw`P_t = A \, f_y`} text="P_t = A·f_y" caption="Tension capacity: area times yield stress" />
      <Formula
        tex={String.raw`P_c = \min\left(A \, f_y,\ \dfrac{\pi^{2} E I}{L^{2}}\right)`}
        text="P_c = min(A·f_y, π²EI ÷ L²)"
        caption="Compression capacity: squash load or Euler buckling over the full member length"
      />
      <Formula tex={String.raw`u = \dfrac{\lvert N \rvert}{P}`} text="u = |N| ÷ P" caption="Utilization: member force over its capacity (nominal, no safety factors)" />
      <KeyPoints
        points={[
          'Pin-jointed: every joint is a hinge, so members carry only tension or compression.',
          'Without a diagonal, a storey cannot resist sideways load; real welded or bolted joints add bending resistance this model ignores.',
          'Sideways load reaches the supports through the diagonals; a diagonal’s direction decides whether it is pulled or pushed.',
          'Stability here means the idealized frame is stable rather than a mechanism, not global buckling.',
          'Roof drift is the average sideways movement of the two roof joints.',
        ]}
      />
      <FinePrint unsupported={BRACED_FRAME_UNSUPPORTED_EFFECTS} />
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
