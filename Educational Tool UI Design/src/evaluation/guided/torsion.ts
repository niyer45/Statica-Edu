import type { TorsionDesign } from '../../geometry/torsion/design'
import type { TorsionAnalysis } from '../../physics/torsion/types'
import type { GuidedPlan } from './plan'

// Torsion Shaft I guided experiments (task 58). Step data only.

const LABELS: Readonly<Record<string, string>> = {
  section: 'Shaft type',
  diameterM: 'Diameter',
  outerDiameterM: 'Outer diameter',
  innerDiameterM: 'Inner diameter',
}
const OUTER = ['diameterM', 'outerDiameterM'] as const
const DIAMETERS = ['diameterM', 'outerDiameterM', 'innerDiameterM'] as const

type R = { analysis: TorsionAnalysis }

export const TORSION_GUIDED_PLAN: GuidedPlan<TorsionDesign, R> = Object.freeze({
  params: (d: Readonly<TorsionDesign>) => ({ ...(d.section as unknown as Record<string, number>), section: d.section.kind }),
  structural: ['section'],
  // Clamp-mode coupled shrink of the bore (geometry/torsion/edit.ts).
  coupled: { outerDiameterM: ['innerDiameterM'] },
  label: (id: string) => LABELS[id] ?? id,
  metrics: {
    twistRad: { label: 'Twist angle', read: (r: Readonly<R>) => r.analysis.twistRad },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
    maxShearStressPa: { label: 'Shear stress', read: (r: Readonly<R>) => r.analysis.maxShearStressPa },
  },
  steps: [
    {
      id: 'diameter',
      title: 'Thicken the shaft',
      instruction: 'Increase only the outside diameter. Predict how the twist angle will change, then Run Test.',
      hint: 'Torsional stiffness depends on the polar moment, which grows very quickly with diameter. Watch the mass as well.',
      focus: 'Outside diameter',
      unlocks: OUTER,
      objective: { kind: 'change', params: OUTER, direction: 'increase', single: true },
      observe: ['twistRad', 'massKg'],
    },
    {
      id: 'section',
      title: 'Solid or hollow',
      instruction: 'Switch between a solid shaft and a hollow tube without changing anything else. Predict, then test: what happens to twist and mass?',
      hint: 'Material near the centre carries little torque. Removing it saves mass while costing only a little stiffness.',
      focus: 'Shaft type (solid or hollow)',
      unlocks: ['section'],
      objective: { kind: 'change', params: ['section'], direction: 'any' },
      observe: ['twistRad', 'massKg'],
    },
    {
      id: 'tune',
      title: 'Tune one diameter',
      instruction: 'Change exactly one diameter. Predict the effect on twist and mass, then Run Test.',
      hint: 'For a tube, a larger outer diameter adds stiffness fast; a larger inner diameter removes mass from where it matters least.',
      focus: 'Any one diameter',
      unlocks: DIAMETERS,
      objective: { kind: 'change', params: DIAMETERS, direction: 'any', single: true },
      observe: ['twistRad', 'massKg', 'maxShearStressPa'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every parameter is unlocked. Combine what your experiments showed and Run Test until a shaft passes every check.',
      hint: 'Stay inside the packaging limit on the outer diameter, then trade inner diameter against mass.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<TorsionDesign, R>)
