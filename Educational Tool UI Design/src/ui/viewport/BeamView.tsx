import { useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react'
import {
  DataTexture,
  OrthographicCamera,
  RepeatWrapping,
  RGBAFormat,
  type Mesh,
} from 'three'
import { selectDraftEnvelope, selectLatestResult } from '../../state/selectors'
import { buildBeamGeometry } from '../mesh'
import { useChallenge, useSession } from '../state/store'
import {
  deformedOutline,
  sceneFrame,
} from './sceneLayout'
import type { SceneHitTarget } from './Viewport3D'
import DimensionHandles, { type HandleFeedback } from './DimensionHandles'

const ORANGE = '#cf744b'
/** Procedural RGBA hatch; no fetches, canvas serialization, or data URLs. */
export function wallHatchTexture() {
  const side = 16
  const pixels = new Uint8Array(side * side * 4)
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 4
      pixels.set(
        (x + y) % 8 < 2 ? [151, 161, 144, 255] : [214, 221, 205, 255],
        i,
      )
    }
  const texture = new DataTexture(pixels, side, side, RGBAFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(8, 12)
  texture.needsUpdate = true
  return texture
}

function CameraRig({
  lengthM,
  zoom,
  reset,
  fit,
  dragging,
}: {
  lengthM: number
  zoom: number
  reset: number
  fit: number
  dragging: boolean
}) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(500)
  // Overview sphere includes wall, arrow and maximum visual deformation.
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    const radius = Math.hypot(lengthM / 2 + 0.09, 0.29, 0.15)
    baseZoom.current = Math.min(size.width, size.height) / (2.2 * radius)
    camera.position.set(lengthM / 2 + 0.85, 0.5, 1)
    controls.current?.target.set(lengthM / 2, -0.025, 0)
    camera.lookAt(lengthM / 2, -0.025, 0)
    camera.zoom = baseZoom.current
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, lengthM, size.width, size.height, reset, fit, invalidate])
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    camera.zoom = baseZoom.current * zoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, zoom, reset, fit, size.width, size.height, invalidate])
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!dragging}
      enableDamping={false}
      enableZoom={false}
      enablePan={false}
    />
  )
}

export interface BeamViewProps {
  deformed: boolean
  highlight: boolean
  zoom: number
  reset: number
  fit: number
  hitTarget: RefObject<SceneHitTarget | null>
  onHandleFeedback?: (feedback: HandleFeedback | null) => void
}

// Only stored TestResults drive deformation. A static reveal respects reduced motion too.
export default function BeamView({
  deformed,
  highlight,
  zoom,
  reset,
  fit,
  hitTarget,
  onHandleFeedback,
}: BeamViewProps) {
  const [dragging, setDragging] = useState(false)
  const session = useSession()
  const ch = useChallenge()
  const { draft } = session
  const latest = selectLatestResult(session)
  const env = selectDraftEnvelope(session)
  const frame = sceneFrame(ch, draft.lengthM, env)
  const L = draft.lengthM
  const beam = useRef<Mesh>(null)
  const { camera, gl } = useThree()
  const geometry = useMemo(
    () => buildBeamGeometry(draft.section, draft.orientationDeg, L),
    [draft.section, draft.orientationDeg, L],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  const hatch = useMemo(wallHatchTexture, [])
  useEffect(() => () => hatch.dispose(), [hatch])
  useEffect(() => {
    if (beam.current)
      hitTarget.current = { camera, canvas: gl.domElement, beam: beam.current }
    return () => {
      hitTarget.current = null
    }
  }, [camera, gl, hitTarget])
  const outline = useMemo(
    () =>
      deformedOutline(latest.designSnapshot, {
        forceN: ch.load.forceN,
        lengthM: latest.designSnapshot.lengthM,
        elasticModulusPa: ch.material.elasticModulusPa,
        bendingInertiaM4: latest.analysis.bendingInertiaM4,
        tipDeflectionM: latest.analysis.tipDeflectionM,
        ...ch.visualization,
      }),
    [latest, ch],
  )
  // D-26: the user removed visible envelope/annotation overlays. Constraints still use the
  // typed draft; these dimensions size only the fixed support plate.
  const halfZ = frame.envelopeLimit.widthZM / 2
  const halfY = frame.envelopeLimit.heightYM / 2
  return (
    <>
      <CameraRig lengthM={L} zoom={zoom} reset={reset} fit={fit} dragging={dragging} />
      <DimensionHandles onDragActive={setDragging} onFeedback={onHandleFeedback} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[1, 2, 3]} intensity={2.2} />
      <mesh name="draft-beam" ref={beam} geometry={geometry}>
        <meshStandardMaterial
          color={highlight ? '#91a99b' : '#345640'}
          roughness={0.65}
          metalness={0.12}
        />
      </mesh>
      <mesh
        position={[
          -frame.wall.thicknessM / 2,
          (frame.wall.topY + frame.wall.bottomY) / 2,
          0,
        ]}
      >
        <boxGeometry
          args={[
            frame.wall.thicknessM,
            frame.wall.topY - frame.wall.bottomY,
            frame.wall.depthM,
          ]}
        />
        <meshStandardMaterial map={hatch} roughness={1} />
      </mesh>
      <mesh position={[-0.001, 0, 0]}>
        <boxGeometry args={[0.002, 2 * halfY + 0.012, 2 * halfZ + 0.012]} />
        <meshStandardMaterial color="#91a99b" />
      </mesh>
      <gridHelper
        args={[1.4, 28, '#c4ceba', '#dfe5d7']}
        position={[L / 2, frame.floorY, 0]}
      />
      <Line
        points={[
          [L, frame.arrowTopY, 0],
          [L, frame.arrowTipY + 0.018, 0],
        ]}
        color={ORANGE}
        lineWidth={2}
      />
      <mesh
        position={[L, frame.arrowTipY + 0.009, 0]}
        rotation={[0, 0, Math.PI]}
      >
        <coneGeometry args={[0.009, 0.018, 12]} />
        <meshBasicMaterial color={ORANGE} />
      </mesh>
      {deformed &&
        [...outline.lines, outline.tip].map((points, i) => (
          <Line
            key={i}
            points={points}
            color={ORANGE}
            dashed
            dashSize={0.009}
            gapSize={0.006}
            lineWidth={1}
          />
        ))}
    </>
  )
}
