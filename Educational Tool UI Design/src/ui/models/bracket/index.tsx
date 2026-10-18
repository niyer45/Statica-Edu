import type { BracketEfficiency } from '../../../evaluation/bracket/types'
import type { BracketSession } from '../../../state/bracketModel'
import type { ModelUi } from '../types'
import BracketChallengePanel from './BracketChallengePanel'
import BracketHelp from './BracketHelp'
import BracketResults from './BracketResults'
import BracketTools from './BracketTools'
import BracketView from './BracketView'

// Mounting Bracket I UI (task 55 L-bracket; MM-20, MM-21). Guided steps and the suggested
// experiment never state reference dimensions or invent numbers.

// The always-visible limits notice carries the short form of the source disclosure; the reference
// dialog and the model-limits explanation fact carry the full text.
export const BRACKET_LIMITS_NOTICE =
  'Idealized bolted L-bracket: statics, Winkler–Bach curved-beam bend stress and beam deflection. Bolt preload, prying and the wall fixing are not modeled. Not a structural certification'

export const bracketUi: ModelUi = {
  copy: {
    tagline: 'Make the L-bracket strong, stiff and light enough, without overloading the wall bolts.',
    guidedContext: 'Thickness, width, flange and bend-radius controls, a bending-moment path, and step-by-step prompts.',
    parametricContext: 'Precise thickness, width, flange height and bend radius editing with the same validated L-bracket model.',
    parametricLabel: 'Direct thickness, width, flange and bend radius editing',
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
  guidance: {
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        instruction: 'Read the challenge and its limits. Find which checks the baseline bracket fails, and trace how the load reaches the wall: along the arm, around the bend, down the flange to the bolts.',
        hint: 'Expand Some things are fixed. to see the load, its offset, the bolts and the material. The moment path under the bracket shows the bending moment rising to a peak at the bend. Accepted applies to this idealized model, not a real-world safety approval.',
      },
      {
        id: 'experiment',
        title: 'Experiment',
        instruction: 'Change one dimension at a time: the thickness, the inner bend radius or the flange height. Predict how the bend stress will change, then Run Test to record the result.',
        hint: 'A tight inner radius crowds stress toward the inside of the bend. A taller flange gives the bolts more leverage against the overturning moment, but it lets the bracket rotate more and adds mass.',
      },
      {
        id: 'compare',
        title: 'Compare',
        instruction: 'Choose designs in Design history, then open Compare results. Compare the bend stress, the bolt tension, the deflection and the mass of each design.',
        hint: 'Making everything thicker, wider and taller passes the strength checks. Check what that does to the mass limit before choosing it.',
      },
      {
        id: 'explain',
        title: 'Explain',
        instruction: 'Use your tested values to connect the load path, the bend radius, the bolt lever arm and the mass. Open Explain & submit to record a design and reflection.',
        hint: 'A submitted attempt can still be Not accepted. Name one effect the idealized bracket model does not include, such as bolt preload, prying or fatigue.',
      },
    ],
    experiment: (session) => {
      const latest = (session as unknown as BracketSession).history.at(-1)
      if (latest === undefined) return undefined
      const failed = latest.evaluation.failures
      if (latest.evaluation.status === 'modelNotApplicable') return 'Your latest test is outside the model limits. Read its applicability reasons, then bring the design back inside them before comparing results.'
      if (failed.includes('bendStress')) return 'Your latest test is overstressed at the bend. Try one change, the thickness or the inner bend radius, and predict the bend stress before you run it.'
      if (failed.includes('boltTension')) return 'Your latest test overloads the bolts. Try a taller flange, and watch what it does to the deflection and the mass.'
      if (failed.includes('deflection')) return 'Your latest test sags too far at the load. Thickness stiffens the bracket most; a shorter flange span also helps.'
      if (failed.includes('mass')) return 'Your latest test is too heavy. Look for the dimension with spare margin, such as the width, and trim it.'
      return undefined
    },
  },
}
