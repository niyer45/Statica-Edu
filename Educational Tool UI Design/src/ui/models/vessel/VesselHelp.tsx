import { VESSEL_ASSUMPTIONS, VESSEL_SOURCE_NOTE, VESSEL_UNSUPPORTED_EFFECTS } from '../../../physics/vessel/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'
import { VESSEL_SOURCE_DISCLOSURE } from './shared'

// Pressure vessel reference (task 69; PVS-15, D-56). Static explanatory text only, no computed
// numbers: the model's formulas typeset with fractions, key points, and the assumptions, sources
// and unmodeled effects collapsed in the fine print.

export default function VesselHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Pressure vessel stresses" icon="book" onClose={onClose}>
      <Formula tex={String.raw`\sigma_{h} = \dfrac{p \, r}{t_{s}}`} text="σh = p·r ÷ ts" caption="Hoop stress around the shell; r is the inner radius and ts the shell wall" />
      <Formula tex={String.raw`\sigma_{l} = \dfrac{p \, r}{2 \, t_{s}}`} text="σl = p·r ÷ (2·ts)" caption="Longitudinal stress along the shell, from the pressure on the closed ends" />
      <Formula tex={String.raw`\sigma_{\mathrm{head}} = \dfrac{p \, r}{2 \, t_{h}}`} text="σhead = p·r ÷ (2·th)" caption="Membrane stress in a hemispherical head of wall th" />
      <Formula tex={String.raw`V = \pi r^{2} L + \dfrac{4}{3} \pi r^{3}`} text="V = π·r²·L + (4/3)·π·r³" caption="Internal volume of the shell of length L and the two heads" />
      <Formula tex={String.raw`\sigma_{\mathrm{allow}} = \dfrac{\sigma_{y}}{n}`} text="σallow = σy ÷ n" caption="Allowable stress: the yield stress divided by the design factor n" />
      <KeyPoints
        points={[
          'The hoop stress is always twice the longitudinal stress, so the hoop stress governs the shell.',
          'Stress grows with the radius and falls with the wall thickness: a wider vessel needs thicker walls.',
          'A hemispherical head works at half the stress of a shell with the same wall, so it can be about half as thick.',
          'For the same volume, a wider and shorter vessel keeps more of its volume in the heads.',
          'The formulas hold for thin walls only: the inner radius must be at least ten times the wall.',
        ]}
      />
      <FinePrint unsupported={VESSEL_UNSUPPORTED_EFFECTS}>
        <p>Assumptions: {VESSEL_ASSUMPTIONS.filter((a) => a !== VESSEL_SOURCE_NOTE).join('; ')}.</p>
        <p>{VESSEL_SOURCE_DISCLOSURE}</p>
      </FinePrint>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits, not a real-world approval or a pressure-vessel code
        check. Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
