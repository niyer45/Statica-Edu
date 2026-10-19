import type { ColumnDesign } from '../../geometry/column/design'
import { COLUMN_PARAM_LABELS } from '../../geometry/column/validate'
import type { ColumnAnalysis } from '../../physics/column/types'
import type { GuidedPlan } from './plan'

// Column Buckling I guided experiments (task 68; CBK-19, D-49). Step data only. The sequence starts
// from the solid Baseline bar: grow it (stiffer but heavy), hollow it out (much lighter for a small
// loss of stiffness), then change one tube dimension at a time (the wall adds area; the diameter
// adds stiffness), then meet every check. Steps 3 and 4 also unlock the section type so a student
// who restored a solid bar can switch back to a tube. Hints never state reference dimensions.

const LABELS: Readonly<Record<string, string>> = { section: 'Section type', ...COLUMN_PARAM_LABELS }

type R = { analysis: ColumnAnalysis }

export const COLUMN_GUIDED_PLAN: GuidedPlan<ColumnDesign, R> = Object.freeze({
  params: (d: Readonly<ColumnDesign>) => ({ ...(d.section as unknown as Record<string, number>), section: d.section.kind }),
  structural: ['section'],
  label: (id: string) => LABELS[id] ?? id,
  metrics: {
    criticalLoadN: { label: 'Critical buckling load', read: (r: Readonly<R>) => r.analysis.criticalLoadN },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
    axialStressPa: { label: 'Axial stress', read: (r: Readonly<R>) => r.analysis.axialStressPa },
    criticalLoadPerMassNPerKg: { label: 'Critical load per kilogram', read: (r: Readonly<R>) => r.analysis.criticalLoadPerMassNPerKg },
  },
  steps: [
    {
      id: 'diameter',
      title: 'Thicken the solid bar',
      instruction: 'Increase only the diameter of the solid bar. Predict how the critical buckling load will change, then Run Test.',
      hint: 'The critical load follows the second moment of area, which grows with the fourth power of the diameter. The mass grows too.',
      focus: 'Diameter',
      unlocks: ['diameterM'],
      objective: { kind: 'change', params: ['diameterM'], direction: 'increase', single: true },
      observe: ['criticalLoadN', 'massKg', 'axialStressPa'],
    },
    {
      id: 'section',
      title: 'Hollow it out',
      instruction: 'Switch between the solid bar and a hollow tube without changing anything else. Predict, then test: what happens to the critical load and the mass?',
      hint: 'Material near the center adds mass but little resistance to bending sideways. Removing it costs a little stiffness and saves a lot of mass.',
      focus: 'Section type (solid bar or hollow tube)',
      unlocks: ['section'],
      objective: { kind: 'change', params: ['section'], direction: 'any' },
      observe: ['criticalLoadN', 'massKg'],
    },
    {
      id: 'wall',
      title: 'Change only the wall',
      instruction: 'Change only the wall thickness of the tube. Predict the effect on the critical load, then Run Test.',
      hint: 'A thicker wall adds area, and so mass and strength, but its extra material sits at about the same distance from the center.',
      focus: 'Wall thickness (and the section type)',
      unlocks: ['section', 'wallThicknessM'],
      objective: { kind: 'change', params: ['wallThicknessM'], direction: 'any', single: true },
      observe: ['criticalLoadN', 'massKg', 'criticalLoadPerMassNPerKg'],
    },
    {
      id: 'outer',
      title: 'Widen the tube',
      instruction: 'Increase only the outer diameter of the tube. Compare the change in critical load with the change in mass, then Run Test.',
      hint: 'Moving the wall farther from the center raises the second moment of area much faster than the mass.',
      focus: 'Outer diameter (and the section type)',
      unlocks: ['section', 'outerDiameterM'],
      objective: { kind: 'change', params: ['outerDiameterM'], direction: 'increase', single: true },
      observe: ['criticalLoadN', 'massKg', 'criticalLoadPerMassNPerKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every parameter is unlocked. Combine what your experiments showed and Run Test until a column passes every check.',
      hint: 'Use a wide, thin-walled tube, but not so wide or thin that the model stops applying.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<ColumnDesign, R>)
