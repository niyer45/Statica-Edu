import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { torsionChallenge } from '../../../../test/fixtures/torsion'
import { torsionRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import { FALLBACK_NOTICE } from '../../viewport/FallbackViewport'
import ViewportBoundary from '../../viewport/ViewportBoundary'
import { VIEWPORT_LOADING_TEXT } from '../../viewport/ViewportLoading'
import { torsionUi } from '.'
import TorsionFallback from './TorsionFallback'
import { TORSION_CANVAS_LABEL } from './TorsionViewport3D'
import { TORSION_SUMMARY_ID } from './TorsionView'
import { useTorsionStore } from './shared'

// Torsion design-view slot wiring (task 54.2): the lazy 3D chunk inside the shared
// ViewportBoundary, with the main-bundle SVG TorsionView as the non-WebGL, context-loss,
// context-creation and chunk-failure fallback. R3F's Canvas and the scene are mocked as in
// Fallback2D.test; the real scene is covered by TorsionScene.test with a no-op renderer.

const glMock = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement | null, throws: false, scene: undefined as Record<string, unknown> | undefined }))
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated, children }: { children?: ReactNode; onCreated: (s: { gl: { domElement: HTMLCanvasElement } }) => void }) => {
    useEffect(() => { const canvas = document.createElement('canvas'); glMock.canvas = canvas; onCreated({ gl: { domElement: canvas } }) }, [onCreated])
    if (glMock.throws) throw new Error('Context creation failed')
    return <div data-testid="mock-3d">{children}</div>
  },
}))
vi.mock('./TorsionScene', () => ({ default: (props: Record<string, unknown>) => { glMock.scene = props; return null } }))

const ch = torsionChallenge()
const SVG_NAME = /Solid shaft cross-section and side view/
let store: ReturnType<typeof useTorsionStore>
function Probe() { store = useTorsionStore(); return null }

function setup(children: ReactNode) {
  const init = torsionRuntime.init(ch, '2026-10-17T00:00:00.000Z', 'base', 'guided')
  if (!init.ok) throw new Error('torsion challenge must initialize')
  return render(
    <StoreProvider challenge={ch} initialSession={init.value} runtime={torsionRuntime as unknown as ModelRuntime} storage={null}>
      <Probe />{children}
    </StoreProvider>,
  )
}
const View = torsionUi.View

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); glMock.throws = false; glMock.canvas = null; glMock.scene = undefined })

describe('Torsion design view slot (task 54.2)', () => {
  it('renders the main-bundle SVG directly without WebGL2, announces once, and never loads 3D', () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    const notify = vi.fn()
    setup(<View onUnavailable={notify} />)
    const before = store.state
    expect(screen.getByRole('img', { name: SVG_NAME })).toBeTruthy()
    expect(screen.getByText(FALLBACK_NOTICE)).toBeTruthy()
    expect(screen.queryByText(VIEWPORT_LOADING_TEXT)).toBeNull()
    expect(screen.queryByTestId('mock-3d')).toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
    expect(screen.getByText(/latest tested twist 2\.73°/)).toBeTruthy()
    expect(notify.mock.calls).toEqual([[FALLBACK_NOTICE]])
    expect(store.state).toBe(before)
  })

  it('loads the lazy 3D view behind ViewportLoading and names and describes the canvas', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class { })
    const notify = vi.fn()
    setup(<View onUnavailable={notify} />)
    expect(screen.getByText(VIEWPORT_LOADING_TEXT)).toBeTruthy()
    expect(await screen.findByTestId('mock-3d', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByText(VIEWPORT_LOADING_TEXT)).toBeNull()
    expect(screen.queryByRole('img', { name: SVG_NAME })).toBeNull()
    expect(screen.queryByText(FALLBACK_NOTICE)).toBeNull()
    const canvas = glMock.canvas!
    expect(canvas.getAttribute('role')).toBe('img')
    expect(canvas.getAttribute('aria-label')).toBe(TORSION_CANVAS_LABEL)
    expect(canvas.getAttribute('aria-describedby')).toBe(TORSION_SUMMARY_ID)
    expect(canvas.tabIndex).toBe(0)
    // The description is the visible text summary below the canvas, not on the model (D-26).
    const summary = document.getElementById(TORSION_SUMMARY_ID)!
    expect(summary.textContent).toMatch(/^Solid shaft · outer 30\.5 mm · latest tested twist 2\.73° \(shown ×10, 27\.3° drawn\)$/)
    expect(screen.getByTestId('mock-3d').contains(summary)).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })

  it('keeps every camera control and the twist toggle local view state', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class { })
    setup(<View onUnavailable={() => {}} />)
    await screen.findByTestId('mock-3d', {}, { timeout: 5000 })
    const before = store.state
    expect(glMock.scene).toMatchObject({ twisted: true, zoom: 1, reset: 0, fit: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(glMock.scene!.zoom).toBeCloseTo(1.1, 9)
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(glMock.scene!.zoom).toBe(1.5)
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(glMock.scene!.zoom).toBe(0.6)
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
    expect(glMock.scene).toMatchObject({ zoom: 1, reset: 1, fit: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Fit view' }))
    expect(glMock.scene).toMatchObject({ zoom: 1, reset: 1, fit: 1 })
    const toggle = screen.getByRole('button', { name: 'Show twist' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Exaggerated visualization (×10)')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(glMock.scene!.twisted).toBe(false)
    expect(screen.queryByText('Exaggerated visualization (×10)')).toBeNull()
    expect(store.state).toBe(before)
  })

  it('switches to the SVG on context loss with the existing state and one announcement', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class { })
    const notify = vi.fn()
    setup(<View onUnavailable={notify} />)
    await screen.findByTestId('mock-3d', {}, { timeout: 5000 })
    const before = store.state
    act(() => glMock.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    expect(screen.getByRole('img', { name: SVG_NAME })).toBeTruthy()
    expect(screen.getByText(FALLBACK_NOTICE)).toBeTruthy()
    expect(screen.queryByTestId('mock-3d')).toBeNull()
    expect(notify.mock.calls).toEqual([[FALLBACK_NOTICE]])
    expect(store.state).toBe(before)
  })

  it('recovers from WebGL context creation failure with the torsion SVG, not the beam fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    vi.stubGlobal('WebGL2RenderingContext', class { })
    glMock.throws = true
    const notify = vi.fn()
    setup(<View onUnavailable={notify} />)
    expect(await screen.findByRole('img', { name: SVG_NAME }, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByRole('img', { name: '2D section view' })).toBeNull()
    await waitFor(() => expect(notify.mock.calls).toEqual([[FALLBACK_NOTICE]]))
    expect(store.state.history).toHaveLength(1)
  })

  it('falls back to the torsion SVG when the 3D chunk fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    const Broken = lazy(async () => { throw new Error('3D chunk failed to load') })
    const notify = vi.fn()
    setup(
      <ViewportBoundary onUnavailable={notify} fallback={TorsionFallback}>
        <Suspense fallback="Loading"><Broken /></Suspense>
      </ViewportBoundary>,
    )
    const before = store.state
    expect(await screen.findByRole('img', { name: SVG_NAME })).toBeTruthy()
    expect(screen.getByText(FALLBACK_NOTICE)).toBeTruthy()
    await waitFor(() => expect(notify.mock.calls).toEqual([[FALLBACK_NOTICE]]))
    expect(store.state).toBe(before)
  })
})
