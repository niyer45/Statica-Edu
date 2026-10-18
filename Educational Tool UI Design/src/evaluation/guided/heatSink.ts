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
      id: 'height',
      title: 'Taller fins',
      instruction: 'Increase only the fin height. Predict how the base temperature will change, then Run Test.',
      hint: 'Taller fins add surface area, but their tips run cooler and contribute less. Watch the fin efficiency and the mass.',
      focus: 'Fin height',
      unlocks: ['finHeightM'],
      objective: { kind: 'change', params: ['finHeightM'], direction: 'increase' },
      observe: ['baseTemperatureK', 'massKg', 'finEfficiency'],
    },
    {
      id: 'count',
      title: 'More fins',
      instruction: 'Add fins without changing their size. Predict the effect on base temperature, then test.',
      hint: 'More fins mean more area, but the gaps between them shrink. Air needs room to flow, so check the gap limit.',
      focus: 'Fin count',
      unlocks: ['finCount'],
      objective: { kind: 'change', params: ['finCount'], direction: 'increase' },
      observe: ['baseTemperatureK', 'massKg', 'finGapM'],
    },
    {
      id: 'thickness',
      title: 'Fin thickness',
      instruction: 'Change only the fin thickness. Predict, then test: is a thicker or thinner fin better here?',
      hint: 'Thicker fins conduct heat to their tips better but weigh more and narrow the gaps.',
      focus: 'Fin thickness',
      unlocks: ['finThicknessM'],
      objective: { kind: 'change', params: ['finThicknessM'], direction: 'any' },
      observe: ['baseTemperatureK', 'massKg', 'finEfficiency'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every fin parameter is unlocked. Combine what your experiments showed and Run Test until a heat sink passes every check.',
      hint: 'Get the temperature down first with height and count, then trim thickness to recover mass and gap.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<HeatSinkDesign, R>)
