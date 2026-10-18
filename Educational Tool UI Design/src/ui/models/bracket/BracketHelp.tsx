import { BRACKET_ASSUMPTIONS, BRACKET_SOURCE_NOTE, BRACKET_UNSUPPORTED_EFFECTS } from '../../../physics/bracket/constants'
import Dialog from '../../dialogs/Dialog'
import { BRACKET_SOURCE_DISCLOSURE } from './shared'

// Bracket reference (task 55 L-bracket). Static explanatory text only, no computed numbers. Lists
// the model assumptions, the sources and the effects the model leaves out.

export default function BracketHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Dialog title="Bend stress and bolt loads" icon="book" onClose={onClose}>
      <p>
        The hanging load P acts at a distance a from the wall, so it tries to turn the bracket away from the wall with a moment
        M = P·a. That moment passes through the arm, around the bend and into the flange, so the bend carries the largest bending
        moment in the bracket.
      </p>
      <div className="formula">
        σ = k · 6M / (w·t²) <span>Bend stress at the inner fibre; k is the curved-beam factor</span>
      </div>
      <p>
        A tight inner radius crowds the stress toward the inside of the bend, so the inner fibre carries more than the straight-beam
        value. The curved-beam factor k grows as the inner radius gets small compared with the thickness, and falls toward one for a
        gentle bend. Thickness is the strongest lever on stress and stiffness, but it also adds mass.
      </p>
      <div className="formula">
        T = P·a / (n·h) <span>Tension in each of the n bolts; h is the height of the bolt row above the heel</span>
      </div>
      <p>
        The bracket pivots about its heel, where the flange leaves the wall at the start of the bend, and the bolt row holds it back.
        A taller flange gives the bolts a longer lever arm and less tension, but the longer flange span also lets the bracket rotate
        more, which adds to the deflection at the load, and it adds mass. A larger bend radius raises the heel and shortens that lever
        arm.
      </p>
      <p>Assumptions: {BRACKET_ASSUMPTIONS.filter((a) => a !== BRACKET_SOURCE_NOTE).join('; ')}.</p>
      <p>{BRACKET_SOURCE_DISCLOSURE}</p>
      <p>This idealized model does not include: {BRACKET_UNSUPPORTED_EFFECTS.join(', ')}.</p>
      <div className="help-limits">
        Accepted means the design meets this challenge&apos;s educational limits, not a real-world approval. Warnings and model
        applicability are shown for the latest tested design. These are educational screening checks, not certification rules.
      </div>
    </Dialog>
  )
}
