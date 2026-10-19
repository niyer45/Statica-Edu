import { FATIGUE_PARAMS, type FatigueDesign } from '../../geometry/fatigue/design'
import { FATIGUE_PARAM_LABELS } from '../../geometry/fatigue/validate'
import type { FatigueAnalysis } from '../../physics/fatigue/types'
import type { GuidedPlan } from './plan'

// Fatigue Analysis I guided experiments (task 70; FAT-17, D-49). Step data only. From the
// Baseline (thin neck, sharp as-forged fillet, bulky collar): round the fillet, change the
// surface finish, thicken the neck, then open everything. Hints never state the reference design.

type R = { analysis: FatigueAnalysis }

export const FATIGUE_GUIDED_PLAN: GuidedPlan<FatigueDesign, R> = Object.freeze({
  params: (d: Readonly<FatigueDesign>) => ({ ...Object.fromEntries(FATIGUE_PARAMS.map((p) => [p, d[p]])), surfaceFinish: d.surfaceFinish }),
  label: (id: string) => (FATIGUE_PARAM_LABELS as Readonly<Record<string, string>>)[id] ?? id,
  metrics: {
    fatigueSafetyFactor: { label: 'Fatigue safety factor', read: (r: Readonly<R>) => r.analysis.fatigueSafetyFactor },
    fatigueNotchFactorKf: { label: 'Fatigue notch factor Kf', read: (r: Readonly<R>) => r.analysis.fatigueNotchFactorKf },
    enduranceLimitPa: { label: 'Endurance limit', read: (r: Readonly<R>) => r.analysis.enduranceLimitPa },
    alternatingStressPa: { label: 'Alternating stress at the fillet', read: (r: Readonly<R>) => r.analysis.alternatingStressPa },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
  },
  steps: [
    {
      id: 'fillet',
      title: 'Round the fillet',
      instruction: 'Increase only the fillet radius. Predict how the fatigue safety factor will change, then Run Test.',
      hint: 'A sharp corner concentrates stress where cracks start. A larger radius lowers Kt, but it also uses up the flat shoulder face the wheel hub needs.',
      focus: 'Fillet radius',
      unlocks: ['filletRadiusM'],
      objective: { kind: 'change', params: ['filletRadiusM'], direction: 'increase' },
      observe: ['fatigueNotchFactorKf', 'fatigueSafetyFactor', 'massKg'],
    },
    {
      id: 'finish',
      title: 'Improve the surface',
      instruction: 'Change only the surface finish at the fillet. Predict how the fatigue safety factor will change, then Run Test.',
      hint: 'Fatigue cracks start at the surface. A rough as-forged skin lowers the endurance limit far more than a machined or ground one, at no change in size or mass.',
      focus: 'Surface finish',
      unlocks: ['surfaceFinish'],
      objective: { kind: 'change', params: ['surfaceFinish'], direction: 'any' },
      observe: ['enduranceLimitPa', 'fatigueSafetyFactor', 'massKg'],
    },
    {
      id: 'neck',
      title: 'Thicken the neck',
      instruction: 'Increase only the neck diameter. Predict how the fatigue safety factor will change, then Run Test.',
      hint: 'Bending stress falls with the cube of the diameter, so a little more neck goes a long way, but it adds mass and leaves less room for the fillet under the collar.',
      focus: 'Neck diameter',
      unlocks: ['neckDiameterM'],
      objective: { kind: 'change', params: ['neckDiameterM'], direction: 'increase' },
      observe: ['alternatingStressPa', 'fatigueSafetyFactor', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every parameter is unlocked, including the collar diameter. Combine what your experiments showed and Run Test until a spindle passes every check.',
      hint: 'Trim the collar to save mass, size the neck for the yield margin, then share the shoulder between the neck and the fillet so the hub still has its face.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<FatigueDesign, R>)
