import { formatMm, paToMpa } from '../../units/units'
import Icon from '../icons/Icon'
import { useChallenge } from '../state/store'

// STUB (task 13.3): the template `aside.challenge-panel` contents moved here.
// Task 21.1 adds the locked load/material/span, pass marks from the latest Evaluation, the
// results table, status banner, warnings, facts, and wires "Run Test".
// Limits are challenge inputs; no result, pass mark, or computed number is shown.
// Run test stays disabled (the runTest reducer is a no-op until task 19).

const NOT_TESTED = 'Not yet tested'

export default function RequirementsPanel({ onOpenHelp }: { onOpenHelp: () => void }) {
  const ch = useChallenge()
  const rows: [string, string][] = [
    ['Tip deflection', `≤ ${formatMm(ch.constraints.maxDeflectionM)} mm`],
    ['Total mass', `≤ ${ch.constraints.maxMassKg.toFixed(2)} kg`],
    ['Bending stress', `≤ ${paToMpa(ch.constraints.maxStressPa).toFixed(0)} MPa`],
    ['Section envelope', `${formatMm(ch.constraints.maxWidthM, 0)} × ${formatMm(ch.constraints.maxHeightM, 0)} mm`],
  ]
  return (
    <>
      <div className="panel-title">
        <Icon name="book" size={16} />
        <h2>The challenge</h2>
        <span className="challenge-number">01 / 01</span>
      </div>
      <div className="challenge-body">
        <p>{ch.statement}</p>
        <div className="section-heading requirements-title">
          DESIGN REQUIREMENTS <Icon name="lock" size={11} />
        </div>
        {rows.map(([label, value]) => (
          <div className="requirement" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <span className="pass-mark" title={NOT_TESTED} aria-label={NOT_TESTED}>
              <span aria-hidden="true">·</span>
            </span>
          </div>
        ))}
        <div className="insight">
          <Icon name="bulb" size={18} />
          <div>
            <button type="button" onClick={onOpenHelp}>
              Section stiffness reference
              <Icon name="arrow" size={12} />
            </button>
          </div>
        </div>
      </div>
      <div className="test-action">
        <button type="button" className="primary run-test" disabled title="Testing is not available yet">
          <Icon name="play" size={15} />
          Run test<span>↵</span>
        </button>
      </div>
    </>
  )
}
