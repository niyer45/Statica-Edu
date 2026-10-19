import type { AxialDesign } from '../../geometry/axial/design'
import type { AxialAnalysis } from '../../physics/axial/types'
import type { GuidedPlan } from './plan'

// Stress and Strain I guided experiments (task 72; SSR-16, D-49). Step data only. Hints never state
// the reference design or invent numbers.

const LABELS: Readonly<Record<string, string>> = { diameterM: 'Diameter', materialId: 'Material' }

type R = { analysis: AxialAnalysis }

export const AXIAL_GUIDED_PLAN: GuidedPlan<AxialDesign, R> = Object.freeze({
  params: (d: Readonly<AxialDesign>) => ({ diameterM: d.diameterM, materialId: d.materialId }),
  label: (id: string) => LABELS[id] ?? id,
  metrics: {
    stressPa: { label: 'Axial stress', read: (r: Readonly<R>) => r.analysis.stressPa },
    elongationM: { label: 'Elongation', read: (r: Readonly<R>) => r.analysis.elongationM },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
  },
  steps: [
    {
      id: 'diameter',
      title: 'Thicken the rod',
      instruction: 'Increase only the diameter. Predict how the elongation will change, then Run Test. Watch the stress and the mass too.',
      hint: 'Stress is the load divided by the area, and the area grows with the square of the diameter. A thicker rod is also heavier.',
      focus: 'Diameter',
      unlocks: ['diameterM'],
      objective: { kind: 'change', params: ['diameterM'], direction: 'increase' },
      observe: ['stressPa', 'elongationM', 'massKg'],
    },
    {
      id: 'material',
      title: 'Change the material',
      instruction: 'Choose a different material, keeping the diameter. Predict the elongation, then test: which numbers change, and which stay the same?',
      hint: "The same load on the same area gives the same stress in any material. Stretch depends on Young's modulus, the allowable stress on the yield strength, and the mass on the density.",
      focus: 'Material',
      unlocks: ['materialId'],
      objective: { kind: 'change', params: ['materialId'], direction: 'any' },
      observe: ['elongationM', 'stressPa', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Diameter and material are both unlocked. Combine what your experiments showed and Run Test until a rod passes every check.',
      hint: 'For each material, find the diameter that keeps the stress and the stretch within their limits, then check whether that rod is light enough.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<AxialDesign, R>)
