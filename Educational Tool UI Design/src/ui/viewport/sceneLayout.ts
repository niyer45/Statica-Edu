import type { StudentChallenge } from '../../challenge/content'
import { SECTION_PARAMS, PARAM_LABELS, type SectionParam } from '../../geometry/params'
import type { BeamDesign, Orientation, Section } from '../../geometry/sections'
import { sectionOutline } from '../../geometry/outline'
import { deformedVertexY, visualDeflectionScale, type DeformationParams } from '../mesh/deformation'

// Display-only scene layout for Viewport3D (task 14.3; Req 25.1, 25.9, 25.12, 7.5, 7.7).
// Positions are in metres in the global frame of the design's "Coordinate and Axis Convention":
// X longitudinal (root x = 0, free end x = L), Y vertical (load in −Y), Z width.
// No physics here: deformed points come from ui/mesh (`deformedVertexY`), and every displayed
// number is read from the challenge, the draft, or a stored Test_Result.

export type Vec3 = [number, number, number]

/** Section-local (u, v) → global (y, z) for an orientation (same mapping as ui/mesh). */
export function localToGlobalYZ(u: number, v: number, o: Orientation): { y: number; z: number } {
  // 0°: u ≡ Z, v ≡ Y. 90°: rotateX(−π/2) maps u onto Y and v onto −Z.
  return o === 0 ? { y: v, z: u } : { y: u, z: -v }
}

export const SECTION_KIND_LABELS: Record<Section['kind'], string> = {
  circle: 'Circle',
  tube: 'Tube',
  rectangle: 'Rectangle',
  iSection: 'I-section',
}

/** Parameters of a section with their labels and values, in validator order. */
export function sectionParamValues(s: Section): { param: SectionParam; label: string; valueM: number }[] {
  const values = s as unknown as Record<string, number>
  return (SECTION_PARAMS[s.kind] as readonly SectionParam[]).map((param) => ({
    param,
    label: PARAM_LABELS[param],
    valueM: values[param] as number,
  }))
}

/** Gap between the section outline and its dimension guides. */
const GUIDE_GAP_M = 0.012

export interface DimensionGuide {
  param: SectionParam
  label: string
  valueM: number
  from: Vec3
  to: Vec3
}

/**
 * One guide per section parameter, drawn just past the free-end face (x = L) so it never
 * overlaps the handles placed on the section itself (task 16.1). Full dimensions sit outside the
 * oriented envelope; thicknesses sit beside the feature they measure.
 */
export function dimensionGuides(s: Section, o: Orientation, lengthM: number, env: { widthZM: number; heightYM: number }): DimensionGuide[] {
  const x = lengthM + 0.002
  const halfY = env.heightYM / 2
  const halfZ = env.widthZM / 2
  const yz = (u: number, v: number): Vec3 => {
    const g = localToGlobalYZ(u, v, o)
    return [x, g.y, g.z]
  }
  const vertical = (valueM: number, z: number): [Vec3, Vec3] => [
    [x, -valueM / 2, z],
    [x, valueM / 2, z],
  ]
  const horizontal = (valueM: number, y: number): [Vec3, Vec3] => [
    [x, y, -valueM / 2],
    [x, y, valueM / 2],
  ]
  return sectionParamValues(s).map(({ param, label, valueM }) => {
    let seg: [Vec3, Vec3]
    switch (param) {
      case 'diameterM':
      case 'outerDiameterM':
        seg = vertical(valueM, halfZ + GUIDE_GAP_M)
        break
      case 'innerDiameterM':
        seg = vertical(valueM, halfZ + 2 * GUIDE_GAP_M)
        break
      case 'widthM': {
        // Width is u-measured: horizontal (Z) at 0°, vertical (Y) at 90°.
        seg = o === 0 ? horizontal(valueM, -halfY - GUIDE_GAP_M) : vertical(valueM, halfZ + GUIDE_GAP_M)
        break
      }
      case 'heightM':
        seg = o === 0 ? vertical(valueM, halfZ + 2 * GUIDE_GAP_M) : horizontal(valueM, -halfY - GUIDE_GAP_M)
        break
      case 'flangeThicknessM': {
        if (s.kind !== 'iSection') throw new Error('flange thickness on a non-I section')
        const u = s.widthM / 2 + GUIDE_GAP_M / 2
        seg = [yz(u, s.heightM / 2 - valueM), yz(u, s.heightM / 2)]
        break
      }
      case 'webThicknessM': {
        if (s.kind !== 'iSection') throw new Error('web thickness on a non-I section')
        const v = -s.heightM / 4
        seg = [yz(-valueM / 2, v), yz(valueM / 2, v)]
        break
      }
    }
    return { param, label, valueM, from: seg[0], to: seg[1] }
  })
}

/** Ordered outer outline of a section in (u, v), without a duplicated closing point. */
function outerOutline(s: Section): { u: number; v: number }[] {
  return sectionOutline(s).outer
}

/** Longitudinal samples for each deformed outline polyline. */
export const DEFORMED_SAMPLES = 24

export interface DeformedOutline {
  /** Polylines along X through a subset of outline points. */
  lines: Vec3[][]
  /** Closed outline of the deformed free-end section. */
  tip: Vec3[]
}

/**
 * Dashed deformed outline of the displayed snapshot (latest Test_Result or Baseline), with the
 * visual offset scaled by `progress` ∈ [0, 1] for the optional reveal animation (Req 32.7).
 */
export function deformedOutline(design: Readonly<BeamDesign>, p: DeformationParams, progress = 1): DeformedOutline {
  const o = design.orientationDeg
  const L = design.lengthM
  const scale = visualDeflectionScale(p) * Math.min(1, Math.max(0, progress))
  const outline = outerOutline(design.section)
  const step = Math.max(1, Math.floor(outline.length / 12))
  const at = (x: number, u: number, v: number): Vec3 => {
    const g = localToGlobalYZ(u, v, o)
    return [x, deformedVertexY(x, g.y, p, scale), g.z]
  }
  const lines = outline
    .filter((_, i) => i % step === 0)
    .map(({ u, v }) => Array.from({ length: DEFORMED_SAMPLES + 1 }, (_, j) => at((j / DEFORMED_SAMPLES) * L, u, v)))
  const tip = outline.map(({ u, v }) => at(L, u, v))
  const firstTip = tip[0]
  if (firstTip) tip.push(firstTip)
  return { lines, tip }
}

export interface SceneFrame {
  lengthM: number
  /** Top of the force arrow shaft. */
  arrowTopY: number
  /** Arrow tip: above every handle and the envelope limit so it never occludes them (Req 25.9). */
  arrowTipY: number
  floorY: number
  wall: { thicknessM: number; bottomY: number; topY: number; depthM: number }
  envelopeLimit: { widthZM: number; heightYM: number }
}

/** Fixed layout of the scene chrome, from the challenge and the draft only. */
export function sceneFrame(ch: Readonly<StudentChallenge>, draftLengthM: number, draftEnv: { widthZM: number; heightYM: number }): SceneFrame {
  const limit = { widthZM: ch.constraints.maxWidthM, heightYM: ch.constraints.maxHeightM }
  const halfTop = Math.max(limit.heightYM, draftEnv.heightYM) / 2
  const halfWidth = Math.max(limit.widthZM, draftEnv.widthZM) / 2
  const maxDrop = ch.visualization.maxVisualDeflectionFractionOfL * draftLengthM
  const floorY = -(halfTop + maxDrop + 0.02)
  const arrowTipY = halfTop + 0.012
  const arrowTopY = arrowTipY + 0.13
  return {
    lengthM: draftLengthM,
    arrowTopY,
    arrowTipY,
    floorY,
    wall: { thicknessM: 0.02, bottomY: floorY, topY: arrowTopY, depthM: 2 * halfWidth + 0.16 },
    envelopeLimit: limit,
  }
}
