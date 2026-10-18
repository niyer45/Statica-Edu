import { BRACKET_PARAMS, type BracketDesign } from '../../geometry/bracket/design'
import { BRACKET_PARAM_LABELS } from '../../geometry/bracket/validate'
import type { BracketAnalysis } from '../../physics/bracket/types'
import type { GuidedPlan } from './plan'

// Mounting Bracket I guided experiments (task 58, task 55 L-bracket). Step data only: when the
// bracket's parameters change, update the parameter ids in `steps` (and the observed metrics)
// here; the parameter list and labels follow the bracket geometry module. The sequence starts
// from the thin, wide, sharp-bent Baseline: thickness, bend radius and flange height can each
// grow, and the width is trimmed only in the open final step.

type R = { analysis: BracketAnalysis }

export const BRACKET_GUIDED_PLAN: GuidedPlan<BracketDesign, R> = Object.freeze({
  params: (d: Readonly<BracketDesign>) => Object.fromEntries(BRACKET_PARAMS.map((p) => [p, d[p]])),
  label: (id: string) => (BRACKET_PARAM_LABELS as Readonly<Record<string, string>>)[id] ?? id,
  metrics: {
    bendStressPa: { label: 'Bend stress', read: (r: Readonly<R>) => r.analysis.bendStressPa },
    deflectionM: { label: 'Deflection', read: (r: Readonly<R>) => r.analysis.deflectionM },
    boltTensionN: { label: 'Bolt tension', read: (r: Readonly<R>) => r.analysis.boltTensionN },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
  },
  steps: [
    {
      id: 'thickness',
      title: 'Thicken the plate',
      instruction: 'Increase only the plate thickness. Predict how the bend stress will change, then Run Test.',
      hint: 'Bending stress falls quickly as the plate gets thicker, and the bracket stiffens, but every millimetre adds mass along the whole bracket.',
      focus: 'Thickness',
      unlocks: ['thicknessM'],
      objective: { kind: 'change', params: ['thicknessM'], direction: 'increase' },
      observe: ['bendStressPa', 'deflectionM', 'massKg'],
    },
    {
      id: 'radius',
      title: 'Open up the bend',
      instruction: 'Increase only the inner bend radius. Predict what happens to the stress at the bend, then Run Test.',
      hint: 'A tight inside corner crowds stress toward the inner surface of the bend. A gentler radius spreads it out at almost no cost in mass.',
      focus: 'Inner bend radius',
      unlocks: ['innerRadiusM'],
      objective: { kind: 'change', params: ['innerRadiusM'], direction: 'increase' },
      observe: ['bendStressPa', 'massKg'],
    },
    {
      id: 'flange',
      title: 'Taller flange',
      instruction: 'Increase only the flange height. Predict how the bolt tension will change, then Run Test.',
      hint: 'A taller flange gives the bolts more leverage against the overturning moment, but it lets the bracket rotate more and adds mass.',
      focus: 'Flange height',
      unlocks: ['flangeHeightM'],
      objective: { kind: 'change', params: ['flangeHeightM'], direction: 'increase' },
      observe: ['boltTensionN', 'deflectionM', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every dimension is unlocked, including the width. Combine what your experiments showed and Run Test until a bracket passes every check.',
      hint: 'Size thickness and radius for the bend stress, the flange for the bolts, then trim the width to bring the mass down.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<BracketDesign, R>)
