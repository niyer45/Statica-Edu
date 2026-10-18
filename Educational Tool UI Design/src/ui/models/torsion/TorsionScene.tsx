import { useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { OrthographicCamera } from 'three'
import { buildBeamGeometry } from '../../mesh'
import { displayedTwist, useTorsionStore } from './shared'
import { shaftOuterDiameterM, TORQUE_ARC_RAD, torsionSceneFrame, twistLinePoints } from './shaftLayout'

// 3D Torsion Shaft I scene (task 54.2; TSH-14, D-26). Lives in the lazy 3D chunk. A steel shaft
// drawn to scale from the DRAFT section (solid or hollow, extruded from the shared section
// outline), a wall and clamp at the fixed end, a curved torque arrow at the free end and a
// surface line twisted by the LATEST TESTED angle × exaggeration, capped (same rule as the SVG).
// No text is drawn on the model; the summary below the canvas is the text equivalent.

const ORANGE = '#cf744b'
const STEEL = '#8e989b'

function CameraRig({ frame, zoom, reset, fit }: { frame: ReturnType<typeof torsionSceneFrame>; zoom: number; reset: number; fit: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(500)
  const { lengthM: L, fitRadiusM } = frame
  // Oblique overview of the whole shaft, wall and torque arrow.
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.width, size.height) / (2.2 * fitRadiusM)
    camera.position.set(L / 2 + 0.55, 0.45, 1)
    controls.current?.target.set(L / 2, 0, 0)
    camera.lookAt(L / 2, 0, 0)
    camera.zoom = baseZoom.current
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, L, fitRadiusM, size.width, size.height, reset, fit, invalidate])
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    camera.zoom = baseZoom.current * zoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, zoom, reset, fit, size.width, size.height, invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping={false} enableZoom={false} enablePan={false} />
}

export interface TorsionSceneProps {
  /** Show the latest tested twist on the surface line; otherwise draw it untwisted. */
  twisted: boolean
  zoom: number
  reset: number
  fit: number
}

export default function TorsionScene({ twisted, zoom, reset, fit }: TorsionSceneProps) {
  const { state, challenge: ch } = useTorsionStore()
  const { section, lengthM: L } = state.draft
  const outer = shaftOuterDiameterM(section)
  const maxD = Math.max(ch.sectionLimits.circle.diameterM.maxM, ch.sectionLimits.tube.outerDiameterM.maxM)
  const frame = torsionSceneFrame(L, outer, maxD)
  const latest = state.history[state.history.length - 1]!
  const { shownRad } = displayedTwist(latest.analysis.twistRad, ch.visualization)
  // The torsion section is a circle/tube member of the shared Section union; it has no
  // orientation (axisymmetric), so the 0° beam extrusion is used.
  const geometry = useMemo(() => buildBeamGeometry(section, 0, L), [section, L])
  useEffect(() => () => geometry.dispose(), [geometry])
  const line = useMemo(() => twistLinePoints(outer / 2, L, twisted ? shownRad : 0), [outer, L, twisted, shownRad])
  const { torque, wall, clamp } = frame
  return (
    <>
      <CameraRig frame={frame} zoom={zoom} reset={reset} fit={fit} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[1, 2, 3]} intensity={2.4} />
      <mesh name="torsion-shaft" geometry={geometry}>
        <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh name="fixed-wall" position={[-wall.thicknessM / 2, 0, 0]}>
        <boxGeometry args={[wall.thicknessM, wall.sizeM, wall.sizeM]} />
        <meshStandardMaterial color="#9aa58f" roughness={1} />
      </mesh>
      <mesh name="fixed-clamp" position={[clamp.lengthM / 2, 0, 0]}>
        <boxGeometry args={[clamp.lengthM, clamp.sizeM, clamp.sizeM]} />
        <meshStandardMaterial color="#5f6b58" roughness={0.8} />
      </mesh>
      <gridHelper args={[1.4, 28, '#c4ceba', '#dfe5d7']} position={[L / 2, frame.floorY, 0]} />
      {/* Dashed like the beam's deformed outline, matching the Exaggerated visualization legend. */}
      <Line name="twist-line" points={line} color={ORANGE} dashed dashSize={0.02} gapSize={0.01} lineWidth={2.5} />
      {/* Torque arrow: an arc about +X (right-hand rule) ending in a cone along its tangent. */}
      <group name="torque-arrow" position={[torque.x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <torusGeometry args={[torque.radiusM, torque.tubeM, 8, 48, TORQUE_ARC_RAD]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
        <mesh
          position={[
            torque.radiusM * Math.cos(TORQUE_ARC_RAD) - (torque.coneLengthM / 2) * Math.sin(TORQUE_ARC_RAD),
            torque.radiusM * Math.sin(TORQUE_ARC_RAD) + (torque.coneLengthM / 2) * Math.cos(TORQUE_ARC_RAD),
            0,
          ]}
          rotation={[0, 0, TORQUE_ARC_RAD]}
        >
          <coneGeometry args={[torque.coneRadiusM, torque.coneLengthM, 12]} />
          <meshBasicMaterial color={ORANGE} />
        </mesh>
      </group>
    </>
  )
}
