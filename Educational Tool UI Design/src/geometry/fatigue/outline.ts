import type { FatigueChallenge } from '../../challenge/fatigue/types'
import type { FatigueDesign } from './design'

// Display geometry of the stepped spindle (task 70; FAT-16). Pure, no physics: shared by the 2D
// side view and the lazy 3D lathe so both draw the same part. Coordinates in metres: x along the
// axis from the housing face (x = 0), y the radius. The collar runs x ∈ [0, L_D], the shoulder face
// is at x = L_D, the fillet is a quarter circle of radius r tangent to the shoulder face and to the
// neck surface, centred at (L_D + r, d/2 + r), and the neck runs to x = L_D + L_d.

export interface ProfilePoint {
  x: number
  y: number
}

/** Segments of the fillet quarter circle. */
export const FILLET_ARC_SEGMENTS = 12

type Lengths = Pick<FatigueChallenge, 'geometry'>

/** Points of the fillet arc from the shoulder face (x = L_D, y = d/2 + r) to the neck (x = L_D + r, y = d/2). */
export function filletArc(d: Pick<FatigueDesign, 'neckDiameterM' | 'filletRadiusM'>, collarLengthM: number, segments = FILLET_ARC_SEGMENTS): ProfilePoint[] {
  const r = d.filletRadiusM
  const cx = collarLengthM + r
  const cy = d.neckDiameterM / 2 + r
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = Math.PI + (i / segments) * (Math.PI / 2) // from the shoulder face round to the neck
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
}

/** Upper half profile of the spindle, closed along the axis: axis start → collar → shoulder → fillet → neck → axis end. */
export function spindleProfile(d: Pick<FatigueDesign, 'neckDiameterM' | 'collarDiameterM' | 'filletRadiusM'>, ch: Lengths): ProfilePoint[] {
  const { collarLengthM: LD, neckLengthM: Ld } = ch.geometry
  return [
    { x: 0, y: 0 },
    { x: 0, y: d.collarDiameterM / 2 },
    { x: LD, y: d.collarDiameterM / 2 },
    ...filletArc(d, LD),
    { x: LD + Ld, y: d.neckDiameterM / 2 },
    { x: LD + Ld, y: 0 },
  ]
}

/** Axial position of the wheel load line, m. */
export function loadLineX(ch: Pick<FatigueChallenge, 'geometry' | 'load'>): number {
  return ch.geometry.collarLengthM + ch.load.armM
}

/** Radial thickness of the drawn wheel hub ring outside the neck, m (display only). */
export const HUB_RING_THICKNESS_M = 0.012
/** The drawn hub extends this far past the load line, m (display only). */
export const HUB_OVERHANG_M = 0.008

/**
 * Closed half profile of the wheel hub seated against the shoulder face: its bore clears the fillet
 * (bore radius d/2 + r over the first r of length) and then sits on the neck up to just past the
 * load line.
 */
export function hubProfile(d: Pick<FatigueDesign, 'neckDiameterM' | 'filletRadiusM'>, ch: Pick<FatigueChallenge, 'geometry' | 'load'>): ProfilePoint[] {
  const LD = ch.geometry.collarLengthM
  const rn = d.neckDiameterM / 2
  const outer = rn + d.filletRadiusM + HUB_RING_THICKNESS_M
  const end = loadLineX(ch) + HUB_OVERHANG_M
  return [
    { x: LD, y: rn + d.filletRadiusM },
    { x: LD, y: outer },
    { x: end, y: outer },
    { x: end, y: rn },
    { x: LD + d.filletRadiusM, y: rn },
  ]
}
