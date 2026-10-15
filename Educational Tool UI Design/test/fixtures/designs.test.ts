import { describe, expect, it } from 'vitest'
import bundledChallenge from '../../src/challenge/challenges/cantilever-beam-1.json'
import { loadChallenge } from '../../src/challenge/loader'
import { validateDesign } from '../../src/geometry/validate'
import { FIXTURES } from './designs'

// Sanity check for the verified fixtures (Req 8.10): every fixture is a valid design for the
// bundled challenge, so evaluation tests exercise physics and constraints, not validation.

const loaded = loadChallenge(bundledChallenge)
if (!loaded.ok) throw new Error(`Bundled challenge failed to load: ${JSON.stringify(loaded.error)}`)
const challenge = loaded.value

describe('verified fixtures', () => {
  it('has unique names matching design ids', () => {
    const names = FIXTURES.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
    for (const f of FIXTURES) expect(f.design.id).toBe(f.name)
  })

  it.each(FIXTURES.map((f) => [f.name, f] as const))('%s passes validateDesign', (_name, f) => {
    expect(validateDesign(f.design, challenge)).toEqual([])
  })
})
