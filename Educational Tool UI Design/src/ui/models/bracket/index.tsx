import type { BracketEfficiency } from '../../../evaluation/bracket/types'
import type { ModelUi } from '../types'
import BracketChallengePanel from './BracketChallengePanel'
import BracketHelp from './BracketHelp'
import BracketResults from './BracketResults'
import BracketTools from './BracketTools'
import BracketView from './BracketView'
import { BRACKET_GUIDED_PLAN } from '../../../evaluation/guided/bracket'

// Mounting Bracket I UI (task 55 L-bracket; MM-20, MM-21). Guided experiment steps
// (evaluation/guided/bracket.ts) never state reference dimensions or invent numbers.

// The always-visible limits notice carries the short form of the source disclosure; the reference
// dialog and the model-limits explanation fact carry the full text.
export const BRACKET_LIMITS_NOTICE =
  'Idealized bolted L-bracket: statics, Winkler–Bach curved-beam bend stress and beam deflection. Bolt preload, prying and the wall fixing are not modeled. Not a structural certification'

export const bracketUi: ModelUi = {
  copy: {
    tagline: 'Make the L-bracket strong, stiff and light enough, without overloading the wall bolts.',
    solverLabel: 'Bolted L-bracket · curved-beam bend stress',
    limitsNotice: BRACKET_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized bolted L-bracket model: statics for the bend moment and bolt tension, a curved-beam formula for the stress at the bend, and beam deflection. The load, its offset from the wall, the material and the bolts remain fixed by the challenge.',
    prediction: {
      title: 'Predict bend stress',
      question: (previous) => `Compared with ${previous}, how will your new bracket change its bend stress?`,
      legend: 'Predicted change in bend stress',
    },
    efficiency: (efficiency) => {
      const e = efficiency as BracketEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Stress margin', value: e.stressMargin },
        { label: 'Deflection margin', value: e.deflectionMargin },
        { label: 'Bolt margin', value: e.boltMargin },
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
