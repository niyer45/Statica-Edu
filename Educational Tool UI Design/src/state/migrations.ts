/** Versioned persistence-envelope migrations. No legacy session format has shipped yet. */
export const CURRENT_SCHEMA_VERSION = 1
export type Migration = (saved: Record<string, unknown>) => Record<string, unknown>
export const migrations: Readonly<Record<number, Migration>> = Object.freeze({})

export function migrateEnvelope(saved: Record<string, unknown>, registry = migrations): Record<string, unknown> {
  let value = saved
  let version = value.schemaVersion
  if (!Number.isInteger(version) || (version as number) < 0 || (version as number) > CURRENT_SCHEMA_VERSION) throw new Error('Unsupported saved session version')
  while (version !== CURRENT_SCHEMA_VERSION) {
    const migrate = registry[version as number]
    if (!migrate) throw new Error('No migration path for saved session')
    value = migrate(value)
    if (value.schemaVersion !== (version as number) + 1) throw new Error('Migration must advance one version')
    version = value.schemaVersion
  }
  return value
}
