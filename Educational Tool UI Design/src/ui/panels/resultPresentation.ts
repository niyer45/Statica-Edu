import type { ConstraintUnit, EvaluationStatus } from '../../evaluation/types'
import { formatMm, paToMpa } from '../../units/units'
export const STATUS_LABELS: Record<EvaluationStatus, string> = { accepted: 'Accepted', notAccepted: 'Not accepted', modelNotApplicable: 'Model not applicable' }
export function formatConstraint(value: number, unit: ConstraintUnit): string {
  if (unit === 'm') return `${formatMm(value, 2)} mm`
  if (unit === 'Pa') return `${paToMpa(value).toFixed(1)} MPa`
  if (unit === 'kg') return `${value.toFixed(3)} kg`
  return ''
}
