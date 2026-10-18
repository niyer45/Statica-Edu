import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { handlesFor, type HandleDescriptor } from '../../geometry/handles'
import type { SectionParam } from '../../geometry/params'
import { useChallenge, useDispatch, useSession } from '../state/store'
import { useGuided } from '../workbench/useGuided'
import { createFrameQueue, dragLimit, parameterDeltaScale, projectToAxis } from './handleDrag'
import { localToGlobalYZ, type Vec3 } from './sceneLayout'

interface CaptureTarget {
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
}
interface ActiveDrag {
  pointerId: number
  param: SectionParam
  axis: Vec3
  origin: Vec3
  initialProjection: number
  initialValue: number
  scale: number
  target: CaptureTarget
}
function setOrbitEnabled(controls: unknown, enabled: boolean) {
  if (typeof controls === 'object' && controls !== null && 'enabled' in controls) controls.enabled = enabled
}
export interface HandleFeedback { label: string; valueM: number; limited: boolean }
export interface DimensionHandlesProps {
  onDragActive: (active: boolean) => void
  onFeedback?: (feedback: HandleFeedback | null) => void
}

export default function DimensionHandles({ onDragActive, onFeedback }: DimensionHandlesProps) {
  const session = useSession()
  const ch = useChallenge()
  const dispatch = useDispatch()
  const controls = useThree((s) => s.controls)
  const [feedback, setFeedback] = useState<{ param: SectionParam; limited: boolean } | null>(null)
  // D-26: live values belong in the viewport chrome, not anchored over the 3D model.
  useEffect(() => {
    if (!feedback) { onFeedback?.(null); return }
    const descriptor = handlesFor(session.draft.section, session.draft.orientationDeg, ch.sectionLimits).find((h) => h.param === feedback.param)
    if (!descriptor) { onFeedback?.(null); return }
    const values = session.draft.section as unknown as Record<SectionParam, number>
    onFeedback?.({ label: descriptor.label, valueM: values[feedback.param], limited: feedback.limited })
  }, [feedback, session.draft, ch.sectionLimits, onFeedback])
  const active = useRef<ActiveDrag | null>(null)
  const current = useRef({ session, ch, dispatch, onDragActive, controls })
  current.current = { session, ch, dispatch, onDragActive, controls }
  const queue = useMemo(() => createFrameQueue<number>((raw) => {
    const drag = active.current
    if (!drag || !Number.isFinite(raw)) return
    const { session, ch, dispatch } = current.current
    const descriptor = handlesFor(session.draft.section, session.draft.orientationDeg, ch.sectionLimits).find((h) => h.param === drag.param)
    if (!descriptor) return
    const limit = dragLimit(raw, descriptor.range.minM, descriptor.range.maxM)
    dispatch({ type: 'setParam', param: drag.param, valueM: raw, mode: 'clamp' })
    setFeedback({ param: drag.param, limited: limit.limited })
  }, (callback) => requestAnimationFrame(callback), (id) => cancelAnimationFrame(id)), [])

  const finish = () => {
    queue.cancel()
    const drag = active.current
    if (!drag) return
    active.current = null
    // Losing context or native capture may already have released the target.
    try { drag.target.releasePointerCapture(drag.pointerId) } catch { /* capture already gone */ }
    setOrbitEnabled(current.current.controls, true)
    current.current.onDragActive(false)
    setFeedback(null)
  }
  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    const end = (event: PointerEvent) => { if (active.current?.pointerId === event.pointerId) finishRef.current() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') finishRef.current() }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', finishRef.current)
    window.addEventListener('keydown', escape)
    const onBlur = finishRef.current
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', escape)
      finishRef.current()
    }
  }, [session.draft.section.kind, session.draft.orientationDeg])
  // Task 58: no handle for a parameter the current Guided step locks.
  const guided = useGuided()
  const handles = handlesFor(session.draft.section, session.draft.orientationDeg, ch.sectionLimits).filter((h) => !guided.locked(h.param))
  const position = (h: HandleDescriptor): Vec3 => {
    const { y, z } = localToGlobalYZ(h.anchorM.u, h.anchorM.v, session.draft.orientationDeg)
    return [session.draft.lengthM + 0.004, y, z]
  }
  const start = (h: HandleDescriptor, e: ThreeEvent<PointerEvent>) => {
    if (active.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const axis: Vec3 = h.axis === 'Y' ? [0, 1, 0] : [0, 0, 1]
    const origin = position(h)
    const initialProjection = projectToAxis(e.ray.origin.toArray(), e.ray.direction.toArray(), origin, axis)
    if (initialProjection === null) return
    e.stopPropagation()
    const target = e.target as unknown as CaptureTarget
    target.setPointerCapture(e.pointerId)
    const values = session.draft.section as unknown as Record<SectionParam, number>
    active.current = { pointerId: e.pointerId, param: h.param, axis, origin, initialProjection, initialValue: values[h.param], scale: parameterDeltaScale(h.param, session.draft.orientationDeg), target }
    setOrbitEnabled(controls, false)
    onDragActive(true)
    setFeedback({ param: h.param, limited: false })
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    const drag = active.current
    if (!drag || drag.pointerId !== e.pointerId) return
    e.stopPropagation()
    const projected = projectToAxis(e.ray.origin.toArray(), e.ray.direction.toArray(), drag.origin, drag.axis)
    if (projected !== null) queue.push(drag.initialValue + drag.scale * (projected - drag.initialProjection))
  }
  return <group>
    {handles.map((h) => <mesh key={h.param} name={`handle-${h.param}`} position={position(h)} renderOrder={10}
      onPointerDown={(e) => start(h, e)} onPointerMove={move}
      onPointerUp={(e) => { if (active.current?.pointerId === e.pointerId) { e.stopPropagation(); finish() } }}
      onPointerCancel={(e) => { if (active.current?.pointerId === e.pointerId) finish() }}
      onLostPointerCapture={(e) => { if (active.current?.pointerId === e.pointerId) finish() }}>
      <sphereGeometry args={[0.0035, 16, 12]} />
      <meshBasicMaterial color={feedback?.param === h.param ? '#cf744b' : '#345640'} depthTest={false} />

    </mesh>)}
  </group>
}
