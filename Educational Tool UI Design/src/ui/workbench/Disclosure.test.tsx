import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Disclosure from './Disclosure'

// Shared collapsed-by-default disclosure (task 78, WD-02, WD-06).
afterEach(cleanup)

describe('Disclosure', () => {
  it('is a native collapsed details with the shared class and its summary', () => {
    const { container } = render(<Disclosure summary="More detail"><p>Hidden words</p></Disclosure>)
    const details = container.querySelector('details')!
    expect(details.className).toBe('ei-disclosure')
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')?.textContent).toBe('More detail')
    // Closed content stays in the DOM for assistive technology and tests.
    expect(screen.getByText('Hidden words')).toBeTruthy()
  })

  it('keeps its id, can start open and holds its content either way', () => {
    const { container } = render(<Disclosure summary="Toggle" id="d1"><p>Body</p></Disclosure>)
    const details = container.querySelector('details')!
    expect(details.id).toBe('d1')
    expect(details.open).toBe(false)
    cleanup()
    const open = render(<Disclosure summary="Open one" defaultOpen><p>Body</p></Disclosure>)
    expect(open.container.querySelector('details')!.open).toBe(true)
    expect(screen.getByText('Body')).toBeTruthy()
  })

  it('appends an extra class and keeps the summary keyboard-focusable', () => {
    const { container } = render(<Disclosure summary="Focusable" className="extra"><p>Body</p></Disclosure>)
    expect(container.querySelector('details')!.className).toBe('ei-disclosure extra')
    const summary = container.querySelector('summary')!
    summary.focus()
    expect(document.activeElement).toBe(summary)
  })
})
