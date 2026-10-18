import { BRACKET_PARAMS, type BracketDesign } from '../../geometry/bracket/design'
import { BRACKET_PARAM_LABELS } from '../../geometry/bracket/validate'
import type { BracketAnalysis } from '../../physics/bracket/types'
import type { GuidedPlan } from './plan'

// Mounting Bracket I guided experiments (task 58). Step data only: when the bracket's
// parameters change, update the parameter ids in `steps` (and the observed metrics) here; the
// parameter list and labels follow the bracket geometry module.

type R = { analysis: BracketAnalysis }

export const BRACKET_GUIDED_PLAN: GuidedPlan<BracketDesign, R> = Object.freeze({
  params: (d: Readonly<BracketDesign>) => Object.fromEntries(BRACKET_PARAMS.map((p) => [p, d[p]])),
  label: (id: string) => (BRACKET_PARAM_LABELS as Readonly<Record<string, string>>)[id] ?? id,
  metrics: {
    peakStressPa: { label: 'Peak stress', read: (r: Readonly<R>) => r.analysis.peakStressPa },
    tipDeflectionM: { label: 'Tip deflection', read: (r: Readonly<R>) => r.analysis.tipDeflectionM },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
  },
  steps: [
    {
      id: 'fillet',
      title: 'Round the corner',
      instruction: 'Increase only the fillet radius at the step. Predict how the peak stress will change, then Run Test.',
      hint: 'A sharp inside corner concentrates stress. A larger fillet spreads the load path around it.',
      focus: 'Fillet radius',
      unlocks: ['filletRadiusM'],
      objective: { kind: 'change', params: ['filletRadiusM'], direction: 'increase' },
      observe: ['peakStressPa', 'tipDeflectionM'],
    },
    {
      id: 'arm',
      title: 'Arm depth',
      instruction: 'Change only the arm depth. Predict, then test: how do tip deflection, stress and mass respond?',
      hint: 'The arm is long, so its depth controls most of the bending stiffness, and it also sets the size of the step.',
      focus: 'Arm depth',
      unlocks: ['armDepthM'],
      objective: { kind: 'change', params: ['armDepthM'], direction: 'any' },
      observe: ['tipDeflectionM', 'peakStressPa', 'massKg'],
    },
    {
      id: 'step',
      title: 'Move the step',
      instruction: 'Change only where the step sits along the bracket. Predict where the highest stress will be, then Run Test.',
      hint: 'The bending moment falls toward the tip. Moving the step outward lowers the moment the step carries.',
      focus: 'Step location',
      unlocks: ['stepLocationM'],
      objective: { kind: 'change', params: ['stepLocationM'], direction: 'any' },
      observe: ['peakStressPa', 'tipDeflectionM', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every dimension is unlocked. Combine what your experiments showed and Run Test until a bracket passes every check.',
      hint: 'Keep the step where the moment is low with a generous fillet, then size the depths for deflection and mass.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<BracketDesign, R>)
