import { VIBRATION_UNSUPPORTED_EFFECTS } from '../../../physics/vibration/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'

// Vibration isolation reference (task 50.3; VIB-02, VIB-12). Static explanatory text only, no
// computed numbers.

export default function VibrationHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Vibration isolation" icon="book" onClose={onClose}>
      <Formula tex={String.raw`f_n = \dfrac{1}{2\pi}\sqrt{\dfrac{k}{m}}`} text="fₙ = (1 ÷ 2π)·√(k ÷ m)" caption="Natural frequency of the component on its mounts" />
      <Formula tex={String.raw`r = \dfrac{f}{f_n}`} text="r = f ÷ fₙ" caption="Frequency ratio: operating frequency over natural frequency" />
      <Formula
        tex={String.raw`T\!R = \sqrt{\dfrac{1 + (2\zeta r)^{2}}{\left(1 - r^{2}\right)^{2} + (2\zeta r)^{2}}}`}
        text="TR = √[(1 + (2ζr)²) ÷ ((1 − r²)² + (2ζr)²)]"
        caption="Share of the base vibration transmitted to the component"
      />
      <KeyPoints
        points={[
          'Isolation starts once the frequency ratio r is above √2.',
          'A softer mount lowers fₙ, but the component sags more.',
          'More damping ζ lowers the resonance peak but passes a little more vibration well above it.',
          'This is steady-state frequency response, not a simulation of motion over time.',
        ]}
      />
      <FinePrint unsupported={VIBRATION_UNSUPPORTED_EFFECTS} />
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
