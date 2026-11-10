import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import Disclosure from './Disclosure'
import GuidedStepPopover, { type StepperStep } from './GuidedStepPopover'

// Guided stepper row and non-modal step popover (task 78, WD-10 to WD-13; task 78.3, WD-30 to WD-32).
afterEach(cleanup)

const STEPS: StepperStep[] = [
  { id: 'a', title: 'Done step', state: 'complete' },
  { id: 'b', title: 'Grow', state: 'current' },
  { id: 'c', title: 'Later step', state: 'locked' },
]

function Host({ k = 'a', steps = STEPS, completeLabel }: { k?: string; steps?: StepperStep[]; completeLabel?: string }) {
  return (
    <>
      <input aria-label="Diameter" />
      <GuidedStepPopover steps={steps} completeLabel={completeLabel} label="Guided step instructions" autoOpenKey={k}>
        <h2>Grow</h2>
        <p>Increase the diameter.</p>
        <p id="guided-lock-line">Locked line</p>
        <Disclosure summary="Hint"><p>A hint.</p></Disclosure>
      </GuidedStepPopover>
      <button type="button">After</button>
    </>
  )
}
const current = () => screen.getByRole('button', { name: /^Grow/ })
const popover = () => screen.getByRole('group', { name: 'Guided step instructions' })

describe('GuidedStepPopover stepper row', () => {
  it('lists the steps as an ordered list in a "Guided steps" nav with state text and aria-current', () => {
    render(<Host />)
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    const items = within(nav).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Done step, completed', '2Grow, current step', '3Later step, locked'])
    expect(items.map((li) => li.getAttribute('aria-current'))).toEqual([null, 'step', null])
    expect(nav.querySelector('ol')).toBeTruthy()
    // Done shows a check, locked shows a lock, the current step shows its number; none is colour alone.
    expect(items[0]!.querySelector('svg')).toBeTruthy()
    expect(items[2]!.querySelectorAll('svg').length).toBe(1)
    expect(items[1]!.querySelector('svg')).toBeNull()
  })

  it('only the current step is a button and there is no "Step N of M" chip', () => {
    render(<Host />)
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    expect(within(nav).getAllByRole('button')).toEqual([current()])
    expect(screen.queryByText(/Step \d+ of \d+/)).toBeNull()
    expect(document.querySelector('.guided-chip')).toBeNull()
  })

  it('with every step met, "All N steps complete" is the toggle and all items read completed', () => {
    const done = STEPS.map((s) => ({ ...s, state: 'complete' as const }))
    render(<Host steps={done} completeLabel="All 3 steps complete" />)
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    const toggle = within(nav).getByRole('button', { name: 'All 3 steps complete' })
    expect(toggle.getAttribute('aria-controls')).toBe(popover().id)
    expect(within(nav).getAllByRole('listitem').every((li) => li.textContent!.endsWith(', completed'))).toBe(true)
    expect(nav.querySelector('[aria-current]')).toBeNull()
  })
})

describe('GuidedStepPopover', () => {
  it('opens on first entry without moving focus and exposes the toggle state', () => {
    render(<Host />)
    expect(document.activeElement).toBe(document.body)
    expect(popover().hasAttribute('hidden')).toBe(false)
    expect(current().getAttribute('aria-expanded')).toBe('true')
    expect(current().getAttribute('aria-controls')).toBe(popover().id)
    // Non-modal group (not a dialog) and no live region of its own.
    expect(popover().getAttribute('role')).toBe('group')
    expect(popover().getAttribute('aria-modal')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('[aria-live]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Grow' })).toBeTruthy()
    expect(within(popover()).getByText('Locked line')).toBeTruthy()
  })

  it('reopens itself without stealing focus when the key changes', () => {
    const { rerender } = render(<Host />)
    const field = screen.getByRole('textbox', { name: 'Diameter' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(popover).toThrow()
    field.focus()
    rerender(<Host k="b" />)
    expect(current().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(field)
  })

  it('Close returns focus to the current step when focus was inside; Escape elsewhere leaves focus alone', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    await user.keyboard('{Escape}')
    expect(current().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(current())
    await user.click(current())
    expect(current().getAttribute('aria-expanded')).toBe('true')
    const field = screen.getByRole('textbox', { name: 'Diameter' })
    field.focus()
    await user.keyboard('{Escape}')
    expect(current().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(field)
    await user.click(current())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.activeElement).toBe(current())
  })

  it('adds one tab stop for the row and two when open (Close, Hint), with no focus trap', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const stops: (Element | null)[] = []
    screen.getByRole('textbox', { name: 'Diameter' }).focus()
    for (let i = 0; i < 4; i++) { await user.tab(); stops.push(document.activeElement) }
    expect(stops[0]).toBe(current())
    expect(stops[1]).toBe(screen.getByRole('button', { name: 'Close' }))
    expect(stops[2]?.tagName).toBe('SUMMARY')
    expect(stops[3]).toBe(screen.getByRole('button', { name: 'After' }))
    // Row: exactly one focusable stop; popover: Close + Hint summary.
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    expect(nav.querySelectorAll('button, summary, a[href], input, select, textarea, [tabindex]')).toHaveLength(1)
    expect(popover().querySelectorAll('button, summary, a[href], input, select, textarea, [tabindex]')).toHaveLength(2)
    // Closed: only the row's one stop remains.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    screen.getByRole('textbox', { name: 'Diameter' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(current())
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }))
  })

  it('the current step toggles it closed and open again', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(current())
    expect(current().getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(current().getAttribute('aria-controls')!)?.hasAttribute('hidden')).toBe(true)
    await user.click(current())
    expect(current().getAttribute('aria-expanded')).toBe('true')
  })
})
