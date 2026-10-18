import { act, createRoot, extend, type RootStore } from '@react-three/fiber'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AmbientLight, BoxGeometry, ConeGeometry, CylinderGeometry, DirectionalLight, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, type Object3D, type WebGLRenderer,
} from 'three'
import { bracedFrameChallenge } from '../../../../test/fixtures/bracedFrame'
import type { BracedFrameChallenge } from '../../../challenge/bracedFrame/types'
import { FRAME_MEMBER_IDS, isDiagonalId } from '../../../geometry/bracedFrame/template'
import type { BracedFrameAction, BracedFrameSession } from '../../../state/bracedFrameModel'
import { bracedFrameRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import { useModelStore } from '../../state/store'
import BracedFrameScene from './BracedFrameScene'
import { frameSceneLayout, TUBE_DIAMETER_EXAGGERATION } from './frameSceneLayout'

// Braced Frame I 3D scene content (task 54.3), rendered into a real R3F root with a stub
// renderer (as BeamView.test does). Geometry comes from the template, diameters from the draft
// sections, and force patterns from the latest stored test; a mechanism has no force pattern.

extend({ AmbientLight, BoxGeometry, ConeGeometry, CylinderGeometry, DirectionalLight, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry })

let state: BracedFrameSession
let dispatch: (a: BracedFrameAction) => void
function Probe() {
  const store = useModelStore<BracedFrameSession, BracedFrameAction, BracedFrameChallenge>()
  state = store.state
  dispatch = store.dispatch
  return null
}
let root: ReturnType<typeof createRoot> | undefined
let canvas: HTMLCanvasElement

afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  canvas?.remove()
  root = undefined
  vi.unstubAllGlobals()
})

async function renderScene(ch: BracedFrameChallenge): Promise<RootStore> {
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
  const init = bracedFrameRuntime.init(ch, '2026-10-17T00:00:00.000Z', 'base', 'guided')
  if (!init.ok) throw new Error('braced frame challenge must initialize')
  let store: RootStore
  await act(async () => {
    store = root!.render(
      <StoreProvider challenge={ch} initialSession={init.value} runtime={bracedFrameRuntime as unknown as ModelRuntime} storage={null}>
        <BracedFrameScene zoom={1} reset={0} fit={0} />
        <Probe />
      </StoreProvider>,
    )
  })
  return store!
}

const named = (store: RootStore, prefix: string) => {
  const found: Object3D[] = []
  store.getState().scene.traverse((o) => {
    if (o.name.startsWith(prefix)) found.push(o)
  })
  return found
}
const meshCount = (o: Object3D) => o.children.filter((c) => c instanceof Mesh).length
const wireframe = (o: Object3D) => o.children.every((c) => c instanceof Mesh && (c.material as MeshBasicMaterial).wireframe === true)
const radiusOf = (ch: BracedFrameChallenge, sectionId: string) => (ch.sections.find((s) => s.id === sectionId)!.outerDiameterM * TUBE_DIAMETER_EXAGGERATION) / 2

describe('Braced Frame I 3D scene (task 54.3)', () => {
  it('draws the baseline from the template with stored force patterns, pinned supports and load arrows', async () => {
    const ch = bracedFrameChallenge()
    const store = await renderScene(ch)
    const tested = state.history.at(-1)!.analysis
    if (tested.status !== 'solved') throw new Error('baseline must be solved')
    const members = named(store, 'member-')
    expect(members.map((m) => m.name.slice(7)).sort()).toEqual(FRAME_MEMBER_IDS.filter((id) => !isDiagonalId(id) || state.draft.members[id].present).sort())
    for (const group of members) {
      const id = group.name.slice(7) as keyof typeof tested.members
      expect(group.userData.pattern).toBe(tested.members[id]!.sense)
      expect(group.userData.radiusM).toBeCloseTo(radiusOf(ch, state.draft.members[id].sectionId), 12)
      // Pattern by shape: compression is banded (many meshes), ≈ 0 is beaded, tension one solid tube.
      const pattern = group.userData.pattern as string
      if (pattern === 'tension') expect(meshCount(group)).toBe(1)
      else expect(meshCount(group)).toBeGreaterThan(3)
    }
    expect(store.getState().scene.getObjectByName('member-diag1b')!.userData.pattern).toBe('compression')
    expect(store.getState().scene.getObjectByName('member-beam2')!.userData.pattern).toBe('zero')
    expect(members.some((m) => m.userData.pattern === 'tension')).toBe(true)
    // Absent candidate diagonals are dashed lines, not tubes.
    const absent = named(store, 'absent-')
    expect(absent.map((o) => o.name).sort()).toEqual(['absent-diag1a', 'absent-diag2a'])
    expect(absent.every((o) => o.type === 'Line2')).toBe(true)
    expect(named(store, 'support-').map((o) => o.name)).toEqual(['support-j1', 'support-j2'])
    expect(named(store, 'joint-')).toHaveLength(6)
    // One arrow per non-zero configured load component (j3 x, j5 x and y, j6 y).
    expect(named(store, 'load-').map((o) => o.name).sort()).toEqual(['load-j3-x', 'load-j5-x', 'load-j5-y', 'load-j6-y'])
    expect(store.getState().scene.getObjectByName('ground-slab')).toBeInstanceOf(Mesh)
    // D-26: nothing is written onto or over the canvas.
    expect(canvas.parentElement!.textContent).toBe('')
  })

  it('shows draft topology and sections with no tested force pattern on a newly added diagonal', async () => {
    const ch = bracedFrameChallenge()
    const store = await renderScene(ch)
    const history = state.history
    await act(async () => dispatch({ type: 'edit', edit: { type: 'toggleDiagonal', memberId: 'diag1a' } }))
    await act(async () => dispatch({ type: 'edit', edit: { type: 'setMemberSection', memberId: 'col1L', sectionId: 'CHS88.9x5.0' } }))
    const added = store.getState().scene.getObjectByName('member-diag1a')!
    expect(added.userData.pattern).toBe('plain')
    expect(meshCount(added)).toBe(1)
    // Untested differs from the solid tension tube by shape: an open wire-mesh tube.
    expect(wireframe(added)).toBe(true)
    expect(store.getState().scene.getObjectByName('absent-diag1a')).toBeUndefined()
    expect(store.getState().scene.getObjectByName('member-col1L')!.userData.radiusM).toBeCloseTo(radiusOf(ch, 'CHS88.9x5.0'), 12)
    // Editing changes only the draft; the stored results that drive patterns are unchanged.
    expect(state.history).toBe(history)
    expect(store.getState().scene.getObjectByName('member-diag1b')!.userData.pattern).toBe('compression')
  })

  it('draws a mechanism with no force patterns', async () => {
    const base = bracedFrameChallenge()
    const ch: BracedFrameChallenge = {
      ...base,
      initialDesign: { ...base.initialDesign, members: { ...base.initialDesign.members, diag2b: { present: false, sectionId: 'CHS60.3x4.0' } } },
    }
    const store = await renderScene(ch)
    expect(state.history.at(-1)!.analysis.status).toBe('mechanism')
    const members = named(store, 'member-')
    expect(members).toHaveLength(7)
    expect(members.every((m) => m.userData.pattern === 'plain' && meshCount(m) === 1 && wireframe(m))).toBe(true)
    expect(named(store, 'absent-')).toHaveLength(3)
  })

  it('frames every scene element inside the camera sphere', () => {
    const ch = bracedFrameChallenge()
    const init = bracedFrameRuntime.init(ch, '2026-10-17T00:00:00.000Z', 'base', 'guided')
    if (!init.ok) throw new Error('braced frame challenge must initialize')
    const layout = frameSceneLayout(ch, init.value.draft, init.value.history[0]!.analysis)
    const inside = (p: readonly number[]) => Math.hypot(p[0]! - layout.center[0], p[1]! - layout.center[1], p[2]! - layout.center[2]) <= layout.radiusM + 1e-9
    for (const j of layout.joints) expect(inside(j.position)).toBe(true)
    for (const l of layout.loads) expect(inside([l.tip[0] - l.direction[0] * 1.1, l.tip[1] - l.direction[1] * 1.1, 0])).toBe(true)
    expect(inside([layout.slab.minX, layout.groundY, 0])).toBe(true)
    expect(inside([layout.slab.maxX, layout.groundY, 0])).toBe(true)
  })
})
