import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import Disclosure from './Disclosure'
import GuidedStepPopover from './GuidedStepPopover'

// Non-modal Guided step popover (task 78, WD-10 to WD-13).
afterEach(cleanup)

function Host({ k = 'a' }: { k?: string }) {
  return (
    <>
      <input aria-label="Diameter" />
      <GuidedStepPopover chipLabel="Step 1 of 3: Grow" label="Guided step instructions" autoOpenKey={k} strip={<p id="guided-lock-line">Locked line</p>}>
        <h2>Grow</h2>
        <p>Increase the diameter.</p>
        <Disclosure summary="Hint"><p>A hint.</p></Disclosure>
      </GuidedStepPopover>
      <button type="button">After</button>
    </>
  )
}
const chip = () => screen.getByRole('button', { name: 'Step 1 of 3: Grow' })
const popover = () => screen.getByRole('group', { name: 'Guided step instructions' })

describe('GuidedStepPopover', () => {
  it('opens on first entry without moving focus and exposes the chip state', () => {
    render(<Host />)
    expect(document.activeElement).toBe(document.body)
    expect(popover().hasAttribute('hidden')).toBe(false)
    expect(chip().getAttribute('aria-expanded')).toBe('true')
    expect(chip().getAttribute('aria-controls')).toBe(popover().id)
    // Non-modal group (not a dialog) and no live region of its own.
    expect(popover().getAttribute('role')).toBe('group')
    expect(popover().getAttribute('aria-modal')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('[aria-live]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Grow' })).toBeTruthy()
    expect(screen.getByText('Locked line')).toBeTruthy()
  })

  it('reopens itself without stealing focus when the key changes', () => {
    const { rerender } = render(<Host />)
    const field = screen.getByRole('textbox', { name: 'Diameter' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(popover).toThrow()
    field.focus()
    rerender(<Host k="b" />)
    expect(chip().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(field)
  })

  it('Close returns focus to the chip when focus was inside; Escape elsewhere leaves focus alone', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    await user.keyboard('{Escape}')
    expect(chip().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(chip())
    // Reopen with the chip, move focus out, Escape closes without moving focus.
    await user.click(chip())
    expect(chip().getAttribute('aria-expanded')).toBe('true')
    const field = screen.getByRole('textbox', { name: 'Diameter' })
    field.focus()
    await user.keyboard('{Escape}')
    expect(chip().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(field)
    // The Close button path.
    await user.click(chip())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.activeElement).toBe(chip())
  })

  it('is keyboard reachable with no focus trap and at most three tab stops', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const stops: (Element | null)[] = []
    document.body.focus()
    // Tab from the Diameter field through chip, Close, Hint, then out to the following button.
    screen.getByRole('textbox', { name: 'Diameter' }).focus()
    for (let i = 0; i < 4; i++) { await user.tab(); stops.push(document.activeElement) }
    expect(stops[0]).toBe(chip())
    expect(stops[1]).toBe(screen.getByRole('button', { name: 'Close' }))
    expect(stops[2]?.tagName).toBe('SUMMARY')
    // Focus continues past the popover: it never pulls focus back.
    expect(stops[3]).toBe(screen.getByRole('button', { name: 'After' }))
    const inside = popover().querySelectorAll('button, summary, a[href], input, select, textarea, [tabindex]')
    expect(inside.length + 1).toBeLessThanOrEqual(3)
    // Focusing a control outside never moves focus back in.
    screen.getByRole('textbox', { name: 'Diameter' }).focus()
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Diameter' }))
  })

  it('the chip toggles it closed and open again', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(chip())
    expect(chip().getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(chip().getAttribute('aria-controls')!)?.hasAttribute('hidden')).toBe(true)
    await user.click(chip())
    expect(chip().getAttribute('aria-expanded')).toBe('true')
  })
})
