import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Dialog from './Dialog'
afterEach(cleanup)
it('labels the modal, traps Tab/Shift+Tab, closes on Escape and restores its opener', () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus()
  const close = vi.fn()
  const view = render(<Dialog title="Accessible modal" onClose={close}><input aria-label="Answer" /><button type="button">Last</button></Dialog>)
  expect(screen.getByRole('dialog', { name: 'Accessible modal' }).getAttribute('aria-modal')).toBe('true')
  const first = screen.getByRole('button', { name: 'Close' }), last = screen.getByRole('button', { name: 'Last' })
  expect(document.activeElement).toBe(first)
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'Tab' }); expect(document.activeElement).toBe(first)
  fireEvent.keyDown(first, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1)
  view.unmount(); expect(document.activeElement).toBe(opener); opener.remove()
})
