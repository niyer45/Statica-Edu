import bracedFrame1 from './challenges/braced-frame-1.json'
import cantileverBeam1 from './challenges/cantilever-beam-1.json'
import fatigueAnalysis1 from './challenges/fatigue-analysis-1.json'
import heatSink1 from './challenges/heat-sink-1.json'
import mountingBracket1 from './challenges/mounting-bracket-1.json'
import pressureVessel1 from './challenges/pressure-vessel-1.json'
import stressStrain1 from './challenges/stress-strain-1.json'
import torsionShaft1 from './challenges/torsion-shaft-1.json'
import vibrationIsolation1 from './challenges/vibration-isolation-1.json'

// Bundled challenge registry (task 34.1 step 1; MM-06). Maps challenge id → raw JSON, typed
// `unknown` so every config goes through its model's loader. Only challenges that a catalog
// entry may link to belong here; dormant configs (Cantilever Beam II, task 52) stay out.

export const BUNDLED_CHALLENGE_JSON: Readonly<Record<string, unknown>> = Object.freeze({
  'cantilever-beam-1': cantileverBeam1 as unknown,
  // Task 47.3, owner-approved activation 2026-10-17.
  'torsion-shaft-1': torsionShaft1 as unknown,
  // Task 50.3, owner-approved activation 2026-10-17.
  'vibration-isolation-1': vibrationIsolation1 as unknown,
  // Task 48.3, owner-approved activation 2026-10-17.
  'heat-sink-1': heatSink1 as unknown,
  // Task 46.3, owner-approved activation 2026-10-17 (Kt source disclosed per D-41).
  'mounting-bracket-1': mountingBracket1 as unknown,
  // Task 49.3, owner-approved activation 2026-10-17.
  'braced-frame-1': bracedFrame1 as unknown,
  // Task 69, owner-requested activation 2026-10-19 (D-59).
  'pressure-vessel-1': pressureVessel1 as unknown,
  // Task 70, owner-requested activation 2026-10-19 (D-60).
  'fatigue-analysis-1': fatigueAnalysis1 as unknown,
  // Task 72 (D-62), owner-requested activation 2026-10-19.
  'stress-strain-1': stressStrain1 as unknown,
})

/** Raw config for a bundled challenge id, or undefined when none is bundled. */
export function bundledChallengeJson(id: string): unknown {
  return Object.prototype.hasOwnProperty.call(BUNDLED_CHALLENGE_JSON, id) ? BUNDLED_CHALLENGE_JSON[id] : undefined
}
