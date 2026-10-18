import { useId } from 'react'
import { finGap } from '../../../geometry/heatSink/design'
import type { FinProfileSample } from '../../../physics/heatSink/types'
import { describeFins, formatCelsius, formatGap, formatPercent, positionLabel, useHeatSinkStore } from './shared'

// Heat sink design view (task 48.3; HSK-14, MM-22). A main-bundle SVG with no Three.js
// dependency, so it is also the non-WebGL view: a front elevation across the fins showing the
// base and the DRAFT fin array to scale (fin thickness, gap and height all visible). Fin
// positions use the geometry module's gap; nothing thermal is computed here.
//
// Temperature shading comes strictly from the stored `finProfile` samples of the latest test
// and is drawn only while the draft is that tested design (an edited draft has no result yet).
// The color scale is fixed by the challenge (air temperature → base temperature limit), has a
// text legend, and the same samples are listed in a table, so color is never the only carrier.
// No static text is drawn on the model (D-26) and there is no flow animation (HSK-14).
// Deviation from the HSK-14 lazy 3D fin array, as for torsion (47.3): the SVG is the primary view.

const PX_PER_M = 4000 // 4 px per mm: the 60 mm base spans 240 px.
const LEFT = 30
const TOP = 20

/** Fixed sequential scale endpoints: cool (air temperature) → hot (limit or above). */
const COOL = [232, 238, 220] as const
const HOT = [181, 83, 42] as const

/** Display color for a stored temperature on the challenge's fixed scale (display mapping only). */
function shade(temperatureK: number, coolK: number, hotK: number): string {
  const f = Math.min(1, Math.max(0, (temperatureK - coolK) / (hotK - coolK)))
  const c = COOL.map((v, i) => Math.round(v + (HOT[i]! - v) * f))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function ProfileTable({ profile, caption }: { profile: readonly FinProfileSample[]; caption: string }) {
  return (
    <table className="fin-profile" aria-label="Fin temperature profile">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Position</th>
          <th scope="col">Temperature</th>
          <th scope="col">Excess over air, share of root</th>
        </tr>
      </thead>
      <tbody>
        {profile.map((p) => (
          <tr key={p.xOverH}>
            <th scope="row">{positionLabel(p.xOverH)}</th>
            <td>{formatCelsius(p.temperatureK)}</td>
            <td>{formatPercent(p.excessRatio)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function HeatSinkView() {
  const { state, challenge: ch } = useHeatSinkStore()
  const gradientId = `fin-shade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const draft = state.draft
  const latest = state.history[state.history.length - 1]!
  const tested = state.draftStatus === 'tested'
  const coolK = ch.ambientTemperatureK
  const hotK = ch.constraints.maxBaseTemperatureK

  const W = ch.base.widthM * PX_PER_M
  const baseH = ch.base.thicknessM * PX_PER_M
  const maxFin = ch.designLimits.finHeightM.maxM * PX_PER_M
  const baseTop = TOP + maxFin
  const t = draft.finThicknessM * PX_PER_M
  const pitch = t + finGap(ch.base.widthM, draft.finCount, draft.finThicknessM) * PX_PER_M
  const finH = draft.finHeightM * PX_PER_M
  const fins = Array.from({ length: draft.finCount }, (_, i) => LEFT + i * pitch)

  return (
    <div className="heat-sink-view">
      <svg
        viewBox={`0 0 ${W + 2 * LEFT} ${baseTop + baseH + 12}`}
        role="img"
        aria-label={`Front view across the heat sink: ${draft.finCount} fins on the base, drawn to scale${tested ? ', shaded by the tested fin temperature' : ''}`}
        className="heat-sink-scene"
      >
        {tested && (
          <defs>
            {/* Root (bottom) to tip (top) at the stored sample positions. */}
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              {latest.analysis.finProfile.map((p) => (
                <stop key={p.xOverH} offset={p.xOverH} stopColor={shade(p.temperatureK, coolK, hotK)} />
              ))}
            </linearGradient>
          </defs>
        )}
        {fins.map((x, i) => (
          <rect key={i} x={x} y={baseTop - finH} width={t} height={finH} className={tested ? 'fin-tested' : 'fin-untested'} fill={tested ? `url(#${gradientId})` : undefined} />
        ))}
        <rect x={LEFT} y={baseTop} width={W} height={baseH} className="heat-sink-base" />
        <rect x={LEFT + W * 0.1} y={baseTop + baseH} width={W * 0.8} height={4} className="heat-sink-source" />
      </svg>
      <p className="viewport-label heat-sink-summary" aria-live="off">
        {describeFins(draft)} · latest tested gap {formatGap(latest.analysis.finGapM)}
        {tested ? '' : ' · shading appears after you test this design'}
      </p>
      {tested && (
        <div className="heat-sink-legend">
          <span>Fin color scale: {formatCelsius(coolK)} (air)</span>
          <svg viewBox="0 0 80 8" aria-hidden="true">
            <defs>
              <linearGradient id={`${gradientId}-legend`}>
                <stop offset={0} stopColor={shade(coolK, coolK, hotK)} />
                <stop offset={1} stopColor={shade(hotK, coolK, hotK)} />
              </linearGradient>
            </defs>
            <rect width="80" height="8" fill={`url(#${gradientId}-legend)`} />
          </svg>
          <span>{formatCelsius(hotK)} limit or hotter</span>
        </div>
      )}
      <details className="fin-profile-details">
        <summary>Fin temperatures</summary>
        <ProfileTable profile={latest.analysis.finProfile} caption={`${latest.iteration === 0 ? 'Baseline' : `Iteration ${latest.iteration}`}, latest tested design`} />
      </details>
    </div>
  )
}
