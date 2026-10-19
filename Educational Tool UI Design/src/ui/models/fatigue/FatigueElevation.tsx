import { wheelLoadRangeN } from '../../../challenge/fatigue/types'
import { hubProfile, loadLineX, spindleProfile, type ProfilePoint } from '../../../geometry/fatigue/outline'
import { useFatigueStore } from './shared'

// Fatigue 2D side view (task 70; FAT-16, OC-12). Main bundle, no Three.js: the view without WebGL
// and the fallback if the 3D chunk fails. It draws the DRAFT spindle to scale in section: the
// hatched housing face, the collar, the shoulder fillet and the neck (pure outline from
// geometry/fatigue/outline.ts, mirrored about the axis), the wheel hub seated on the shoulder face,
// the axis, and the wheel load at its line as a solid arrow (largest load) beside a short open
// arrow (smallest load), so the fluctuation reads without words. A ring marks the fillet, the
// critical section. No text on the drawing (D-26); FatigueDetails carries the words and values.

const X0 = 34
const Y0 = 112
const PX_PER_M = 1900

export const ELEVATION_LABEL =
  'Side view of the stepped spindle in section: the collar held by the housing on the left, the shoulder fillet, and the neck carrying the wheel hub and the fluctuating wheel load on the right; a ring marks the fillet'

export default function FatigueElevation() {
  const { state, challenge: ch } = useFatigueStore()
  const draft = state.draft
  const p = (q: ProfilePoint, sign: 1 | -1) => `${(X0 + q.x * PX_PER_M).toFixed(2)},${(Y0 - sign * q.y * PX_PER_M).toFixed(2)}`
  const profile = spindleProfile(draft, ch)
  // The silhouette: upper profile left to right, then the mirrored profile right to left.
  const body = [...profile.map((q) => p(q, 1)), ...[...profile].reverse().map((q) => p(q, -1))].join(' ')
  const hub = hubProfile(draft, ch)
  const hubUpper = hub.map((q) => p(q, 1)).join(' ')
  const hubLower = hub.map((q) => p(q, -1)).join(' ')
  const length = ch.geometry.collarLengthM + ch.geometry.neckLengthM
  const loadX = X0 + loadLineX(ch) * PX_PER_M
  const hubTop = Y0 - hub[1]!.y * PX_PER_M
  const range = wheelLoadRangeN(ch.load)
  const shortArrow = 26 * (range.minN / range.maxN)
  const filletX = X0 + (ch.geometry.collarLengthM + draft.filletRadiusM / 2) * PX_PER_M
  const filletY = Y0 - (draft.neckDiameterM / 2 + draft.filletRadiusM / 2) * PX_PER_M
  return (
    <svg viewBox="0 0 250 190" role="img" aria-label={ELEVATION_LABEL} className="beam-scene bracket-elevation fatigue-elevation">
      <defs>
        <pattern id="fatigue-wall-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="bracket-hatch-line" />
        </pattern>
      </defs>
      <rect x={4} y={Y0 - 100} width={X0 - 4} height={176} className="bracket-wall" />
      <rect x={4} y={Y0 - 100} width={X0 - 4} height={176} fill="url(#fatigue-wall-hatch)" />
      <polygon points={body} className="fatigue-body" />
      <polygon points={hubUpper} className="fatigue-hub" />
      <polygon points={hubLower} className="fatigue-hub" />
      <line x1={X0 - 6} y1={Y0} x2={X0 + length * PX_PER_M + 8} y2={Y0} className="fatigue-axis" />
      <circle cx={filletX} cy={filletY} r={7} className="fatigue-fillet-marker" />
      <line x1={loadX} y1={hubTop - 34} x2={loadX} y2={hubTop - 8} className="bracket-load" />
      <polygon points={`${loadX - 4},${hubTop - 9} ${loadX + 4},${hubTop - 9} ${loadX},${hubTop - 1}`} className="bracket-load-head" />
      <line x1={loadX + 12} y1={hubTop - 8 - shortArrow} x2={loadX + 12} y2={hubTop - 8} className="fatigue-load-min" />
      <polygon points={`${loadX + 8},${hubTop - 9} ${loadX + 16},${hubTop - 9} ${loadX + 12},${hubTop - 1}`} className="fatigue-load-min-head" />
    </svg>
  )
}
