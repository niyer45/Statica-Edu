import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledChallengeResult } from '../../challenge/content'
import { sectionOutline } from '../../geometry/outline'
import { initSession, type SessionState } from '../../state/session'
import { tinyCircle } from '../../../test/fixtures/designs'
import StoreProvider from '../state/StoreProvider'
import { useDispatch, useSession } from '../state/store'
import FallbackViewport, { FALLBACK_NOTICE } from './FallbackViewport'
import { DEFAULT_ORBIT, project, SCENE_UNITS_PER_M } from './projection'
import Viewport3D from './Viewport3D'
import ViewportBoundary from './ViewportBoundary'
import { localToGlobalYZ } from './sceneLayout'
import type { HandleFeedback } from './DimensionHandles'

const glMock = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement | null, throws: false, feedback: undefined as ((value: HandleFeedback | null) => void) | undefined }))
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated, children }: { children?: ReactNode; onCreated: (s: { gl: { domElement: HTMLCanvasElement } }) => void }) => {
    useEffect(() => { const canvas = document.createElement('canvas'); glMock.canvas = canvas; onCreated({ gl: { domElement: canvas } }) }, [onCreated])
    if (glMock.throws) throw new Error('Context creation failed')
    return <div data-testid="mock-3d">{children}</div>
  }
}))
vi.mock('./BeamView', () => ({ default: ({ onHandleFeedback }: { onHandleFeedback?: (value: HandleFeedback | null) => void }) => { glMock.feedback = onHandleFeedback; return null } }))
if (!bundledChallengeResult.ok) throw new Error('Invalid challenge')
const ch = bundledChallengeResult.value
let latest: SessionState
function Probe() {
  latest = useSession()
  const dispatch = useDispatch()
  return <>
    <button onClick={() => dispatch({ type: 'applySection', kind: 'iSection' })}>Apply I</button>
    <button onClick={() => dispatch({ type: 'applySection', kind: 'tube' })}>Apply tube</button>
    <button onClick={() => dispatch({ type: 'setParam', param: 'webThicknessM', valueM: 0.006, mode: 'strict' })}>Change web</button>
    <button onClick={() => dispatch({ type: 'setOrientation', orientationDeg: 90 })}>Rotate section</button>
  </>
}
function setup(children: ReactNode, tiny = false) {
  const initial = initSession(tiny ? { ...ch, initialDesign: tinyCircle.design } : ch, '2026-10-15T00:00:00.000Z', 'baseline', 'parametric')
  if (!initial.ok) throw new Error('Invalid initial session')
  return render(<StoreProvider challenge={ch} initialSession={initial.value}><Probe />{children}</StoreProvider>)
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); glMock.throws = false; glMock.canvas = null })

describe('typed SVG fallback (14.4/14.5)', () => {
  it('renders accessible views without WebGL, announces once and leaves session state unchanged', () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    const announce = vi.fn()
    setup(<Viewport3D onUnavailable={announce} />)
    const before = latest
    expect(screen.getByText(FALLBACK_NOTICE)).toBeTruthy()
    expect(screen.getByRole('img', { name: '2D section view' }).getAttribute('aria-describedby')).toBe('viewport-scene-summary')
    expect(announce.mock.calls).toEqual([[FALLBACK_NOTICE]])
    fireEvent.click(screen.getByRole('button', { name: 'Show deformation' }))
    expect(screen.queryByTestId('fallback-deformation')).toBeNull()
    expect(screen.queryByText('Exaggerated visualization (×15)')).toBeNull()
    for (const name of ['Zoom in', 'Zoom out', 'Fit view', 'Reset view']) fireEvent.click(screen.getByRole('button', { name }))
    expect(announce).toHaveBeenCalledTimes(1)
    expect(latest).toBe(before)
  })
  it('renders independent I-section dimensions and rotated outline, while retaining stored deformation', () => {
    setup(<FallbackViewport />)
    const before = screen.getByTestId('fallback-deformation').innerHTML
    // The baseline is already an I-section: go through a tube so the I-section is freshly applied
    // with the challenge default thicknesses.
    fireEvent.click(screen.getByText('Apply tube'))
    fireEvent.click(screen.getByText('Apply I'))
    fireEvent.click(screen.getByText('Change web'))
    fireEvent.click(screen.getByText('Rotate section'))
    const outline = sectionOutline(latest.draft.section)
    const expected = outline.outer.map((p, i) => `${i ? 'L' : 'M'}${-1000 * p.v} ${-1000 * p.u}`).join(' ') + ' Z'
    expect(screen.getByTestId('fallback-section-outline').getAttribute('d')).toBe(expected)
    expect(screen.getByTestId('scene-summary').textContent).toContain('Web thickness 6.00 mm')
    expect(screen.getByTestId('scene-summary').textContent).toContain('Flange thickness 4.00 mm')
    expect(screen.getByTestId('fallback-deformation').innerHTML).toBe(before)
  })
  it('renders tube holes as a second closed subpath with even-odd fill', () => {
    setup(<FallbackViewport />)
    fireEvent.click(screen.getByText('Apply tube'))
    const path = screen.getByTestId('fallback-section-outline')
    expect(path.getAttribute('d')!.match(/M/g)).toHaveLength(2)
    expect(path.getAttribute('fill-rule')).toBe('evenodd')
  })
  it.each([false, true])('projects the exact exaggerated/capped stored tip offset (tiny=%s)', (tiny) => {
    setup(<FallbackViewport />, tiny)
    const result = latest.history[0]!
    const expectedOffset = Math.min(ch.visualization.exaggerationFactor * result.analysis.tipDeflectionM, 0.3 * result.designSnapshot.lengthM)
    const line = screen.getByTestId('fallback-deformation').querySelector('polyline')!
    const last = line.getAttribute('points')!.split(' ').at(-1)!.split(',').map(Number)
    // The bundled baseline is turned 90°, so map the section point with the stored orientation.
    const outer = sectionOutline(result.designSnapshot.section).outer[0]
    const g = localToGlobalYZ(outer.u, outer.v, result.designSnapshot.orientationDeg)
    const tip = project([result.designSnapshot.lengthM, g.y - expectedOffset, g.z], result.designSnapshot.lengthM, DEFAULT_ORBIT.angle, DEFAULT_ORBIT.elevation, 1)
    expect(last[0]).toBeCloseTo(tip[0], 10)
    expect(last[1]).toBeCloseTo(tip[1], 10)
    const unbent = project([result.designSnapshot.lengthM, g.y, g.z], result.designSnapshot.lengthM, DEFAULT_ORBIT.angle, DEFAULT_ORBIT.elevation, 1)
    expect(last[1] - unbent[1]).toBeCloseTo(expectedOffset * SCENE_UNITS_PER_M * Math.cos(DEFAULT_ORBIT.elevation), 10)
  })
  it('keeps orbit keyboard-operable, allows Tab to leave, and restores default view', () => {
    setup(<FallbackViewport />)
    const view = screen.getByRole('img', { name: /2D cantilever beam projection/ })
    const before = view.querySelector('polyline')!.getAttribute('points')
    fireEvent.keyDown(view, { key: 'ArrowRight' })
    expect(view.querySelector('polyline')!.getAttribute('points')).not.toBe(before)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    view.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
    expect(view.querySelector('polyline')!.getAttribute('points')).toBe(before)
  })
})

describe('viewport recovery', () => {
  it('recovers from lazy bundle rejection outside Suspense without modifying the draft/history', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    const Broken = lazy(async () => { throw new Error('3D chunk failed to load') })
    const notify = vi.fn()
    setup(<ViewportBoundary onUnavailable={notify}><Suspense fallback="Loading"><Broken /></Suspense></ViewportBoundary>)
    const before = latest
    expect(await screen.findByText(FALLBACK_NOTICE)).toBeTruthy()
    // The fallback DOM can commit before its passive announcement effect runs.
    await waitFor(() => expect(notify.mock.calls).toEqual([[FALLBACK_NOTICE]]))
    expect(latest).toBe(before)
  })
  it('recovers from WebGL context creation failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    vi.stubGlobal('WebGL2RenderingContext', class { })
    glMock.throws = true
    setup(<ViewportBoundary><Viewport3D /></ViewportBoundary>)
    expect(screen.getByText(FALLBACK_NOTICE)).toBeTruthy()
    expect(latest.history).toHaveLength(1)
  })
  it('switches to SVG on context loss with the existing state and an announcement', () => {
    vi.stubGlobal('WebGL2RenderingContext', class { })
    const notify = vi.fn()
    setup(<ViewportBoundary><Viewport3D onUnavailable={notify} /></ViewportBoundary>)
    const before = latest
    expect(screen.getByTestId('mock-3d')).toBeTruthy()
    act(() => glMock.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    expect(screen.getByText(FALLBACK_NOTICE)).toBeTruthy()
    expect(latest).toBe(before)
    expect(notify.mock.calls).toEqual([[FALLBACK_NOTICE]])
  })
})


it('keeps live handle feedback outside the model and hides the fixed-support overlay in 3D (D-26)', () => {
  vi.stubGlobal('WebGL2RenderingContext', class { })
  setup(<Viewport3D />)
  const before = latest
  expect(screen.queryByText('Fixed support')).toBeNull()
  act(() => glMock.feedback!({ label: 'Width', valueM: 0.04, limited: true }))
  const feedback = screen.getByTestId('dimension-feedback')
  expect(feedback.textContent).toContain('Width: 40.00 mm')
  expect(screen.getByRole('tooltip').textContent).toContain('Limit reached')
  expect(screen.getByTestId('mock-3d').contains(feedback)).toBe(false)
  expect(latest).toBe(before)
  act(() => glMock.feedback!(null))
  expect(feedback.textContent).toBe('')
  expect(screen.queryByRole('tooltip')).toBeNull()
})
