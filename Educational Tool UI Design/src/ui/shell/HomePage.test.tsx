import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalog } from '../../challenge/catalog'
import HomePage, { AUDIENCES } from './HomePage'

// Task 64: the Figma-styled landing page. Account flows through Home are covered in
// ui/account/accountFlow.test.tsx; these cases cover the audience tabs and catalog-driven content.

afterEach(cleanup)

function setup() {
  const onBrowse = vi.fn()
  render(<HomePage account={null} entries={catalog} startedCount={0} onBrowse={onBrowse} onMyDesigns={() => {}} onAccount={() => {}} />)
  return { onBrowse }
}

describe('HomePage (task 64)', () => {
  it('draws one card per available challenge and counts them from the catalog', () => {
    setup()
    const cards = within(screen.getByRole('list', { name: 'Challenges available now' })).getAllByRole('listitem')
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual(catalog.map((e) => e.title))
    const facts = screen.getByText('Design challenges', { selector: 'dt' }).closest('div')!
    expect(within(facts).getByText(String(catalog.filter((e) => e.available).length))).toBeTruthy()
  })

  it('switches audience tabs by click and arrow keys, with one tab in the tab order', () => {
    setup()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Students', 'Educators', 'Investors'])
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(within(screen.getByRole('tabpanel')).getByRole('heading', { level: 3 }).textContent).toBe(AUDIENCES.Students.intro)

    fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' }) // wraps to the last tab
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[2])
    const panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('aria-labelledby')).toBe('audience-Investors')
    // Planned work is labelled as planned; only shipped work reads Available now.
    expect(within(panel).getByRole('heading', { level: 4, name: /^Today/ }).textContent).toBe('TodayAvailable now')
    expect(within(panel).getByRole('heading', { level: 4, name: /^Long term/ }).textContent).toBe('Long termPlanned')

    fireEvent.keyDown(tabs[2]!, { key: 'Home' })
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(tabs[1]!)
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('audience-Educators')
  })

  it('sends the Investors action to the roadmap and the Students action to the library', () => {
    const { onBrowse } = setup()
    fireEvent.click(screen.getByRole('button', { name: AUDIENCES.Students.action }))
    expect(onBrowse).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('tab', { name: 'Investors' }))
    fireEvent.click(screen.getByRole('button', { name: AUDIENCES.Investors.action }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Where Statica is going' }))
    expect(onBrowse).toHaveBeenCalledTimes(1)
  })
})
