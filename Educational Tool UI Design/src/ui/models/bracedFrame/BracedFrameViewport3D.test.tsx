import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bracedFrameChallenge } from '../../../../test/fixtures/bracedFrame'
import type { BracedFrameSession } from '../../../state/bracedFrameModel'
import { bracedFrameRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import { VIEWPORT_LOADING_TEXT } from '../../viewport/ViewportLoading'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import { bracedFrameUi } from '.'
import BracedFrameFallback from './BracedFrameFallback'
import BracedFrameViewport3D, { FRAME_SCENE_DESCRIPTION_ID, FRAME_SCENE_LABEL } from './BracedFrameViewport3D'
import { FRAME_FALLBACK_NOTICE, FRAME_SUMMARY_ID, useFrameStore } from './shared'

// Braced Frame I 3D view slot wiring and fallback (task 54.3). The R3F Canvas is replaced by a
// DOM stand-in (as in the beam's Fallback2D tests) so the slot, boundary, context-loss and
// non-WebGL paths are exercised without a WebGL context; the scene itself is covered by
// BracedFrameScene.test.tsx.

const glMock = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement | null, throws: false }))
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated, children }: { children?: ReactNode; onCreated: (s: { gl: { domElement: HTMLCanvasElement } }) => void }) => {
    useEffect(() => {
      const canvas = document.createElement('canvas')
      glMock.canvas = canvas
      document.body.append(canvas)
      onCreated({ gl: { domElement: canvas } })
    }, [onCreated])
    if (glMock.throws) throw new Error('Context creation failed')
    return <div data-testid="mock-3d">{children}</div>
  },
}))
vi.mock('./BracedFrameScene', () => ({ default: () => null }))

const ch = bracedFrameChallenge()
const clock = () => '2026-10-17T00:00:00.000Z'
let latest: BracedFrameSession
function Probe() {
  latest = useFrameStore().state
  return null
}

function setup(children: ReactNode) {
  const init = bracedFrameRuntime.init(ch, clock(), 'base', 'guided')
  if (!init.ok) throw new Error('braced frame challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={bracedFrameRuntime as unknown as ModelRuntime} storage={null} clock={clock} newId={() => 'id'}>
      <Probe />
      {children}
    </StoreProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  glMock.canvas?.remove()
  glMock.canvas = null
  glMock.throws = false
})

describe('Braced Frame I 3D view slot (task 54.3)', () => {
  it('mounts the lazy 3D chunk in the View slot with a named, described canvas and keyboard view controls', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const notify = vi.fn()
    const View = bracedFrameUi.View
    setup(<View onUnavailable={notify} />)
    // The text equivalent is in the main bundle and present while the chunk loads.
    expect(screen.getByText(VIEWPORT_LOADING_TEXT)).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Latest tested member forces' })).toBeTruthy()
    expect(await screen.findByTestId('mock-3d', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByText(VIEWPORT_LOADING_TEXT)).toBeNull()
    const canvas = glMock.canvas!
    expect(canvas.getAttribute('role')).toBe('img')
    expect(canvas.getAttribute('aria-label')).toBe(FRAME_SCENE_LABEL)
    expect(canvas.getAttribute('aria-describedby')).toBe(`${FRAME_SCENE_DESCRIPTION_ID} ${FRAME_SUMMARY_ID}`)
    expect(canvas.tabIndex).toBe(0)
    // Both description targets exist: the scene description and the latest-test summary.
    expect(document.getElementById(FRAME_SCENE_DESCRIPTION_ID)!.textContent).toMatch(
      /Diagonals present: lower diagonal \(bottom right to top left\), upper diagonal \(bottom right to top left\)\. Diagonals not present, drawn dashed: lower diagonal \(bottom left to top right\), upper diagonal \(bottom left to top right\)\./,
    )
    expect(document.getElementById(FRAME_SUMMARY_ID)!.textContent).toContain('Latest test (Baseline): stable')
    // Pattern key states every pattern in words (never color alone); no SVG fallback in 3D.
    const key = screen.getByRole('list', { name: '3D pattern key' })
    for (const text of ['Solid tube: tension', 'Striped tube: compression', 'Beaded: ≈ 0', 'Pale plain tube: no tested force', 'Dashed: not present', 'Tube widths ×4'])
      expect(key.textContent).toContain(text)
    expect(screen.queryByRole('img', { name: /Two-storey braced frame elevation/ })).toBeNull()
    expect(screen.queryByText(FRAME_FALLBACK_NOTICE)).toBeNull()
    // No text is placed on or over the Canvas itself (D-26).
    expect(screen.getByTestId('mock-3d').textContent).toBe('')
    // View controls are local view state: buttons, reachable by keyboard, never touching the session.
    const before = latest
    for (const name of ['Zoom in', 'Zoom out', 'Reset view', 'Fit view']) {
      const button = screen.getByRole('button', { name })
      expect(button.tagName).toBe('BUTTON')
      fireEvent.click(button)
    }
    expect(latest).toBe(before)
    expect(notify).not.toHaveBeenCalled()
  })

  it('renders the SVG elevation without WebGL2, announces once and never creates a canvas', () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    const notify = vi.fn()
    setup(<BracedFrameViewport3D onUnavailable={notify} />)
    expect(screen.getByText(FRAME_FALLBACK_NOTICE)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Two-storey braced frame elevation/ }).getAttribute('aria-describedby')).toBe(FRAME_SUMMARY_ID)
    expect(screen.getByRole('list', { name: 'Line pattern key' })).toBeTruthy()
    expect(screen.queryByTestId('mock-3d')).toBeNull()
    expect(glMock.canvas).toBeNull()
    expect(notify.mock.calls).toEqual([[FRAME_FALLBACK_NOTICE]])
  })

  it('switches to the SVG elevation on context loss with the same state and one announcement', () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const notify = vi.fn()
    setup(
      <ViewportBoundary onUnavailable={notify} fallback={BracedFrameFallback}>
        <BracedFrameViewport3D onUnavailable={notify} />
      </ViewportBoundary>,
    )
    const before = latest
    expect(screen.getByTestId('mock-3d')).toBeTruthy()
    const lost = new Event('webglcontextlost', { cancelable: true })
    act(() => {
      glMock.canvas!.dispatchEvent(lost)
    })
    expect(lost.defaultPrevented).toBe(true)
    expect(screen.queryByTestId('mock-3d')).toBeNull()
    expect(screen.getByText(FRAME_FALLBACK_NOTICE)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Two-storey braced frame elevation/ })).toBeTruthy()
    expect(latest).toBe(before)
    expect(notify.mock.calls).toEqual([[FRAME_FALLBACK_NOTICE]])
  })

  it('recovers from Canvas creation failure through the boundary with the frame fallback, not the beam one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('WebGL2RenderingContext', class {})
    glMock.throws = true
    const notify = vi.fn()
    const View = bracedFrameUi.View
    setup(<View onUnavailable={notify} />)
    expect(await screen.findByText(FRAME_FALLBACK_NOTICE, {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Two-storey braced frame elevation/ })).toBeTruthy()
    expect(screen.queryByRole('img', { name: '2D section view' })).toBeNull()
    expect(screen.getByRole('table', { name: 'Latest tested member forces' })).toBeTruthy()
    await waitFor(() => expect(notify.mock.calls).toEqual([[FRAME_FALLBACK_NOTICE]]))
    expect(latest.history).toHaveLength(1)
  })

  it('recovers from a rejected 3D chunk outside Suspense', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = lazy(async () => {
      throw new Error('3D chunk failed to load')
    })
    const notify = vi.fn()
    setup(
      <ViewportBoundary onUnavailable={notify} fallback={BracedFrameFallback}>
        <Suspense fallback="Loading">
          <Broken />
        </Suspense>
      </ViewportBoundary>,
    )
    const before = latest
    const notice = await screen.findByText(FRAME_FALLBACK_NOTICE)
    expect(within(notice.parentElement!).getByRole('img', { name: /Two-storey braced frame elevation/ })).toBeTruthy()
    await waitFor(() => expect(notify.mock.calls).toEqual([[FRAME_FALLBACK_NOTICE]]))
    expect(latest).toBe(before)
  })
})
