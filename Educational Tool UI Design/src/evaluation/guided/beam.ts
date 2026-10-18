import { PARAM_LABELS, type SectionParam } from '../../geometry/params'
import type { BeamDesign } from '../../geometry/sections'
import type { Analysis } from '../../physics/types'
import type { GuidedPlan } from './plan'

// Cantilever Beam I guided experiments (task 58). Step data only: swap this file to change the
// sequence. Parameter ids are the section kind ('section'), 'orientationDeg' and the section's
// own dimension keys, so a step stays valid whatever shape the Baseline uses.

const DEPTH = ['diameterM', 'outerDiameterM', 'heightM'] as const
const DIMENSIONS = ['diameterM', 'outerDiameterM', 'innerDiameterM', 'widthM', 'heightM', 'flangeThicknessM', 'webThicknessM', 'orientationDeg'] as const

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
      id: 'depth',
      title: 'Make it deeper',
      instruction: 'Increase only the depth of the section (its diameter or height). Predict how tip deflection will change, then Run Test.',
      hint: 'Bending stiffness grows very quickly with depth, but mass grows too. Compare both numbers with the Baseline.',
      focus: 'Depth (diameter or height)',
      unlocks: DEPTH,
      objective: { kind: 'change', params: DEPTH, direction: 'increase', single: true },
      observe: ['tipDeflectionM', 'massKg'],
    },
    {
      id: 'shape',
      title: 'Try another shape',
      instruction: 'Switch to a different section shape without touching any dimension. Predict, then test: does the new shape use its material better?',
      hint: 'Shapes that place material far from the centre, such as a tube or an I-section, usually stiffen more per kilogram.',
      focus: 'Section shape',
      unlocks: ['section'],
      objective: { kind: 'change', params: ['section'], direction: 'any' },
      observe: ['tipDeflectionM', 'massKg'],
    },
    {
      id: 'tune',
      title: 'Tune one dimension',
      instruction: 'Change exactly one dimension of your section (or its orientation). Predict the effect on deflection and mass, then Run Test.',
      hint: 'One change per test keeps cause and effect clear. A rectangle or I-section stood on its edge is much stiffer than one lying flat.',
      focus: 'Any one dimension or the orientation',
      unlocks: DIMENSIONS,
      objective: { kind: 'change', params: DIMENSIONS, direction: 'any', single: true },
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
