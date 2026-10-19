import { COLUMN_ASSUMPTIONS, COLUMN_SOURCE_NOTE, COLUMN_UNSUPPORTED_EFFECTS } from '../../../physics/column/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'

// Column reference (task 68; CBK-02, CBK-11, CBK-14, D-56). Static explanatory text only, no computed
// numbers: the formulas, the key points of the lesson (stiffness, not strength; I over area; length
// squared; tube beats solid) and, collapsed, the assumptions, sources and unmodeled effects.

export default function ColumnHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Column buckling" icon="book" onClose={onClose}>
      <Formula tex={String.raw`P_{cr} = \dfrac{\pi^{2} E I}{(K L)^{2}}`} text="P_cr = π²EI ÷ (KL)²" caption="Euler critical load; K = 1 for pins at both ends" />
      <Formula tex={String.raw`I = \dfrac{\pi \left(D^{4} - d^{4}\right)}{64}`} text="I = π(D⁴ − d⁴) ÷ 64" caption="Second moment of area of a round tube (d = 0 for a solid bar)" />
      <Formula tex={String.raw`\sigma = \dfrac{P}{A}`} text="σ = P ÷ A" caption="Axial stress, checked against the allowable stress" />
      <Formula tex={String.raw`\lambda = \dfrac{K L}{r} \ge \sqrt{\dfrac{2 \pi^{2} E}{\sigma_{y}}}`} text="λ = KL ÷ r ≥ √(2π²E ÷ σy)" caption="Euler applies only to slender columns; r is the radius of gyration" />
      <KeyPoints
        points={[
          'Buckling is a stiffness failure: a column can bow sideways while its stress is still low.',
          'The critical load depends on E and I, not on the strength of the material.',
          'I grows with the fourth power of the diameter, so material far from the center counts most.',
          'Twice the length means a quarter of the critical load.',
          'A tube beats a solid bar of the same mass, until its wall gets too thin or the column too stocky.',
        ]}
      />
      <FinePrint unsupported={COLUMN_UNSUPPORTED_EFFECTS}>
        <p>Assumptions: {COLUMN_ASSUMPTIONS.filter((a) => a !== COLUMN_SOURCE_NOTE).join('; ')}.</p>
        <p>This model uses the {COLUMN_SOURCE_NOTE}.</p>
      </FinePrint>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits, not a real-world approval. Warnings and model
        applicability are shown for the latest tested design. These are educational screening checks, not certification rules.
      </div>
    </Dialog>
  )
}
