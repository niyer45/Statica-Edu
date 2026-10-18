import type { HeatSinkEfficiency } from '../../../evaluation/heatSink/types'
import { mToMm } from '../../../units/units'
import type { ModelUi } from '../types'
import HeatSinkChallengePanel from './HeatSinkChallengePanel'
import HeatSinkHelp from './HeatSinkHelp'
import HeatSinkResults from './HeatSinkResults'
import HeatSinkTools from './HeatSinkTools'
import HeatSinkView from './HeatSinkView'
import { HEAT_SINK_GUIDED_PLAN } from '../../../evaluation/guided/heatSink'

// Heat Sink I UI (task 48.3; heat-sink-1 HSK-08, HSK-14, HSK-15; MM-20, MM-21). Guided content
// never states the reference design or that a particular fin count works.

export const HEAT_SINK_LIMITS_NOTICE = 'Idealized plate-fin heat sink model, not a thermal certification'

export const heatSinkUi: ModelUi = {
  copy: {
    tagline: 'Keep the base temperature down within mass, fin height and fin gap limits.',
    contextNote: 'The convection coefficient is a given fan-assisted value, not computed.',
    solverLabel: '1D conduction and convection · Plate-fin heat sink',
    limitsNotice: HEAT_SINK_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized plate-fin heat sink model. The base, material, heat load, air temperature and the given convection coefficient remain fixed by the challenge.',
    prediction: {
      title: 'Predict base temperature rise',
      question: (previous) => `Compared with ${previous}, how will your new fin array change the base temperature rise?`,
      legend: 'Predicted change in base temperature rise',
    },
    // Stored margins; the gap margin is shown in millimetres (a unit conversion only).
    efficiency: (efficiency) => {
      const e = efficiency as HeatSinkEfficiency
      return [
        { label: 'Temperature margin (K)', value: e.temperatureMarginK },
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Fin gap margin (mm)', value: mToMm(e.gapMarginM) },
      ]
    },
  },
  Tools: HeatSinkTools,
  View: HeatSinkView,
  ChallengePanel: HeatSinkChallengePanel,
  Results: HeatSinkResults,
  Help: HeatSinkHelp,
  guided: HEAT_SINK_GUIDED_PLAN,
}
