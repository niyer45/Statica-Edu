import { COLUMN_GUIDED_PLAN } from '../../../evaluation/guided/column'
import type { ColumnEfficiency } from '../../../evaluation/column/types'
import type { ModelUi } from '../types'
import ColumnChallengePanel from './ColumnChallengePanel'
import ColumnHelp from './ColumnHelp'
import ColumnResults from './ColumnResults'
import ColumnTools from './ColumnTools'
import ColumnView from './ColumnView'

// Column Buckling I UI (task 68; CBK-18, CBK-19; MM-20, MM-21). Guided experiment steps
// (evaluation/guided/column.ts) never state reference dimensions or invent numbers.

export const COLUMN_LIMITS_NOTICE =
  'Idealized pinned–pinned Euler column: straight, centrally loaded, slender. Crookedness, inelastic and local buckling are not modeled. Not a structural certification'

export const columnUi: ModelUi = {
  copy: {
    tagline: 'Keep a slender column from buckling without making it heavy.',
    solverLabel: 'Euler buckling · Pinned–pinned column',
    limitsNotice: COLUMN_LIMITS_NOTICE,
    drawerAvailable:
      'Available with an idealized Euler column model: the critical buckling load of a straight column pinned at both ends, its axial stress and its mass, with checks that the column is slender enough for Euler and its wall thick enough. The length, end pins, load and material remain fixed by the challenge.',
    prediction: {
      title: 'Predict critical load',
      question: (previous) => `Compared with ${previous}, how will your new column change its critical buckling load?`,
      legend: 'Predicted change in critical buckling load',
    },
    efficiency: (efficiency) => {
      const e = efficiency as ColumnEfficiency
      return [
        { label: 'Mass usage', value: e.massUsage },
        { label: 'Buckling margin', value: e.bucklingMargin },
        { label: 'Stress margin', value: e.stressMargin },
      ]
    },
  },
  Tools: ColumnTools,
  View: ColumnView,
  ChallengePanel: ColumnChallengePanel,
  Results: ColumnResults,
  Help: ColumnHelp,
  guided: COLUMN_GUIDED_PLAN,
}
