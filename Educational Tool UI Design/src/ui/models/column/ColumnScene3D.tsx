import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei/core/Edges'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { CylinderGeometry, ExtrudeGeometry, OrthographicCamera, Path, Shape } from 'three'
import Icon from '../../icons/Icon'
import { COLUMN_SUMMARY_ID, ColumnSummary } from './ColumnElevation'
import { displayedRadii, MODE_AMPLITUDE_FRACTION, modeShapePoints } from './columnLayout'
import { useColumnStore } from './shared'

// Column 3D view (task 68; CBK-18, D-26, D-45). Lazy chunk. Scene in metres: y up from the bottom
// pin (y = 0) to the top pin (y = L), the column buckling sideways in the x–y plane, the pins along
// z. It shows:
//   - a floor with a base block and a clevis (two plates and a pin) holding the bottom end;
//   - the DRAFT column, solid or hollow (an extruded ring whose open ends show the bore), its
//     diameter drawn ×DIAMETER_DISPLAY_SCALE and its length to scale, with a tongue plate into
//     each end;
//   - the same clevis upside down at the top, under a load cap, and a downward load arrow;
//   - when "Show buckling mode" is on, the dashed half-sine mode shape (display only, fixed
//     amplitude, columnLayout.ts).
// No text is drawn on the model (D-26); ColumnSummary below the canvas is the text equivalent.
// Orbit with the pointer; zoom and reset with the buttons. If WebGL2 is missing or the context is
// lost, the view swaps in the main-bundle 2D elevation.

const ALUMINUM = '#9aa79b'
const STEEL = '#59665b'
const LOAD = '#cf744b'
const MODE = '#a4471c'

/** Fittings, m (display only). */
const FIT = { tongue: 0.11, tongueThickness: 0.016, plateGap: 0.05, plate: 0.012, plateHeight: 0.16, pinRadius: 0.014 }

function CameraRig({ lengthM, zoom, reset }: { lengthM: number; zoom: number; reset: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(200)
  const focusY = lengthM / 2 + 0.1
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.height / (lengthM + 0.9), size.width / 1.6)
    camera.position.set(1.4, focusY + 0.7, 2)
    controls.current?.target.set(0, focusY, 0)
    camera.lookAt(0, focusY, 0)
    camera.zoom = baseZoom.current
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, focusY, lengthM, size.width, size.height, reset, invalidate])
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    camera.zoom = baseZoom.current * zoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, zoom, reset, size.width, size.height, invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping={false} enableZoom={false} enablePan={false} />
}

/** A clevis: two plates either side of the tongue and the pin through them, centred on the pin at y = 0. */
function Clevis({ flip }: { flip: boolean }) {
  const z = FIT.plateGap / 2 + FIT.plate / 2
  const plateY = flip ? FIT.plateHeight / 2 - 0.03 : -FIT.plateHeight / 2 + 0.03
  return (
    <group name={flip ? 'top-clevis' : 'bottom-clevis'}>
      {[-z, z].map((pz) => (
        <mesh key={pz} position={[0, plateY, pz]}>
          <boxGeometry args={[0.1, FIT.plateHeight, FIT.plate]} />
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.4} />
          <Edges color="#1d2a1f" />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[FIT.pinRadius, FIT.pinRadius, FIT.plateGap + 2 * FIT.plate + 0.02, 20]} />
        <meshStandardMaterial color="#3d4a3f" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  )
}

function Scene({ zoom, reset, showMode }: { zoom: number; reset: number; showMode: boolean }) {
  const { state, challenge: ch } = useColumnStore()
  const L = ch.lengthM
  const section = state.draft.section
  const { outer, inner } = displayedRadii(section)
  const start = FIT.tongue * 0.6
  const height = L - 2 * start
  const geometry = useMemo(() => {
    if (inner <= 0) {
      const g = new CylinderGeometry(outer, outer, height, 48)
      g.translate(0, start + height / 2, 0)
      return g
    }
    const shape = new Shape()
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
    const hole = new Path()
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const g = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 })
    // Extrusion runs along +z; turn it to run up +y from the bottom tongue.
    g.rotateX(-Math.PI / 2)
    g.translate(0, start, 0)
    return g
  }, [outer, inner, height, start])
  useEffect(() => () => geometry.dispose(), [geometry])
  const amplitude = MODE_AMPLITUDE_FRACTION * L
  const mode = useMemo(() => modeShapePoints(L, amplitude).map(([x, y]) => [x, y, outer + 0.03] as [number, number, number]), [L, amplitude, outer])
  const capY = L + FIT.plateHeight - 0.02
  return (
    <>
      <CameraRig lengthM={L} zoom={zoom} reset={reset} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[1.2, 2.4, 1.6]} intensity={2.2} />
      <directionalLight position={[-1, 0.8, -1.2]} intensity={0.5} />
      <gridHelper args={[1.6, 16, '#c4ceba', '#dfe5d7']} position={[0, -0.16, 0]} />
      <mesh name="base-block" position={[0, -0.13, 0]}>
        <boxGeometry args={[0.3, 0.06, 0.24]} />
        <meshStandardMaterial color="#9aa58f" roughness={1} />
        <Edges color="#5f6b58" />
      </mesh>
      <Clevis flip={false} />
      <group position={[0, L, 0]}>
        <Clevis flip />
      </group>
      {[0, L].map((y) => (
        <mesh key={y} position={[0, y === 0 ? FIT.tongue / 2 - 0.02 : L - FIT.tongue / 2 + 0.02, 0]}>
          <boxGeometry args={[0.07, FIT.tongue, FIT.tongueThickness]} />
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh name="column-body" geometry={geometry}>
        <meshStandardMaterial color={ALUMINUM} roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh name="load-cap" position={[0, capY, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.2]} />
        <meshStandardMaterial color="#9aa58f" roughness={1} />
        <Edges color="#5f6b58" />
      </mesh>
      <Line name="load-arrow" points={[[0, capY + 0.42, 0], [0, capY + 0.08, 0]]} color={LOAD} lineWidth={3} />
      <mesh position={[0, capY + 0.05, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.035, 0.07, 16]} />
        <meshBasicMaterial color={LOAD} />
      </mesh>
      {showMode && <Line name="mode-shape" points={mode} color={MODE} dashed dashSize={0.05} gapSize={0.03} lineWidth={2.5} />}
    </>
  )
}

export default function ColumnScene3D({ onContextLost: onLost }: { onContextLost: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const [showMode, setShowMode] = useState(true)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const onContextLost = useCallback(
    (event: Event) => {
      event.preventDefault()
      onLost()
    },
    [onLost],
  )
  useEffect(() => () => canvas.current?.removeEventListener('webglcontextlost', onContextLost), [onContextLost])
  return (
    <>
      <div className="beam-scene column-scene relative flex flex-1 flex-col">
        <Canvas
          className="scene-canvas"
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [1.4, 1.8, 2], near: 0.01, far: 40, zoom: 200 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', '3D view of the column: a round column held by a pin at the bottom and a pin at the top, with the load pressing down on the top')
            gl.domElement.setAttribute('aria-describedby', COLUMN_SUMMARY_ID)
            gl.domElement.tabIndex = 0
          }}
        >
          <Scene zoom={zoom} reset={reset} showMode={showMode} />
        </Canvas>
      </div>
      <div className="column-scene-controls" role="group" aria-label="3D view controls">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((v) => Math.min(2.5, v + 0.2))}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}>
          <Icon name="minus" size={15} />
        </button>
        <button
          type="button"
          aria-label="Reset view"
          title="Reset view"
          onClick={() => {
            setZoom(1)
            setReset((n) => n + 1)
          }}
        >
          <Icon name="reset" size={15} />
        </button>
        <button type="button" className="toggle-row" onClick={() => setShowMode((v) => !v)} aria-pressed={showMode}>
          <span className={`toggle ${showMode ? 'on' : ''}`} />
          <span>Show buckling mode</span>
        </button>
        <span className="column-scene-hint">Drag to rotate</span>
      </div>
      <div className="px-3">
        <ColumnSummary />
      </div>
    </>
  )
}
