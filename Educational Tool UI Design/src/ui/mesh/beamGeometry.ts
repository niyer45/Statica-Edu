import { BufferGeometry, ExtrudeGeometry, Path, Shape } from 'three'
import { sectionOutline } from '../../geometry/outline'
import type { Orientation, Section, Vec2 } from '../../geometry/sections'
import { deformedVertexY, visualDeflectionScale, type DeformationParams } from './deformation'

// Beam mesh generation (design "Mesh", Req 25.1, 25.6). Pure: builds new three.js geometry from
// the typed section and never reads geometry back for results.
//
// Axes (design "Coordinate and Axis Convention"): X longitudinal (root x = 0, free end x = L),
// Y vertical, Z width. At 0° section u ≡ Z and v ≡ Y; at 90° the section is rotated about X so u
// maps onto Y.

/** Extrusion steps along X (design: 40 segments). */
export const BEAM_LENGTH_SEGMENTS = 40
/** Points per circle in the section outline. */
export const BEAM_OUTLINE_SEGMENTS = 48

function toShapePath<T extends Path>(target: T, pts: readonly Vec2[]): T {
  pts.forEach((p, i) => (i === 0 ? target.moveTo(p.u, p.v) : target.lineTo(p.u, p.v)))
  target.closePath()
  return target
}

/** Section outline as a THREE.Shape in (x = u, y = v); tube sections get their inner hole. */
export function sectionShape(s: Section, segments: number = BEAM_OUTLINE_SEGMENTS): Shape {
  const { outer, holes } = sectionOutline(s, segments)
  const shape = toShapePath(new Shape(), outer)
  for (const hole of holes) shape.holes.push(toShapePath(new Path(), hole))
  return shape
}

export interface BeamGeometryOptions {
  lengthSegments?: number
  outlineSegments?: number
}

/**
 * Undeformed beam: the section outline extruded along +X from x = 0 to x = L, centred on the
 * beam axis (y = z = 0), with `lengthSegments` cross-section rings along X.
 */
export function buildBeamGeometry(
  s: Section,
  orientation: Orientation,
  lengthM: number,
  opts: BeamGeometryOptions = {},
): BufferGeometry {
  const steps = opts.lengthSegments ?? BEAM_LENGTH_SEGMENTS
  const geometry = new ExtrudeGeometry(sectionShape(s, opts.outlineSegments), {
    depth: lengthM,
    steps,
    bevelEnabled: false,
  })
  // Extrusion runs along local +Z with the shape in local XY (x = u, y = v).
  // rotateY(−π/2): (x, y, z) → (−z, y, x), so Z = u, Y = v, X = −depth; then shift by L so the
  // beam spans x ∈ [0, L]. Both are proper rotations/translations, so normals stay outward.
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(lengthM, 0, 0)
  // 90°: rotateX(−π/2) maps (Y, Z) = (v, u) → (u, −v), i.e. u onto Y.
  if (orientation === 90) geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  return geometry
}

/**
 * Returns a new geometry whose vertex Y positions are displaced by the exaggerated, capped
 * deflection at each vertex's x. The input geometry is not modified.
 */
export function deformBeamGeometry(geometry: BufferGeometry, p: DeformationParams): BufferGeometry {
  const out = geometry.clone()
  const pos = out.getAttribute('position')
  const scale = visualDeflectionScale(p)
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, deformedVertexY(pos.getX(i), pos.getY(i), p, scale))
  }
  pos.needsUpdate = true
  out.computeVertexNormals()
  out.computeBoundingBox()
  return out
}

/** Convenience: undeformed beam for the section, then deformed per `p`. */
export function buildDeformedBeamGeometry(
  s: Section,
  orientation: Orientation,
  p: DeformationParams,
  opts: BeamGeometryOptions = {},
): BufferGeometry {
  const base = buildBeamGeometry(s, orientation, p.lengthM, opts)
  const deformed = deformBeamGeometry(base, p)
  base.dispose()
  return deformed
}
