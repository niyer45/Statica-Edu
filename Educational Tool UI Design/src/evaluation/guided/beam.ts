import { PARAM_LABELS, type SectionParam } from '../../geometry/params'
import type { BeamDesign } from '../../geometry/sections'
import type { Analysis } from '../../physics/types'
import type { GuidedPlan } from './plan'

// Cantilever Beam I guided experiments (task 58). Step data only: swap this file to change the
// sequence. Parameter ids are the section kind ('section'), 'orientationDeg' and the section's
// own dimension keys. The sequence starts from the Baseline, a solid Ø31 mm circle that is too
// flexible and too heavy (D-47 amendment): growing the circle trades mass for stiffness, so the
// student then tries a shape that places material away from the centre and tunes it.

const DIMENSIONS = ['diameterM', 'outerDiameterM', 'innerDiameterM', 'widthM', 'heightM', 'flangeThicknessM', 'webThicknessM'] as const

export const BEAM_GUIDED_PLAN: GuidedPlan<BeamDesign, { analysis: Analysis }> = Object.freeze({
  params: (d: Readonly<BeamDesign>) => ({ ...(d.section as unknown as Record<string, number>), section: d.section.kind, orientationDeg: d.orientationDeg }),
  structural: ['section'],
  // Clamp-mode coupled shrinks (geometry/clamp.ts).
  coupled: { outerDiameterM: ['innerDiameterM'], heightM: ['flangeThicknessM'], widthM: ['webThicknessM'] },
  label: (id: string) => (id === 'section' ? 'Section shape' : id === 'orientationDeg' ? 'Section orientation' : (PARAM_LABELS[id as SectionParam] ?? id)),
  metrics: {
    tipDeflectionM: { label: 'Tip deflection', read: (r: Readonly<{ analysis: Analysis }>) => r.analysis.tipDeflectionM },
    massKg: { label: 'Mass', read: (r: Readonly<{ analysis: Analysis }>) => r.analysis.massKg },
    nominalMaxStressPa: { label: 'Bending stress', read: (r: Readonly<{ analysis: Analysis }>) => r.analysis.nominalMaxStressPa },
  },
  steps: [
    {
      id: 'diameter',
      title: 'Grow the circle',
      instruction: 'Increase only the diameter of the solid circle. Predict how tip deflection will change, then Run Test.',
      hint: 'A wider circle is much stiffer, but every extra millimetre adds mass. Watch whether deflection and mass can both be met this way.',
      focus: 'Diameter',
      unlocks: ['diameterM'],
      objective: { kind: 'change', params: ['diameterM'], direction: 'increase' },
      observe: ['tipDeflectionM', 'massKg', 'nominalMaxStressPa'],
    },
    {
      id: 'shape',
      title: 'Try another shape',
      instruction: 'Switch to a different section shape. Predict, then test: does the new shape use its material better or worse?',
      hint: 'Shapes that place material far from the centre, such as a tube or an I-section, usually stiffen more per kilogram than solid ones.',
      focus: 'Section shape',
      unlocks: ['section'],
      objective: { kind: 'change', params: ['section'], direction: 'any' },
      observe: ['tipDeflectionM', 'massKg'],
    },
    {
      id: 'tune',
      title: 'Tune one dimension',
      instruction: 'Change exactly one dimension of the section, or its orientation. Predict the effect on deflection and mass, then Run Test.',
      hint: 'One change per test keeps cause and effect clear. Material far from the centre (flanges, height) adds stiffness fastest; check the envelope limit too.',
      focus: 'Any one dimension or the orientation',
      unlocks: [...DIMENSIONS, 'orientationDeg'],
      objective: { kind: 'change', params: [...DIMENSIONS, 'orientationDeg'], direction: 'any', single: true },
      observe: ['tipDeflectionM', 'massKg', 'nominalMaxStressPa'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every parameter is unlocked. Combine what your experiments showed and Run Test until a design passes every check.',
      hint: 'Fix the requirement with the largest miss first, then trim mass without losing the other checks.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<BeamDesign, { analysis: Analysis }>)
