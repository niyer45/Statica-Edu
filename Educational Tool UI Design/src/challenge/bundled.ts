import cantileverBeam1 from './challenges/cantilever-beam-1.json'
import torsionShaft1 from './challenges/torsion-shaft-1.json'

// Bundled challenge registry (task 34.1 step 1; MM-06). Maps challenge id → raw JSON, typed
// `unknown` so every config goes through its model's loader. Only challenges that a catalog
// entry may link to belong here; dormant configs (Cantilever Beam II, task 52) stay out.

export const BUNDLED_CHALLENGE_JSON: Readonly<Record<string, unknown>> = Object.freeze({
  'cantilever-beam-1': cantileverBeam1 as unknown,
  // Task 47.3, owner-approved activation 2026-10-17.
  'torsion-shaft-1': torsionShaft1 as unknown,
})

/** Raw config for a bundled challenge id, or undefined when none is bundled. */
export function bundledChallengeJson(id: string): unknown {
  return Object.prototype.hasOwnProperty.call(BUNDLED_CHALLENGE_JSON, id) ? BUNDLED_CHALLENGE_JSON[id] : undefined
}
