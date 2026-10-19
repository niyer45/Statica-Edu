import { FATIGUE_ASSUMPTIONS, FATIGUE_SOURCE_NOTE, FATIGUE_UNSUPPORTED_EFFECTS } from '../../../physics/fatigue/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'
import { FATIGUE_SOURCE_DISCLOSURE } from './shared'

// Fatigue reference (task 70; FAT-15, D-56). Static explanatory text only, no computed numbers:
// typeset formulas, key points, and the assumptions, sources and unmodeled effects in the
// collapsed disclosure.

export default function FatigueHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Fatigue at a stress raiser" icon="book" onClose={onClose}>
      <Formula tex={String.raw`K_f = 1 + q\,(K_t - 1), \qquad q = \dfrac{1}{1 + \sqrt{a}/\sqrt{r}}`} text="Kf = 1 + q·(Kt − 1), q = 1 ÷ (1 + √a ÷ √r)" caption="The fillet's stress concentration Kt, softened by the notch sensitivity q" />
      <Formula tex={String.raw`\sigma_a = K_f \, \dfrac{32 M_a}{\pi d^{3}}, \qquad \sigma_m = K_f \, \dfrac{32 M_m}{\pi d^{3}}`} text="σa = Kf · 32·Ma ÷ (π·d³), σm = Kf · 32·Mm ÷ (π·d³)" caption="Alternating and mean bending stress at the fillet" />
      <Formula tex={String.raw`S_e = k_a \, k_b \, k_c \, k_d \, k_e \, S_e'`} text="Se = ka·kb·kc·kd·ke·Se′" caption="Endurance limit: surface, size, load, temperature and reliability factors" />
      <Formula tex={String.raw`n_f = \dfrac{1}{\dfrac{\sigma_a}{S_f(N)} + \dfrac{\sigma_m}{S_{ut}}}`} text="n_f = 1 ÷ (σa ÷ S_f(N) + σm ÷ S_ut)" caption="Modified Goodman safety factor at the target life N, with S_f(N) from the S-N line" />
      <KeyPoints
        points={[
          'Cracks start where the local stress swings most: at the fillet, not in the plain neck.',
          'A larger fillet lowers Kt, but it eats the flat shoulder face the hub sits on.',
          'Surface finish changes the endurance limit as much as a big change in size.',
          'A steady (mean) stress uses up part of the strength, so less swing is allowed.',
          'Below the endurance limit the S-N line predicts no failure; above it, a finite life.',
        ]}
      />
      <FinePrint unsupported={FATIGUE_UNSUPPORTED_EFFECTS}>
        <p>Assumptions: {FATIGUE_ASSUMPTIONS.filter((a) => a !== FATIGUE_SOURCE_NOTE).join('; ')}.</p>
        <p>{FATIGUE_SOURCE_DISCLOSURE}</p>
      </FinePrint>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits, not a fatigue certification. Fatigue data scatter widely; these are
        screening estimates from published correlations, shown for the latest tested design.
      </div>
    </Dialog>
  )
}
