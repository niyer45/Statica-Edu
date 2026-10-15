import { sectionOutline } from '../../geometry/outline'
import type { BeamDesign, Vec2 } from '../../geometry/sections'
import { localToGlobalYZ, type Vec3 } from './sceneLayout'

// Template orthographic SVG projection. Geometry remains in SI; this display scale maps the
// original 600 mm span onto the template's 330 scene units without altering the analysis.
export const SCENE_UNITS_PER_M = 550
export const DEFAULT_ORBIT = { angle: 0.47, elevation: Math.atan(0.43) }
export const clampElevation = (value: number) => Math.max(-Math.PI / 3, Math.min(Math.PI / 3, value))
export const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, i) => sum + v * b[i], 0)
export function cameraDirection(angle: number, elevation: number): Vec3 {
  return [Math.sin(angle) * Math.cos(elevation), Math.sin(elevation), -Math.cos(angle) * Math.cos(elevation)]
}
export function project([x, y, z]: Vec3, lengthM: number, angle: number, elevation: number, zoom: number): [number, number] {
  const centeredX = x - lengthM / 2
  return [
    450 + zoom * SCENE_UNITS_PER_M * (centeredX * Math.cos(angle) + z * Math.sin(angle)),
    250 + zoom * SCENE_UNITS_PER_M * (-y * Math.cos(elevation) + (centeredX * Math.sin(angle) - z * Math.cos(angle)) * Math.sin(elevation)),
  ]
}
export function sectionPoint(x: number, p: Vec2, orientation: 0 | 90): Vec3 {
  const { y, z } = localToGlobalYZ(p.u, p.v, orientation)
  return [x, y, z]
}
export interface Surface {
  points: Vec3[]
  holes?: Vec3[][]
  fill: string
  stroke: string
  wall?: boolean
}
export function depthOf(surface: Surface, camera: Vec3) {
  return surface.points.reduce((sum, p) => sum + dot(p, camera), 0) / surface.points.length
}
/** Closed six-sided solids with only camera-facing surfaces, as in the template. */
function solidBox(x: number, y: number, z: number, w: number, h: number, d: number, camera: Vec3, wall = false): Surface[] {
  const vertices: Vec3[] = [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]]
  const sides: { indices: number[]; normal: Vec3; fill: string }[] = [
    { indices: [0, 4, 7, 3], normal: [-1, 0, 0], fill: '#b8c1b2' },
    { indices: [1, 2, 6, 5], normal: [1, 0, 0], fill: '#cbd4c4' },
    { indices: [0, 1, 5, 4], normal: [0, -1, 0], fill: '#929f89' },
    { indices: [3, 7, 6, 2], normal: [0, 1, 0], fill: '#e1e7da' },
    { indices: [0, 3, 2, 1], normal: [0, 0, -1], fill: '#acb9a0' },
    { indices: [4, 5, 6, 7], normal: [0, 0, 1], fill: '#9daa93' },
  ]
  return sides.filter((s) => dot(s.normal, camera) > 0.00001).map((s) => ({ points: s.indices.map((i) => vertices[i]), fill: s.fill, stroke: '#89977e', wall }))
}
export function beamSurfaces(design: BeamDesign, camera: Vec3): Surface[] {
  const { lengthM: L, orientationDeg: o } = design
  const { outer, holes } = sectionOutline(design.section)
  const surfaces = solidBox(-0.069, -0.156, -0.118, 0.069, 0.338, 0.236, camera, true)
  surfaces.push(...solidBox(0, -0.065, -0.065, 0.0127, 0.13, 0.13, camera))
  // Short strips preserve painter sorting at the wall. Inner tube faces retain opposite winding.
  for (const contour of [outer, ...holes]) {
    for (let strip = 0; strip < 20; strip++) for (let i = 0; i < contour.length; i++) {
      const a = sectionPoint(0, contour[i], o)
      const b = sectionPoint(0, contour[(i + 1) % contour.length], o)
      const normal: Vec3 = [0, a[2] - b[2], b[1] - a[1]]
      if (dot(normal, camera) <= 0) continue
      const x = Math.max(0.0127, strip * L / 20)
      const nextX = (strip + 1) * L / 20
      if (nextX <= x) continue
      surfaces.push({ points: [[x, a[1], a[2]], [nextX, a[1], a[2]], [nextX, b[1], b[2]], [x, b[1], b[2]]], fill: i % 3 === 0 ? '#91a99b' : i % 3 === 1 ? '#d7e1d7' : '#bdcdbf', stroke: 'none' })
    }
  }
  if (camera[0] > 0) surfaces.push({ points: outer.map((p) => sectionPoint(L, p, o)), holes: holes.map((h) => h.map((p) => sectionPoint(L, p, o))), fill: '#dbe4db', stroke: '#6c8977' })
  return surfaces.sort((a, b) => depthOf(a, camera) - depthOf(b, camera))
}
