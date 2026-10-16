import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Toast from './Toast'
afterEach(() => { cleanup(); vi.useRealTimers() })
it('automatically dismisses temporary feedback after five seconds and cancels on unmount', () => {
  vi.useFakeTimers()
  const dismiss = vi.fn()
  const view = render(<Toast message="Iteration 1 deleted from history." onDismiss={dismiss} />)
  vi.advanceTimersByTime(4999)
  expect(dismiss).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(dismiss).toHaveBeenCalledTimes(1)
  view.rerender(<Toast message="Iteration 2 deleted from history." onDismiss={dismiss} />)
  view.unmount()
  vi.advanceTimersByTime(5000)
  expect(dismiss).toHaveBeenCalledTimes(1)
})
