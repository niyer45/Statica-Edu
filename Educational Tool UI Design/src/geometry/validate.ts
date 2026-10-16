import type { Challenge, ParamRange, SectionKind, SectionLimits } from '../challenge/types'
import { GEOM_TOL, type BeamDesign, type GeometryError, type Section } from './sections'

// Geometry validator (Req 4.3, 5.2–5.15, 7.8). Pure: never mutates or throws.
//
// Inputs may come from untrusted data (imports, persistence) even though they are typed,
// so every read is defensive: a missing or non-number dimension counts as NON_FINITE,
// and a missing or unknown section kind counts as SECTION_NOT_ALLOWED (param 'kind').
//
// Error order (deterministic, Req 5.13):
//   validateSection
//     1. Per parameter, in the kind's fixed parameter order (below), at most one of:
//        NON_FINITE | NON_POSITIVE | BELOW_MIN | ABOVE_MAX.
//        circle: diameterM
//        tube: outerDiameterM, innerDiameterM
//        rectangle: widthM, heightM
//        iSection: widthM, heightM, flangeThicknessM, webThicknessM
//     2. Coupled rules, in this order:
//        tube:     INNER_NOT_LESS_THAN_OUTER, WALL_TOO_THIN (only when d < D)
//        iSection: FLANGES_OVERLAP, WEB_WIDER_THAN_FLANGE, FLANGE_TOO_THIN, WEB_TOO_THIN
//   validateDesign
//     3. SECTION_NOT_ALLOWED (alone, replacing steps 1–2) or the validateSection errors
//     4. BAD_ORIENTATION
//     5. LOCKED_FIELD_CHANGED for lengthM, then materialId
//
// Exclusivity (Req 5.2, 5.3): a parameter that is NON_FINITE or NON_POSITIVE gets exactly
// that one error. Every coupled rule that reads such a parameter is skipped, so no further
// error can involve it. Out-of-range (but finite, positive) values still feed coupled rules,
// since those are independent rules.
//
// Tolerances: range bounds, minimum wall, minimum clear web, minimum thicknesses, and
// tw ≤ b use GEOM_TOL. d ≥ D is an exact comparison (design table: "d ≥ D").
// Tube inner diameter: 0 is allowed (−0 too, since −0 === 0); it has no range of its own.
// Thickness params (tf, tw) have no range besides the challenge minimums and coupled rules.
// Locked fields: compared with strict equality (no tolerance) against the challenge's
// initialDesign values. forceN and support are locked too but are not part of BeamDesign,
// so they cannot differ here; the session reducer enforces them (Req 4.2, 4.4).

const SECTION_KINDS: readonly SectionKind[] = ['circle', 'tube', 'rectangle', 'iSection']

const PARAM_LABELS: Record<string, string> = {
  diameterM: 'Diameter',
  outerDiameterM: 'Outer diameter',
  innerDiameterM: 'Inner diameter',
  widthM: 'Width',
  heightM: 'Height',
  flangeThicknessM: 'Flange thickness',
  webThicknessM: 'Web thickness',
}

/** Metres → plain millimetre text for messages ("30 mm", "2.5 mm"). Local: domain code does not import units/. */
function mm(m: number): string {
  if (!Number.isFinite(m)) return String(m)
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

interface ParamSpec {
  name: string
  range?: ParamRange
  /** Tube inner diameter: exactly 0 is valid. */
  zeroAllowed?: boolean
}

function paramSpecs(kind: SectionKind, limits: SectionLimits): ParamSpec[] {
  switch (kind) {
    case 'circle':
      return [{ name: 'diameterM', range: limits.circle.diameterM }]
    case 'tube':
      return [
        { name: 'outerDiameterM', range: limits.tube.outerDiameterM },
        { name: 'innerDiameterM', zeroAllowed: true },
      ]
    case 'rectangle':
      return [
        { name: 'widthM', range: limits.rectangle.widthM },
        { name: 'heightM', range: limits.rectangle.heightM },
      ]
    case 'iSection':
      return [
        { name: 'widthM', range: limits.iSection.widthM },
        { name: 'heightM', range: limits.iSection.heightM },
        { name: 'flangeThicknessM' },
        { name: 'webThicknessM' },
      ]
  }
}

/** Per-parameter check. Returns the single error for the parameter, or null. */
function checkParam(spec: ParamSpec, value: unknown): GeometryError | null {
  const { name } = spec
  const label = PARAM_LABELS[name] ?? name
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return {
      code: 'NON_FINITE',
      param: name,
      message: `${label} must be a finite number (got ${describe(value)}).`,
    }
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
    return {
      code: 'BELOW_MIN',
      param: name,
      message: `${label} must be at least ${mm(r.minM)} (got ${mm(value)}).`,
    }
  }
  if (r && value > r.maxM + GEOM_TOL) {
    return {
      code: 'ABOVE_MAX',
      param: name,
      message: `${label} must be at most ${mm(r.maxM)} (got ${mm(value)}).`,
    }
  }
  return null
}

function sectionNotAllowed(kind: unknown, allowed?: readonly SectionKind[]): GeometryError {
  const known = typeof kind === 'string' && (SECTION_KINDS as readonly string[]).includes(kind)
  const list = (allowed ?? SECTION_KINDS).join(', ')
  return {
    code: 'SECTION_NOT_ALLOWED',
    param: 'kind',
    message: known
      ? `Section type "${kind}" is not allowed in this challenge (allowed: ${list}).`
      : `Section type ${describe(kind)} is not recognized (allowed: ${list}).`,
  }
}

/** Validates a section's dimensions against the challenge limits. See the header for rule order. */
export function validateSection(s: Section, limits: SectionLimits): GeometryError[] {
  const raw: unknown = s
  if (!isRecord(raw)) return [sectionNotAllowed(undefined)]
  const kind = raw.kind
  if (typeof kind !== 'string' || !(SECTION_KINDS as readonly string[]).includes(kind)) {
    return [sectionNotAllowed(kind)]
  }

  const errors: GeometryError[] = []
  /** Parameters that passed NON_FINITE / NON_POSITIVE (finite numbers, usable by coupled rules). */
  const ok = new Map<string, number>()
  for (const spec of paramSpecs(kind as SectionKind, limits)) {
    const value = raw[spec.name]
    const err = checkParam(spec, value)
    if (err) errors.push(err)
    if (!err || err.code === 'BELOW_MIN' || err.code === 'ABOVE_MAX') ok.set(spec.name, value as number)
  }

  if (kind === 'tube') {
    const D = ok.get('outerDiameterM')
    const d = ok.get('innerDiameterM')
    const minWall = limits.tube.minWallM
    if (D !== undefined && d !== undefined) {
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
  }

  if (kind === 'iSection') {
    const lim = limits.iSection
    const b = ok.get('widthM')
    const h = ok.get('heightM')
    const tf = ok.get('flangeThicknessM')
    const tw = ok.get('webThicknessM')
    if (h !== undefined && tf !== undefined && h - 2 * tf < lim.minClearWebHeightM - GEOM_TOL) {
      errors.push({
        code: 'FLANGES_OVERLAP',
        param: 'flangeThicknessM',
        message: `Flanges overlap: the web between the flanges is ${mm(h - 2 * tf)} tall and must be at least ${mm(lim.minClearWebHeightM)}. Use thinner flanges or a taller section.`,
      })
    }
    if (b !== undefined && tw !== undefined && tw > b + GEOM_TOL) {
      errors.push({
        code: 'WEB_WIDER_THAN_FLANGE',
        param: 'webThicknessM',
        message: `Web thickness (${mm(tw)}) must not be wider than the flange width (${mm(b)}).`,
      })
    }
    if (tf !== undefined && tf < lim.minFlangeThicknessM - GEOM_TOL) {
      errors.push({
        code: 'FLANGE_TOO_THIN',
        param: 'flangeThicknessM',
        message: `Flange thickness must be at least ${mm(lim.minFlangeThicknessM)} (got ${mm(tf)}).`,
      })
    }
    if (tw !== undefined && tw < lim.minWebThicknessM - GEOM_TOL) {
      errors.push({
        code: 'WEB_TOO_THIN',
        param: 'webThicknessM',
        message: `Web thickness must be at least ${mm(lim.minWebThicknessM)} (got ${mm(tw)}).`,
      })
    }
  }

  return errors
}

const LOCKED_DESIGN_FIELDS = ['lengthM', 'materialId'] as const
const LOCKED_LABELS: Record<(typeof LOCKED_DESIGN_FIELDS)[number], string> = {
  lengthM: 'Beam length',
  materialId: 'Material',
}

/** Validates a full design against a challenge. See the header for rule order. */
export function validateDesign(d: BeamDesign, ch: Pick<Challenge, 'initialDesign' | 'allowedSections' | 'sectionLimits'>): GeometryError[] {
  const raw: unknown = d
  const design: Record<string, unknown> = isRecord(raw) ? raw : {}
  const errors: GeometryError[] = []

  const section = design.section
  const kind = isRecord(section) ? section.kind : undefined
  if (typeof kind === 'string' && (ch.allowedSections as readonly string[]).includes(kind)) {
    errors.push(...validateSection(section as Section, ch.sectionLimits))
  } else {
    errors.push(sectionNotAllowed(kind, ch.allowedSections))
  }

  const o = design.orientationDeg
  if (o !== 0 && o !== 90) {
    errors.push({
      code: 'BAD_ORIENTATION',
      param: 'orientationDeg',
      message: `Orientation must be exactly 0° or 90° (got ${typeof o === 'number' ? String(o) : describe(o)}).`,
    })
  }

  for (const field of LOCKED_DESIGN_FIELDS) {
    const expected = ch.initialDesign[field]
    const actual = design[field]
    if (actual !== expected) {
      const fmt = (v: unknown) => (field === 'lengthM' ? describe(v) : JSON.stringify(v) ?? String(v))
      errors.push({
        code: 'LOCKED_FIELD_CHANGED',
        param: field,
        message: `${LOCKED_LABELS[field]} is fixed by the challenge and cannot be changed (expected ${fmt(expected)}, got ${fmt(actual)}).`,
      })
    }
  }

  return errors
}
