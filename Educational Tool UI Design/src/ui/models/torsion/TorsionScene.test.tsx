import { act, createRoot, extend, type RootStore } from '@react-three/fiber'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AmbientLight, Box3, BoxGeometry, ConeGeometry, DirectionalLight, GridHelper, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, type BufferAttribute, type InterleavedBufferAttribute, type WebGLRenderer,
} from 'three'
import { torsionChallenge } from '../../../../test/fixtures/torsion'
import { torsionRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import TorsionScene from './TorsionScene'
import { displayedTwist, useTorsionStore } from './shared'
import { TWIST_LINE_START_RAD } from './shaftLayout'

// 3D Torsion Shaft I scene (task 54.2) through R3F with a no-op renderer, as BeamView.test does.

extend({ AmbientLight, BoxGeometry, ConeGeometry, DirectionalLight, GridHelper, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry })
const ch = torsionChallenge()
let store: ReturnType<typeof useTorsionStore>
function Probe() { store = useTorsionStore(); return null }
let root: ReturnType<typeof createRoot> | undefined
let canvas: HTMLCanvasElement

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  canvas?.remove()
  root = undefined
  vi.unstubAllGlobals()
})

async function renderScene(twisted: boolean) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const renderer = {
    domElement: canvas, render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), getPixelRatio: () => 1,
    xr: { isPresenting: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), setAnimationLoop: vi.fn() },
    shadowMap: { enabled: false },
  }
  root = createRoot(canvas)
  await root.configure({ gl: renderer as unknown as WebGLRenderer, orthographic: true, frameloop: 'never', size: { width: 500, height: 400, top: 0, left: 0 } })
  const init = torsionRuntime.init(ch, '2026-10-17T00:00:00.000Z', 'base', 'guided')
  if (!init.ok) throw new Error('torsion challenge must initialize')
  let r3f: RootStore
  await act(async () => {
    r3f = root!.render(
      <StoreProvider challenge={ch} initialSession={init.value} runtime={torsionRuntime as unknown as ModelRuntime} storage={null}>
        <TorsionScene twisted={twisted} zoom={1} reset={0} fit={0} /><Probe />
      </StoreProvider>,
    )
  })
  return () => r3f!.getState().scene
}

/** Angle about +X of the twist line's free-end point. */
function freeEndAngle(scene: ReturnType<Awaited<ReturnType<typeof renderScene>>>) {
  const line = scene.getObjectByName('twist-line') as Mesh
  expect(line.type).toBe('Line2')
  const end = line.geometry.getAttribute('instanceEnd') as BufferAttribute | InterleavedBufferAttribute
  const i = end.count - 1
  expect(end.getX(i)).toBeCloseTo(ch.lengthM, 6)
  return Math.atan2(end.getZ(i), end.getY(i))
}

describe('3D torsion shaft (task 54.2)', () => {
  it('draws the draft shaft to scale with a fixed end, torque arrow and the latest tested twist', async () => {
    const scene = await renderScene(true)
    const history = store.state.history
    const shaft = scene().getObjectByName('torsion-shaft') as Mesh
    const box = shaft.geometry.boundingBox!
    expect(box.max.x - box.min.x).toBeCloseTo(ch.lengthM, 6)
    expect(box.max.y - box.min.y).toBeCloseTo(0.0265, 6)
    expect(box.max.z - box.min.z).toBeCloseTo(0.0265, 6)
    // Fixed end at x = 0: the wall lies behind it, the clamp grips the root.
    const wall = new Box3().setFromObject(scene().getObjectByName('fixed-wall')!)
    expect(wall.max.x).toBeCloseTo(0, 6)
    const clamp = new Box3().setFromObject(scene().getObjectByName('fixed-clamp')!)
    expect(clamp.min.x).toBeCloseTo(0, 6)
    expect(clamp.max.y).toBeGreaterThan(0.01325)
    // The curved torque arrow sits beyond the free end, around the axis.
    const arrow = new Box3().setFromObject(scene().getObjectByName('torque-arrow')!)
    expect(arrow.min.x).toBeGreaterThan(ch.lengthM)
    expect(arrow.max.y).toBeGreaterThan(0.01325)
    expect(arrow.min.y).toBeLessThan(-0.01325)
    const { shownRad } = displayedTwist(store.state.history[0]!.analysis.twistRad, ch.visualization)
    expect(shownRad).toBeGreaterThan(0)
    expect(freeEndAngle(scene())).toBeCloseTo(TWIST_LINE_START_RAD + shownRad, 6)
    // D-26: nothing but the canvas is rendered by the scene; no text on the model.
    expect(canvas.parentElement!.textContent).toBe('')
    expect(store.state.history).toBe(history)
  })

  it('redraws a hollow tube from the draft but keeps the twist of the latest TESTED design', async () => {
    const scene = await renderScene(true)
    const before = freeEndAngle(scene())
    await act(async () => store.dispatch({ type: 'edit', edit: { type: 'setSection', kind: 'tube' } }))
    await act(async () => store.dispatch({ type: 'edit', edit: { type: 'setParam', param: 'outerDiameterM', valueM: 0.05, mode: 'strict' } }))
    expect(store.state.draft.section).toMatchObject({ kind: 'tube', outerDiameterM: 0.05 })
    const shaft = scene().getObjectByName('torsion-shaft') as Mesh
    const box = shaft.geometry.boundingBox!
    expect(box.max.y - box.min.y).toBeCloseTo(0.05, 6)
    // The tube has a bore: no vertex lies inside the inner radius, and the line is on the new surface.
    const position = shaft.geometry.getAttribute('position')
    const inner = (store.state.draft.section as { innerDiameterM: number }).innerDiameterM / 2
    let minR = Infinity
    for (let i = 0; i < position.count; i++) minR = Math.min(minR, Math.hypot(position.getY(i), position.getZ(i)))
    expect(minR).toBeCloseTo(inner, 4)
    expect(freeEndAngle(scene())).toBeCloseTo(before, 6)
    expect(store.state.history).toHaveLength(1)
  })

  it('draws the surface line untwisted when twist display is off', async () => {
    const scene = await renderScene(false)
    expect(freeEndAngle(scene())).toBeCloseTo(TWIST_LINE_START_RAD, 6)
  })
})
