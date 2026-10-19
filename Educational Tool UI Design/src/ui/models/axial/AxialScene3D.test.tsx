import { act, createRoot, extend, type RootStore } from '@react-three/fiber'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AmbientLight, BoxGeometry, ConeGeometry, CylinderGeometry, DirectionalLight, Group, LineBasicMaterial, LineSegments,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, type WebGLRenderer,
} from 'three'
import { axialChallenge } from '../../../../test/fixtures/axial'
import { axialModel } from '../../../state/axialModel'
import { axialRuntime, type ModelRuntime } from '../../../state/runtimes'
import StoreProvider from '../../state/StoreProvider'
import { AxialScene, DISPLAY_LENGTH_M } from './AxialScene3D'
import { displayedStretch } from './shared'

// Stress and Strain I 3D scene (task 72; SSR-15, D-26) through R3F with a no-op renderer, as the
// torsion scene test does.

extend({ AmbientLight, BoxGeometry, ConeGeometry, CylinderGeometry, DirectionalLight, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry })
const ch = axialChallenge()
let root: ReturnType<typeof createRoot> | undefined
let canvas: HTMLCanvasElement

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  canvas?.remove()
  root = undefined
  vi.unstubAllGlobals()
})

async function renderScene(stretch: boolean) {
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
  const init = axialRuntime.init(ch, '2026-10-19T00:00:00.000Z', 'base', 'parametric')
  if (!init.ok) throw new Error('rod challenge must initialize')
  let r3f: RootStore
  await act(async () => {
    r3f = root!.render(
      <StoreProvider challenge={ch} initialSession={init.value} runtime={axialRuntime as unknown as ModelRuntime} storage={null}>
        <AxialScene zoom={1} reset={0} stretch={stretch} />
      </StoreProvider>,
    )
  })
  return r3f!.getState().scene
}

describe('Stress and Strain I 3D scene', () => {
  it('draws the draft rod at its true radius, stretched by the latest tested elongation, with a ring at the unstretched end', async () => {
    const scene = await renderScene(true)
    const rod = scene.getObjectByName('rod') as Mesh<CylinderGeometry>
    const { radiusTop, height } = rod.geometry.parameters
    expect(radiusTop).toBeCloseTo(ch.initialDesign.diameterM / 2, 12)
    const { fractionOfLength } = displayedStretch(axialModel.analyze(ch.initialDesign, ch).elongationM, ch.lengthM, ch.visualization)
    expect(height).toBeCloseTo(DISPLAY_LENGTH_M * (1 + fractionOfLength), 12)
    expect(scene.getObjectByName('unstretched-end')).toBeDefined()
    expect(scene.getObjectByName('roof-beam')).toBeDefined()
    expect(scene.getObjectByName('load')).toBeDefined()
  })

  it('draws the unstretched rod and no ring when the stretch is hidden', async () => {
    const scene = await renderScene(false)
    const rod = scene.getObjectByName('rod') as Mesh<CylinderGeometry>
    expect(rod.geometry.parameters.height).toBeCloseTo(DISPLAY_LENGTH_M, 12)
    expect(scene.getObjectByName('unstretched-end')).toBeUndefined()
  })
})
