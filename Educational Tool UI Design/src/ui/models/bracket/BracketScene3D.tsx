import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei/core/Edges'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { ExtrudeGeometry, OrthographicCamera, Shape } from 'three'
import { bracketOutline } from '../../../geometry/bracket/outline'
import Icon from '../../icons/Icon'
import { wallHatchTexture } from '../../viewport/wallHatch'
import { SUMMARY_ID } from './BracketDetails'
import { useBracketStore } from './shared'

// Bracket 3D view (task 54.1; owner request: show what the component is). Lazy chunk. Scene in
// metres: x from the wall (0) to the tip (L), y up, z across the plate thickness.
//   - Hatched wall, the bracket's mounting plate and four bolt heads.
//   - The DRAFT stepped bar: the pure display outline (geometry/bracket/outline.ts, fillets
//     included) extruded to the challenge thickness, with crisp edges.
//   - A load hanging from the tip on a cable, with a downward arrow.
//   - When the draft is the tested design and a peak stress exists, a band around the bar marks
//     the governing section (root or step) from the stored analysis; shape plus the text summary,
//     never color alone. No static text on the model (D-26).
// Orbit with the pointer; zoom and reset with the buttons. If WebGL2 is missing or the context is
// lost, BracketView swaps in the main-bundle 2D side view.

const STEEL = '#8f9c90'
const LOAD = '#cf744b'
const MARK = '#7a3f14'

function CameraRig({ lengthM, zoom, reset }: { lengthM: number; zoom: number; reset: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(900)
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    const radius = lengthM / 2 + 0.07
    baseZoom.current = Math.min(size.width, size.height * 1.6) / (2.3 * radius)
    camera.position.set(lengthM / 2 + 0.32, 0.2, 0.42)
    controls.current?.target.set(lengthM / 2 - 0.02, -0.03, 0)
    camera.lookAt(lengthM / 2 - 0.02, -0.03, 0)
    camera.zoom = baseZoom.current
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, lengthM, size.width, size.height, reset, invalidate])
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
  const L = ch.lengthM
  const b = ch.thicknessM
  const geometry = useMemo(() => {
    const pts = bracketOutline(draft, L)
    const shape = new Shape()
    pts.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)))
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: b, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, -b / 2)
    return g
  }, [draft, L, b])
  useEffect(() => () => geometry.dispose(), [geometry])
  const hatch = useMemo(wallHatchTexture, [])
  useEffect(() => () => hatch.dispose(), [hatch])
  const latest = state.history[state.history.length - 1]!
  const governs = state.draftStatus === 'tested' ? latest.analysis.peakLocation : undefined
  const D = draft.rootDepthM
  const plateH = D + 0.05
  const plateW = b + 0.05
  const plateT = 0.006
  const tipBottom = -draft.armDepthM / 2
  const weightTop = tipBottom - 0.05
  const markX = governs === 'root' ? 0.004 : latest.designSnapshot.stepLocationM
  return (
    <>
      <CameraRig lengthM={L} zoom={zoom} reset={reset} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[0.6, 1.4, 1.2]} intensity={2.2} />
      <directionalLight position={[-0.5, 0.4, -0.8]} intensity={0.5} />
      <mesh position={[-0.02 - plateT, -0.03, 0]}>
        <boxGeometry args={[0.04, 0.26, 0.22]} />
        <meshStandardMaterial map={hatch} roughness={1} />
      </mesh>
      <mesh position={[-plateT / 2, 0, 0]}>
        <boxGeometry args={[plateT, plateH, plateW]} />
        <meshStandardMaterial color="#6f7c70" roughness={0.6} metalness={0.25} />
        <Edges color="#2f3a31" />
      </mesh>
      {[
        [plateH / 2 - 0.012, plateW / 2 - 0.012],
        [plateH / 2 - 0.012, -(plateW / 2 - 0.012)],
        [-(plateH / 2 - 0.012), plateW / 2 - 0.012],
        [-(plateH / 2 - 0.012), -(plateW / 2 - 0.012)],
      ].map(([y, z], i) => (
        <mesh key={i} position={[0.0025, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0055, 0.0055, 0.005, 6]} />
          <meshStandardMaterial color="#3d4a3f" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh name="bracket-bar" geometry={geometry}>
        <meshStandardMaterial color={STEEL} roughness={0.45} metalness={0.35} />
        <Edges color="#243326" threshold={20} />
      </mesh>
      {governs !== undefined && (
        <mesh position={[markX, 0, 0]}>
          <boxGeometry args={[0.003, (governs === 'root' ? D : latest.designSnapshot.rootDepthM) + 0.01, b + 0.01]} />
          <meshStandardMaterial color={MARK} roughness={0.7} transparent opacity={0.75} />
          <Edges color={MARK} />
        </mesh>
      )}
      <Line points={[[L - 0.004, tipBottom, 0], [L - 0.004, weightTop, 0]]} color="#3d4a3f" lineWidth={1.5} />
      <mesh position={[L - 0.004, weightTop - 0.014, 0]}>
        <boxGeometry args={[0.03, 0.028, 0.03]} />
        <meshStandardMaterial color={LOAD} roughness={0.8} />
        <Edges color="#7a3f14" />
      </mesh>
      <Line points={[[L - 0.004, weightTop - 0.032, 0], [L - 0.004, weightTop - 0.06, 0]]} color={LOAD} lineWidth={2} />
      <mesh position={[L - 0.004, weightTop - 0.066, 0]} rotation={[0, 0, Math.PI]}>
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
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [0.5, 0.2, 0.42], near: 0.001, far: 20, zoom: 900 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', '3D view of the wall-mounted bracket with its mounting plate, bolts and hanging tip load')
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
