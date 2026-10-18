import { describe, expect, it } from 'vitest'
import { BUNDLED_CHALLENGE_JSON, bundledChallengeJson } from '../src/challenge/bundled'
import { catalog } from '../src/challenge/catalog'
import { modelFor, modelOf } from '../src/state/models'
import { runtimeForJson } from '../src/state/runtimes'

// Catalog/registry guard (task 34.1 step 1; MM-06, MM-07). An available card must resolve to a
// bundled config that loads and whose explicit model is registered. Preview cards stay
// unavailable until their own model tracks (46–50) are verified, and dormant Beam II is unlinked.

describe('catalog availability guard', () => {
  const available = catalog.filter((e) => e.available)

  it.each(available.map((e) => [e.title, e] as const))('%s resolves to a loadable bundled challenge with a registered model', (_title, entry) => {
    if (!entry.available) throw new Error('filtered to available entries')
    // Each config loads through the runtime of its own declared model (MM-02), never the beam loader.
    const json = bundledChallengeJson(entry.challengeId)
    const runtime = runtimeForJson(json)
    if (runtime === undefined) throw new Error(`${entry.challengeId} declares an unregistered model`)
    const loaded = runtime.load(json)
    if (!loaded.ok) throw new Error(loaded.error.map((i) => i.message).join('; '))
    expect(loaded.value.id).toBe(entry.challengeId)
    expect(modelFor(modelOf(loaded.value))).toBeDefined()
  })

  it('keeps exactly the owner-activated challenges available', () => {
    expect(available.map((e) => e.title)).toEqual(['Cantilever Beam I', 'Mounting Bracket I', 'Torsion Shaft I', 'Heat Sink I', 'Braced Frame I', 'Vibration Isolation I'])
  })

  it('bundles only challenges an available card links to (no dormant Beam II)', () => {
    const linked = available.map((e) => (e.available ? e.challengeId : ''))
    expect(Object.keys(BUNDLED_CHALLENGE_JSON).sort()).toEqual([...linked].sort())
    expect(bundledChallengeJson('cantilever-beam-2')).toBeUndefined()
    expect(bundledChallengeJson('__proto__')).toBeUndefined()
  })
})
