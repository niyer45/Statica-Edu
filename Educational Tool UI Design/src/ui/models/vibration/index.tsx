import type { VibrationEfficiency } from '../../../evaluation/vibration/types'
import type { ModelUi } from '../types'
import VibrationChallengePanel from './VibrationChallengePanel'
import VibrationHelp from './VibrationHelp'
import VibrationResults from './VibrationResults'
import VibrationTools from './VibrationTools'
import VibrationView from './VibrationView'

// Vibration Isolation I UI (task 50.3; vibration-isolation-1 VIB-08, VIB-14, VIB-15; MM-20,
// MM-21). Guided hints never state the reference stiffness or material, or the feasible windows.

export const VIBRATION_LIMITS_NOTICE = 'Idealized steady-state vibration isolation, not an engineering certification'

export const vibrationUi: ModelUi = {
  copy: {
    tagline: 'Keep vibration out of the operating band within sag, resonance and rattle-space limits.',
    guidedContext: 'Mount stiffness and material controls, a frequency-response chart, and step-by-step prompts.',
    parametricContext: 'Precise stiffness and material editing with the same validated vibration model.',
    parametricLabel: 'Direct mount stiffness and material editing',
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
  guidance: {
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        instruction: 'Read the challenge and its limits. Find which limits the baseline mount misses and where its natural frequency sits relative to the operating band.',
        hint: 'The chart marks the operating band and the natural frequency of the latest test. Expand Some things are fixed. to see the mass, band, base vibration and stroke. Accepted applies to this idealized model, not a real-world approval.',
      },
      {
        id: 'experiment',
        title: 'Experiment',
        instruction: 'Change the stiffness alone and keep the material. Predict how the worst vibration transmitted in the operating band will change, then Run Test to record the result.',
        hint: 'Watch where the natural frequency moves relative to the band, and check what a softer mount does to the sag. The chart is steady-state response at each frequency, not motion over time.',
      },
      {
        id: 'compare',
        title: 'Compare',
        instruction: 'Test a lightly damped and a heavily damped material at the same stiffness, then choose them in Design history and open Compare results.',
        hint: 'Compare the resonance peak with the vibration transmitted in the band. Damping helps in one place and costs something in the other.',
      },
      {
        id: 'explain',
        title: 'Explain',
        instruction: 'Use your tested values to explain how natural frequency, frequency ratio and damping changed the vibration reaching the component. Open Explain & submit to record a design and reflection.',
        hint: 'A submitted attempt can still be Not accepted. Name one effect the idealized model does not include, such as rocking modes or elastomer stiffening.',
      },
    ],
    experiment: () => undefined,
  },
}
