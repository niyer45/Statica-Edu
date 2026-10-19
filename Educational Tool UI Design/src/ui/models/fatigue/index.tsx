import type { FatigueEfficiency } from '../../../evaluation/fatigue/types'
import { FATIGUE_GUIDED_PLAN } from '../../../evaluation/guided/fatigue'
import type { ModelUi } from '../types'
import FatigueChallengePanel from './FatigueChallengePanel'
import FatigueHelp from './FatigueHelp'
import FatigueResults from './FatigueResults'
import FatigueTools from './FatigueTools'
import FatigueView from './FatigueView'

// Fatigue Analysis I UI (task 70; MM-20, MM-21). Guided experiment steps
// (evaluation/guided/fatigue.ts) never state the reference design or invent numbers.

export const FATIGUE_LIMITS_NOTICE =
  'Stress-life screening of a stepped spindle: fitted stress concentration, notch sensitivity, Marin endurance-limit factors, an S-N line and the modified Goodman line. Corrosion, temperature, residual stress and variable loads are not modeled. Not a fatigue certification'

export const fatigueUi: ModelUi = {
  copy: {
    tagline: 'Keep the spindle alive for its target life: tame the stress at the fillet without making it too heavy.',
    solverLabel: 'Stepped spindle · stress-life fatigue',
    limitsNotice: FATIGUE_LIMITS_NOTICE,
    drawerAvailable:
      'Available with a stress-life fatigue model of a stepped spindle: a fitted stress-concentration factor and notch sensitivity at the shoulder fillet, an endurance limit with surface and size factors, an S-N line and the modified Goodman line. The load, the material and the lengths remain fixed by the challenge.',
    prediction: {
      title: 'Predict fatigue safety factor',
      question: (previous) => `Compared with ${previous}, how will your new spindle change its fatigue safety factor?`,
      legend: 'Predicted change in fatigue safety factor',
    },
    efficiency: (efficiency) => {
      const e = efficiency as FatigueEfficiency
      return [
        { label: 'Fatigue margin', value: e.fatigueMargin },
        { label: 'Yield margin', value: e.yieldMargin },
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Shoulder face margin (m)', value: e.shoulderFaceMarginM },
      ]
    },
  },
  Tools: FatigueTools,
  View: FatigueView,
  ChallengePanel: FatigueChallengePanel,
  Results: FatigueResults,
  Help: FatigueHelp,
  guided: FATIGUE_GUIDED_PLAN,
}
