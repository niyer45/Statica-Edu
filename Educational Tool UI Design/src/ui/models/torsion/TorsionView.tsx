import { formatMm, radToDeg } from '../../../units/units'
import { formatTorsion, SHAFT_SECTION_NAMES, useTorsionStore } from './shared'

// Torsion design view (task 47.3; TSH-14, OC-12). A main-bundle SVG with no Three.js dependency,
// so it is also the non-WebGL view. Left: the draft cross-section. Right: a side elevation
// with the fixed end and a surface line twisted by the LATEST TESTED angle × the configured
// exaggeration (display only, capped), matching the beam's latest-tested deformation rule.
// No static text is drawn on the model (D-26); the summary below is the text equivalent.
// Deviation from the TSH-14 3D shaft, recorded in tasks.md: an SVG elevation is used for 47.3.

const SECTION_BOX = 120

export default function TorsionView() {
  const { state, challenge: ch } = useTorsionStore()
  const section = state.draft.section
  const outer = section.kind === 'circle' ? section.diameterM : section.outerDiameterM
  const inner = section.kind === 'tube' ? section.innerDiameterM : 0
  const maxD = ch.sectionLimits.circle.diameterM.maxM
  const scale = (SECTION_BOX * 0.9) / maxD
  const latest = state.history[state.history.length - 1]!
  const tested = latest.analysis.twistRad
  const shown = Math.min(tested * ch.visualization.twistExaggerationFactor, ch.visualization.maxVisualTwistRad)
  // Elevation: shaft drawn as a rectangle whose height is the outer diameter (to scale).
  const shaftH = Math.max(outer * scale, 4)
  const top = 60 - shaftH / 2
  // Surface line: a helix projected onto the elevation, drifting by the shown twist fraction.
  const drift = (shown / (2 * Math.PI)) * shaftH * 2
  return (
    <div className="torsion-view">
      <svg viewBox="0 0 420 130" role="img" aria-label={`${SHAFT_SECTION_NAMES[section.kind]} cross-section and side view of the shaft`} className="beam-scene">
        <g transform="translate(70 65)">
          <circle r={(outer * scale) / 2} className="shaft-section" />
          {inner > 0 && <circle r={(inner * scale) / 2} className="shaft-bore" />}
        </g>
        <g>
          <rect x={150} y={20} width={8} height={80} className="shaft-wall" />
          <rect x={158} y={top} width={240} height={shaftH} className="shaft-body" />
          <line x1={158} y1={top + shaftH * 0.25} x2={398} y2={Math.max(top, top + shaftH * 0.25 - drift)} className="shaft-twist-line" />
        </g>
      </svg>
      <p className="viewport-label torsion-summary" aria-live="off">
        {SHAFT_SECTION_NAMES[section.kind]} · outer {formatMm(outer, 1)} mm{inner > 0 ? ` · inner ${formatMm(inner, 1)} mm` : ''} · latest tested twist {formatTorsion(tested, 'rad')}
        {shown < tested * ch.visualization.twistExaggerationFactor ? ' (display capped)' : ` (shown ×${ch.visualization.twistExaggerationFactor}, ${radToDeg(shown).toFixed(1)}° drawn)`}
      </p>
    </div>
  )
}
