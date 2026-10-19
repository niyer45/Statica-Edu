import { HEAT_SINK_UNSUPPORTED_EFFECTS } from '../../../physics/heatSink/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'

// Heat sink reference (task 48.3; HSK-01, HSK-02, HSK-12). Static explanatory text only, no
// computed numbers.

export default function HeatSinkHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Fin heat transfer" icon="book" onClose={onClose}>
      <Formula tex={String.raw`\Delta T = Q \, R_{\text{total}}`} text="ΔT = Q·R_total" caption="Base temperature rise above the air" />
      <Formula tex={String.raw`R_{\text{conv}} = \dfrac{1}{\eta_o \, h \, A_t}`} text="R_conv = 1 ÷ (η_o·h·A_t)" caption="Convection resistance: more effective area means lower resistance" />
      <KeyPoints
        points={[
          'More exposed area cools the base, but each extra square centimetre helps less.',
          'Tall, thin fins run cooler toward their tips, so their outer parts carry less heat.',
          'The convection coefficient h is given for low-speed fan-assisted airflow; the model does not compute it.',
          'The minimum fin gap stands in for the airflow between close fins.',
        ]}
      />
      <FinePrint unsupported={HEAT_SINK_UNSUPPORTED_EFFECTS} />
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
