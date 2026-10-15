import type { SectionParam } from '../../geometry/params'
import type { Orientation } from '../../geometry/sections'
import type { Vec3 } from './sceneLayout'

const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, i) => sum + v * b[i], 0)
/** Closest point of an infinite editing axis to the pointer ray. Parallel/non-finite rays skip. */
export function projectToAxis(rayOrigin: Vec3, rayDirection: Vec3, axisOrigin: Vec3, axis: Vec3): number | null {
  if (![...rayOrigin, ...rayDirection, ...axisOrigin, ...axis].every(Number.isFinite)) return null
  const length = Math.hypot(...rayDirection)
  const axisLength = Math.hypot(...axis)
  if (!length || !axisLength) return null
  const d = rayDirection.map((v) => v / length) as Vec3
  const a = axis.map((v) => v / axisLength) as Vec3
  const w = rayOrigin.map((v, i) => v - axisOrigin[i]) as Vec3
  const c = dot(d, a)
  const denominator = 1 - c * c
  if (denominator < 1e-10) return null
  const result = (dot(w, a) - c * dot(w, d)) / denominator
  return Number.isFinite(result) ? result : null
}
/** Descriptor anchor motion → full parameter change, including the inward flange face. */
export function parameterDeltaScale(param: SectionParam, orientation: Orientation): number {
  if (param === 'flangeThicknessM') return orientation === 0 ? -1 : 1
  if (param === 'heightM' && orientation === 90) return -2
  return 2
}
export function dragLimit(value: number, min: number, max: number) {
  return { value: Math.max(min, Math.min(max, value)), limited: value < min || value > max }
}
/** Latest event wins. Releasing/cancelling discards the pending event, preserving last applied edit. */
export function createFrameQueue<T>(apply: (value: T) => void, request: (callback: FrameRequestCallback) => number, cancel: (id: number) => void) {
  let frame: number | null = null
  let latest: T | undefined
  return {
    push(value: T) {
      latest = value
      if (frame !== null) return
      frame = request(() => { frame = null; const value = latest; latest = undefined; if (value !== undefined) apply(value) })
    },
    cancel() { if (frame !== null) cancel(frame); frame = null; latest = undefined },
  }
}
