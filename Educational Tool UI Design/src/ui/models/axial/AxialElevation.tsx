import { displayedStretch, useAxialStore } from './shared'

// Stress and Strain I 2D view (task 72; SSR-15, OC-12). Main bundle, no Three.js, so it is the view
// on devices without WebGL and the fallback if the 3D chunk fails. It shows:
//   - left, the DRAFT cross-section: a solid circle to scale against the largest allowed diameter;
//   - right, an elevation: the hatched roof beam, the upper clevis and pin, the DRAFT rod (width
//     to the same scale; length drawn much shorter than scale, as the summary says), stretched by
//     the LATEST TESTED elongation × the configured exaggeration (display only, capped), a dashed
//     line where the unstretched rod would end, the lower clevis, the load and a downward arrow.
// No text is drawn on the model (D-26); AxialSummary carries the words and values.

/** Pixels per metre for diameters (the largest allowed diameter is drawn 60 px wide). */
const MAX_DIAMETER_PX = 60
/** Drawn length of the unstretched rod, px (not to scale). */
const ROD_PX = 120
const CX = 205
const TOP = 44

export const ELEVATION_LABEL =
  'Cross-section of the rod on the left; on the right the rod hangs from a roof beam and carries a load, drawn stretched by its latest tested elongation, exaggerated'

export default function AxialElevation() {
  const { state, challenge: ch } = useAxialStore()
  const draft = state.draft
  const latest = state.history[state.history.length - 1]!
  const pxPerM = MAX_DIAMETER_PX / ch.diameterLimits.maxM
  const w = Math.max(draft.diameterM * pxPerM, 2)
  const { fractionOfLength } = displayedStretch(latest.analysis.elongationM, ch.lengthM, ch.visualization)
  const stretched = ROD_PX * (1 + fractionOfLength)
  const end = TOP + stretched
  return (
    <svg viewBox="0 0 300 250" role="img" aria-label={ELEVATION_LABEL} className="beam-scene axial-elevation">
      <defs>
        <pattern id="axial-beam-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="axial-hatch-line" />
        </pattern>
      </defs>
      <g transform="translate(55 90)">
        <circle r={MAX_DIAMETER_PX / 2} className="axial-section-envelope" />
        <circle r={w / 2} className={`axial-section axial-material-${draft.materialId}`} />
      </g>
      <rect x={CX - 75} y={14} width={150} height={18} className="axial-beam" />
      <rect x={CX - 75} y={14} width={150} height={18} fill="url(#axial-beam-hatch)" />
      <rect x={CX - 12} y={32} width={24} height={16} rx={2} className="axial-clevis" />
      <rect x={CX - w / 2} y={TOP} width={w} height={stretched} className={`axial-rod axial-material-${draft.materialId}`} />
      <line x1={CX - w / 2 - 10} y1={TOP + ROD_PX} x2={CX + w / 2 + 10} y2={TOP + ROD_PX} className="axial-unstretched" />
      <circle cx={CX} cy={40} r={2.5} className="axial-pin" />
      <rect x={CX - 12} y={end - 4} width={24} height={16} rx={2} className="axial-clevis" />
      <circle cx={CX} cy={end + 4} r={2.5} className="axial-pin" />
      <rect x={CX - 22} y={end + 12} width={44} height={24} rx={2} className="axial-load" />
      <line x1={CX} y1={end + 38} x2={CX} y2={end + 50} className="axial-arrow" />
      <polygon points={`${CX - 4},${end + 48} ${CX + 4},${end + 48} ${CX},${end + 56}`} className="axial-arrow-head" />
    </svg>
  )
}
