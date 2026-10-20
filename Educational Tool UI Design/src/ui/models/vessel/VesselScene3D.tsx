import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei/core/Edges'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { DoubleSide, LatheGeometry, OrthographicCamera, Quaternion, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { vesselPressureStations, vesselProfile, vesselWallSection } from '../../../geometry/vessel/profile'
import Icon from '../../icons/Icon'
import { SUMMARY_ID } from './VesselDetails'
import { useVesselStore } from './shared'

// Pressure vessel 3D view (task 69; PVS-15, D-45 pattern). Lazy chunk. Scene in metres with the
// vessel axis along x and its middle at the origin. The DRAFT vessel is the pure display
// half-section (geometry/vessel/profile.ts: shell wall and hemispherical head walls, to scale)
// revolved about the axis through three quarters of a turn, so the missing quarter (top front)
// shows the inside and both cut faces show the shell and head wall thicknesses. The outer surface
// is steel, the inner surface a lighter tone and the cut faces dark with crisp edges, so the
// cutaway reads by tone and outline; there is no static text on the model (D-26). Orbit with the pointer; zoom and
// reset with the buttons. If WebGL2 is missing or the context is lost, VesselView swaps in the
// main-bundle 2D section. Orange arrows on the inner surface seen through the open quarter show the
// internal pressure pushing outward on the shell and heads (owner request 2026-10-19).

const STEEL = '#8f9b9f'
const INSIDE = '#dfe6e8'
const SECTION = '#2f3b40'
/** Load colour, as the bracket's load arrow. */
const PRESSURE = '#cf744b'
/**
 * Meridians (lathe angle) of the arrows: the two cut planes (φ = 0 and 3π/2), nudged into the open
 * quarter so they sit in the air space against the cut edges of the wall, like the 2D section.
 * Meridian φ points along world (0, −sin φ, cos φ), so these face the default camera.
 */
const ARROW_MERIDIANS = [1.5 * Math.PI + 0.04, -0.04]

/** The removed quarter runs from straight up to straight toward the viewer (see the header). */
const PHI_LENGTH = 1.5 * Math.PI

/** Scene framing: half-extent of the region the camera keeps in view, m (fits the largest vessel). */
const RADIUS = 0.9

function CameraRig({ zoom, reset }: { zoom: number; reset: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(150)
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.width, size.height * 1.8) / (2.1 * RADIUS)
    camera.position.set(1.0, 1.7, 2.0)
    controls.current?.target.set(0, 0, 0)
    camera.lookAt(0, 0, 0)
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
  const { state } = useVesselStore()
  const draft = state.draft
  // Lathe and section shapes use (radius, axial position): the lathe axis is three's y axis,
  // turned onto x by the group rotation below.
  const section = useMemo(() => vesselWallSection(draft).map((p) => new Vector2(p.y, p.x)), [draft])
  const surfaces = useMemo(() => {
    const { outer, inner } = vesselProfile(draft)
    const lathe = (pts: typeof outer) => new LatheGeometry(pts.map((p) => new Vector2(p.y, p.x)), 96, 0, PHI_LENGTH)
    return { outer: lathe(outer), inner: lathe(inner) }
  }, [draft])
  const cuts = useMemo(() => {
    const shape = new Shape(section)
    // The lathe's meridian at angle φ points along (sin φ, 0, cos φ): a rotation about y by
    // φ − π/2 takes the shape's x axis there.
    return [0, PHI_LENGTH].map((phi) => {
      const g = new ShapeGeometry(shape)
      g.rotateY(phi - Math.PI / 2)
      return g
    })
  }, [section])
  // Pressure arrows in lathe coordinates: a profile point (axial x, radius y) on meridian φ sits at
  // (y·sin φ, x, y·cos φ). Each arrow ends on the inner surface, pointing along the outward normal.
  const arrows = useMemo(() => {
    const length = 0.55 * (draft.innerDiameterM / 2)
    const up = new Vector3(0, 1, 0)
    return vesselPressureStations(draft).flatMap(({ point, normal }) =>
      (point.y > 0 ? ARROW_MERIDIANS : [ARROW_MERIDIANS[0]!]).map((phi) => {
        const at = (radial: number, axial: number) => new Vector3(radial * Math.sin(phi), axial, radial * Math.cos(phi))
        const tip = at(point.y, point.x)
        const dir = at(normal.y, normal.x).normalize()
        return { tip, dir, length, rotation: new Quaternion().setFromUnitVectors(up, dir) }
      }),
    )
  }, [draft])
  useEffect(() => () => { surfaces.outer.dispose(); surfaces.inner.dispose() }, [surfaces])
  useEffect(() => () => cuts.forEach((g) => g.dispose()), [cuts])
  return (
    <>
      <CameraRig zoom={zoom} reset={reset} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[1.2, 2.4, 2]} intensity={2.2} />
      <directionalLight position={[-1.5, 0.6, -1.4]} intensity={0.6} />
      <group rotation={[0, 0, -Math.PI / 2]}>
        <mesh name="vessel-outer" geometry={surfaces.outer}>
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} side={DoubleSide} />
        </mesh>
        <mesh name="vessel-inner" geometry={surfaces.inner}>
          <meshStandardMaterial color={INSIDE} roughness={0.8} metalness={0.05} side={DoubleSide} />
        </mesh>
        {cuts.map((g, i) => (
          <mesh key={i} name="vessel-cut" geometry={g}>
            <meshBasicMaterial color={SECTION} side={DoubleSide} />
            <Edges color={SECTION} threshold={30} />
          </mesh>
        ))}
        {arrows.map(({ tip, dir, length, rotation }, i) => {
          const head = 0.32 * length
          return (
            <group key={i} name="vessel-pressure-arrow">
              <mesh position={tip.clone().addScaledVector(dir, -(length + head) / 2)} quaternion={rotation}>
                <cylinderGeometry args={[0.05 * length, 0.05 * length, length - head, 10]} />
                <meshBasicMaterial color={PRESSURE} />
              </mesh>
              <mesh position={tip.clone().addScaledVector(dir, -head / 2)} quaternion={rotation}>
                <coneGeometry args={[0.16 * length, head, 14]} />
                <meshBasicMaterial color={PRESSURE} />
              </mesh>
            </group>
          )
        })}
      </group>
    </>
  )
}

export default function VesselScene3D({ onContextLost: onLost }: { onContextLost: () => void }) {
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
      <div className="beam-scene vessel-scene relative flex flex-1 flex-col">
        <Canvas
          className="scene-canvas"
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [1.0, 1.7, 2.0], near: 0.01, far: 50, zoom: 150 }}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement
            gl.domElement.addEventListener('webglcontextlost', onContextLost)
            gl.domElement.setAttribute('role', 'img')
            gl.domElement.setAttribute('aria-label', '3D cutaway of the pressure vessel: a cylindrical shell with a hemispherical head at each end, a quarter removed to show the shell and head walls, with arrows showing the internal pressure pushing outward on the walls')
            gl.domElement.setAttribute('aria-describedby', SUMMARY_ID)
            gl.domElement.tabIndex = 0
          }}
        >
          <Scene zoom={zoom} reset={reset} />
        </Canvas>
      </div>
      <div className="vessel-scene-controls" role="group" aria-label="3D view controls">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((v) => Math.min(2.4, v + 0.2))}>
          <Icon name="plus" size={15} />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}>
          <Icon name="minus" size={15} />
        </button>
        <button type="button" aria-label="Reset view" title="Reset view" onClick={() => { setZoom(1); setReset((n) => n + 1) }}>
          <Icon name="reset" size={15} />
        </button>
        <span className="vessel-scene-hint">Drag to rotate</span>
      </div>
    </>
  )
}
