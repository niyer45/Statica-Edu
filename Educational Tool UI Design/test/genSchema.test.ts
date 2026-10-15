import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderChallengeSchema, sortKeys } from '../scripts/challengeSchema'

// Requirements 1.8, 1.9: schemas/challenge.schema.json is generated deterministically
// from the zod schema, and the committed file matches the generator output.

const SCHEMA_FILE = fileURLToPath(new URL('../schemas/challenge.schema.json', import.meta.url))

describe('renderChallengeSchema', () => {
  it('is byte-identical across runs and matches the committed schema file', () => {
    const first = renderChallengeSchema()
    const second = renderChallengeSchema()
    expect(second).toBe(first)
    expect(first).toBe(readFileSync(SCHEMA_FILE, 'utf8'))
  })
})

describe('sortKeys', () => {
  it('sorts object keys at every level and preserves array order', () => {
    const input = { b: 1, a: { z: [3, 1, 2], y: [{ d: 1, c: 2 }] } }
    const out = sortKeys(input)
    expect(JSON.stringify(out)).toBe('{"a":{"y":[{"c":2,"d":1}],"z":[3,1,2]},"b":1}')
    // Input is not mutated.
    expect(Object.keys(input)).toEqual(['b', 'a'])
  })
})
