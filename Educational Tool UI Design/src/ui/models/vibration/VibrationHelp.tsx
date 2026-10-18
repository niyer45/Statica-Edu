import { VIBRATION_UNSUPPORTED_EFFECTS } from '../../../physics/vibration/constants'
import Dialog from '../../dialogs/Dialog'

// Vibration isolation reference (task 50.3; VIB-02, VIB-12). Static explanatory text only, no
// computed numbers.

export default function VibrationHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Vibration isolation" icon="book" onClose={onClose}>
      <p>
        A component on springy mounts has a natural frequency. Base vibration far below it passes straight through, vibration near it is
        amplified, and vibration well above it is reduced. Isolation starts once the frequency ratio r = f / fₙ is above √2.
      </p>
      <div className="formula">
        fₙ = (1 / 2π)·√(k / m) <span>Softer mount → lower natural frequency, but more sag</span>
      </div>
      <div className="formula">
        TR = √[(1 + (2ζr)²) / ((1 − r²)² + (2ζr)²)] <span>Vibration transmitted to the component</span>
      </div>
      <p>
        Damping ζ limits the resonance peak but transmits a little more vibration well above resonance. This is a steady-state frequency
        response at each frequency, not a simulation of motion over time.
      </p>
      <p>This idealized model does not include: {VIBRATION_UNSUPPORTED_EFFECTS.join(', ')}.</p>
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
