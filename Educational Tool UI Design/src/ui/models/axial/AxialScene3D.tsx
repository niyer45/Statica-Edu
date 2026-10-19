import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei/core/Edges'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { OrthographicCamera } from 'three'
import Icon from '../../icons/Icon'
import { wallHatchTexture } from '../../viewport/wallHatch'
import { AXIAL_SUMMARY_ID } from './AxialView'
import { displayedStretch, useAxialStore } from './shared'

// Stress and Strain I 3D view (task 72; SSR-15, D-26, D-45). Lazy chunk. Scene in metres, y up:
//   - a hatched roof beam with a clevis whose cheeks and pin hold the top of the rod;
//   - the DRAFT rod: a solid round bar of the draft diameter (to scale), drawn DISPLAY_LENGTH_M
//     long (much shorter than the real rod, as the text summary says), stretched by the LATEST
//     TESTED elongation × the configured exaggeration (display only, capped) when "Show stretch"
//     is on, with a thin ring where the unstretched rod would end;
//   - a lower clevis, the hanging load block and a downward arrow along the rod's axis.
// No text is drawn on the model; the summary below the view is the text equivalent. Orbit with
// the pointer; zoom and reset with the buttons. Context loss swaps in the 2D view (AxialView).

/** Drawn length of the unstretched rod, m (not to scale). */
export const DISPLAY_LENGTH_M = 0.5
const COLORS: Readonly<Record<string, string>> = { steel: '#8e989b', aluminium: '#c5ccc8', titanium: '#9a9fb0' }
const DARK = '#3d4a3f'
const LOAD = '#cf744b'
const MARK = '#7a3f14'
const FOCUS: [number, number, number] = [0, -0.3, 0]
const RADIUS = 0.42

function CameraRig({ zoom, reset }: { zoom: number; reset: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(500)
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.width, size.height * 1.2) / (2.3 * RADIUS)
    camera.position.set(FOCUS[0] + 0.55, FOCUS[1] + 0.25, FOCUS[2] + 0.8)
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

/** Two clevis cheeks either side of the rod end and the pin through them, centred at height y. */
function Clevis({ y, r }: { y: number; r: number }) {
  return (
    <group position={[0, y, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0, side * (r + 0.005)]}>
          <boxGeometry args={[0.036, 0.04, 0.006]} />
          <meshStandardMaterial color="#7d8a7e" roughness={0.6} metalness={0.3} />
          <Edges color="#2f3a31" />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 2 * r + 0.026, 16]} />
        <meshStandardMaterial color={DARK} roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  )
}

/** The scene content (exported for the R3F scene test). */
export function AxialScene({ zoom, reset, stretch }: { zoom: number; reset: number; stretch: boolean }) {
  const { state, challenge: ch } = useAxialStore()
  const draft = state.draft
  const latest = state.history[state.history.length - 1]!
  const r = draft.diameterM / 2
  const { fractionOfLength } = displayedStretch(latest.analysis.elongationM, ch.lengthM, ch.visualization)
  const length = DISPLAY_LENGTH_M * (1 + (stretch ? fractionOfLength : 0))
  const top = 0
  const bottom = top - length
  const hatch = useMemo(wallHatchTexture, [])
  useEffect(() => () => hatch.dispose(), [hatch])
  const loadTop = bottom - 0.04
  return (
    <>
      <CameraRig zoom={zoom} reset={reset} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[0.6, 1.4, 1.2]} intensity={2.2} />
      <directionalLight position={[-0.5, 0.4, -0.8]} intensity={0.5} />
      <mesh name="roof-beam" position={[0, 0.055, 0]}>
        <boxGeometry args={[0.42, 0.05, 0.14]} />
        <meshStandardMaterial map={hatch} roughness={1} />
      </mesh>
      <mesh position={[0, 0.026, 0]}>
        <boxGeometry args={[0.06, 0.008, 0.06]} />
        <meshStandardMaterial color="#7d8a7e" roughness={0.6} metalness={0.3} />
        <Edges color="#2f3a31" />
      </mesh>
      <Clevis y={top} r={r} />
      <mesh name="rod" position={[0, top - length / 2, 0]}>
        <cylinderGeometry args={[r, r, length, 32]} />
        <meshStandardMaterial color={COLORS[draft.materialId] ?? COLORS.steel} roughness={0.4} metalness={0.4} />
      </mesh>
      {stretch && (
        <mesh name="unstretched-end" position={[0, top - DISPLAY_LENGTH_M, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r + 0.008, 0.0015, 8, 48]} />
          <meshBasicMaterial color="#34543c" />
        </mesh>
      )}
      <Clevis y={bottom} r={r} />
      <mesh name="load" position={[0, loadTop - 0.035, 0]}>
        <boxGeometry args={[0.08, 0.07, 0.08]} />
        <meshStandardMaterial color={LOAD} roughness={0.8} />
        <Edges color={MARK} />
      </mesh>
      <Line points={[[0, bottom - 0.02, 0], [0, loadTop, 0]]} color={DARK} lineWidth={1.5} />
      <Line points={[[0, loadTop - 0.08, 0], [0, loadTop - 0.13, 0]]} color={LOAD} lineWidth={2.5} />
      <mesh position={[0, loadTop - 0.14, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.01, 0.02, 12]} />
        <meshBasicMaterial color={LOAD} />
      </mesh>
    </>
  )
}

export default function AxialScene3D({ onContextLost: onLost }: { onContextLost: () => void }) {
  const { challenge: ch } = useAxialStore()
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const [stretch, setStretch] = useState(true)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const onContextLost = useCallback((event: Event) => {
    event.preventDefault()
    onLost()
  }, [onLost])
  useEffect(() => () => canvas.current?.removeEventListener('webglcontextlost', onContextLost), [onContextLost])
  return (
    <>
      <div className="beam-scene axial-scene relative flex flex-1 flex-col">
        <Canvas
          className="scene-canvas"
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [0.55, -0.05, 0.8], near: 0.001, far: 20, zoom: 500 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', '3D view of the hanger rod: pinned under a roof beam and carrying a hanging load')
            gl.domElement.setAttribute('aria-describedby', AXIAL_SUMMARY_ID)
            gl.domElement.tabIndex = 0
          }}
        >
          <AxialScene zoom={zoom} reset={reset} stretch={stretch} />
        </Canvas>
      </div>
      <div className="bracket-scene-controls" role="group" aria-label="3D view controls">
        <button type="button" className="toggle-row" onClick={() => setStretch((v) => !v)} aria-pressed={stretch}>
          <span className={`toggle ${stretch ? 'on' : ''}`} />
          <span>Show stretch</span>
        </button>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((v) => Math.min(1.8, v + 0.15))}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.15))}>
          <Icon name="minus" size={15} />
        </button>
        <button type="button" aria-label="Reset view" title="Reset view" onClick={() => { setZoom(1); setReset((n) => n + 1) }}>
          <Icon name="reset" size={15} />
        </button>
        <span className="bracket-scene-hint">{stretch ? `Stretch exaggerated ×${ch.visualization.elongationExaggerationFactor}` : 'Drag to rotate'}</span>
      </div>
    </>
  )
}
