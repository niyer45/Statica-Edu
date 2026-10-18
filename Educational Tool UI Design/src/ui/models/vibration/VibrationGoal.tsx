import { formatHz } from '../../../units/units'
import GoalChecklist, { type GoalCheck } from '../GoalChecklist'
import { CHECK_LABELS, formatVibration, useVibrationStore } from './shared'

// Vibration Isolation I goal card (task 56): the goal, what to change, the four stored checks of
// the latest test and where its natural frequency sits relative to the operating band. The full
// constraint labels stay in the challenge panel's Test details table.

export const VIBRATION_GOAL = 'Choose a mount that passes every check.'
export const VIBRATION_CHANGE = 'Change the mount stiffness and material, then Run Test.'

export default function VibrationGoal() {
  const { state, challenge: ch } = useVibrationStore()
  const latest = state.history[state.history.length - 1]!
  const { analysis: a, evaluation } = latest
  const band = ch.excitation.operatingBandHz
  const checks: GoalCheck[] = evaluation.constraints.flatMap((c): GoalCheck[] =>
    c.id === 'applicability'
      ? []
      : [
          {
            id: c.id,
            label: CHECK_LABELS[c.id],
            status: c.passed ? 'pass' : 'fail',
            value: (
              <>
                <span>{formatVibration(c.value, c.unit)}</span> / <span>{formatVibration(c.limit, c.unit)}</span>
              </>
            ),
          },
        ],
  )
  const position = a.naturalFrequencyHz < band.minHz ? 'below' : a.naturalFrequencyHz > band.maxHz ? 'above' : 'inside'
  return (
    <GoalChecklist
      goal={VIBRATION_GOAL}
      change={VIBRATION_CHANGE}
      testLabel={latest.iteration === 0 ? 'Baseline' : `Iteration ${latest.iteration}`}
      draft={state.draftStatus === 'draft'}
      checks={checks}
    >
      <p className="goal-note vibration-position">
        Natural frequency {formatVibration(a.naturalFrequencyHz, 'Hz')} is {position} the operating band ({formatHz(band.minHz)}–{formatHz(band.maxHz)} Hz).
      </p>
      <p className="goal-note goal-hint">Vibration values are transmissibility: 1 = passes straight through, below 1 = isolated.</p>
      {evaluation.status === 'modelNotApplicable' && (
        <ul className="goal-alert" aria-label="Model applicability reasons">
          {a.notApplicableReasons.map((r) => (
            <li key={r.code}>{r.message}</li>
          ))}
        </ul>
      )}
      {a.warnings.length > 0 && (
        <ul className="goal-alert" aria-label="Model warnings">
          {a.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      )}
    </GoalChecklist>
  )
}
