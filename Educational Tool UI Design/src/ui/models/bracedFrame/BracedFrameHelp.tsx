import { BRACED_FRAME_UNSUPPORTED_EFFECTS } from '../../../physics/bracedFrame/constants'
import Dialog from '../../dialogs/Dialog'

// Pin-jointed frame reference (task 49.3; BFR-01, BFR-10, BFR-13). Static explanatory text only,
// no computed numbers.

export const PIN_JOINTED_IDEALIZATION =
  'This frame is modeled as pin-jointed: every joint is a hinge, so members carry only tension or compression. Without a diagonal, a storey of this idealized frame cannot resist sideways load. Real frames with welded or bolted joints have some bending resistance that this model ignores.'

export default function BracedFrameHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Pin-jointed frame" icon="book" onClose={onClose}>
      <p>{PIN_JOINTED_IDEALIZATION}</p>
      <p>
        Sideways load travels down the frame through the diagonals to the supports. The direction of a diagonal decides whether it is pulled
        (tension) or pushed (compression). Stability here means only whether this pin-jointed idealization is stable or a mechanism; it is
        not a global or second-order buckling check.
      </p>
      <div className="formula">
        P = A·f<sub>y</sub> <span>Tension capacity: area × yield stress</span>
      </div>
      <div className="formula">
        P = min(A·f<sub>y</sub>, π²EI / L²) <span>Compression capacity: squash load or Euler buckling of the full member length</span>
      </div>
      <div className="formula">
        u = |N| / P <span>Utilization: member force divided by its capacity (nominal, no safety factors)</span>
      </div>
      <p>Roof drift is the average sideways movement of the two roof joints.</p>
      <p>This idealized model does not include: {BRACED_FRAME_UNSUPPORTED_EFFECTS.join(', ')}.</p>
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
