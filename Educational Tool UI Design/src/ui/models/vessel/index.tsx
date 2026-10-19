import { VESSEL_GUIDED_PLAN } from '../../../evaluation/guided/vessel'
import type { VesselEfficiency } from '../../../evaluation/vessel/types'
import type { ModelUi } from '../types'
import VesselChallengePanel from './VesselChallengePanel'
import VesselHelp from './VesselHelp'
import VesselResults from './VesselResults'
import VesselTools from './VesselTools'
import VesselView from './VesselView'

// Pressure Vessel I UI (task 69; MM-20, MM-21, PVS-15, PVS-16). Guided experiment steps
// (evaluation/guided/vessel.ts) never state reference dimensions or invent numbers.

// The always-visible limits notice carries the short form of the source disclosure; the reference
// dialog and the model-limits explanation fact carry the full text.
export const VESSEL_LIMITS_NOTICE =
  'Idealized thin-walled vessel: membrane stresses in the shell and hemispherical heads. Junction stresses, welds, nozzles and corrosion are not modeled. Not a pressure-vessel code check'

export const vesselUi: ModelUi = {
  copy: {
    tagline: 'Hold the required air at pressure, within the length and mass limits, without overstressing the shell or the heads.',
    solverLabel: 'Thin-walled pressure vessel · membrane stresses',
    limitsNotice: VESSEL_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized thin-walled pressure vessel model: hoop and longitudinal stress in the cylindrical shell and membrane stress in the hemispherical heads, plus volume, length and mass. The pressure, the head shape, the steel and its design factor remain fixed by the challenge.',
    prediction: {
      title: 'Predict hoop stress',
      question: (previous) => `Compared with ${previous}, how will your new vessel change its hoop stress?`,
      legend: 'Predicted change in hoop stress',
    },
    efficiency: (efficiency) => {
      const e = efficiency as VesselEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Hoop stress margin', value: e.hoopMargin },
        { label: 'Head stress margin', value: e.headMargin },
        { label: 'Volume margin', value: e.volumeMargin },
      ]
    },
  },
  Tools: VesselTools,
  View: VesselView,
  ChallengePanel: VesselChallengePanel,
  Results: VesselResults,
  Help: VesselHelp,
  guided: VESSEL_GUIDED_PLAN,
}
