import { VESSEL_PARAMS, type VesselDesign } from '../../geometry/vessel/design'
import { VESSEL_PARAM_LABELS } from '../../geometry/vessel/validate'
import type { VesselAnalysis } from '../../physics/vessel/types'
import type { GuidedPlan } from './plan'

// Pressure Vessel I guided experiments (task 69; PVS-16, D-49). Step data only. The sequence
// starts from the long, narrow, thin-walled Baseline: thicken the shell (hoop and longitudinal
// stress fall together, hoop stays twice longitudinal), widen it (volume rises but so does the
// hoop stress: stress grows with radius), shorten it (overall length and mass fall, volume falls
// too), size the heads (they need about half the shell's wall), then open design. Hints never
// state the reference dimensions or invent numbers.

type R = { analysis: VesselAnalysis }

export const VESSEL_GUIDED_PLAN: GuidedPlan<VesselDesign, R> = Object.freeze({
  params: (d: Readonly<VesselDesign>) => Object.fromEntries(VESSEL_PARAMS.map((p) => [p, d[p]])),
  label: (id: string) => (VESSEL_PARAM_LABELS as Readonly<Record<string, string>>)[id] ?? id,
  metrics: {
    hoopStressPa: { label: 'Hoop stress', read: (r: Readonly<R>) => r.analysis.hoopStressPa },
    longitudinalStressPa: { label: 'Longitudinal stress', read: (r: Readonly<R>) => r.analysis.longitudinalStressPa },
    headStressPa: { label: 'Head stress', read: (r: Readonly<R>) => r.analysis.headStressPa },
    volumeM3: { label: 'Internal volume', read: (r: Readonly<R>) => r.analysis.volumeM3 },
    overallLengthM: { label: 'Overall length', read: (r: Readonly<R>) => r.analysis.overallLengthM },
    massKg: { label: 'Mass', read: (r: Readonly<R>) => r.analysis.massKg },
  },
  steps: [
    {
      id: 'shell',
      title: 'Thicken the shell',
      instruction: 'Increase only the shell thickness. Predict how the hoop stress will change, then Run Test and compare it with the longitudinal stress.',
      hint: 'The same pressure is now carried by more steel. Watch the hoop and longitudinal stresses: both fall, and one stays twice the other.',
      focus: 'Shell thickness',
      unlocks: ['shellThicknessM'],
      objective: { kind: 'change', params: ['shellThicknessM'], direction: 'increase' },
      observe: ['hoopStressPa', 'longitudinalStressPa', 'massKg'],
    },
    {
      id: 'diameter',
      title: 'Widen the vessel',
      instruction: 'Increase only the inner diameter. Predict what a wider shell does to the hoop stress, then Run Test.',
      hint: 'A wider vessel holds much more air, but the pressure now pushes on a larger radius with the same wall, so the walls are worked harder.',
      focus: 'Inner diameter',
      unlocks: ['innerDiameterM'],
      objective: { kind: 'change', params: ['innerDiameterM'], direction: 'increase' },
      observe: ['hoopStressPa', 'volumeM3', 'overallLengthM', 'massKg'],
    },
    {
      id: 'length',
      title: 'Shorten the shell',
      instruction: 'Decrease only the shell length. Predict how the volume and the overall length will change, then Run Test.',
      hint: 'Length changes how much air the cylinder holds and how much room the vessel needs, but not the stresses in its walls.',
      focus: 'Shell length',
      unlocks: ['shellLengthM'],
      objective: { kind: 'change', params: ['shellLengthM'], direction: 'decrease' },
      observe: ['volumeM3', 'overallLengthM', 'massKg', 'hoopStressPa'],
    },
    {
      id: 'heads',
      title: 'Size the heads',
      instruction: 'Change only the head thickness. Predict how the head stress will change, then Run Test and compare it with the hoop stress.',
      hint: 'A hemisphere spreads the pressure in two directions instead of one, so it can be thinner than the shell at the same stress. Thick heads add a lot of mass.',
      focus: 'Head thickness',
      unlocks: ['headThicknessM'],
      objective: { kind: 'change', params: ['headThicknessM'], direction: 'any' },
      observe: ['headStressPa', 'massKg'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Every dimension is unlocked. Combine what your experiments showed and Run Test until a vessel passes every check.',
      hint: 'Choose a diameter that fits the volume in the allowed length, size the shell for the hoop stress at that diameter, then make the heads only as thick as their own stress needs.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<VesselDesign, R>)
