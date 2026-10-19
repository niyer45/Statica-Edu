import type { AxialEfficiency } from '../../../evaluation/axial/types'
import { AXIAL_GUIDED_PLAN } from '../../../evaluation/guided/axial'
import type { ModelUi } from '../types'
import AxialChallengePanel from './AxialChallengePanel'
import AxialHelp from './AxialHelp'
import AxialResults from './AxialResults'
import AxialTools from './AxialTools'
import AxialView from './AxialView'

// Stress and Strain I UI (task 72; SSR-15, SSR-16; MM-20, MM-21). Guided experiment steps
// (evaluation/guided/axial.ts) never state the reference design or invent numbers.

export const AXIAL_LIMITS_NOTICE =
  'Idealized linear-elastic rod in axial tension with typical textbook material values. Yielding, necking and the end fittings are not modeled. Not a structural certification'

export const axialUi: ModelUi = {
  copy: {
    tagline: 'Make a hanger rod strong, stiff and light enough by choosing its diameter and material.',
    solverLabel: 'Axial tension · linear elastic',
    limitsNotice: AXIAL_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized axial-tension model: stress is the load over the area, stretch follows Hooke’s law, and the material sets stiffness, yield strength and density (typical textbook values). The length, load, design factor and supports remain fixed by the challenge.',
    prediction: {
      title: 'Predict elongation',
      question: (previous) => `Compared with ${previous}, how will your new rod change its elongation?`,
      legend: 'Predicted change in elongation',
    },
    efficiency: (efficiency) => {
      const e = efficiency as AxialEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Stress margin', value: e.stressMargin },
        { label: 'Elongation margin', value: e.elongationMargin },
      ]
    },
  },
  Tools: AxialTools,
  View: AxialView,
  ChallengePanel: AxialChallengePanel,
  Results: AxialResults,
  Help: AxialHelp,
  guided: AXIAL_GUIDED_PLAN,
}
