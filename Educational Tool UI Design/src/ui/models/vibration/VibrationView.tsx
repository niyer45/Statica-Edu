import { useId, useMemo } from 'react'
import { transmissibilityCurve } from '../../../physics/vibration/response'
import { formatHz, formatPercent, mToMm } from '../../../units/units'
import { formatVibration, materialName, useVibrationStore } from './shared'
import VibrationGoal from './VibrationGoal'
import './vibration.css'

// Vibration design view (task 50.3; VIB-14, MM-22). Main-bundle SVG with no Three.js dependency,
// so it is also the non-WebGL view. Two static parts, both for the LATEST TESTED design:
//   1. A spring–damper–mass schematic on a base. The only display offset is a sag drawn from the
//      stored static deflection, capped at the configured maximum. No animation or motion.
//   2. A steady-state frequency-response chart of transmissibility against frequency, sampled
//      from the pure physics response function at the stored natural frequency and damping ratio
//      (display only, never persisted). It marks the operating band, both transmissibility
//      limits, the natural frequency and the worst in-band and peak points, using patterns,
//      marker shapes and text rather than colour alone.
// Every labelled number comes from the stored analysis or the challenge config. The goal card
// (task 56) sits above the figures; the table below the chart (collapsed, task 56) is the text
// equivalent.

/** Chart frame (SVG user units). */
const W = 420
const H = 230
const L = 46
const R = 12
const T = 14
const B = 34
/** Log transmissibility axis, decades 10⁻³…10². */
const Y_MIN_EXP = -3
const Y_MAX_EXP = 2
const DECADES = [0.001, 0.01, 0.1, 1, 10, 100]
/** Schematic: display pixels per millimetre of stored sag, before the configured cap. */
const SAG_PX_PER_MM = 3

const fmt2 = (n: number) => n.toFixed(2)

export default function VibrationView() {
  const { state, challenge: ch } = useVibrationStore()
  const rawId = useId()
  const hatch = `vib-band-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const latest = state.history[state.history.length - 1]!
  const a = latest.analysis
  const limits = ch.constraints
  const band = ch.excitation.operatingBandHz
  const maxHz = ch.visualization.chartMaxHz
  const curve = useMemo(
    () => transmissibilityCurve(a.naturalFrequencyHz, a.dampingRatio, maxHz, ch.visualization.chartSamples),
    [a.naturalFrequencyHz, a.dampingRatio, maxHz, ch.visualization.chartSamples],
  )
  const x = (hz: number) => L + (Math.min(Math.max(hz, 0), maxHz) / maxHz) * (W - L - R)
  const y = (tr: number) => {
    const e = Math.min(Math.max(Math.log10(Math.max(tr, 1e-12)), Y_MIN_EXP), Y_MAX_EXP)
    return T + ((Y_MAX_EXP - e) / (Y_MAX_EXP - Y_MIN_EXP)) * (H - T - B)
  }
  const path = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt2(x(p.frequencyHz))} ${fmt2(y(p.transmissibility))}`).join(' ')
  const xTicks = Array.from({ length: Math.floor(maxHz / 10) + 1 }, (_, i) => i * 10)
  const fnX = x(a.naturalFrequencyHz)
  const worst = { x: x(a.worstInBandFrequencyHz), y: y(a.worstInBandTransmissibility) }
  const peak = { x: x(a.peakTransmissibilityFrequencyHz), y: y(a.peakTransmissibility) }
  const fnPosition =
    a.naturalFrequencyHz < band.minHz ? 'below the operating band' : a.naturalFrequencyHz > band.maxHz ? 'above the operating band' : 'inside the operating band'

  // Schematic geometry: base at the bottom, mass block above a spring and damper in parallel.
  const sagMm = mToMm(a.staticDeflectionM)
  const sagPx = Math.min(sagMm * SAG_PX_PER_MM, ch.visualization.maxVisualSagPx)
  const baseY = 200
  const massBottom = 96 + sagPx
  const coils = 6
  const springTop = massBottom
  const springLen = baseY - springTop
  const spring = [`M40 ${springTop}`, `L40 ${springTop + 8}`]
  for (let i = 0; i < coils; i++) {
    const y0 = springTop + 8 + ((springLen - 16) * (i + 0.5)) / coils
    spring.push(`L${i % 2 === 0 ? 28 : 52} ${fmt2(y0)}`)
  }
  spring.push(`L40 ${baseY - 8}`, `L40 ${baseY}`)
  const pistonY = springTop + springLen / 2

  return (
    <div className="vibration-view">
      <VibrationGoal />
      <div className="vibration-figures">
        <svg
          viewBox="0 0 140 230"
          role="img"
          aria-label={`Static schematic: component mass on a ${materialName(ch, latest.designSnapshot.materialId)} mount, spring and damper in parallel on a vibrating base`}
          className="vibration-schematic"
        >
          <defs>
            <pattern id={`${hatch}-ground`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="vib-hatch-line" />
            </pattern>
          </defs>
          <rect x={18} y={massBottom - 56} width={104} height={56} rx={3} className="vib-mass" />
          <path d={spring.join(' ')} className="vib-spring" />
          <line x1={100} y1={massBottom} x2={100} y2={pistonY - 6} className="vib-damper" />
          <rect x={88} y={pistonY - 2} width={24} height={30} className="vib-damper-cylinder" />
          <line x1={92} y1={pistonY - 6} x2={108} y2={pistonY - 6} className="vib-damper" />
          <line x1={100} y1={pistonY + 28} x2={100} y2={baseY} className="vib-damper" />
          <rect x={8} y={baseY} width={124} height={8} className="vib-base" />
          <rect x={8} y={baseY + 8} width={124} height={12} fill={`url(#${hatch}-ground)`} className="vib-ground" />
        </svg>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${hatch}-title`} className="vibration-chart">
          <title id={`${hatch}-title`}>
            {`Steady-state frequency response of the latest tested mount: transmissibility from 0 to ${maxHz} Hz on a logarithmic scale, with the operating band, limits, natural frequency, worst in-band point and peak marked. Values are listed in the table below.`}
          </title>
          <defs>
            <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="vib-band-hatch" />
            </pattern>
          </defs>
          <rect x={x(band.minHz)} y={T} width={x(band.maxHz) - x(band.minHz)} height={H - T - B} fill={`url(#${hatch})`} className="vib-band" />
          <text x={(x(band.minHz) + x(band.maxHz)) / 2} y={T + 10} textAnchor="middle" className="vib-chart-label">
            Operating band
          </text>
          {DECADES.map((d) => (
            <g key={d}>
              <line x1={L} x2={W - R} y1={y(d)} y2={y(d)} className="vib-grid" />
              <text x={L - 4} y={y(d) + 3} textAnchor="end" className="vib-axis-text">
                {d}
              </text>
            </g>
          ))}
          {xTicks.map((hz) => (
            <text key={hz} x={x(hz)} y={H - B + 12} textAnchor="middle" className="vib-axis-text">
              {hz}
            </text>
          ))}
          <line x1={L} x2={L} y1={T} y2={H - B} className="vib-axis" />
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="vib-axis" />
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="vib-axis-text">
            Frequency (Hz)
          </text>
          <text x={10} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 10 ${(T + H - B) / 2})`} className="vib-axis-text">
            Transmissibility
          </text>
          <line x1={L} x2={W - R} y1={y(limits.maxWorstInBandTransmissibility)} y2={y(limits.maxWorstInBandTransmissibility)} className="vib-limit vib-limit-band" />
          <text x={W - R - 2} y={y(limits.maxWorstInBandTransmissibility) - 3} textAnchor="end" className="vib-chart-label">
            Band limit {formatVibration(limits.maxWorstInBandTransmissibility, 'ratio')}
          </text>
          <line x1={L} x2={W - R} y1={y(limits.maxPeakTransmissibility)} y2={y(limits.maxPeakTransmissibility)} className="vib-limit vib-limit-peak" />
          <text x={W - R - 2} y={y(limits.maxPeakTransmissibility) - 3} textAnchor="end" className="vib-chart-label">
            Peak limit {formatVibration(limits.maxPeakTransmissibility, 'ratio')}
          </text>
          <line x1={fnX} x2={fnX} y1={T} y2={H - B} className="vib-fn" />
          <text x={fnX + 3} y={H - B - 4} className="vib-chart-label">
            fₙ {formatHz(a.naturalFrequencyHz)} Hz
          </text>
          <path d={path} className="vib-curve" />
          <path d={`M${fmt2(peak.x)} ${fmt2(peak.y - 6)} L${fmt2(peak.x + 5)} ${fmt2(peak.y + 3)} L${fmt2(peak.x - 5)} ${fmt2(peak.y + 3)} Z`} className="vib-marker vib-marker-peak" />
          <text x={peak.x + 7} y={peak.y - 4} className="vib-chart-label">
            Peak {formatVibration(a.peakTransmissibility, 'ratio')}
          </text>
          <rect x={worst.x - 4} y={worst.y - 4} width={8} height={8} className="vib-marker vib-marker-worst" />
          <text x={worst.x + 7} y={worst.y + 12} className="vib-chart-label">
            Worst in band {formatVibration(a.worstInBandTransmissibility, 'ratio')}
          </text>
        </svg>
      </div>
      {sagPx < sagMm * SAG_PX_PER_MM && <p className="vibration-note">Drawn sag is capped; the stored sag is {formatVibration(a.staticDeflectionM, 'm')}.</p>}
      <details className="vibration-more">
        <summary>All response values</summary>
        <p className="vibration-summary">
          Latest test: {materialName(ch, latest.designSnapshot.materialId)} mount · {formatVibration(a.stiffnessNPerM, 'N/m')} · natural frequency{' '}
          {formatVibration(a.naturalFrequencyHz, 'Hz')}, {fnPosition} · sag {formatVibration(a.staticDeflectionM, 'm')}. Steady-state response at each frequency,
          not motion over time.
        </p>
        <div className="vibration-table">
          <table aria-label="Frequency response values">
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Latest tested value</th>
                <th scope="col">Limit or reference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Operating band</th>
                <td>
                  {formatHz(band.minHz)}–{formatHz(band.maxHz)} Hz
                </td>
                <td>Fixed</td>
              </tr>
              <tr>
                <th scope="row">Natural frequency fₙ</th>
                <td>{formatVibration(a.naturalFrequencyHz, 'Hz')}</td>
                <td>{fnPosition}</td>
              </tr>
              <tr>
                <th scope="row">Frequency ratio at band minimum</th>
                <td>{formatVibration(a.frequencyRatioAtBandMin, 'ratio')}</td>
                <td>Isolation needs more than √2</td>
              </tr>
              <tr>
                <th scope="row">Worst vibration transmitted in the band</th>
                <td>
                  {formatVibration(a.worstInBandTransmissibility, 'ratio')} at {formatVibration(a.worstInBandFrequencyHz, 'Hz')}
                </td>
                <td>{formatVibration(limits.maxWorstInBandTransmissibility, 'ratio')}</td>
              </tr>
              <tr>
                <th scope="row">Isolation efficiency at that frequency</th>
                <td>{a.isolationEfficiency === undefined ? 'None: the band is amplified' : `${formatPercent(a.isolationEfficiency, 1)} %`}</td>
                <td>—</td>
              </tr>
              <tr>
                <th scope="row">Peak transmissibility (resonance)</th>
                <td>
                  {formatVibration(a.peakTransmissibility, 'ratio')} at {formatVibration(a.peakTransmissibilityFrequencyHz, 'Hz')}
                </td>
                <td>{formatVibration(limits.maxPeakTransmissibility, 'ratio')}</td>
              </tr>
              <tr>
                <th scope="row">Static deflection (sag)</th>
                <td>{formatVibration(a.staticDeflectionM, 'm')}</td>
                <td>{formatVibration(limits.maxStaticDeflectionM, 'm')}</td>
              </tr>
              <tr>
                <th scope="row">Peak relative displacement</th>
                <td>
                  {formatVibration(a.peakRelativeDisplacementM, 'm')} at {formatVibration(a.peakRelativeDisplacementFrequencyHz, 'Hz')}
                </td>
                <td>{formatVibration(limits.maxRelativeDisplacementM, 'm')}</td>
              </tr>
              <tr>
                <th scope="row">Damping</th>
                <td>
                  ζ {formatVibration(a.dampingRatio, 'zeta')} · c {formatVibration(a.dampingCoefficientNsPerM, 'Ns/m')}
                </td>
                <td>{materialName(ch, latest.designSnapshot.materialId)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
