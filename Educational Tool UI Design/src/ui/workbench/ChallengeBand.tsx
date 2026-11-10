import { catalog } from '../../challenge/catalog'
import { useChallenge } from '../state/store'
import ChallengeStatement from './ChallengeStatement'

// The challenge band (task 78.2, WD-20–WD-24): the first thing in the workbench. The card's goal
// line (catalog description, unchanged) is the headline; the first sentence of the statement is a
// visible paragraph and the rest sits word for word in "More about this challenge". The statement
// is rendered here once; the Checks panel no longer carries it.

export interface ChallengeBandViewProps {
  /** The challenge's catalog card summary line, shown as the goal headline. */
  headline?: string
  /** The statement text from the challenge data, unchanged. */
  statement: string
}

export function ChallengeBandView({ headline, statement }: ChallengeBandViewProps) {
  return (
    <section className="challenge-band" aria-labelledby="challenge-band-title">
      <h2 id="challenge-band-title">The challenge</h2>
      {headline !== undefined && <p className="challenge-goal">{headline}</p>}
      <ChallengeStatement text={statement} leadSentences={1} />
    </section>
  )
}

export default function ChallengeBand() {
  const ch = useChallenge()
  const entry = catalog.find((e) => e.available && e.challengeId === ch.id)
  return <ChallengeBandView headline={entry?.description} statement={ch.statement} />
}
