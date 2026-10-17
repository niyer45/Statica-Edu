import { z } from 'zod'
import type { Challenge, Result } from '../challenge/types'
import { beamDesignSchema, type BeamDesign, type Section } from '../geometry/sections'
import { validateDesign } from '../geometry/validate'

// Design import / export (Req 22.1–22.4, 23.1–23.4). Pure: no DOM, storage, or clock.
//
// Export: `{ format, schemaVersion, challengeId, design }` in that key order, design keys in a
// fixed order (id, section, orientationDeg, lengthM, materialId; section kind first, then its
// parameters). 2-space indent so the downloaded file is readable. Only the given design is
// written: no referenceDesign or other challenge data.
//
// Import accepts JSON text (string) or an already-parsed value and never throws. Checks, in
// reason order:
//   1. Text only: UTF-8 size > MAX_IMPORT_BYTES → one size reason, nothing parsed (23.1).
//   2. Text only: JSON.parse (the only parser, 23.2); failure → one "not valid JSON" reason (23.3).
//   3. Root must be a plain object → otherwise one reason, stop.
//   4. Forbidden-key scan (`__proto__`, `constructor`, `prototype`) over own keys at every depth.
//      Any hit → one reason per hit, stop (security rejection; nothing else reads the data) (23.4).
//   5. Envelope, one reason per failed check (22.4): unknown top-level keys, format,
//      schemaVersion, challengeId. Then, if `design` is not an object → one reason and stop
//      (no design checks are possible).
//   6. Design: unknown keys (design, then section; forceN / load / support get a "fixed by the
//      challenge" message since they are locked but not part of a design), id, locked fields
//      (lengthM, then materialId), then geometry errors from validateDesign in its order.
// The strict zod envelope schema is the source of unknown-key reasons; checks with a dedicated
// human-readable reason (format, version, id, locked fields, geometry via validateDesign) skip
// the matching zod issue so each failure is reported once. validateDesign is the geometry
// authority (e.g. it allows a solid tube, innerDiameterM = 0, which the zod shape rejects).
// The returned design is a fresh object built from validated fields, never the parsed object.

// Validation uses only public challenge fields; UI never receives referenceDesign.
export type ImportChallenge = Pick<Challenge, 'id' | 'initialDesign' | 'allowedSections' | 'sectionLimits'>

export const IMPORT_FORMAT = 'ei-design'
export const IMPORT_SCHEMA_VERSION = 1
/** 100 KB. Text strictly larger than this many UTF-8 bytes is rejected before parsing. */
export const MAX_IMPORT_BYTES = 102400

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
const LOCKED_NON_DESIGN_KEYS: Readonly<Record<string, string>> = {
  forceN: 'The load',
  load: 'The load',
  support: 'The support',
}

const SECTION_PARAMS: Readonly<Record<Section['kind'], readonly string[]>> = {
  circle: ['diameterM'],
  tube: ['outerDiameterM', 'innerDiameterM'],
  rectangle: ['widthM', 'heightM'],
  iSection: ['widthM', 'heightM', 'flangeThicknessM', 'webThicknessM'],
}

const envelopeSchema = z
  .object({
    format: z.literal(IMPORT_FORMAT),
    schemaVersion: z.literal(IMPORT_SCHEMA_VERSION),
    challengeId: z.string(),
    design: beamDesignSchema,
  })
  .strict()

/** Envelope / design paths whose zod issues are replaced by a dedicated reason. */
const COVERED_PATHS: ReadonlySet<string> = new Set([
  'format',
  'schemaVersion',
  'challengeId',
  'design',
  'design.id',
  'design.orientationDeg',
  'design.lengthM',
  'design.materialId',
])

export function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function show(v: unknown): string {
  if (v === undefined) return 'missing'
  try {
    const s = JSON.stringify(v) ?? String(v)
    return s.length > 60 ? `${s.slice(0, 57)}...` : s
  } catch {
    return typeof v
  }
}

function joinPath(parts: readonly (string | number)[]): string {
  return parts.length === 0 ? '(top level)' : parts.join('.')
}

function sectionInOrder(s: Section): Section {
  const raw = s as unknown as Record<string, unknown>
  const params = SECTION_PARAMS[s.kind] as readonly string[] | undefined
  const out: Record<string, unknown> = { kind: s.kind }
  for (const key of params ?? Object.keys(raw).filter((k) => k !== 'kind')) out[key] = raw[key]
  return out as unknown as Section
}

function designInOrder(d: BeamDesign): BeamDesign {
  return {
    id: d.id,
    section: sectionInOrder(d.section),
    orientationDeg: d.orientationDeg,
    lengthM: d.lengthM,
    materialId: d.materialId,
  }
}

/** Serializes a design for download. Exactly four top-level keys (Req 22.1). */
export function exportDesign(d: BeamDesign, ch: Pick<Challenge, 'id'>): string {
  return JSON.stringify(
    {
      format: IMPORT_FORMAT,
      schemaVersion: IMPORT_SCHEMA_VERSION,
      challengeId: ch.id,
      design: designInOrder(d),
    },
    null,
    2,
  )
}

/** UTF-8 byte length, stopping early once the limit is clearly exceeded. */
export function exceedsByteLimit(text: string): boolean {
  // Every UTF-16 code unit encodes to at least one UTF-8 byte.
  if (text.length > MAX_IMPORT_BYTES) return true
  return new TextEncoder().encode(text).length > MAX_IMPORT_BYTES
}

/** Iterative own-key scan (cycle-safe, no recursion depth limit). */
export function findForbiddenKeys(root: unknown): string[] {
  const reasons: string[] = []
  const seen = new Set<object>()
  const stack: { value: unknown; path: string[] }[] = [{ value: root, path: [] }]
  while (stack.length > 0) {
    const { value, path } = stack.pop()!
    if (typeof value !== 'object' || value === null || seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) stack.push({ value: value[i], path: [...path, String(i)] })
      continue
    }
    for (const key of Reflect.ownKeys(value)) {
      // Symbol keys cannot come from JSON.parse but can from a pre-parsed value.
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) {
        reasons.push(`Unexpected key "${String(key)}" at ${joinPath(path)} is not allowed in a design file.`)
        continue
      }
      // Read through the descriptor so accessor properties (getters) are never invoked.
      const child = Object.getOwnPropertyDescriptor(value, key)
      if (child && 'value' in child) stack.push({ value: child.value, path: [...path, key] })
    }
  }
  return reasons
}

function unknownKeyReason(path: readonly (string | number)[], key: string): string {
  const full = [...path, key].join('.')
  const locked = path.length <= 1 ? LOCKED_NON_DESIGN_KEYS[key] : undefined
  if (locked) {
    return `Unexpected key "${full}": ${locked.toLowerCase()} is fixed by the challenge and cannot be imported.`
  }
  return `Unexpected key "${full}" is not part of the design file format.`
}

function check(data: Record<string, unknown>, ch: ImportChallenge): Result<BeamDesign, string[]> {
  const reasons: string[] = []
  const parsed = envelopeSchema.safeParse(data)
  const zodIssues = parsed.success ? [] : parsed.error.issues

  const extraReasons: string[] = []
  const unknownTop: string[] = []
  const unknownDesign: string[] = []
  for (const issue of zodIssues) {
    if (issue.code === 'unrecognized_keys') {
      const target = issue.path.length === 0 ? unknownTop : unknownDesign
      for (const key of issue.keys) target.push(unknownKeyReason(issue.path, key))
      continue
    }
    const path = issue.path.join('.')
    if (COVERED_PATHS.has(path) || path.startsWith('design.section')) continue
    extraReasons.push(`${path || 'File'}: ${issue.message}`)
  }

  reasons.push(...unknownTop)
  if (data.format !== IMPORT_FORMAT) {
    reasons.push(`This is not a design file: format must be "${IMPORT_FORMAT}" (got ${show(data.format)}).`)
  }
  if (data.schemaVersion !== IMPORT_SCHEMA_VERSION) {
    reasons.push(
      `Unsupported design file version: schemaVersion must be ${IMPORT_SCHEMA_VERSION} (got ${show(data.schemaVersion)}).`,
    )
  }
  if (data.challengeId !== ch.id) {
    reasons.push(
      `This design belongs to a different challenge: expected "${ch.id}" (got ${show(data.challengeId)}).`,
    )
  }

  const design = data.design
  if (!isPlainRecord(design)) {
    reasons.push(`The file has no design: "design" must be an object (got ${show(design)}).`)
    return { ok: false, error: [...reasons, ...extraReasons] }
  }

  reasons.push(...unknownDesign)
  if (typeof design.id !== 'string' || design.id.length === 0) {
    reasons.push(`Design id must be a non-empty string (got ${show(design.id)}).`)
  }
  const geometry = validateDesign(design as unknown as BeamDesign, ch)
  for (const e of geometry) if (e.code === 'LOCKED_FIELD_CHANGED') reasons.push(e.message)
  for (const e of geometry) if (e.code !== 'LOCKED_FIELD_CHANGED') reasons.push(e.message)
  reasons.push(...extraReasons)

  if (reasons.length > 0) return { ok: false, error: reasons }
  // All fields checked above; build a fresh design rather than returning the parsed object.
  return { ok: true, value: designInOrder(design as unknown as BeamDesign) }
}

/**
 * Validates an imported design file (JSON text or a parsed value) against the active
 * challenge. Returns the design, or one human-readable reason per failed check. Never throws.
 */
export function importDesign(input: unknown, ch: ImportChallenge): Result<BeamDesign, string[]> {
  try {
    let data: unknown = input
    if (typeof input === 'string') {
      if (exceedsByteLimit(input)) {
        return {
          ok: false,
          error: [`The file is too large: design files must be at most ${MAX_IMPORT_BYTES} bytes (100 KB).`],
        }
      }
      try {
        data = JSON.parse(input)
      } catch {
        return { ok: false, error: ['The file is not valid JSON.'] }
      }
    }

    if (!isPlainRecord(data)) {
      return {
        ok: false,
        error: [
          `The file must contain a JSON object with format, schemaVersion, challengeId, and design (got ${Array.isArray(data) ? 'an array' : show(data)}).`,
        ],
      }
    }

    const forbidden = findForbiddenKeys(data)
    if (forbidden.length > 0) return { ok: false, error: forbidden }

    return check(data, ch)
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown error'
    return { ok: false, error: [`The design file could not be read: ${detail}`] }
  }
}
