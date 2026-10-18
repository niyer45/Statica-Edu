import { PARAM_LABELS, type SectionParam } from '../../geometry/params'
import type { BeamDesign } from '../../geometry/sections'
import type { Analysis } from '../../physics/types'
import type { GuidedPlan } from './plan'

// Cantilever Beam I guided experiments (task 58). Step data only: swap this file to change the
// sequence. Parameter ids are the section kind ('section'), 'orientationDeg' and the section's
// own dimension keys. The sequence starts from the task 59 Baseline, an I-section lying on its
// side (90°), so the first experiment stands it upright.

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
      id: 'upright',
      title: 'Stand it upright',
      instruction: 'Change only the section orientation, keeping every dimension. Predict how tip deflection will change, then Run Test.',
      hint: 'The same material resists bending far better when the tall side of the section lines up with the load. Mass does not change.',
      focus: 'Section orientation',
      unlocks: ['orientationDeg'],
      objective: { kind: 'change', params: ['orientationDeg'], direction: 'any' },
      observe: ['tipDeflectionM', 'nominalMaxStressPa', 'massKg'],
    },
    {
      id: 'tune',
      title: 'Tune one dimension',
      instruction: 'Change exactly one dimension of the section. Predict the effect on deflection and mass, then Run Test.',
      hint: 'One change per test keeps cause and effect clear. Material far from the centre (flanges, height) adds stiffness fastest; check the envelope limit too.',
      focus: 'Any one dimension',
      unlocks: DIMENSIONS,
      objective: { kind: 'change', params: DIMENSIONS, direction: 'any', single: true },
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
