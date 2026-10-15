import { act, createRoot, extend, type RootStore } from '@react-three/fiber'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AmbientLight, BoxGeometry, ConeGeometry, DirectionalLight, GridHelper, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, type WebGLRenderer,
} from 'three'
import { bundledChallengeResult } from '../../challenge/content'
import { orientedEnvelope } from '../../geometry/envelope'
import { bootstrap } from '../state/bootstrap'
import StoreProvider from '../state/StoreProvider'
import { useDispatch, useSession } from '../state/store'
import BeamView from './BeamView'
import type { SceneHitTarget } from './Viewport3D'

extend({ AmbientLight, BoxGeometry, ConeGeometry, DirectionalLight, GridHelper, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry })
let state: ReturnType<typeof useSession>
let dispatch: ReturnType<typeof useDispatch>
function Probe() { state = useSession(); dispatch = useDispatch(); return null }
let root: ReturnType<typeof createRoot> | undefined
let canvas: HTMLCanvasElement

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  canvas?.remove()
  root = undefined
  vi.unstubAllGlobals()
})

describe('3D scene presentation (D-26)', () => {
  it('renders all four typed profiles with no envelope, dimension guides or on-model text', async () => {
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
    const boot = bootstrap(bundledChallengeResult, () => '2026-10-15T00:00:00.000Z', () => 'baseline')
    if (!boot.ok) throw new Error('Invalid challenge')
    const hitTarget = createRef<SceneHitTarget>()
    let store: RootStore
    await act(async () => {
      store = root!.render(<StoreProvider challenge={boot.value.challenge} initialSession={boot.value.session}>
        <BeamView deformed={false} highlight={false} zoom={1} reset={0} fit={0} hitTarget={hitTarget} /><Probe />
      </StoreProvider>)
    })
    const history = state.history
    for (const kind of boot.value.challenge.allowedSections) {
      await act(async () => dispatch({ type: 'applySection', kind }))
      const scene = store!.getState().scene
      const beam = scene.getObjectByName('draft-beam') as Mesh
      expect(beam).toBeInstanceOf(Mesh)
      const bounds = beam.geometry.boundingBox!
      const env = orientedEnvelope(state.draft.section, state.draft.orientationDeg)
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(state.draft.lengthM, 6)
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(env.heightYM, 6)
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(env.widthZM, 6)
      const lines: string[] = []
      scene.traverse((object) => { if (object.type === 'Line2') lines.push(object.type) })
      // With deformation hidden the only scene line is the force-arrow shaft.
      expect(lines).toHaveLength(1)
      expect(canvas.parentElement!.textContent).toBe('')
      expect(canvas.parentElement!.querySelectorAll('div')).toHaveLength(0)
      expect(hitTarget.current?.beam).toBe(beam)
      expect(state.history).toBe(history)
    }
  })
})
