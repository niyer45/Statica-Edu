import { BRACKET_ASSUMPTIONS, BRACKET_SOURCE_NOTE, BRACKET_UNSUPPORTED_EFFECTS } from '../../../physics/bracket/constants'
import Dialog from '../../dialogs/Dialog'
import { FinePrint, Formula, KeyPoints } from '../../dialogs/Reference'
import { BRACKET_SOURCE_DISCLOSURE } from './shared'

// Bracket reference (task 55 L-bracket). Static explanatory text only, no computed numbers. Lists
// the model assumptions, the sources and the effects the model leaves out.

export default function BracketHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Bend stress and bolt loads" icon="book" onClose={onClose}>
      <Formula tex={String.raw`M = P \, a`} text="M = P·a" caption="Moment at the bend from the load P hanging a distance a from the wall" />
      <Formula tex={String.raw`\sigma = k \, \dfrac{6 M}{w \, t^{2}}`} text="σ = k · 6M ÷ (w·t²)" caption="Bend stress at the inner fibre; k is the curved-beam factor" />
      <Formula tex={String.raw`T = \dfrac{P \, a}{n \, h}`} text="T = P·a ÷ (n·h)" caption="Tension in each of the n bolts; h is the bolt-row height above the heel" />
      <KeyPoints
        points={[
          'The bend carries the largest moment in the bracket.',
          'A tight inner radius raises k and the inner-fibre stress; a gentle bend brings k toward 1.',
          'Thickness is the strongest lever on stress and stiffness, but it adds mass.',
          'A taller flange lowers bolt tension, but adds rotation, deflection and mass.',
          'A larger bend radius raises the heel and shortens the bolts’ lever arm.',
        ]}
      />
      <FinePrint unsupported={BRACKET_UNSUPPORTED_EFFECTS}>
        <p>Assumptions: {BRACKET_ASSUMPTIONS.filter((a) => a !== BRACKET_SOURCE_NOTE).join('; ')}.</p>
        <p>{BRACKET_SOURCE_DISCLOSURE}</p>
      </FinePrint>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits, not a real-world approval. Warnings and model
        applicability are shown for the latest tested design. These are educational screening checks, not certification rules.
      </div>
    </Dialog>
  )
}
