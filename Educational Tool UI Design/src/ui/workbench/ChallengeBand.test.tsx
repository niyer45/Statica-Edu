import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON } from '../../challenge/bundled'
import { catalog } from '../../challenge/catalog'
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { ChallengeBandView } from './ChallengeBand'
import { splitStatement } from './ChallengeStatement'
import Workbench from './Workbench'

// The challenge band (task 78.2, WD-20–WD-24).
afterEach(cleanup)

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

function renderWorkbench(mode: 'guided' | 'parametric') {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  return render(
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} initialMode={mode} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

describe('ChallengeBandView', () => {
  it('shows the catalog goal line, the first sentence visible and the remainder collapsed word for word, for all ten challenges', () => {
    const available = catalog.filter((e) => e.available)
    expect(available).toHaveLength(10)
    for (const entry of available) {
      if (!entry.available) continue
      const statement = (BUNDLED_CHALLENGE_JSON[entry.challengeId] as { statement: string }).statement
      const { lead, rest } = splitStatement(statement, 1)
      const { container, unmount } = render(<ChallengeBandView headline={entry.description} statement={statement} />)
      const band = screen.getByRole('region', { name: 'The challenge' })
      expect(within(band).getAllByRole('heading')).toHaveLength(1)
      expect(within(band).getByRole('heading', { level: 2 }).textContent, entry.challengeId).toBe('The challenge')
      expect(container.querySelector('.challenge-goal')?.textContent, entry.challengeId).toBe(entry.description)
      const first = within(band).getByText(lead)
      expect(first.tagName).toBe('P')
      expect(first.closest('details')).toBeNull()
      if (rest === '') {
        expect(band.querySelector('details'), entry.challengeId).toBeNull()
      } else {
        const more = band.querySelector('details')!
        expect(more.open, entry.challengeId).toBe(false)
        expect(more.querySelector('summary')?.textContent).toBe('More about this challenge')
        expect(more.querySelector('.ei-disclosure-body')?.textContent ?? more.textContent, entry.challengeId).toContain(rest)
        fireEvent.click(within(band).getByText('More about this challenge'))
        expect(more.open).toBe(true)
      }
      unmount()
    }
  })
})

describe('ChallengeBand in the Workbench', () => {
  it.each(['guided', 'parametric'] as const)('renders once, before the About row and the Guided chip, in %s mode', (mode) => {
    const { container } = renderWorkbench(mode)
    const bands = container.querySelectorAll('.challenge-band')
    expect(bands).toHaveLength(1)
    const band = bands[0]!
    const entry = catalog.find((e) => e.available && e.challengeId === 'cantilever-beam-1')!
    expect(band.querySelector('.challenge-goal')?.textContent).toBe(entry.description)
    const statement = bundledChallengeResult.ok ? bundledChallengeResult.value.statement : ''
    const { lead } = splitStatement(statement, 1)
    expect(within(band as HTMLElement).getByText(lead).closest('details')).toBeNull()
    // The statement appears once: the Checks panel does not repeat it.
    expect(screen.getAllByText(lead)).toHaveLength(1)
    const panel = screen.getByRole('complementary', { name: 'Checks' })
    expect(within(panel).queryByText('More about this challenge')).toBeNull()
    expect(container.querySelectorAll('details.ei-disclosure > summary').length).toBeGreaterThan(0)
    // DOM order: page title, then the band, then About this model, then the Guided chip.
    const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(container.querySelector('h1')!, band)).toBe(true)
    expect(follows(band, container.querySelector('.about-model')!)).toBe(true)
    expect(follows(band, container.querySelector('.design-panel')!)).toBe(true)
    const chip = container.querySelector('.guided-chip')
    if (mode === 'guided') expect(follows(band, chip!)).toBe(true)
    else expect(chip).toBeNull()
  })
})
