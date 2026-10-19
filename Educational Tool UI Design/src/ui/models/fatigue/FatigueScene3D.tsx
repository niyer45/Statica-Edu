import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei/core/Edges'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { DoubleSide, LatheGeometry, OrthographicCamera, Vector2 } from 'three'
import { wheelLoadRangeN } from '../../../challenge/fatigue/types'
import { hubProfile, loadLineX, spindleProfile, type ProfilePoint } from '../../../geometry/fatigue/outline'
import Icon from '../../icons/Icon'
import { wallHatchTexture } from '../../viewport/wallHatch'
import { SUMMARY_ID } from './FatigueDetails'
import { useFatigueStore } from './shared'

// Fatigue 3D view (task 70; FAT-16, D-45). Lazy chunk. Scene in metres: x along the spindle axis
// from the housing face (x = 0), y up, z across.
//   - A hatched housing block behind x = 0 that holds the collar.
//   - The DRAFT spindle: the pure display profile (geometry/fatigue/outline.ts: collar, shoulder
//     fillet, neck) turned on a lathe, with crisp edges at the shoulder.
//   - The wheel hub seated on the shoulder face, drawn see-through so the fillet stays visible.
//   - The wheel load at its line: a long solid arrow (largest load) and a short thin arrow
//     (smallest load) above the hub.
//   - When the draft is the tested design, a ring around the fillet marks the critical section.
// No text on the model (D-26). If WebGL2 is missing or the context is lost, FatigueView swaps in
// the main-bundle 2D side view.

const STEEL = '#8e989b'
const HUB = '#b7c2b0'
const LOAD = '#cf744b'
const MARK = '#7a3f14'
const DARK = '#3d4a3f'

const FOCUS: [number, number, number] = [0.05, 0.005, 0]
const RADIUS = 0.085

function lathe(points: ProfilePoint[]): LatheGeometry {
  return new LatheGeometry(points.map((q) => new Vector2(q.y, q.x)), 64)
}

function CameraRig({ zoom, reset }: { zoom: number; reset: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(1500)
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.width, size.height * 1.5) / (2.3 * RADIUS)
    camera.position.set(FOCUS[0] + 0.18, FOCUS[1] + 0.12, FOCUS[2] + 0.3)
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
  const { state, challenge: ch } = useFatigueStore()
  const draft = state.draft
  const spindle = useMemo(() => lathe(spindleProfile(draft, ch)), [draft, ch])
  const hub = useMemo(() => lathe([...hubProfile(draft, ch), hubProfile(draft, ch)[0]!]), [draft, ch])
  useEffect(() => () => spindle.dispose(), [spindle])
  useEffect(() => () => hub.dispose(), [hub])
  const hatch = useMemo(wallHatchTexture, [])
  useEffect(() => () => hatch.dispose(), [hatch])
  const latest = state.history[state.history.length - 1]!
  const tested = state.draftStatus === 'tested' ? latest.designSnapshot : undefined
  const loadX = loadLineX(ch)
  const hubTop = hubProfile(draft, ch)[1]!.y
  const range = wheelLoadRangeN(ch.load)
  const longArrow = 0.032
  const shortArrow = longArrow * (range.minN / range.maxN)
  const ringX = ch.geometry.collarLengthM + draft.filletRadiusM / 2
  const ringR = draft.neckDiameterM / 2 + draft.filletRadiusM / 2
  return (
    <>
      <CameraRig zoom={zoom} reset={reset} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[0.6, 1.4, 1.2]} intensity={2.2} />
      <directionalLight position={[-0.5, 0.4, -0.8]} intensity={0.5} />
      <mesh position={[-0.015, 0, 0]}>
        <boxGeometry args={[0.03, 0.11, 0.11]} />
        <meshStandardMaterial map={hatch} roughness={1} />
      </mesh>
      <mesh name="fatigue-spindle" geometry={spindle} rotation={[0, 0, -Math.PI / 2]}>
        <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.35} />
        <Edges color="#243326" threshold={30} />
      </mesh>
      <mesh name="fatigue-hub" geometry={hub} rotation={[0, 0, -Math.PI / 2]}>
        <meshStandardMaterial color={HUB} roughness={0.6} transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
      </mesh>
      {tested && (
        <mesh name="fatigue-fillet-ring" position={[ringX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[ringR + 0.0012, 0.0012, 10, 48]} />
          <meshStandardMaterial color={MARK} roughness={0.7} />
        </mesh>
      )}
      <Line points={[[loadX, hubTop + 0.004 + longArrow, 0], [loadX, hubTop + 0.012, 0]]} color={LOAD} lineWidth={2.5} />
      <mesh position={[loadX, hubTop + 0.008, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.0035, 0.008, 12]} />
        <meshBasicMaterial color={LOAD} />
      </mesh>
      <Line points={[[loadX + 0.012, hubTop + 0.012 + shortArrow, 0], [loadX + 0.012, hubTop + 0.012, 0]]} color={DARK} lineWidth={1.2} />
      <mesh position={[loadX + 0.012, hubTop + 0.009, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.0022, 0.006, 10]} />
        <meshBasicMaterial color={DARK} />
      </mesh>
    </>
  )
}

export const FATIGUE_CANVAS_LABEL = '3D view of the stepped spindle: the collar held by the housing, the shoulder fillet, and the neck with the wheel hub and the fluctuating wheel load'

export default function FatigueScene3D({ onContextLost: onLost }: { onContextLost: () => void }) {
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
          camera={{ position: [0.23, 0.125, 0.3], near: 0.001, far: 20, zoom: 1500 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', FATIGUE_CANVAS_LABEL)
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
