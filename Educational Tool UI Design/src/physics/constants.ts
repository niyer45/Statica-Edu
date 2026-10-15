// Applicability thresholds and model metadata (Req 10.4, 10.5, 10.9, 10.10).
// The applicability checker reads thresholds only from this module.
// Thresholds are inclusive on the safe side: a metric equal to its threshold
// (within REL_TOL) produces no issue.

export type ApplicabilityCode =
  | 'DEPTH_SPAN'
  | 'LARGE_DEFLECTION'
  | 'PLASTICITY'
  | 'TUBE_SLENDERNESS'
  | 'FLANGE_OUTSTAND'
  | 'WEB_SLENDERNESS'
  | 'RECT_ASPECT'

export interface ApplicabilityThreshold {
  /** A warning is raised when the metric exceeds this value. */
  readonly warning: number
  /** The model is not applicable when the metric exceeds this value. */
  readonly notApplicable: number
  /** Human-readable metric definition. */
  readonly metric: string
  /** The unmodeled effect named in the issue message. */
  readonly effect: string
}

export const APPLICABILITY_CODES: readonly ApplicabilityCode[] = Object.freeze([
  'DEPTH_SPAN',
  'LARGE_DEFLECTION',
  'PLASTICITY',
  'TUBE_SLENDERNESS',
  'FLANGE_OUTSTAND',
  'WEB_SLENDERNESS',
  'RECT_ASPECT',
] as const)

const t = (
  warning: number,
  notApplicable: number,
  metric: string,
  effect: string,
): ApplicabilityThreshold => Object.freeze({ warning, notApplicable, metric, effect })

/** The 14 applicability thresholds (7 warning, 7 not-applicable). */
export const THRESHOLDS: Readonly<Record<ApplicabilityCode, ApplicabilityThreshold>> =
  Object.freeze({
    DEPTH_SPAN: t(0.1, 0.2, 'envelope height / L', 'shear deformation'),
    LARGE_DEFLECTION: t(0.02, 0.1, 'tip deflection / L', 'large deflection'),
    PLASTICITY: t(0.8, 1.0, 'nominal stress / yield stress', 'plasticity'),
    TUBE_SLENDERNESS: t(40, 100, 'D / t_wall', 'local shell buckling'),
    FLANGE_OUTSTAND: t(10, 20, '(b − tw) / (2·tf)', 'flange local buckling'),
    WEB_SLENDERNESS: t(60, 120, '(h − 2·tf) / tw', 'web local buckling'),
    RECT_ASPECT: t(8, 20, 'envelope height / envelope width', 'lateral-torsional buckling'),
  })

/** Effects the model never accounts for, listed on every Analysis (Req 10.9). */
export const UNSUPPORTED_EFFECTS: readonly string[] = Object.freeze([
  'torsion',
  'shear deformation',
  'local buckling',
  'lateral-torsional buckling',
  'plasticity',
  'large deflection',
  'root stress concentrations',
  'joint/fastener compliance',
  'self-weight',
])

/** Model assumptions listed on every Analysis (Req 10.9). */
export const ASSUMPTIONS: readonly string[] = Object.freeze([
  'linear elastic material',
  'small deflection',
  'straight prismatic beam',
  'fixed (rigid) root',
  'point load at the tip',
  'isotropic material',
  'Euler-Bernoulli beam (shear deformation negligible)',
  'nominal bending stress only',
])
