import Disclosure from './Disclosure'

// Challenge statement with a short visible lead (task 78, WD-04). The first `leadSentences`
// sentences stay visible as a paragraph; the rest, word for word and in order, sits in a
// collapsed "More about this challenge" Disclosure. The statement text is never edited.

// Words that end in a period without ending a sentence.
const ABBREVIATIONS = new Set(['i.e.', 'e.g.', 'etc.', 'vs.', 'approx.', 'fig.', 'eq.', 'no.', 'ca.', 'cf.', 'dr.', 'st.', 'max.', 'min.', 'ref.'])

/**
 * Splits `text` into a lead (the first `leadSentences` sentences) and the rest (everything after
 * them, leading whitespace removed). A sentence ends at ".", "!" or "?" (optionally followed by
 * closing quotes or brackets) that is followed by whitespace and then an uppercase letter, digit,
 * opening quote or bracket. A period inside a number ("4.0 MPa"), glued to the next token
 * ("Ø24.5 mm") or ending a known abbreviation ("i.e.") does not end one. Deterministic and pure.
 */
export function splitStatement(text: string, leadSentences = 2): { lead: string; rest: string } {
  const body = text.trim()
  const count = Math.max(1, Math.floor(leadSentences))
  const boundary = /([.!?]["')\]]*)(\s+)(?=["'(\[]?[A-Z0-9Ø])/g
  let sentences = 0
  let match: RegExpExecArray | null
  while ((match = boundary.exec(body)) !== null) {
    const end = match.index + match[1]!.length
    const word = body.slice(0, end).split(/\s+/).pop()!.toLowerCase().replace(/^["'(\[]+/, '')
    if (ABBREVIATIONS.has(word)) continue
    sentences++
    if (sentences === count) return { lead: body.slice(0, end), rest: body.slice(match.index + match[0].length) }
  }
  return { lead: body, rest: '' }
}

export interface ChallengeStatementProps {
  /** The statement text from the challenge data, unchanged. */
  text: string
  /** Sentences kept visible; the default is 2 (WD-01). */
  leadSentences?: number
}

export default function ChallengeStatement({ text, leadSentences = 2 }: ChallengeStatementProps) {
  const { lead, rest } = splitStatement(text, leadSentences)
  return (
    <>
      <p>{lead}</p>
      {rest !== '' && (
        <Disclosure summary="More about this challenge">
          <p>{rest}</p>
        </Disclosure>
      )}
    </>
  )
}
