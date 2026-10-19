import { AXIAL_ASSUMPTIONS, AXIAL_UNSUPPORTED_EFFECTS } from '../../../physics/axial/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'

// Stress and Strain I reference (task 72; SSR-12, SSR-15, D-56). Static explanatory text only, no
// computed numbers: typeset formulas with fractions, key points and the model's limits.

export const AXIAL_SOURCES =
  'Sources: Gere & Goodno, Mechanics of Materials; Hibbeler, Mechanics of Materials; Budynas & Nisbett, Shigley’s Mechanical Engineering Design (design factor); typical material values from Callister & Rethwisch, Materials Science and Engineering. Edition and equation numbers pending engineering review.'

export default function AxialHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Stress and strain" icon="book" onClose={onClose}>
      <Formula tex={String.raw`\sigma = \dfrac{P}{A}, \qquad A = \dfrac{\pi d^{2}}{4}`} text="σ = P ÷ A, A = πd² ÷ 4" caption="Axial stress: the load spread over the cross-section" />
      <Formula tex={String.raw`\varepsilon = \dfrac{\delta}{L} = \dfrac{\sigma}{E}`} text="ε = δ ÷ L = σ ÷ E" caption="Strain, and Hooke's law with Young's modulus E" />
      <Formula tex={String.raw`\delta = \dfrac{P L}{A E}`} text="δ = PL ÷ AE" caption="Elongation of the rod" />
      <Formula tex={String.raw`\sigma \le \dfrac{\sigma_{y}}{n}`} text="σ ≤ σy ÷ n" caption="Stress check: yield strength divided by the design factor n" />
      <KeyPoints
        points={[
          'Stress depends only on the load and the area, not on the material.',
          "Stretch depends on the area and on the material's stiffness, Young's modulus E.",
          'Strength (yield) and stiffness (E) are different properties: a stiff material is not always a strong one.',
          'Mass grows with the area and the density, so the lightest good rod depends on the material.',
        ]}
      />
      <FinePrint unsupported={AXIAL_UNSUPPORTED_EFFECTS}>
        <p>Assumptions: {AXIAL_ASSUMPTIONS.join('; ')}.</p>
        <p>{AXIAL_SOURCES}</p>
      </FinePrint>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits, not a real-world approval. A rod at or beyond its
        yield strength is outside the model: yielding and necking are not modeled. These are educational screening checks, not
        certification rules.
      </div>
    </Dialog>
  )
}
