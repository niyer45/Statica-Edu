import type { HeatSinkDesign } from '../../geometry/heatSink/design'
import type { HeatSinkAnalysis } from '../../physics/heatSink/types'
import type { GuidedPlan } from './plan'

// Heat Sink I guided experiments (task 58). Step data only.

const LABELS: Readonly<Record<string, string>> = { finCount: 'Fin count', finThicknessM: 'Fin thickness', finHeightM: 'Fin height' }

type R = { analysis: HeatSinkAnalysis }

export const HEAT_SINK_GUIDED_PLAN: GuidedPlan<HeatSinkDesign, R> = Object.freeze({
  params: (d: Readonly<HeatSinkDesign>) => ({ finCount: d.finCount, finThicknessM: d.finThicknessM, finHeightM: d.finHeightM }),
  label: (id: string) => LABELS[id] ?? id,
  metrics: {
    baseTemperatureK: { label: 'Base temperature', read: (r: Readonly<R>) => r.analysis.baseTemperatureK },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
    finEfficiency: { label: 'Fin efficiency', read: (r: Readonly<R>) => r.analysis.finEfficiency },
    finGapM: { label: 'Gap between fins', read: (r: Readonly<R>) => r.analysis.finGapM },
  },
  steps: [
    {
      id: 'count',
      title: 'More fins',
      instruction: 'Add fins without changing their size. Predict how the base temperature will change, then Run Test.',
      hint: 'More fins mean more surface area, but the gaps between them shrink. Air needs room to flow, so check the gap limit.',
      focus: 'Fin count',
      unlocks: ['finCount'],
      objective: { kind: 'change', params: ['finCount'], direction: 'increase' },
      observe: ['baseTemperatureK', 'massKg', 'finGapM'],
    },
    {
      id: 'thickness',
      title: 'Thinner fins',
      instruction: 'Make the fins thinner without changing their number or height. Predict, then test: what happens to mass, temperature and the gaps?',
      hint: 'Thin fins weigh less and leave wider gaps, but conduct heat to their tips less well. Watch the fin efficiency.',
      focus: 'Fin thickness',
      unlocks: ['finThicknessM'],
      objective: { kind: 'change', params: ['finThicknessM'], direction: 'decrease' },
      observe: ['massKg', 'baseTemperatureK', 'finEfficiency'],
    },
    {
      id: 'height',
      title: 'Fin height',
      instruction: 'Change only the fin height. Predict the effect on base temperature and mass, then Run Test.',
      hint: 'Taller fins add area, but their tips run cooler and contribute less, and the height has a packaging limit.',
      focus: 'Fin height',
      unlocks: ['finHeightM'],
      objective: { kind: 'change', params: ['finHeightM'], direction: 'any' },
      observe: ['baseTemperatureK', 'massKg', 'finEfficiency'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every fin parameter is unlocked. Combine what your experiments showed and Run Test until a heat sink passes every check.',
      hint: 'Balance count and thickness for area and gap, keep the height inside its limit, then check the mass.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<HeatSinkDesign, R>)
