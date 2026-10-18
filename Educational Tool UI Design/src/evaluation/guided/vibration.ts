import type { VibrationDesign } from '../../geometry/vibration/design'
import type { VibrationAnalysis } from '../../physics/vibration/types'
import type { GuidedPlan } from './plan'

// Vibration Isolation I guided experiments (task 58). Step data only.

const LABELS: Readonly<Record<string, string>> = { stiffnessNPerM: 'Stiffness', materialId: 'Isolator material' }

type R = { analysis: VibrationAnalysis }

export const VIBRATION_GUIDED_PLAN: GuidedPlan<VibrationDesign, R> = Object.freeze({
  params: (d: Readonly<VibrationDesign>) => ({ stiffnessNPerM: d.stiffnessNPerM, materialId: d.materialId }),
  label: (id: string) => LABELS[id] ?? id,
  metrics: {
    worstInBandTransmissibility: { label: 'Worst in-band transmissibility', read: (r: Readonly<R>) => r.analysis.worstInBandTransmissibility },
    naturalFrequencyHz: { label: 'Natural frequency', read: (r: Readonly<R>) => r.analysis.naturalFrequencyHz },
    staticDeflectionM: { label: 'Static deflection', read: (r: Readonly<R>) => r.analysis.staticDeflectionM },
    peakTransmissibility: { label: 'Resonance peak', read: (r: Readonly<R>) => r.analysis.peakTransmissibility },
  },
  steps: [
    {
      id: 'stiffness',
      title: 'Soften the mount',
      instruction: 'Decrease only the mount stiffness. Predict how much vibration reaches the component in the operating band, then Run Test.',
      hint: 'Isolation starts once the operating frequency is well above the natural frequency. A softer mount lowers the natural frequency but sags more.',
      focus: 'Stiffness',
      unlocks: ['stiffnessNPerM'],
      objective: { kind: 'change', params: ['stiffnessNPerM'], direction: 'decrease' },
      observe: ['naturalFrequencyHz', 'worstInBandTransmissibility', 'staticDeflectionM'],
    },
    {
      id: 'damping',
      title: 'Change the damping',
      instruction: 'Choose a different isolator material, keeping the stiffness. Predict, then test: what happens at resonance and in the operating band?',
      hint: 'Damping tames the resonance peak during run-up, but above resonance it lets a little more vibration through.',
      focus: 'Isolator material',
      unlocks: ['materialId'],
      objective: { kind: 'change', params: ['materialId'], direction: 'any' },
      observe: ['peakTransmissibility', 'worstInBandTransmissibility'],
    },
    {
      id: 'open',
      title: 'Meet every check',
      instruction: 'Stiffness and material are both unlocked. Balance them and Run Test until a mount passes every check.',
      hint: 'Pick the stiffness for isolation and sag first, then the damping for the resonance peak and stroke.',
      focus: 'All parameters',
      unlocks: 'all',
      objective: { kind: 'accepted' },
    },
  ],
} satisfies GuidedPlan<VibrationDesign, R>)
