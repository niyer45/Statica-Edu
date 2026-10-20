import type { VesselDesign } from './design'

// Pressure vessel display profile (task 69; PVS-12, PVS-15). Pure geometry for the views only:
// the upper half of the vessel's longitudinal section, in metres, with x along the axis (0 at the
// middle of the shell) and y the radial distance from the axis. The 3D view revolves it about
// the x axis; the 2D view draws it and its mirror image. It is the vessel as modeled: a shell of
// inner radius r and wall t_s between x = ±L/2, closed by hemispherical heads of the same inner
// radius and wall t_h centred on the junctions. Where t_h ≠ t_s the outer surface steps at the
// junction; the transition taper is not modeled (requirements PVS-12).

export interface ProfilePoint {
  x: number
  y: number
}

/** Segments per quarter-circle head arc. */
export const VESSEL_ARC_SEGMENTS = 16

/** Points of one quarter arc of radius `radius` centred on (cx, 0), from angle `from` to `to`. */
function arc(cx: number, radius: number, from: number, to: number, segments: number): ProfilePoint[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / segments
    return { x: cx + radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
}

/**
 * The outer and inner surfaces of the upper half-section, each from the left pole to the right
 * pole (x increasing). Both start and end on the axis (y = 0).
 */
export function vesselProfile(d: Pick<VesselDesign, 'innerDiameterM' | 'shellLengthM' | 'shellThicknessM' | 'headThicknessM'>, segments = VESSEL_ARC_SEGMENTS): { outer: ProfilePoint[]; inner: ProfilePoint[] } {
  const r = d.innerDiameterM / 2
  const half = d.shellLengthM / 2
  const rs = r + d.shellThicknessM
  const rh = r + d.headThicknessM
  const outer = [
    ...arc(-half, rh, Math.PI, Math.PI / 2, segments),
    { x: -half, y: rs },
    { x: half, y: rs },
    ...arc(half, rh, Math.PI / 2, 0, segments),
  ]
  const inner = [...arc(-half, r, Math.PI, Math.PI / 2, segments), ...arc(half, r, Math.PI / 2, 0, segments)]
  return { outer, inner }
}

/**
 * The closed wall region of the upper half-section (outer surface left to right, then the inner
 * surface right to left), for filled drawings and the cut faces of the 3D cutaway.
 */
export function vesselWallSection(d: Pick<VesselDesign, 'innerDiameterM' | 'shellLengthM' | 'shellThicknessM' | 'headThicknessM'>, segments = VESSEL_ARC_SEGMENTS): ProfilePoint[] {
  const { outer, inner } = vesselProfile(d, segments)
  return [...outer, ...[...inner].reverse()]
}

/** Half the outside length of the vessel along its axis (pole to middle), for view framing, m. */
export function vesselHalfExtentM(d: Pick<VesselDesign, 'innerDiameterM' | 'shellLengthM' | 'headThicknessM'>): number {
  return d.shellLengthM / 2 + d.innerDiameterM / 2 + d.headThicknessM
}

/** A point on the inner surface and the outward unit normal there (display only). */
export interface PressureStation {
  point: ProfilePoint
  normal: ProfilePoint
}

/**
 * Where the views draw internal-pressure arrows (owner request 2026-10-19): points on the inner
 * surface of the upper half-section with the outward normal, along which pressure pushes on the
 * wall. The shell gets one station per inner radius of length (1 to 5, evenly spaced, normal
 * straight out); each head gets stations at its pole and at 45°, with the normal pointing away
 * from the head's centre. Ordered left to right.
 */
export function vesselPressureStations(d: Pick<VesselDesign, 'innerDiameterM' | 'shellLengthM'>): PressureStation[] {
  const r = d.innerDiameterM / 2
  const half = d.shellLengthM / 2
  const head = (sign: 1 | -1, angle: number): PressureStation => ({
    point: { x: sign * (half + r * Math.cos(angle)), y: r * Math.sin(angle) },
    normal: { x: sign * Math.cos(angle), y: Math.sin(angle) },
  })
  const count = Math.min(5, Math.max(1, Math.round(d.shellLengthM / r)))
  const shell = Array.from({ length: count }, (_, i): PressureStation => ({
    point: { x: -half + (d.shellLengthM * (i + 0.5)) / count, y: r },
    normal: { x: 0, y: 1 },
  }))
  return [head(-1, 0), head(-1, Math.PI / 4), ...shell, head(1, Math.PI / 4), head(1, 0)]
}
