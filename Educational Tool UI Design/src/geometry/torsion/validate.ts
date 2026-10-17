import type { TorsionChallenge, TorsionSectionLimits } from '../../challenge/torsion/types'
import { GEOM_TOL, type GeometryError } from '../sections'
import { TORSION_SECTION_KINDS, type TorsionDesign, type TorsionSection, type TorsionSectionKind } from './design'

// Torsion shaft geometry validator (task 47.2; TSH-04, TSH-13, MM-09). Pure: never mutates or
// throws. Total over untrusted input: a missing or non-number dimension counts as NON_FINITE,
// and a missing or unknown section kind (anything outside circle/tube) counts as
// SECTION_NOT_ALLOWED (param 'kind'). Errors reuse the beam's GeometryError type and codes so
// shared notices and persistence error tables need no new vocabulary.
//
// Semantics deliberately mirror geometry/validate.ts for the circle and tube kinds:
// Error order (deterministic):
//   validateTorsionSection
//     1. Per parameter, in this order, at most one of NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX:
//        circle: diameterM
//        tube:   outerDiameterM, innerDiameterM (0 allowed, no range of its own)
//     2. tube coupled rules: INNER_NOT_LESS_THAN_OUTER, then WALL_TOO_THIN (only when d < D)
//   validateTorsionDesign
//     3. SECTION_NOT_ALLOWED (alone, replacing steps 1–2) or the validateTorsionSection errors
//     4. LOCKED_FIELD_CHANGED for lengthM, then materialId
//
// Exclusivity: a parameter that is NON_FINITE or NON_POSITIVE gets exactly that one error and
// skips the coupled rules. Out-of-range (finite, positive) values still feed coupled rules.
// Tolerances: range bounds and the minimum wall use GEOM_TOL; d ≥ D is exact. Locked fields
// compare with strict equality against the challenge's initialDesign. torqueNm and support are
// locked too but are challenge constants, not design fields, so no design can change them.

const PARAM_LABELS: Readonly<Record<string, string>> = {
  diameterM: 'Diameter',
  outerDiameterM: 'Outer diameter',
  innerDiameterM: 'Inner diameter',
}

/** Metres → plain millimetre text for messages ("30 mm", "2.5 mm"). Local: domain code does not import units/. */
function mm(m: number): string {
  const v = Number((m * 1e3).toFixed(4))
  return `${Object.is(v, -0) ? 0 : v} mm`
}

function describe(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? mm(v) : String(v)
  if (v === undefined) return 'missing'
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return typeof v
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isTorsionKind(kind: unknown): kind is TorsionSectionKind {
  return typeof kind === 'string' && (TORSION_SECTION_KINDS as readonly string[]).includes(kind)
}

interface ParamSpec {
  name: string
  range?: { minM: number; maxM: number }
  /** Tube inner diameter: exactly 0 is valid (TSH-04). */
  zeroAllowed?: boolean
}

function paramSpecs(kind: TorsionSectionKind, limits: TorsionSectionLimits): ParamSpec[] {
  return kind === 'circle'
    ? [{ name: 'diameterM', range: limits.circle.diameterM }]
    : [
        { name: 'outerDiameterM', range: limits.tube.outerDiameterM },
        { name: 'innerDiameterM', zeroAllowed: true },
      ]
}

/** Per-parameter check. Returns the single error for the parameter, or null. */
function checkParam(spec: ParamSpec, value: unknown): GeometryError | null {
  const { name } = spec
  const label = PARAM_LABELS[name]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { code: 'NON_FINITE', param: name, message: `${label} must be a finite number (got ${describe(value)}).` }
  }
  if (value < 0 || (value === 0 && !spec.zeroAllowed)) {
    return {
      code: 'NON_POSITIVE',
      param: name,
      message: spec.zeroAllowed
        ? `${label} must be zero or greater (got ${mm(value)}).`
        : `${label} must be greater than zero (got ${mm(value)}).`,
    }
  }
  const r = spec.range
  if (r && value < r.minM - GEOM_TOL) {
    return { code: 'BELOW_MIN', param: name, message: `${label} must be at least ${mm(r.minM)} (got ${mm(value)}).` }
  }
  if (r && value > r.maxM + GEOM_TOL) {
    return { code: 'ABOVE_MAX', param: name, message: `${label} must be at most ${mm(r.maxM)} (got ${mm(value)}).` }
  }
  return null
}

function sectionNotAllowed(kind: unknown, allowed: readonly TorsionSectionKind[] = TORSION_SECTION_KINDS): GeometryError {
  const list = allowed.join(', ')
  return {
    code: 'SECTION_NOT_ALLOWED',
    param: 'kind',
    message: isTorsionKind(kind)
      ? `Section type "${kind}" is not allowed in this challenge (allowed: ${list}).`
      : `Section type ${describe(kind)} is not available for a shaft (allowed: ${list}).`,
  }
}

/** Validates a shaft section's dimensions against the torsion limits. See the header for rule order. */
export function validateTorsionSection(s: TorsionSection, limits: TorsionSectionLimits): GeometryError[] {
  const raw: unknown = s
  if (!isRecord(raw)) return [sectionNotAllowed(undefined)]
  const kind = raw.kind
  if (!isTorsionKind(kind)) return [sectionNotAllowed(kind)]

  const errors: GeometryError[] = []
  /** Parameters that passed NON_FINITE / NON_POSITIVE (finite numbers, usable by coupled rules). */
  const ok = new Map<string, number>()
  for (const spec of paramSpecs(kind, limits)) {
    const value = raw[spec.name]
    const err = checkParam(spec, value)
    if (err) errors.push(err)
    if (!err || err.code === 'BELOW_MIN' || err.code === 'ABOVE_MAX') ok.set(spec.name, value as number)
  }

  const D = ok.get('outerDiameterM')
  const d = ok.get('innerDiameterM')
  if (kind === 'tube' && D !== undefined && d !== undefined) {
    const minWall = limits.tube.minWallM
    if (d >= D) {
      errors.push({
        code: 'INNER_NOT_LESS_THAN_OUTER',
        param: 'innerDiameterM',
        message: `Inner diameter must be smaller than the outer diameter (inner ${mm(d)}, outer ${mm(D)}).`,
      })
    } else if ((D - d) / 2 < minWall - GEOM_TOL) {
      errors.push({
        code: 'WALL_TOO_THIN',
        param: 'innerDiameterM',
        message: `Tube wall is too thin: wall ${mm((D - d) / 2)} must be at least ${mm(minWall)}. Reduce the inner diameter.`,
      })
    }
  }
  return errors
}

const LOCKED_DESIGN_FIELDS = ['lengthM', 'materialId'] as const
const LOCKED_LABELS: Readonly<Record<(typeof LOCKED_DESIGN_FIELDS)[number], string>> = {
  lengthM: 'Shaft length',
  materialId: 'Material',
}

/** The challenge fields validateTorsionDesign reads. */
export type TorsionValidationContext = Pick<TorsionChallenge, 'initialDesign' | 'allowedSections' | 'sectionLimits'>

/** Validates a full shaft design against a challenge. See the header for rule order. */
export function validateTorsionDesign(d: TorsionDesign, ch: TorsionValidationContext): GeometryError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: GeometryError[] = []

  const section = design.section
  const kind = isRecord(section) ? section.kind : undefined
  if (isTorsionKind(kind) && ch.allowedSections.includes(kind)) {
    errors.push(...validateTorsionSection(section as TorsionSection, ch.sectionLimits))
  } else {
    errors.push(sectionNotAllowed(kind, ch.allowedSections))
  }

  for (const field of LOCKED_DESIGN_FIELDS) {
    const expected = ch.initialDesign[field]
    const actual = design[field]
    if (actual !== expected) {
      errors.push({
        code: 'LOCKED_FIELD_CHANGED',
        param: field,
        message: `${LOCKED_LABELS[field]} is fixed by the challenge and cannot be changed (expected ${describe(expected)}, got ${describe(actual)}).`,
      })
    }
  }
  return errors
}
