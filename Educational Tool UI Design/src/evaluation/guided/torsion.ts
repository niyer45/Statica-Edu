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
// Task 71 (D-61, introductory): the experiments follow the one idea of the challenge, the polar
// moment J. Hollow the solid shaft first, then move the tube's material outward, then combine.
const TUBE = ['outerDiameterM', 'innerDiameterM'] as const

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
      // Id kept from version 2 (it names the section switch); the step now comes first.
      id: 'section',
      title: 'Hollow it out',
      instruction: 'Switch the solid shaft to a hollow tube with the same outside diameter. Predict how the twist angle will change, then Run Test.',
      hint: 'Material near the centre carries little of the torque. Removing it cuts the mass by much more than it costs in stiffness.',
      focus: 'Shaft type (solid or hollow)',
      unlocks: ['section'],
      objective: { kind: 'change', params: ['section'], direction: 'any' },
      observe: ['twistRad', 'massKg'],
    },
    {
      id: 'outward',
      title: 'Move the material outward',
      instruction: 'Increase the outer diameter of the tube; you may increase the inner diameter as well to keep the wall thin. Predict the twist, then Run Test.',
      hint: 'Stiffness depends on the polar moment J, which grows with the fourth power of the diameter: the same steel further from the centre resists twist much more.',
      focus: 'Outer diameter (inner diameter optional)',
      unlocks: TUBE,
      // The inner diameter is a coupled follower of the outer one, so a test that grows both
      // counts as one outward change.
      objective: { kind: 'change', params: ['outerDiameterM'], direction: 'increase' },
      observe: ['twistRad', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every parameter is unlocked. Combine what your experiments showed and Run Test until a shaft passes every check.',
      hint: 'Keep the outer diameter within the packaging limit, then adjust the inner diameter: a smaller bore adds stiffness, a larger bore saves mass.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<TorsionDesign, R>)
