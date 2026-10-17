import type { HeatSinkDesign } from '../../geometry/heatSink/design'
import type { HeatSinkAnalysis } from '../../physics/heatSink/types'
import type { EvaluationStatus, ExplanationFact } from '../types'

// Heat sink evaluation types (task 48.2; HSK-07, MM-11, MM-12). The beam evaluation types are
// frozen (D-39) and unchanged; these follow the shared evaluation envelope (status, accepted,
// ordered constraints, failures, margins under `efficiency`, grounded facts) with heat sink ids.

/** The five constraints, always reported in this order (HSK-07). */
export type HeatSinkConstraintId = 'baseTemperature' | 'mass' | 'finHeight' | 'finGap' | 'applicability'

/** SI units of heat sink constraints; `K` is one of the MM-12 unit extensions. */
export type HeatSinkConstraintUnit = 'K' | 'kg' | 'm' | 'bool'

/**
 * One constraint check. Upper bounds have the beam ConstraintResult semantics: pass iff
 * `withinLimit(value, limit)`, `utilization = value / limit`. The lower bound (`finGap`, bound
 * 'lower') passes iff `withinLowerLimit(value, limit)` and reports `utilization = limit / value`,
 * so utilization > 1 means a limit was exceeded either way. All utilizations are unclamped. The
 * bool applicability constraint has value 1 or 0, limit 1, utilization = value.
 */
export interface HeatSinkConstraintResult {
  id: HeatSinkConstraintId
  label: string
  value: number
  limit: number
  unit: HeatSinkConstraintUnit
  bound: 'upper' | 'lower'
  passed: boolean
  utilization: number
}

/**
 * Unclamped margins (HSK-07): temperatureMarginK = T_max − T_base (K), massUsage = m / m_max and
 * gapMarginM = s − s_min (m). A negative margin or massUsage > 1 means a limit was exceeded.
 */
export interface HeatSinkEfficiency {
  temperatureMarginK: number
  massUsage: number
  gapMarginM: number
}

export interface HeatSinkEvaluation {
  status: EvaluationStatus
  accepted: boolean
  constraints: HeatSinkConstraintResult[]
  failures: HeatSinkConstraintId[]
  efficiency: HeatSinkEfficiency
  facts: ExplanationFact[]
}

/** The stored parts of a tested heat sink result that comparison facts read (any TestResult-like value). */
export interface HeatSinkComparable {
  designSnapshot: Readonly<HeatSinkDesign>
  analysis: Readonly<HeatSinkAnalysis>
  evaluation: Readonly<HeatSinkEvaluation>
}
