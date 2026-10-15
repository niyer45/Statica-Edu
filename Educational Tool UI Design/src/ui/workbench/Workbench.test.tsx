import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import LiveRegion, { nextAnnouncement, type Announcement } from '../a11y/LiveRegion'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { MODEL_LIMITS_NOTICE } from './PageFooter'
import Workbench, { VIEWPORT_LOADING_TEXT } from './Workbench'
import { workflowSteps } from './WorkflowStepper'

// Task 13.3 smoke tests: Workbench regions and LiveRegion behaviour (fuller tests: 13.4).

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

function renderWorkbench() {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  return render(
    <StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

afterEach(cleanup)

describe('Workbench', () => {
  it('renders the template regions, panels before the viewport, footer notice, and live region', async () => {
    const { container } = renderWorkbench()
    for (const cls of ['workbench', 'design-panel', 'viewport', 'challenge-panel', 'results-panel', 'page-footer']) {
      expect(container.querySelector(`.${cls}`), cls).not.toBeNull()
    }
    // Panels are present while the lazy viewport is still loading.
    expect(screen.getByText(VIEWPORT_LOADING_TEXT)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Run test/ })).toBeTruthy()
    expect(container.querySelectorAll('.design-panel .shape-tile')).toHaveLength(4)
    expect(screen.getByText('Design history')).toBeTruthy()
    expect(screen.getByText(MODEL_LIMITS_NOTICE)).toBeTruthy()
    // Explain & submit disabled until a non-baseline test exists (Req 35.6).
    expect(screen.getByRole('button', { name: /Explain & submit/ }).hasAttribute('disabled')).toBe(true)
    // Stepper states conveyed by text.
    expect(screen.getByRole('list', { name: 'Workflow' }).textContent).toContain('Modify & predict, current step')
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull()

    // The lazy viewport resolves into the same region.
    expect(await screen.findByRole('button', { name: 'Zoom in' }, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByText(VIEWPORT_LOADING_TEXT)).toBeNull()
  })

  it('derives stepper states from tests and submission', () => {
    expect(workflowSteps(0, false).map((s) => s.state)).toEqual(['complete', 'active', 'upcoming', 'upcoming'])
    expect(workflowSteps(1, false).map((s) => s.state)).toEqual(['complete', 'complete', 'complete', 'active'])
    expect(workflowSteps(2, true).map((s) => s.state)).toEqual(['complete', 'complete', 'complete', 'complete'])
  })
})

describe('LiveRegion', () => {
  it('is always present, replaces its message, and re-announces duplicates', () => {
    const { rerender } = render(<LiveRegion announcement={null} />)
    const region = () => screen.getByTestId('live-region')
    expect(region().getAttribute('aria-live')).toBe('polite')
    expect(region().textContent).toBe('')

    let a: Announcement = nextAnnouncement(null, 'Section applied: Rectangle')
    rerender(<LiveRegion announcement={a} />)
    expect(region().textContent).toBe('Section applied: Rectangle')

    a = nextAnnouncement(a, 'Restored iteration 1')
    rerender(<LiveRegion announcement={a} />)
    expect(region().textContent).toBe('Restored iteration 1')

    // Same text again: a new node is inserted so assistive technology re-reads it.
    const before = region().firstElementChild
    act(() => {
      a = nextAnnouncement(a, 'Restored iteration 1')
      rerender(<LiveRegion announcement={a} />)
    })
    const after = region().firstElementChild
    expect(region().textContent).toBe('Restored iteration 1')
    expect(after).not.toBe(before)
    expect(region().childElementCount).toBe(1)
  })
})
