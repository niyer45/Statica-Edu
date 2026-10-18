import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import type { SessionState } from '../../state/session'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { MODEL_LIMITS_NOTICE } from './PageFooter'
import Workbench, { VIEWPORT_LOADING_TEXT } from './Workbench'

// Task 13.4: Workbench layout component tests (Req 24.6, 24.7, 24.11, 29.7, 30.6, 30.7, 35.5).
//
// The lazy viewport chunk is replaced by a controllable module so "panels before the viewport
// resolves" is deterministic and independent of the real scene (tasks 14.x).

const viewport = vi.hoisted(() => {
  let release: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  return { ready, release: () => release() }
})

vi.mock('../viewport/Viewport3D', async () => {
  await viewport.ready
  return { default: () => <div data-testid="viewport-resolved">3D scene</div> }
})

const clock = () => '2025-01-01T00:00:00.000Z'
const newId = () => 'baseline-id'

function bootSession() {
  const boot = bootstrap(bundledChallengeResult, clock, newId)
  if (!boot.ok) throw new Error(boot.error.message)
  return boot.value
}

function renderWorkbench(initialSession?: SessionState) {
  const { challenge, session } = bootSession()
  return render(
    <StoreProvider challenge={challenge} initialSession={initialSession ?? session} clock={clock} newId={newId}>
      <Workbench onExit={() => {}} />
    </StoreProvider>,
  )
}

/** Text exposed to assistive technology: content outside `aria-hidden` subtrees. */
function exposedText(node: Node): string {
  if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return ''
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  return Array.from(node.childNodes).map(exposedText).join('')
}

/** Visible label plus the visually hidden state text of each Guided experiment step. */
function stepTexts() {
  return within(screen.getByRole('list', { name: 'Experiment steps' }))
    .getAllByRole('listitem')
    .map(exposedText)
}

const liveRegion = () => {
  const regions = document.querySelectorAll('[aria-live="polite"]')
  expect(regions).toHaveLength(1)
  return regions[0] as HTMLElement
}

afterEach(cleanup)

describe('Workbench layout', () => {
  it('renders operable panels and the loading placeholder before the viewport resolves (Req 24.6, 24.7)', async () => {
    const { container } = renderWorkbench()

    const placeholder = screen.getByRole('status')
    expect(placeholder.textContent).toBe(VIEWPORT_LOADING_TEXT)
    // Same footprint as the scene: it uses the scene's `.beam-scene` box inside `.viewport`.
    expect(placeholder.classList.contains('beam-scene')).toBe(true)
    expect(placeholder.closest('.viewport')).not.toBeNull()
    expect(screen.queryByTestId('viewport-resolved')).toBeNull()

    // Requirements panel (problem statement + Run Test), palette, numeric controls, history.
    const challenge = container.querySelector('.challenge-panel') as HTMLElement
    expect(challenge.textContent?.trim().length).toBeGreaterThan(0)
    // Run Test is present; it stays disabled until the runTest reducer lands (task 19).
    expect(within(challenge).getByRole('button', { name: /Run test/i })).toBeTruthy()
    const tiles = container.querySelectorAll('.design-panel .shape-tile')
    expect(tiles.length).toBeGreaterThan(0)
    expect(container.querySelector('.design-panel input')).not.toBeNull()
    expect(within(container.querySelector('.results-panel') as HTMLElement).getByText('Design history')).toBeTruthy()

    // Panels respond to input while the viewport is still loading (the palette tiles are
    // non-interactive stubs until task 15.1, so the requirements panel's help button is used).
    expect(document.querySelector('.modal')).toBeNull()
    const panelButtons = within(challenge).getAllByRole('button').filter((b) => !b.hasAttribute('disabled'))
    expect(panelButtons.length).toBeGreaterThan(0)
    fireEvent.click(panelButtons[0] as HTMLElement)
    expect(document.querySelector('.modal')).not.toBeNull()
    expect(screen.getByText(VIEWPORT_LOADING_TEXT)).toBeTruthy()

    // Releasing the chunk swaps the placeholder for the scene in the same region.
    await act(async () => {
      viewport.release()
      await viewport.ready
    })
    const scene = await screen.findByTestId('viewport-resolved')
    expect(scene.closest('.viewport')).not.toBeNull()
    expect(screen.queryByText(VIEWPORT_LOADING_TEXT)).toBeNull()
  })

  it('keeps the template region class names (Req 24.11)', () => {
    const { container } = renderWorkbench()
    const grid = container.querySelector('.workbench') as HTMLElement
    expect(grid).not.toBeNull()
    // Three columns inside the grid, in template order.
    expect(Array.from(grid.children).map((el) => el.classList[0])).toEqual([
      'design-panel',
      'viewport',
      'challenge-panel',
    ])
    // Results full width after the grid, then the footer.
    const results = container.querySelector('.results-panel') as HTMLElement
    const footer = container.querySelector('footer.page-footer') as HTMLElement
    expect(grid.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(results.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grid.contains(results)).toBe(false)

    // `.toast` and `.modal` appear on demand with the template classes.
    expect(document.querySelector('.toast')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'My designs' }))
    expect(document.querySelector('.toast')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(document.querySelector('.modal')).not.toBeNull()
  })

  it('shows Guided experiment step states as text (Req 35.5, task 58)', () => {
    const { session } = bootSession()
    const baseline = session.history[0]
    if (baseline === undefined) throw new Error('baseline missing')

    // Baseline only: the first experiment is current, the rest locked.
    const { unmount } = renderWorkbench(session)
    expect(stepTexts()).toEqual([
      '1. Make it deeper, current step',
      '2. Try another shape, locked',
      '3. Tune one dimension, locked',
      '4. Meet every check, locked',
    ])
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toContain('Make it deeper')
    unmount()

    // A stored test that increased only the depth completes the first step.
    const deeper = { ...baseline.designSnapshot, section: { kind: 'circle' as const, diameterM: 0.04 } }
    const tested: SessionState = {
      ...session,
      history: [...session.history, { ...baseline, id: 'run-1', iteration: 1, designSnapshot: deeper }],
    }
    renderWorkbench(tested)
    expect(stepTexts()).toEqual([
      '1. Make it deeper, complete',
      '2. Try another shape, current step',
      '3. Tune one dimension, locked',
      '4. Meet every check, locked',
    ])
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toContain('Try another shape')
  })

  it('always shows the model-limits notice in the footer (Req 29.7)', () => {
    const { session } = bootSession()
    const baseline = session.history[0]
    if (baseline === undefined) throw new Error('baseline missing')
    const variants: SessionState[] = [
      session,
      { ...session, history: [...session.history, { ...baseline, id: 'run-1', iteration: 1 }] },
      { ...session, draftStatus: 'draft' },
    ]
    for (const s of variants) {
      const { container, unmount } = renderWorkbench(s)
      const footer = container.querySelector('footer.page-footer') as HTMLElement
      expect(within(footer).getByText(MODEL_LIMITS_NOTICE)).toBeTruthy()
      // Still shown while a dialog is open.
      fireEvent.click(screen.getByRole('button', { name: 'Help' }))
      expect(within(footer).getByText(MODEL_LIMITS_NOTICE)).toBeTruthy()
      unmount()
    }
  })

  it('keeps one live region from first render, replaces messages, and re-announces repeats (Req 30.6, 30.7)', () => {
    renderWorkbench()
    const region = liveRegion()
    expect(region.textContent).toBe('')
    // Portaled to <body>, outside the Workbench tree, so hiding the Workbench cannot hide it.
    expect(region.parentElement).toBe(document.body)
    expect(region.hidden).toBe(false)
    expect(region.getAttribute('aria-hidden')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'My designs' }))
    const first = region.firstElementChild
    expect(region.textContent).toBe('Your local designs are collected in the history below.')
    expect(region.childElementCount).toBe(1)

    // Same event again: the message node is re-inserted so it is announced again.
    fireEvent.click(screen.getByRole('button', { name: 'My designs' }))
    expect(liveRegion()).toBe(region)
    expect(region.textContent).toBe('Your local designs are collected in the history below.')
    expect(region.childElementCount).toBe(1)
    expect(region.firstElementChild).not.toBe(first)

    // Opening and closing dialogs does not remove or hide the region.
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(liveRegion()).toBe(region)
  })
})
