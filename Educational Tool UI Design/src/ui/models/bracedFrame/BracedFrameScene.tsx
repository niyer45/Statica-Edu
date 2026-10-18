import { useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { OrthographicCamera } from 'three'
import { frameSceneLayout, LOAD_ARROW_LENGTH_M, memberAxis, type SceneMember, type Vec3 } from './frameSceneLayout'
import { useFrameStore } from './shared'

// Braced Frame I 3D scene content (task 54.3), rendered inside the lazy chunk's Canvas. Every
// position comes from the challenge template and loads, every tube diameter from the draft's
// chosen catalog section, and every force pattern from the latest stored test (see
// frameSceneLayout). Tension, compression and ≈ 0 differ in SHAPE, not only color: solid tube,
// striped tube (raised dark bands on a pale core) and a thin beaded core. A member with no
// tested force (a mechanism, or a diagonal added since the latest test) is an open wire-mesh
// tube, so it differs from the solid tension tube by shape as well as shade; an absent candidate diagonal is a thin dashed line. D-26: no text or annotation on the model;
// the summary, pattern key and member force table outside the Canvas are the text equivalent.

const TENSION = '#2f5a3d'
const BAND = '#22301f'
const CORE = '#eef1e6'
const BEAD = '#4f653e'
const PLAIN = '#7d8a72'
const ABSENT = '#7d8873'
const JOINT = '#3b4a3e'
const SUPPORT = '#8c9a80'
const SLAB = '#dfe4d8'
const LOAD = '#8a5a24'
const QUARTER_TURN = Math.PI / 2

function CameraRig({ cx, cy, cz, radius, zoom, reset, fit }: { cx: number; cy: number; cz: number; radius: number; zoom: number; reset: number; fit: number }) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const baseZoom = useRef(40)
  // A front three-quarter overview from slightly above, framing the whole scene sphere.
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    baseZoom.current = Math.min(size.width, size.height) / (1.9 * radius)
    camera.position.set(cx + 7, cy + 4.5, cz + 14)
    controls.current?.target.set(cx, cy, cz)
    camera.lookAt(cx, cy, cz)
    camera.zoom = baseZoom.current
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, cx, cy, cz, radius, size.width, size.height, reset, fit, invalidate])
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    camera.zoom = baseZoom.current * zoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, zoom, reset, fit, size.width, size.height, invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping={false} enableZoom={false} enablePan={false} maxPolarAngle={QUARTER_TURN} />
}

/** Positions along a tube's local axis (centred on 0) for repeated bands or beads. */
function stations(length: number, pitch: number): number[] {
  const count = Math.max(3, Math.round(length / pitch))
  const step = length / count
  return Array.from({ length: count }, (_, i) => -length / 2 + step * (i + 0.5))
}

function MemberTube({ member }: { member: SceneMember }) {
  const { midpoint, length, angleRad } = memberAxis(member.start, member.end)
  const r = member.radiusM
  let body
  if (member.pattern === 'compression') {
    const pitch = Math.max(0.3, 3.2 * r)
    body = (
      <>
        <mesh>
          <cylinderGeometry args={[r * 0.68, r * 0.68, length, 20]} />
          <meshStandardMaterial color={CORE} roughness={0.7} />
        </mesh>
        {stations(length, pitch).map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[r, r, pitch * 0.5, 20]} />
            <meshStandardMaterial color={BAND} roughness={0.55} metalness={0.15} />
          </mesh>
        ))}
      </>
    )
  } else if (member.pattern === 'zero') {
    body = (
      <>
        <mesh>
          <cylinderGeometry args={[r * 0.3, r * 0.3, length, 12]} />
          <meshStandardMaterial color={BEAD} roughness={0.6} />
        </mesh>
        {stations(length, 3 * r).map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <sphereGeometry args={[r * 0.85, 14, 10]} />
            <meshStandardMaterial color={BEAD} roughness={0.6} />
          </mesh>
        ))}
      </>
    )
  } else if (member.pattern === 'tension') {
    body = (
      <mesh>
        <cylinderGeometry args={[r, r, length, 24]} />
        <meshStandardMaterial color={TENSION} roughness={0.45} metalness={0.25} />
      </mesh>
    )
  } else {
    body = (
      <mesh>
        <cylinderGeometry args={[r, r, length, 8, Math.max(4, Math.round(length / (4 * r))), true]} />
        <meshBasicMaterial color={PLAIN} wireframe />
      </mesh>
    )
  }
  return (
    <group name={`member-${member.id}`} userData={{ pattern: member.pattern, radiusM: r }} position={midpoint as Vec3} rotation={[0, 0, angleRad - QUARTER_TURN]}>
      {body}
    </group>
  )
}

/** Arrow whose tip sits just short of the loaded joint, pointing along the load component. */
function LoadArrow({ name, tip, direction }: { name: string; tip: Vec3; direction: Vec3 }) {
  const head = 0.28
  const angle = Math.atan2(direction[1], direction[0]) - QUARTER_TURN
  return (
    <group name={name} position={tip} rotation={[0, 0, angle]}>
      <mesh position={[0, -head / 2, 0]}>
        <coneGeometry args={[0.12, head, 16]} />
        <meshStandardMaterial color={LOAD} roughness={0.6} />
      </mesh>
      <mesh position={[0, -(LOAD_ARROW_LENGTH_M + head) / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, LOAD_ARROW_LENGTH_M - head, 10]} />
        <meshStandardMaterial color={LOAD} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Pin support: a triangular block with its apex at the base joint, a pin, and a base plate. */
function PinSupport({ name, position, height }: { name: string; position: Vec3; height: number }) {
  const circumradius = height / 1.5
  return (
    <group name={name} position={position}>
      <mesh position={[0, -circumradius, 0]} rotation={[-QUARTER_TURN, 0, 0]}>
        <cylinderGeometry args={[circumradius, circumradius, 0.5, 3]} />
        <meshStandardMaterial color={SUPPORT} roughness={0.8} flatShading />
      </mesh>
      <mesh rotation={[QUARTER_TURN, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.62, 16]} />
        <meshStandardMaterial color={JOINT} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, -height - 0.025, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.7]} />
        <meshStandardMaterial color={SUPPORT} roughness={0.8} />
      </mesh>
    </group>
  )
}

export interface BracedFrameSceneProps {
  zoom: number
  reset: number
  fit: number
}

export default function BracedFrameScene({ zoom, reset, fit }: BracedFrameSceneProps) {
  const { state, challenge: ch } = useFrameStore()
  const tested = state.history[state.history.length - 1]!.analysis
  const layout = useMemo(() => frameSceneLayout(ch, state.draft, tested), [ch, state.draft, tested])
  const slabWidth = layout.slab.maxX - layout.slab.minX
  return (
    <>
      <CameraRig cx={layout.center[0]} cy={layout.center[1]} cz={layout.center[2]} radius={layout.radiusM} zoom={zoom} reset={reset} fit={fit} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 8, 10]} intensity={2.2} />
      <directionalLight position={[-6, 4, -4]} intensity={0.6} />
      <mesh name="ground-slab" position={[(layout.slab.minX + layout.slab.maxX) / 2, layout.groundY - 0.15, 0]}>
        <boxGeometry args={[slabWidth, 0.3, layout.slab.depthM]} />
        <meshStandardMaterial color={SLAB} roughness={1} />
      </mesh>
      {layout.supports.map((s) => (
        <PinSupport key={s.id} name={`support-${s.id}`} position={s.position} height={layout.supportHeightM} />
      ))}
      {layout.members.map((m) => (
        <MemberTube key={m.id} member={m} />
      ))}
      {layout.absent.map((m) => (
        <Line key={m.id} name={`absent-${m.id}`} points={[m.start, m.end]} color={ABSENT} dashed dashSize={0.2} gapSize={0.15} lineWidth={1.5} />
      ))}
      {layout.joints.map((j) => (
        <mesh key={j.id} name={`joint-${j.id}`} position={j.position}>
          <sphereGeometry args={[layout.jointRadiusM, 20, 14]} />
          <meshStandardMaterial color={JOINT} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {layout.loads.map((l) => (
        <LoadArrow key={l.key} name={`load-${l.key}`} tip={l.tip} direction={l.direction} />
      ))}
    </>
  )
}
