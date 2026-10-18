import type { VibrationEfficiency } from '../../../evaluation/vibration/types'
import type { ModelUi } from '../types'
import VibrationChallengePanel from './VibrationChallengePanel'
import VibrationHelp from './VibrationHelp'
import VibrationResults from './VibrationResults'
import VibrationTools from './VibrationTools'
import VibrationView from './VibrationView'
import { VIBRATION_GUIDED_PLAN } from '../../../evaluation/guided/vibration'

// Vibration Isolation I UI (task 50.3; vibration-isolation-1 VIB-08, VIB-14, VIB-15; MM-20,
// MM-21). Guided hints never state the reference stiffness or material, or the feasible windows.

export const VIBRATION_LIMITS_NOTICE = 'Idealized steady-state vibration isolation, not an engineering certification'

export const vibrationUi: ModelUi = {
  copy: {
    tagline: 'Keep vibration out of the operating band within sag, resonance and rattle-space limits.',
    solverLabel: 'Single degree of freedom · Steady-state base isolation',
    limitsNotice: VIBRATION_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized steady-state vibration isolation model. Component mass, operating band, base vibration and mount stroke remain fixed by the challenge.',
    prediction: {
      title: 'Predict transmitted vibration',
      question: (previous) => `Compared with ${previous}, how will your new mount change the worst vibration transmitted in the operating band?`,
      legend: 'Predicted change in the worst vibration transmitted in the operating band',
    },
    efficiency: (efficiency) => {
      const e = efficiency as VibrationEfficiency
      return [
        { label: 'Isolation margin', value: e.isolationMargin },
        { label: 'Sag usage', value: e.sagUsage },
        { label: 'Clearance usage', value: e.clearanceUsage },
      ]
    },
  },
  Tools: VibrationTools,
  View: VibrationView,
  ChallengePanel: VibrationChallengePanel,
  Results: VibrationResults,
  Help: VibrationHelp,
  guided: VIBRATION_GUIDED_PLAN,
}
