import type { ApplicabilityThreshold } from '../constants'

// Vibration Isolation I model constants, applicability thresholds and metadata (task 50.2;
// vibration-isolation-1 VIB-03, VIB-10–VIB-12). The vibration applicability checker reads
// thresholds only from this module. Thresholds are inclusive on the safe side: a metric equal to
// its threshold (within REL_TOL) produces no issue, exactly as for the beam and torsion.
//
// Not screened, by design (VIB-11): band order, Y > 0 and m > 0 are config-schema rules; the
// excitation-amplitude-versus-linear-range check is covered by SPRING_STROKE; run-up through
// resonance is screened by the steady-state peak constraints (a conservative screen; no transient
// amplitude is computed); lift-off when Z_peak > δ_st is disclosed as an assumption.

/** Standard gravity g, m/s². A model constant, not a design or challenge field (VIB-03). */
export const STANDARD_GRAVITY_MS2 = 9.80665

export type VibrationApplicabilityCode = 'SPRING_STROKE' | 'DAMPING_RATIO'

/** Fixed issue order (VIB-10). */
export const VIBRATION_APPLICABILITY_CODES: readonly VibrationApplicabilityCode[] = Object.freeze([
  'SPRING_STROKE',
  'DAMPING_RATIO',
] as const)

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/** The four vibration thresholds (2 warning, 2 not-applicable). */
export const VIBRATION_THRESHOLDS: Readonly<Record<VibrationApplicabilityCode, ApplicabilityThreshold>> =
  Object.freeze({
    SPRING_STROKE: t(0.8, 1.0, '(δ_st + Z_peak) / linear stroke', 'mount bottoming and nonlinear spring behavior beyond the linear stroke'),
    // Configured materials stop at ζ = 0.30 and the schema caps ζ at 1 (defense in depth).
    DAMPING_RATIO: t(0.35, 0.5, 'equivalent viscous damping ratio ζ', 'the hysteretic damping of real elastomers'),
  })

/** Effects the model never accounts for, listed on every analysis (VIB-12). */
export const VIBRATION_UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'multi-degree-of-freedom response, rocking and coupled modes',
  'nonlinear, amplitude-dependent or hysteretic mount behavior, and friction',
  'frequency-dependent stiffness and damping (elastomer dynamic stiffening)',
  'temperature, creep and ageing of elastomers',
  'coil-spring surge (internal resonances)',
  'shock and transient excitation',
  'startup and run-up transient amplitude (screened only by steady-state peaks)',
  'support or foundation flexibility',
  'acoustic and flanking transmission paths',
  'excitation from the component itself (forced, as opposed to base, excitation)',
  'lift-off and bottoming contact (screened only through SPRING_STROKE)',
])

/** Model assumptions listed on every analysis (design "Model sdofBaseIsolation v1"). */
export const VIBRATION_ASSUMPTIONS: readonly string[] = Object.freeze([
  'one degree of freedom: vertical translation of a rigid component',
  'linear spring and viscous damper in parallel',
  'equivalent viscous damping ratio from nominal material values',
  'harmonic base displacement with the same amplitude at every frequency',
  'steady-state frequency response only, not a simulation of motion over time',
  'run-up through resonance screened by steady-state peaks (a conservative screen)',
  'mounts bonded and linear in both tension and compression (lift-off not screened)',
  'rigid foundation',
])
