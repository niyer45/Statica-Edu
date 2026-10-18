import { HEAT_SINK_UNSUPPORTED_EFFECTS } from '../../../physics/heatSink/constants'
import Dialog from '../../dialogs/Dialog'

// Heat sink reference (task 48.3; HSK-01, HSK-02, HSK-12). Static explanatory text only, no
// computed numbers.

export default function HeatSinkHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Fin heat transfer" icon="book" onClose={onClose}>
      <p>
        Heat enters the base from the component, conducts into the fins and leaves to the air by convection. More exposed surface
        area lowers the base temperature, but each extra square centimetre helps less: tall, thin fins run cooler toward their tips, so
        their outer parts carry less heat.
      </p>
      <div className="formula">
        ΔT = Q · R<sub>total</sub> <span>Base temperature rise above the air</span>
      </div>
      <div className="formula">
        R<sub>conv</sub> = 1 / (η<sub>o</sub> h A<sub>t</sub>) <span>More effective area η_o·A_t → lower resistance</span>
      </div>
      <p>
        The convection coefficient h is given for low-speed fan-assisted airflow; the model does not compute it. The minimum fin gap
        stands in for the airflow between closely spaced fins, which the model does not calculate.
      </p>
      <p>This idealized model does not include: {HEAT_SINK_UNSUPPORTED_EFFECTS.join(', ')}.</p>
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
