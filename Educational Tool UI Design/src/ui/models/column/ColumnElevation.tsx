import { columnInnerDiameterM, columnOuterDiameterM } from '../../../geometry/column/design'
import { displayedRadii, DISPLAY_NOTE, MODE_AMPLITUDE_FRACTION, modeShapePoints } from './columnLayout'
import { COLUMN_SECTION_NAMES, designLabel, formatColumn, formatLimit, useColumnStore } from './shared'

// Column 2D view (task 68; CBK-18, OC-12). Main bundle, no Three.js, so it is the view on devices
// without WebGL and the fallback if the 3D chunk fails. Left: the DRAFT column standing between a
// pin on a grounded support at the bottom and a pin at the top, with the load pressing down on the
// top pin and the dashed buckling mode shape (display rules in columnLayout.ts). Right: the draft
// cross-section, solid or hollow, to its own scale. No text is drawn on the model (D-26);
// ColumnSummary below carries the words and the stored values.

/** Id of the visible text summary; the 3D canvas references it with `aria-describedby`. */
export const COLUMN_SUMMARY_ID = 'column-view-summary'

export const ELEVATION_LABEL =
  'Side view of the column: a round column standing between a pin at the bottom and a pin at the top, with the load pressing down on the top pin; on the right, its cross-section'

const CX = 104
const TOP = 46
const BOTTOM = 246
const SECTION_CX = 236
const SECTION_CY = 146
/** Cross-section inset scale: the largest allowed outer diameter fills about 84 px. */
const SECTION_BOX = 84

/** Text equivalent of the column views: the draft section and the latest tested buckling result. */
export function ColumnSummary() {
  const { state } = useColumnStore()
  const latest = state.history[state.history.length - 1]!
  const buckling = latest.evaluation.constraints.find((c) => c.id === 'buckling')!
  return (
    <p id={COLUMN_SUMMARY_ID} className="viewport-label column-summary" aria-live="off">
      {COLUMN_SECTION_NAMES[state.draft.section.kind]} {designLabel(state.draft)}, pinned at both ends, load pressing down on the top.
      {' '}Latest tested critical buckling load {formatColumn(buckling.value, 'N')} (needs {formatLimit(buckling)})
      {state.draftStatus === 'draft' && ' · draft changed since this test'}. {DISPLAY_NOTE}
    </p>
  )
}

export default function ColumnElevation() {
  const { state, challenge: ch } = useColumnStore()
  const section = state.draft.section
  const pxPerM = (BOTTOM - TOP) / ch.lengthM
  const { outer } = displayedRadii(section)
  const halfWidth = Math.max(outer * pxPerM, 2)
  const amplitude = MODE_AMPLITUDE_FRACTION * ch.lengthM
  const mode = modeShapePoints(ch.lengthM, amplitude)
    .map(([x, h]) => `${(CX + x * pxPerM).toFixed(2)},${(BOTTOM - h * pxPerM).toFixed(2)}`)
    .join(' ')
  // Inset: true proportions of the draft section, scaled so the largest allowed tube fits the box.
  const maxD = Math.max(ch.sectionLimits.solid.diameterM.maxM, ch.sectionLimits.tube.outerDiameterM.maxM)
  const insetScale = SECTION_BOX / maxD
  const insetOuter = (columnOuterDiameterM(section) / 2) * insetScale
  const insetInner = (columnInnerDiameterM(section) / 2) * insetScale
  return (
    <svg viewBox="0 0 300 276" role="img" aria-label={ELEVATION_LABEL} className="beam-scene column-elevation">
      <defs>
        <pattern id="column-ground-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="column-hatch-line" />
        </pattern>
      </defs>
      <rect x={CX - 32} y={BOTTOM + 20} width={64} height={8} fill="url(#column-ground-hatch)" />
      <line x1={CX - 32} y1={BOTTOM + 20} x2={CX + 32} y2={BOTTOM + 20} className="column-ground" />
      <polygon points={`${CX},${BOTTOM} ${CX - 14},${BOTTOM + 20} ${CX + 14},${BOTTOM + 20}`} className="column-support" />
      <rect x={CX - halfWidth} y={TOP + 9} width={2 * halfWidth} height={BOTTOM - TOP - 18} className="column-body" />
      <polyline points={mode} className="column-mode" />
      <circle cx={CX} cy={BOTTOM} r={5} className="column-pin" />
      <circle cx={CX} cy={TOP} r={5} className="column-pin" />
      <line x1={CX} y1={6} x2={CX} y2={TOP - 12} className="column-load" />
      <polygon points={`${CX - 5},${TOP - 14} ${CX + 5},${TOP - 14} ${CX},${TOP - 6}`} className="column-load-head" />
      <circle cx={SECTION_CX} cy={SECTION_CY} r={insetOuter} className="column-section" />
      {insetInner > 0 && <circle cx={SECTION_CX} cy={SECTION_CY} r={insetInner} className="column-bore" />}
    </svg>
  )
}
