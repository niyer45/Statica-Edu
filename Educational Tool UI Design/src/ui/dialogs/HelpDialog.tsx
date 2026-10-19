import Icon from '../icons/Icon'
import ModalFrame from './ModalFrame'
import { FinePrint, Formula, KeyPoints } from './Reference'

// STUB (task 13.3): the template help / "Section stiffness" modal moved here unchanged in
// content (no computed numbers). Task 22.2 moves it onto the `Dialog` primitive. Task 65: typeset
// formula and key points instead of paragraphs.

export default function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <ModalFrame title="Section stiffness" icon="book" onClose={onClose}>
      <Formula tex={String.raw`\delta = \dfrac{F L^{3}}{3 E I}`} text="δ = FL³ ÷ 3EI" caption="Tip deflection of a cantilever with a load F at its tip" />
      <KeyPoints
        points={[
          'Material far from the neutral axis adds most to the second moment of area I.',
          'More I means less bending deflection.',
          'Assumes a straight, slender, linearly elastic beam with a fixed root.',
        ]}
      />
      <FinePrint unsupported={['local buckling', 'torsion', 'joints', 'stress concentrations']} />
      <div className="help-limits">
        Warnings and model applicability are shown for the latest tested design. These are
        educational screening checks, not certification rules.
      </div>
      <button type="button" className="primary modal-primary" onClick={onClose}>
        Back to design
        <Icon name="arrow" size={15} />
      </button>
    </ModalFrame>
  )
}
