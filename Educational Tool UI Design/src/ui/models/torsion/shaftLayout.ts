import type { TorsionSection } from '../../../geometry/torsion/design'

// Display-only layout for the 3D torsion shaft (task 54.2; TSH-14). Positions are in metres:
// X along the shaft axis (fixed end x = 0, free end x = L), Y vertical, Z horizontal across.
// No physics here: the shaft is drawn from the draft diameters, and the twist angle passed in
// is the stored latest tested angle after the display rule in `displayedTwist`.

export type Vec3 = [number, number, number]

/** Samples along the twisted surface line. */
export const TWIST_LINE_SAMPLES = 48
/** Angular position of the surface line at the fixed end (faces the default camera). */
export const TWIST_LINE_START_RAD = Math.PI / 8

/** Outer diameter of a shaft section. */
export function shaftOuterDiameterM(section: Readonly<TorsionSection>): number {
  return section.kind === 'circle' ? section.diameterM : section.outerDiameterM
}

/**
 * The surface line: starts at `TWIST_LINE_START_RAD` on the fixed end and rotates about +X
 * (right-hand rule, the sense of the applied torque) until it reaches start + `shownRad` at the
 * free end. The rotation is interpolated linearly along the length for display only. Drawn just
 * outside the faceted surface so it is never hidden inside the mesh.
 */
export function twistLinePoints(radiusM: number, lengthM: number, shownRad: number, samples = TWIST_LINE_SAMPLES): Vec3[] {
  const r = radiusM * 1.02 + 0.0004
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples
    const angle = TWIST_LINE_START_RAD + shownRad * t
    return [t * lengthM, r * Math.cos(angle), r * Math.sin(angle)]
  })
}

/** Angle of the torque arrow arc (three-quarters of a turn). */
export const TORQUE_ARC_RAD = 1.5 * Math.PI

export interface TorsionSceneFrame {
  lengthM: number
  /** Wall plate behind the fixed end, centred on the axis, spanning x ∈ [−thickness, 0]. */
  wall: { thicknessM: number; sizeM: number }
  /** Clamp block gripping the fixed end, spanning x ∈ [0, lengthM]. */
  clamp: { lengthM: number; sizeM: number }
  /** Curved torque arrow just beyond the free end, around the shaft axis. */
  torque: { x: number; radiusM: number; tubeM: number; coneRadiusM: number; coneLengthM: number }
  floorY: number
  /** Overview radius used to frame the camera. */
  fitRadiusM: number
}

/**
 * Fixed scene chrome from the challenge (largest allowed diameter) and the draft. The wall and
 * floor depend only on the challenge so they stay still while the student edits; the clamp and
 * the torque arrow follow the draft diameter so they always surround the shaft.
 */
export function torsionSceneFrame(lengthM: number, outerDiameterM: number, maxDiameterM: number): TorsionSceneFrame {
  const wallSize = 4 * maxDiameterM
  const radius = outerDiameterM / 2
  return {
    lengthM,
    wall: { thicknessM: 0.025, sizeM: wallSize },
    clamp: { lengthM: 0.035, sizeM: outerDiameterM + 0.024 },
    torque: { x: lengthM + 0.025, radiusM: radius + 0.018, tubeM: 0.0025, coneRadiusM: 0.007, coneLengthM: 0.018 },
    floorY: -wallSize / 2,
    fitRadiusM: Math.hypot(lengthM / 2 + 0.06, wallSize / 2),
  }
}
