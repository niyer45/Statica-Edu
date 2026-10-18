import type { HeatSinkChallenge } from '../../../challenge/heatSink/types'
import type { HeatSinkMetricId } from '../../../evaluation/heatSink/metrics'
import type { HeatSinkConstraintId } from '../../../evaluation/heatSink/types'
import type { HeatSinkDesign } from '../../../geometry/heatSink/design'
import type { HeatSinkAction, HeatSinkSession } from '../../../state/heatSinkModel'
import { formatMm, kelvinToCelsius, kgToG, m2ToCm2, UNAVAILABLE_PLACEHOLDER } from '../../../units/units'
import { useModelStore } from '../../state/store'

// Shared helpers for the Heat Sink I UI (task 48.3). Display formatting only: every value shown
// comes from a stored heat sink analysis/evaluation or the challenge config. Absolute
// temperatures are stored in kelvin and shown in °C; temperature differences stay in kelvin.

export type StudentHeatSinkChallenge = Omit<HeatSinkChallenge, 'referenceDesign'>

/** The active heat sink store; the model UI registry guarantees the active model is the heat sink. */
export const useHeatSinkStore = () => useModelStore<HeatSinkSession, HeatSinkAction, StudentHeatSinkChallenge>()

const finite = (v: number, text: (v: number) => string) => (Number.isFinite(v) ? text(v) : UNAVAILABLE_PLACEHOLDER)

/** Stored absolute temperature (K) as °C, one decimal. */
export const formatCelsius = (k: number) => finite(k, (v) => `${kelvinToCelsius(v).toFixed(1)} °C`)
/** Temperature difference (K), two decimals. */
export const formatKelvinDifference = (k: number) => finite(k, (v) => `${v.toFixed(2)} K`)
/** Mass (kg) as grams, one decimal. */
export const formatGrams = (kg: number) => finite(kg, (v) => `${kgToG(v).toFixed(1)} g`)
/** Fin gap (m) as millimetres, two decimals. */
export const formatGap = (m: number) => `${formatMm(m, 2)} mm`
/** Fin thickness or height (m) as millimetres, one decimal. */
export const formatLength = (m: number) => `${formatMm(m, 1)} mm`
/** A stored ratio (efficiency, heat share) as a percentage, one decimal. */
export const formatPercent = (ratio: number) => finite(ratio, (v) => `${(v * 100).toFixed(1)}%`)
/** Area (m²) as cm², one decimal. */
export const formatArea = (m2: number) => finite(m2, (v) => `${m2ToCm2(v).toFixed(1)} cm²`)
/** Thermal resistance (K/W), three decimals. */
export const formatResistance = (r: number) => finite(r, (v) => `${v.toFixed(3)} K/W`)

/** Display text for a stored constraint value or limit, by constraint id. */
export function formatConstraint(id: HeatSinkConstraintId, value: number): string {
  if (id === 'baseTemperature') return formatCelsius(value)
  if (id === 'mass') return formatGrams(value)
  if (id === 'finHeight') return formatLength(value)
  if (id === 'finGap') return formatGap(value)
  return ''
}

/** A limit with its direction: upper bounds are maxima, the fin gap is a minimum. */
export function formatLimit(c: { id: HeatSinkConstraintId; bound: 'upper' | 'lower'; limit: number }): string {
  return `${c.bound === 'lower' ? 'min' : 'max'} ${formatConstraint(c.id, c.limit)}`
}

/** Display of a stored metric value and of a difference between two stored values. */
export interface MetricDisplay {
  value(v: number): string
  delta(d: number): string
}

const pts = (d: number) => `${(d * 100).toFixed(1)} points`

export const METRIC_DISPLAY: Readonly<Record<HeatSinkMetricId, MetricDisplay>> = {
  baseTemperatureRiseK: { value: formatKelvinDifference, delta: formatKelvinDifference },
  // A difference between two absolute temperatures is a kelvin difference.
  baseTemperatureK: { value: formatCelsius, delta: formatKelvinDifference },
  massKg: { value: formatGrams, delta: formatGrams },
  finEfficiency: { value: formatPercent, delta: pts },
  overallEfficiency: { value: formatPercent, delta: pts },
  totalAreaM2: { value: formatArea, delta: formatArea },
  effectiveAreaM2: { value: formatArea, delta: formatArea },
  finGapM: { value: formatGap, delta: formatGap },
  finHeightM: { value: formatLength, delta: formatLength },
  finHeatShare: { value: formatPercent, delta: pts },
  totalResistanceKPerW: { value: formatResistance, delta: formatResistance },
}

/** Signed difference text; the magnitude uses the metric's own formatting. */
export function signedDelta(d: number, display: MetricDisplay): string {
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${display.delta(Math.abs(d))}`
}

/** One-line description of a fin array design. */
export function describeFins(d: Pick<HeatSinkDesign, 'finCount' | 'finThicknessM' | 'finHeightM'>): string {
  return `${d.finCount} fins · ${formatMm(d.finThicknessM, 1)} × ${formatMm(d.finHeightM, 1)} mm`
}

export const FIN_PARAM_LABELS: Readonly<Record<string, string>> = {
  finCount: 'Fin count',
  finThicknessM: 'Fin thickness',
  finHeightM: 'Fin height',
}

/** Student-facing name of a stored fin profile sample position (x/H). */
export function positionLabel(xOverH: number): string {
  if (xOverH === 0) return 'Root'
  if (xOverH === 1) return 'Tip'
  return `${Math.round(xOverH * 100)}% of fin height`
}
