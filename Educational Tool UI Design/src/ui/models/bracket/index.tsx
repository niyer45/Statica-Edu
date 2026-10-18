import type { BracketEfficiency } from '../../../evaluation/bracket/types'
import type { ModelUi } from '../types'
import BracketChallengePanel from './BracketChallengePanel'
import BracketHelp from './BracketHelp'
import BracketResults from './BracketResults'
import BracketTools from './BracketTools'
import BracketView from './BracketView'
import { BRACKET_GUIDED_PLAN } from '../../../evaluation/guided/bracket'

// Mounting Bracket I UI (task 46.3; mounting-bracket-1 MBR-16, MBR-18, MBR-19; MM-20, MM-21).
// Guided experiment steps (evaluation/guided/bracket.ts) never state reference dimensions or invent numbers.

// The always-visible limits notice carries the short form of the Kt source disclosure (MBR-20,
// D-41 K-1); the reference dialog and the model-limits explanation fact carry the full text.
export const BRACKET_LIMITS_NOTICE =
  'Idealized stepped-bar bending; fillet Kt coefficients from secondary copies, pending printed-edition verification. Not a structural certification'

export const bracketUi: ModelUi = {
  copy: {
    tagline: 'Find where the stress peaks and bring it within the limit without adding material everywhere.',
    solverLabel: 'Stepped flat bar · Peterson shoulder-fillet Kt',
    limitsNotice: BRACKET_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized stepped-bar bending model and a published shoulder-fillet stress-concentration fit. Length, thickness, force, material, and wall clamp remain fixed by the challenge.',
    prediction: {
      title: 'Predict peak stress',
      question: (previous) => `Compared with ${previous}, how will your new bracket change its peak stress?`,
      legend: 'Predicted change in peak stress',
    },
    efficiency: (efficiency) => {
      const e = efficiency as BracketEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        // Absent when the tested design has no peak stress (Kt fit undefined); never invented.
        ...(e.stressMargin !== undefined ? [{ label: 'Stress margin', value: e.stressMargin }] : []),
        { label: 'Deflection margin', value: e.deflectionMargin },
      ]
    },
  },
  Tools: BracketTools,
  View: BracketView,
  ChallengePanel: BracketChallengePanel,
  Results: BracketResults,
  Help: BracketHelp,
  guided: BRACKET_GUIDED_PLAN,
}
