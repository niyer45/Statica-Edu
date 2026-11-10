import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import Disclosure from './Disclosure'
import GuidedStepDialog, { type StepperStep } from './GuidedStepDialog'

// Guided stepper row and modal step dialog (task 78, 78.3 WD-30 to WD-36; task 78.4 WD-40 to WD-47).
afterEach(cleanup)

const STEPS: StepperStep[] = [
  { id: 'a', title: 'Done step', state: 'complete' },
  { id: 'b', title: 'Grow', state: 'current' },
  { id: 'c', title: 'Later step', state: 'locked' },
]

function Host({ k = 'a', steps = STEPS, completeLabel, feedback }: { k?: string; steps?: StepperStep[]; completeLabel?: string; feedback?: string }) {
  return (
    <>
      <input aria-label="Diameter" />
      <GuidedStepDialog steps={steps} completeLabel={completeLabel} label="Step 2 of 3: Grow" title="Grow" autoOpenKey={k} feedback={feedback}>
        <p>Increase the diameter.</p>
        <p id="guided-lock-line">Locked line</p>
        <Disclosure summary="Hint"><p>A hint.</p></Disclosure>
      </GuidedStepDialog>
      <button type="button">After</button>
    </>
  )
}
const current = () => screen.getByRole('button', { name: /^Grow/ })
const dialog = () => screen.getByRole('dialog', { name: 'Step 2 of 3: Grow' })

describe('GuidedStepDialog stepper row', () => {
  it('lists the steps as an ordered list in a "Guided steps" nav with state text and aria-current', () => {
    render(<Host />)
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    const items = within(nav).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Done step, completed', '2Grow, current step', '3Later step, locked'])
    expect(items.map((li) => li.getAttribute('aria-current'))).toEqual([null, 'step', null])
    expect(nav.querySelector('ol')).toBeTruthy()
    expect(items[0]!.querySelector('svg')).toBeTruthy()
    expect(items[2]!.querySelectorAll('svg').length).toBe(1)
    expect(items[1]!.querySelector('svg')).toBeNull()
  })

  it('only the current step is a button (aria-haspopup="dialog", no aria-expanded or aria-controls)', () => {
    render(<Host />)
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    expect(within(nav).getAllByRole('button')).toEqual([current()])
    expect(current().getAttribute('aria-haspopup')).toBe('dialog')
    expect(current().hasAttribute('aria-expanded')).toBe(false)
    expect(current().hasAttribute('aria-controls')).toBe(false)
    expect(screen.queryByText(/Step \d+ of \d+/)).toBeNull()
  })

  it('with every step met, "All N steps complete" is the opening button and all items read completed', () => {
    const done = STEPS.map((s) => ({ ...s, state: 'complete' as const }))
    render(<Host steps={done} completeLabel="All 3 steps complete" />)
    const nav = screen.getByRole('navigation', { name: 'Guided steps' })
    expect(within(nav).getByRole('button', { name: 'All 3 steps complete' }).getAttribute('aria-haspopup')).toBe('dialog')
    expect(within(nav).getAllByRole('listitem').every((li) => li.textContent!.endsWith(', completed'))).toBe(true)
    expect(nav.querySelector('[aria-current]')).toBeNull()
  })

  it('shows the feedback line only when there is feedback, with no live region or role', () => {
    const { rerender } = render(<Host />)
    expect(document.querySelector('.guided-feedback')).toBeNull()
    rerender(<Host feedback="Not yet." />)
    const line = document.querySelector('.guided-feedback')!
    expect(line.textContent).toBe('Not yet.')
    expect(line.hasAttribute('role')).toBe(false)
    expect(line.hasAttribute('aria-live')).toBe(false)
    expect(line.previousElementSibling).toBe(screen.getByRole('navigation', { name: 'Guided steps' }))
  })
})

describe('GuidedStepDialog', () => {
  it('opens on mount as a modal dialog with the given name, heading and content', () => {
    render(<Host />)
    const d = dialog()
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(within(d).getByRole('heading', { name: 'Grow' })).toBeTruthy()
    expect(within(d).getByText('Locked line')).toBeTruthy()
    expect(d.querySelector('details')?.open).toBe(false)
    expect(within(d).getByRole('button', { name: 'Got it' })).toBeTruthy()
    expect(document.querySelector('[aria-live]')).toBeNull()
    // Initial focus: the dialog's Close button.
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Close' }))
  })

  it('"Got it", Close and Escape close it and return focus to the current step', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(current())
    await user.click(current())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.activeElement).toBe(current())
    await user.click(current())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(current())
    // Keyboard: Tab to "Got it", Enter.
    await user.click(current())
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it' }))
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(current())
  })

  it('traps focus: Tab and Shift+Tab cycle among Close, Hint and Got it; the page behind is unreachable', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const seen: (string | null)[] = []
    for (let i = 0; i < 5; i++) { seen.push(document.activeElement?.textContent ?? null); await user.tab() }
    expect(seen.map((t) => t === '' ? 'Close' : t)).toEqual(['×', 'Hint', 'Got it', '×', 'Hint'])
    expect(dialog().contains(document.activeElement)).toBe(true)
    screen.getByRole('textbox', { name: 'Diameter' }).focus()
    expect(dialog().contains(document.activeElement)).toBe(true)
    screen.getByRole('button', { name: 'After' }).focus()
    expect(dialog().contains(document.activeElement)).toBe(true)
  })

  it('ignores a backdrop click', () => {
    render(<Host />)
    fireEvent.click(document.querySelector('.modal-backdrop')!)
    expect(dialog()).toBeTruthy()
  })

  it('reopens by itself when the key changes, and the current step reopens it on demand', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    rerender(<Host k="a" feedback="Not yet." />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<Host k="b" />)
    expect(dialog()).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    await user.click(current())
    expect(dialog()).toBeTruthy()
  })

  it('stays closed while the workbench host is hidden and opens when the host becomes visible (entering)', async () => {
    const { container } = render(<div hidden><Host /></div>)
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => { container.firstElementChild!.removeAttribute('hidden') })
    expect(dialog()).toBeTruthy()
    // Leaving and entering again opens it again, even after "Got it".
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await act(async () => { container.firstElementChild!.setAttribute('hidden', '') })
    await act(async () => { container.firstElementChild!.removeAttribute('hidden') })
    expect(dialog()).toBeTruthy()
  })

  it('waits while another dialog is open and opens when it closes', async () => {
    const other = document.createElement('div')
    other.setAttribute('role', 'dialog')
    other.setAttribute('aria-label', 'Run structural test')
    document.body.append(other)
    render(<Host />)
    expect(screen.queryByRole('dialog', { name: 'Step 2 of 3: Grow' })).toBeNull()
    other.remove()
    await act(async () => { await Promise.resolve() })
    expect(dialog()).toBeTruthy()
  })
})
