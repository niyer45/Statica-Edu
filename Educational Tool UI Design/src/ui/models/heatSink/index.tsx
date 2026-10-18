import type { HeatSinkEfficiency } from '../../../evaluation/heatSink/types'
import { mToMm } from '../../../units/units'
import type { ModelUi } from '../types'
import HeatSinkChallengePanel from './HeatSinkChallengePanel'
import HeatSinkHelp from './HeatSinkHelp'
import HeatSinkResults from './HeatSinkResults'
import HeatSinkTools from './HeatSinkTools'
import HeatSinkView from './HeatSinkView'

// Heat Sink I UI (task 48.3; heat-sink-1 HSK-08, HSK-14, HSK-15; MM-20, MM-21). Guided content
// never states the reference design or that a particular fin count works.

export const HEAT_SINK_LIMITS_NOTICE = 'Idealized plate-fin heat sink model, not a thermal certification'

export const heatSinkUi: ModelUi = {
  copy: {
    tagline: 'Keep the base temperature down within mass, fin height and fin gap limits.',
    guidedContext: 'Fin count, thickness and height controls, and step-by-step prompts.',
    parametricContext: 'Precise fin editing with the same validated heat sink model. The convection coefficient is a given fan-assisted value, not computed.',
    parametricLabel: 'Direct fin array editing',
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
  guidance: {
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        instruction: 'Read the challenge and its limits. Find which limit the baseline heat sink misses, and use Test details to see how much of its heat leaves through the fins.',
        hint: 'Expand Some things are fixed. to see the base, heat load, air temperature and the given convection coefficient. Accepted applies to this idealized model, not a real-world thermal approval.',
      },
      {
        id: 'experiment',
        title: 'Experiment',
        instruction: 'Change one fin variable at a time: count, thickness or height. Predict whether the base temperature rise will go up or down, then Run Test to record the result.',
        hint: 'The fin shading and the Fin temperatures table show the latest tested design until you run another test. Watch the fin gap as fins become more numerous or thicker.',
      },
      {
        id: 'compare',
        title: 'Compare',
        instruction: 'Choose designs in Design history, then open Compare results. Compare how much the base temperature drops for each gram added by thicker fins versus more or taller fins.',
        hint: 'Look at fin efficiency and effective area as well as mass. Extra fin surface helps less when the outer part of a fin is barely warmer than the air.',
      },
      {
        id: 'explain',
        title: 'Explain',
        instruction: 'Use your tested values to connect surface area, fin efficiency and mass. Open Explain & submit to record a design and reflection.',
        hint: 'A submitted attempt can still be Not accepted. Name one effect the model does not include, for example that real airflow depends on the gap between fins.',
      },
    ],
    experiment: () => undefined,
  },
}
