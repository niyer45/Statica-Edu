import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei/core/Edges'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { ExtrudeGeometry, OrthographicCamera, Shape } from 'three'
import { bracketArmLengthM, bracketBendSection, bracketBoltRowHeightM, bracketOutline } from '../../../geometry/bracket/outline'
import Icon from '../../icons/Icon'
import { wallHatchTexture } from '../../viewport/wallHatch'
import { SUMMARY_ID } from './BracketDetails'
import { useBracketStore } from './shared'

// Bracket 3D view (task 55 L-bracket; owner request: show a real L-bracket). Lazy chunk. Scene in
// metres: x from the wall face (0) outward along the arm, y up from the underside of the arm, z
// across the bracket width.
//   - A hatched wall block behind x = 0.
//   - The DRAFT L-bracket: the pure display outline (geometry/bracket/outline.ts: flange flat on
//     the wall, the bend with its inner radius, the arm) extruded across the width, with crisp
//     edges.
//   - The two bolts of the row through the flange: hex heads and washers on the inside face.
//   - The load: a hanger pin spanning the width under the arm at the load offset, a V-sling to a
//     weight and a downward arrow.
//   - When the draft is the tested design, a band across the middle of the bend marks the
//     critical section (where the stored bend stress is checked); shape plus the text summary,
//     never color alone. No static text on the model (D-26).
// Orbit with the pointer; zoom and reset with the buttons. If WebGL2 is missing or the context is
// lost, BracketView swaps in the main-bundle 2D side view.

const ALUMINUM = '#9aa79b'
const LOAD = '#cf744b'
const MARK = '#7a3f14'
const DARK = '#3d4a3f'

/** Scene framing: centre and half-extent of the region the camera keeps in view, m. */
const FOCUS: [number, number, number] = [0.045, 0.01, 0]
const RADIUS = 0.15

function CameraRig({ zoom, reset }: { zoom: number; reset: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(900)
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.width, size.height * 1.4) / (2.3 * RADIUS)
    camera.position.set(FOCUS[0] + 0.3, FOCUS[1] + 0.16, FOCUS[2] + 0.42)
    controls.current?.target.set(...FOCUS)
    camera.lookAt(...FOCUS)
    camera.zoom = baseZoom.current
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, size.width, size.height, reset, invalidate])
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    camera.zoom = baseZoom.current * zoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, zoom, reset, size.width, size.height, invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping={false} enableZoom={false} enablePan={false} />
}

function Scene({ zoom, reset }: { zoom: number; reset: number }) {
  const { state, challenge: ch } = useBracketStore()
  const draft = state.draft
  const w = draft.widthM
  const t = draft.thicknessM
  const armLength = bracketArmLengthM(ch)
  const geometry = useMemo(() => {
    const pts = bracketOutline(draft, armLength)
    const shape = new Shape()
    pts.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)))
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, -w / 2)
    return g
  }, [draft, armLength, w])
  useEffect(() => () => geometry.dispose(), [geometry])
  const hatch = useMemo(wallHatchTexture, [])
  useEffect(() => () => hatch.dispose(), [hatch])
  const latest = state.history[state.history.length - 1]!
  const tested = state.draftStatus === 'tested' ? latest.designSnapshot : undefined
  const boltY = bracketBoltRowHeightM(draft, ch)
  const boltZ = [-w / 4, w / 4]
  const loadX = ch.loadOffsetM
  const pinY = -0.003
  const hookY = -0.045
  const weightTop = -0.055
  const band = tested ? bracketBendSection(tested) : undefined
  return (
    <>
      <CameraRig zoom={zoom} reset={reset} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[0.6, 1.4, 1.2]} intensity={2.2} />
      <directionalLight position={[-0.5, 0.4, -0.8]} intensity={0.5} />
      <mesh position={[-0.02, 0.05, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.26]} />
        <meshStandardMaterial map={hatch} roughness={1} />
      </mesh>
      <mesh name="bracket-body" geometry={geometry}>
        <meshStandardMaterial color={ALUMINUM} roughness={0.45} metalness={0.35} />
        <Edges color="#243326" threshold={20} />
      </mesh>
      {boltZ.map((z) => (
        <group key={z} position={[0, boltY, z]}>
          <mesh position={[t + 0.0008, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0065, 0.0065, 0.0016, 24]} />
            <meshStandardMaterial color="#59665b" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[t + 0.0016 + 0.0022, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.0044, 6]} />
            <meshStandardMaterial color={DARK} roughness={0.5} metalness={0.4} />
            <Edges color="#1d2a1f" />
          </mesh>
        </group>
      ))}
      {band && (
        <mesh position={[(band.inner.x + band.outer.x) / 2, (band.inner.y + band.outer.y) / 2, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[tested!.thicknessM + 0.006, 0.003, tested!.widthM + 0.01]} />
          <meshStandardMaterial color={MARK} roughness={0.7} transparent opacity={0.8} />
          <Edges color={MARK} />
        </mesh>
      )}
      <mesh position={[loadX, pinY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0028, 0.0028, w + 0.012, 16]} />
        <meshStandardMaterial color={DARK} roughness={0.5} metalness={0.4} />
      </mesh>
      <Line points={[[loadX, pinY, w / 2 + 0.004], [loadX, hookY, 0], [loadX, pinY, -w / 2 - 0.004]]} color={DARK} lineWidth={1.5} />
      <Line points={[[loadX, hookY, 0], [loadX, weightTop, 0]]} color={DARK} lineWidth={1.5} />
      <mesh position={[loadX, weightTop - 0.014, 0]}>
        <boxGeometry args={[0.03, 0.028, 0.03]} />
        <meshStandardMaterial color={LOAD} roughness={0.8} />
        <Edges color={MARK} />
      </mesh>
      <Line points={[[loadX, weightTop - 0.032, 0], [loadX, weightTop - 0.058, 0]]} color={LOAD} lineWidth={2} />
      <mesh position={[loadX, weightTop - 0.064, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.006, 0.012, 12]} />
        <meshBasicMaterial color={LOAD} />
      </mesh>
    </>
  )
}

export default function BracketScene3D({ onContextLost: onLost }: { onContextLost: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const onContextLost = useCallback((event: Event) => {
    event.preventDefault()
    onLost()
  }, [onLost])
  useEffect(() => () => canvas.current?.removeEventListener('webglcontextlost', onContextLost), [onContextLost])
  return (
    <>
      <div className="beam-scene bracket-scene relative flex flex-1 flex-col">
        <Canvas
          className="scene-canvas"
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [0.35, 0.19, 0.42], near: 0.001, far: 20, zoom: 900 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', '3D view of the L-bracket: the flange bolted flat to the wall, the bend, and the arm carrying a hanging load')
            gl.domElement.setAttribute('aria-describedby', SUMMARY_ID)
            gl.domElement.tabIndex = 0
          }}
        >
          <Scene zoom={zoom} reset={reset} />
        </Canvas>
      </div>
      <div className="bracket-scene-controls" role="group" aria-label="3D view controls">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((v) => Math.min(1.8, v + 0.15))}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.15))}>
          <Icon name="minus" size={15} />
        </button>
        <button type="button" aria-label="Reset view" title="Reset view" onClick={() => { setZoom(1); setReset((n) => n + 1) }}>
          <Icon name="reset" size={15} />
        </button>
        <span className="bracket-scene-hint">Drag to rotate</span>
      </div>
    </>
  )
}
