// Pure rendering of the challenge JSON Schema from the zod challenge schema (D-13).
// Output is deterministic: object keys are sorted recursively, 2-space indent, trailing newline.
// No side effects on import; scripts/gen-schema.ts writes the result to disk.
import { zodToJsonSchema } from 'zod-to-json-schema'
import { challengeSchema } from '../src/challenge/schema'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** Returns a copy with object keys sorted (code-point order) at every level; array order is kept. */
export function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out: { [key: string]: Json } = {}
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key])
    return out
  }
  return value
}

export function renderChallengeSchema(): string {
  const schema = zodToJsonSchema(challengeSchema, {
    $refStrategy: 'none',
    target: 'jsonSchema7',
  }) as { [key: string]: Json }
  schema.title = 'Challenge'
  return `${JSON.stringify(sortKeys(schema), null, 2)}\n`
}
