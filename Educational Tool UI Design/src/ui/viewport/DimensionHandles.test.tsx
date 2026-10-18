import { act, createRoot, extend, type RootStore, type ThreeEvent } from '@react-three/fiber'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Ray, Vector3, type WebGLRenderer } from 'three'
extend({ Group, Mesh, MeshBasicMaterial, SphereGeometry })
import { bundledChallengeResult } from '../../challenge/content'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useDispatch, useSession } from '../state/store'
import DimensionHandles from './DimensionHandles'

let session: ReturnType<typeof useSession>
let dispatch: ReturnType<typeof useDispatch>
function Probe() { session = useSession(); dispatch = useDispatch(); return null }
let root: ReturnType<typeof createRoot> | undefined
let canvas: HTMLCanvasElement

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  canvas?.remove()
  document.querySelectorAll('[data-handle-test]').forEach((el) => el.remove())
  root = undefined
  vi.unstubAllGlobals()
})
async function setup(mode: 'guided' | 'parametric' = 'parametric') {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const flush = async () => { await act(async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((cb) => cb(0)) }) }
  canvas = document.createElement('canvas')
  canvas.dataset.handleTest = 'true'
  document.body.append(canvas)
  const renderer = { domElement: canvas, render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), getPixelRatio: () => 1, xr: { isPresenting: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), setAnimationLoop: vi.fn() }, shadowMap: { enabled: false } }
  root = createRoot(canvas)
  await root.configure({ gl: renderer as unknown as WebGLRenderer, frameloop: 'never', size: { width: 500, height: 400, top: 0, left: 0 } })
  const boot = bootstrap(bundledChallengeResult, () => '2026-10-15T00:00:00.000Z', () => 'baseline', mode)
  if (!boot.ok) throw new Error('Invalid session')
  const dragActive = vi.fn()
  const feedback = vi.fn()
  let store: RootStore
  await act(async () => { store = root!.render(<StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session}><DimensionHandles onDragActive={dragActive} onFeedback={feedback} /><Probe /></StoreProvider>) })
  const controls = { enabled: true }
  await act(async () => { store!.setState({ controls: controls as unknown as ReturnType<RootStore['getState']>['controls'] }) })
  const handle = (param: string) => store!.getState().scene.getObjectByName(`handle-${param}`) as Mesh
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }
  const event = (y: number, pointerId = 1) => ({ pointerId, pointerType: 'mouse', button: 0, target, stopPropagation: vi.fn(), ray: new Ray(new Vector3(0.604, y, 1), new Vector3(0, 0, -1)) }) as unknown as ThreeEvent<PointerEvent>
  // Use the real R3F reconciler/mesh event handlers with a no-op GPU renderer.
  const invoke = async (mesh: Mesh, name: string, e: ThreeEvent<PointerEvent>) => {
    const instance = mesh as Mesh & { __r3f: { handlers: Record<string, (e: ThreeEvent<PointerEvent>) => void> } }
    await act(async () => { instance.__r3f.handlers[name](e) })
  }
  return { handle, event, invoke, controls, dragActive, feedback, target, frames, flush, store: store! }
}

describe('dimension handle/store integration (16.1/16.2)', () => {
  it('captures the pointer, applies only latest motion per frame through the clamper, and restores orbit on release', async () => {
    const t = await setup()
    const mesh = t.handle('diameterM')
    const history = session.history
    await t.invoke(mesh, 'onPointerDown', t.event(0.015))
    expect(t.target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(t.controls.enabled).toBe(false)
    await t.invoke(mesh, 'onPointerMove', t.event(0.1))
    await t.invoke(mesh, 'onPointerMove', t.event(0.04))
    expect(session.draft.section).toEqual({ kind: 'circle', diameterM: 0.03 })
    expect(t.frames.size).toBe(1)
    await t.flush()
    expect(session.draft.section).toEqual({ kind: 'circle', diameterM: 0.08 })
    expect(session.history).toBe(history)
    await t.invoke(mesh, 'onPointerMove', t.event(0.2))
    await t.flush()
    expect(session.draft.section).toEqual({ kind: 'circle', diameterM: 0.1 })
    expect(t.feedback).toHaveBeenLastCalledWith({ label: 'Diameter', valueM: 0.1, limited: true })
    await t.invoke(mesh, 'onPointerMove', t.event(0.025))
    await t.flush()
    expect((session.draft.section as { diameterM: number }).diameterM).toBeCloseTo(0.05, 12)
    expect(t.feedback.mock.calls.at(-1)![0].limited).toBe(false)
    await t.invoke(mesh, 'onPointerUp', t.event(0.025))
    expect(t.controls.enabled).toBe(true)
    expect(t.target.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(t.dragActive.mock.calls).toEqual([[true], [false]])
    expect(t.feedback).toHaveBeenLastCalledWith(null)
  })
  it('skips unprojectable events, cancels pending motion, and replaces handle sets on section/orientation change', async () => {
    const t = await setup()
    const mesh = t.handle('diameterM')
    await t.invoke(mesh, 'onPointerDown', t.event(0.015))
    const invalid = t.event(NaN)
    await t.invoke(mesh, 'onPointerMove', invalid)
    expect(t.frames.size).toBe(0)
    await t.invoke(mesh, 'onPointerMove', t.event(0.04))
    await t.invoke(mesh, 'onPointerCancel', t.event(0.04))
    await t.flush()
    expect(session.draft.section).toEqual({ kind: 'circle', diameterM: 0.03 })
    expect(t.controls.enabled).toBe(true)
    await act(async () => dispatch({ type: 'applySection', kind: 'iSection' }))
    expect(t.handle('diameterM')).toBeUndefined()
    for (const param of ['widthM', 'heightM', 'flangeThicknessM', 'webThicknessM']) expect(t.handle(param)).toBeInstanceOf(Mesh)
    const before = t.handle('heightM').position.toArray()
    await act(async () => dispatch({ type: 'setOrientation', orientationDeg: 90 }))
    expect(t.handle('heightM').position.toArray()).not.toEqual(before)
  })

  it('shows no handle for a parameter the current Guided step locks (task 58)', async () => {
    const t = await setup('guided')
    // Step 1 unlocks the depth: the diameter handle is present.
    expect(t.handle('diameterM')).toBeTruthy()
    await act(async () => {
      dispatch({ type: 'setParam', param: 'diameterM', valueM: 0.04, mode: 'strict' })
      dispatch({ type: 'setPrediction', direction: 'decrease', now: 't' })
      dispatch({ type: 'runTest', now: 't', id: 'r1' })
    })
    // Step 2 locks every dimension (only the shape is editable): no handles remain.
    expect(session.history).toHaveLength(2)
    expect(t.handle('diameterM')).toBeUndefined()
  })
})
