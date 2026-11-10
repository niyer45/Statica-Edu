import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../../challenge/bundled'
import ChallengeStatement, { splitStatement } from './ChallengeStatement'

// Challenge statement lead + "More about this challenge" (task 78, WD-04).
afterEach(cleanup)

const words = (s: string) => s.split(/\s+/).filter(Boolean)

describe('splitStatement', () => {
  it('splits after the requested number of sentences', () => {
    expect(splitStatement('One. Two. Three. Four.', 2)).toEqual({ lead: 'One. Two.', rest: 'Three. Four.' })
    expect(splitStatement('One. Two. Three.', 1)).toEqual({ lead: 'One.', rest: 'Two. Three.' })
    expect(splitStatement('One? Two! Three.', 2)).toEqual({ lead: 'One? Two!', rest: 'Three.' })
  })

  it('has no rest when the text has no more sentences than the lead', () => {
    expect(splitStatement('Only one sentence here.', 2)).toEqual({ lead: 'Only one sentence here.', rest: '' })
    expect(splitStatement('One. Two.', 2)).toEqual({ lead: 'One. Two.', rest: '' })
    expect(splitStatement('', 2)).toEqual({ lead: '', rest: '' })
  })

  it('does not break at decimals, glued units or abbreviations', () => {
    const text = 'Keep stress below 4.0 MPa for the Ø24.5 mm shaft. The rod, i.e. the slender part, must hold. Use e.g. steel. Last one.'
    const { lead, rest } = splitStatement(text, 2)
    expect(lead).toBe('Keep stress below 4.0 MPa for the Ø24.5 mm shaft. The rod, i.e. the slender part, must hold.')
    expect(rest).toBe('Use e.g. steel. Last one.')
    // "vs." and "approx." do not end a sentence either.
    expect(splitStatement('Compare A vs. B at approx. 5 mm. Done.', 1)).toEqual({ lead: 'Compare A vs. B at approx. 5 mm.', rest: 'Done.' })
    // A sentence that starts with a number still starts a sentence.
    expect(splitStatement('Load it. 4.0 MPa is the limit. End.', 1)).toEqual({ lead: 'Load it.', rest: '4.0 MPa is the limit. End.' })
  })

  it('is deterministic and clamps a non-positive lead to one sentence', () => {
    const text = 'A one. A two. A three.'
    expect(splitStatement(text, 2)).toEqual(splitStatement(text, 2))
    expect(splitStatement(text, 0).lead).toBe('A one.')
  })

  it('keeps every word of every bundled statement, in order', () => {
    for (const [id, json] of Object.entries(BUNDLED_CHALLENGE_JSON)) {
      const statement = (json as { statement?: string }).statement
      if (typeof statement !== 'string') continue
      const { lead, rest } = splitStatement(statement, 2)
      expect(words(`${lead} ${rest}`), id).toEqual(words(statement))
      expect(lead.length, id).toBeGreaterThan(0)
    }
  })
})

describe('ChallengeStatement', () => {
  it('shows the lead as a paragraph and folds the rest into a collapsed disclosure', () => {
    const { container } = render(<ChallengeStatement text="First point. Second point. Third point. Fourth point." />)
    const lead = screen.getByText('First point. Second point.')
    expect(lead.tagName).toBe('P')
    expect(lead.closest('details')).toBeNull()
    const details = container.querySelector<HTMLDetailsElement>('details.ei-disclosure')!
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')?.textContent).toBe('More about this challenge')
    expect(details.textContent).toContain('Third point. Fourth point.')
  })

  it('renders no disclosure when nothing remains and honours leadSentences', () => {
    const { container, rerender } = render(<ChallengeStatement text="Short. Statement." />)
    expect(container.querySelector('details')).toBeNull()
    rerender(<ChallengeStatement text="One. Two. Three." leadSentences={1} />)
    expect(screen.getByText('One.')).toBeTruthy()
    expect(container.querySelector('details')?.textContent).toContain('Two. Three.')
  })
})
