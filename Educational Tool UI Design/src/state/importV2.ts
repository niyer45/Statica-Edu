import type { ModelRef, Result } from '../challenge/types'
import { exceedsByteLimit, findForbiddenKeys, IMPORT_FORMAT, isPlainRecord, MAX_IMPORT_BYTES, show } from './importExport'

// Design import/export for non-beam models (task 34.2; multi-model-architecture MM-19).
// `ei-design` schemaVersion 2 adds the model identity: { format, schemaVersion, challengeId,
// model, design }. The beam keeps schemaVersion 1 (state/importExport.ts) unchanged. The same
// size limit, single JSON.parse, plain-object root and forbidden-key scan apply before any
// field is read; the model's `parseDesign` then validates the design object and returns a
// fresh design built from validated fields. Pure, never throws.

export const IMPORT_SCHEMA_VERSION_V2 = 2

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(['format', 'schemaVersion', 'challengeId', 'model', 'design'])

/** Serializes a v2 design file; `design` must already be in the model's fixed key order. */
export function exportDesignV2(design: unknown, ch: { id: string }, model: Readonly<ModelRef>): string {
  return JSON.stringify(
    { format: IMPORT_FORMAT, schemaVersion: IMPORT_SCHEMA_VERSION_V2, challengeId: ch.id, model: { id: model.id, version: model.version }, design },
    null,
    2,
  )
}

/**
 * Validates a v2 design file (text or parsed value) for the active challenge and model.
 * Returns the design, or one human-readable reason per failed check. Never throws.
 */
export function importDesignV2<D>(
  input: unknown,
  ch: { id: string },
  model: Readonly<ModelRef>,
  parseDesign: (design: Record<string, unknown>) => Result<D, string[]>,
): Result<D, string[]> {
  try {
    let data: unknown = input
    if (typeof input === 'string') {
      if (exceedsByteLimit(input)) {
        return { ok: false, error: [`The file is too large: design files must be at most ${MAX_IMPORT_BYTES} bytes (100 KB).`] }
      }
      try {
        data = JSON.parse(input)
      } catch {
        return { ok: false, error: ['The file is not valid JSON.'] }
      }
    }
    if (!isPlainRecord(data)) {
      return { ok: false, error: [`The file must contain a JSON object with format, schemaVersion, challengeId, model, and design (got ${Array.isArray(data) ? 'an array' : show(data)}).`] }
    }
    const forbidden = findForbiddenKeys(data)
    if (forbidden.length > 0) return { ok: false, error: forbidden }

    const reasons: string[] = []
    for (const key of Object.keys(data)) {
      if (!TOP_LEVEL_KEYS.has(key)) reasons.push(`Unexpected key "${key}" is not part of the design file format.`)
    }
    if (data.format !== IMPORT_FORMAT) reasons.push(`This is not a design file: format must be "${IMPORT_FORMAT}" (got ${show(data.format)}).`)
    if (data.schemaVersion !== IMPORT_SCHEMA_VERSION_V2) {
      reasons.push(`Unsupported design file version: schemaVersion must be ${IMPORT_SCHEMA_VERSION_V2} (got ${show(data.schemaVersion)}).`)
    }
    if (data.challengeId !== ch.id) reasons.push(`This design belongs to a different challenge: expected "${ch.id}" (got ${show(data.challengeId)}).`)
    const m = data.model
    const keysOk = isPlainRecord(m) && Object.keys(m).every((k) => k === 'id' || k === 'version')
    if (!keysOk || m.id !== model.id || m.version !== model.version) {
      reasons.push(`This design was made for a different analysis model: expected "${model.id}" version ${model.version} (got ${show(m)}).`)
    }
    const design = data.design
    if (!isPlainRecord(design)) {
      reasons.push(`The file has no design: "design" must be an object (got ${show(design)}).`)
      return { ok: false, error: reasons }
    }
    const parsed = parseDesign(design)
    if (!parsed.ok) reasons.push(...parsed.error)
    if (reasons.length > 0 || !parsed.ok) return { ok: false, error: reasons }
    return parsed
  } catch (e) {
    return { ok: false, error: [`The design file could not be read: ${e instanceof Error ? e.message : 'unknown error'}`] }
  }
}
