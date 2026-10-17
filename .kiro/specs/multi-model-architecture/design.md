# Multi-model learning loop — design (task 45.2)

Companion to requirements.md, 2026-10-17. Type sketches are normative in shape and naming intent; exact generics may be adjusted during 34.1 if the requirement semantics are preserved and the change is recorded in HANDOFF.md.

## Current single-model coupling (audited 2026-10-17)

| Location | Beam/single-challenge assumption |
| --- | --- |
| `challenge/types.ts` | `Challenge` hard-codes `BeamDesign`, section limits/defaults, `load.forceN`, `support: 'fixedRoot'`, beam constraint names and `LockedField`. |
| `physics/types.ts`, `physics/analyze.ts` | `ModelId` has a single literal; `Analysis` has beam fields only. |
| `evaluation/types.ts` | `ConstraintId`, `ConstraintUnit`, `Efficiency`, `ComparedMetric`, `SectionState` and `PredictionOutcome.ratio` (tip deflection) are beam-specific. `TestResult.designSnapshot` is `BeamDesign`. |
| `state/session.ts`, `state/reducer.ts` | `SessionState.draft: BeamDesign`; edit actions (`applySection`, `setParam`, `setOrientation`) and `initSession`/`runTest` call beam validate/analyze/evaluate directly. |
| `state/persistence.ts` | Envelope schema hard-codes beam draft-error codes and constraint ids; `deserializeSession` re-analyzes with the beam solver and compares stored analysis/evaluation key-for-key (`agrees`). |
| `state/importExport.ts` | `ei-design` v1 envelope uses `beamDesignSchema` and section parameter tables. |
| `ui/App.tsx`, `ui/state/StoreProvider.tsx` | One bundled challenge is booted once; one StoreProvider and one persistence controller per page load. |
| `ui/shell/PlatformShell.tsx`, `LibraryPage`, `ChallengeDrawer`, `MyDesignsPage` | An entry is runnable iff `available && challengeId === loaded challenge.id`; My designs shows the single workspace. |
| `ui/workbench/*`, `ui/viewport/*`, `ui/controls/*`, `ui/history/*`, `ui/panels/*` | Section palette, numeric controls, beam viewport/fallback, beam metric labels in history/compare/results. `ModeExperience` holds beam-specific Guided text. |

**Compatibility constraint:** `agrees()` requires identical key sets. Adding any field to the beam `Analysis`, `Evaluation`, `PredictionOutcome` or `TestResult`, or changing their key order semantics, would invalidate every existing saved beam session. The beam result shape is therefore frozen (MM-03, MM-17). Model identity for the beam is carried by the existing `analysis.modelId` plus the challenge config.

## Type sketches

```typescript
// challenge/ — model-discriminated configs. BeamChallenge is today's Challenge, unchanged.
export interface ModelRef { id: ModelId; version: number }
export interface ChallengeCommon {
  id: string; version: number; title: string; difficulty: Difficulty
  allowedModes: InteractionMode[]; statement: string
  predictionPolicy: { requiredOnIterations: number[] }
  reflectionPrompt: { id: string; text: string }
  guidance?: GuidanceContent            // MM-21; beam keeps its current built-in text until moved
}
export type BeamChallenge = Challenge   // existing type; `model` optional, defaults to beam v1
export type AnyChallenge = BeamChallenge | TorsionChallenge | /* … per track */ never
export function modelOf(ch: AnyChallenge): ModelRef

// physics/ — shared analysis envelope; beam Analysis already satisfies it structurally.
export interface AnalysisCommon {
  modelId: ModelId
  applicable: boolean
  warnings: readonly ApplicabilityIssue<string>[]
  notApplicableReasons: readonly ApplicabilityIssue<string>[]
  unsupportedEffects: readonly string[]
  assumptions: readonly string[]
}
// New models add `modelVersion: number` and, where needed, `status: 'solved' | 'mechanism'`.

// evaluation/ — shared evaluation envelope.
export type ConstraintUnit = 'm' | 'Pa' | 'kg' | 'bool' | 'rad' | 'Hz' | 'K' | 'ratio' | 'W/K'
export interface EvaluationOf<C extends string, M extends Record<string, number>> {
  status: EvaluationStatus; accepted: boolean
  constraints: ConstraintResultOf<C>[]; failures: C[]
  efficiency: M                          // beam keeps its three keys; name kept for compatibility
  facts: ExplanationFact[]
}
export type PredictionOutcomeV2 =
  | { metric: string; scorable: true; predicted: PredictionDirection; actual: PredictionDirection; ratio: number; matched: boolean }
  | { metric: string; scorable: false; predicted: PredictionDirection; reason: 'noFiniteMetric' }
// Beam continues to store the existing PredictionOutcome (no `metric`/`scorable` keys).

export interface TestResultOf<D, A extends AnalysisCommon, E> {
  id: string; iteration: number; label?: string
  designSnapshot: Readonly<D>; analysis: Readonly<A>; evaluation: Readonly<E>
  accepted: boolean; failures: string[]
  prediction?: Prediction; predictionOutcome?: PredictionOutcome | PredictionOutcomeV2
  timestamp: string
}

// state/ — registry binding pure layers (state may import every domain layer).
export interface ModelDefinition<Ch, D, A extends AnalysisCommon, E, Edit> {
  ref: ModelRef
  loadChallenge(json: unknown): Result<Ch, SchemaIssue[]>
  validateDesign(d: D, ch: Ch): DesignError[]
  applyEdit(draft: D, edit: Edit, ch: Ch): Result<D, DesignError[]>
  sameDesignIgnoringId(a: D, b: D): boolean
  cloneDesign(d: D): D
  analyze(d: D, ch: Ch): A                 // throws ModelInvariantError
  evaluate(d: D, a: A, ch: Ch): E
  primaryMetric: { id: string; label: string; read(a: A): number | undefined }
  comparisonMetrics: readonly { id: string; read(a: A): number | undefined }[]
  explainChange(prev: TestResultOf<D, A, E>, next: TestResultOf<D, A, E>): ExplanationFact[]
  persistence: { envelopeVersion: 1 | 2; designSchema: ZodType; errorCodes: readonly string[]; constraintIds: readonly string[] }
  importDesign(json: unknown, ch: Ch): Result<D, string[]>
  exportDesign(d: D, ch: Ch): string
}
export function modelFor(ref: ModelRef): ModelDefinition<…> | undefined  // undefined → unavailable
```

The beam definition wraps the existing functions (`loadChallenge`, `validateDesign`, `analyze`, `evaluate`, `scorePrediction`, `importDesign`/`exportDesign`, `compareResults`/`explainChange`) without moving or rewriting them. Its `applyEdit` adapts the existing `applySection`/`setParam`/`setOrientation` reducer branches.

## Reducer generalization

`sessionReducer(s, a, ch)` becomes a function of the model definition: `makeSessionReducer(def)(s, a, ch)`. Shared actions keep their current semantics and notices. New models use `{ type: 'edit'; edit: Edit }`. The beam's existing action types stay accepted for the beam definition, so the existing reducer tests and the model-based harness (`test/state/model.ts`) run unchanged. The harness is then parameterized to run its generic invariants (Properties 28–34, 36, 37) against both the beam and the test-only model (MM-27).

Prediction: `runTest` reads `def.primaryMetric`. The beam continues to call the existing `scorePrediction`, so stored beam outcomes stay identical. New models produce `PredictionOutcomeV2`.

## Persistence and import

| Envelope | Used by | Writes | Reads |
| --- | --- | --- | --- |
| v1 `{schemaVersion:1, savedAt, session, undefinedFields}` | Beam challenges only | Unchanged bytes | Existing validation, unchanged |
| v2 `{schemaVersion:2, savedAt, model:{id,version}, session, undefinedFields}` | Non-beam challenges | New | Model-dispatched validation (MM-18) |

`migrations.ts` does **not** migrate v1 → v2. Each model definition declares its envelope version, and `deserializeSession` rejects an envelope whose version or `model` does not match the active challenge. This keeps beam saves readable by the current production release if a rollback happens. A future beam schema change would add a real v1 → next migration under its own task.

Design import: beam `ei-design` v1 unchanged. New models use `ei-design` v2 with `model`. The size limit, single-parser rule, forbidden-key scan and per-reason messages are shared helpers extracted from the current implementation without changing beam messages.

## Shell and store integration (task 34)

- **Boot:** `App` validates every bundled challenge linked from an available catalog entry. A failing *available* config shows the existing full-page error (unchanged behavior for today's single challenge). Unlinked dormant configs are not booted.
- **Store per challenge:** a `ChallengeHost` keyed by challenge id mounts `StoreProvider` with that challenge's model definition, persistence controller and initial session. Switching challenges unmounts the previous host; its state is already persisted synchronously. The current "Workbench stays mounted while visiting other pages" behavior is preserved for the active challenge.
- **Library/drawer:** an entry is runnable iff it passes the MM-06 guard. Mode is selected before entry per challenge (D-37). The drawer's preview/unavailable text is unchanged for unregistered entries.
- **My designs:** reads each runnable challenge's own storage key through its model's deserializer (read-only) to decide whether a workspace card exists, labeled by challenge title. It never enumerates unknown storage keys.
- **Dev snapshot:** `{ challengeId, session }` for the active host, dev port only.

## Implementation increments and gates

1. **34.1 step 1 — Registry with beam only.** Introduce `ModelDefinition`, the beam definition, the bundled-challenge registry, `makeSessionReducer` and the persistence/import dispatch. No user-visible change. Gate: every existing test passes unchanged; a new byte-compatibility test round-trips a recorded v1 beam save fixture; guard tests for MM-06/MM-07.
2. **34.1 step 2 — Per-challenge hosts and isolation.** ChallengeHost, multi-challenge boot, shell runnable check, My designs attribution and dev snapshot shape. Test with two beam-model configs registered *in test only* (Cantilever Beam I plus a test fixture), never activating Beam II in the bundled catalog. Gate: isolation/switch/reload/reset tests, existing E2E unchanged, full browser gate.
3. **34.2 — Model UI slots and generic content.** UI registry, model-declared metrics in history/compare/results, Guided content per challenge, test-only model exercising v2 persistence/import, not-scorable predictions and generic reducer properties. Gate: contract tests MM-26, coverage thresholds, full browser gate.
4. **47.2/47.3 onward** register real models per D-38 and flip `available` only after each track's integrated verification.

## Test plan summary

Unit/property tests: registry/guard, dispatch by identity, v1 byte-compatibility fixture, v1/v2 cross-rejection, import cross-challenge/model rejection, unit formatting, not-scorable outcome, and generic reducer properties for beam plus the test model. Component tests: shell runnable gating, per-challenge My designs, host switching preserving state, model slot rendering with fallback. E2E (desktop and Pixel 7): the existing 24 cases unchanged. When a second runnable challenge exists, add a switch/reload isolation case with keyboard entry, a fallback case and axe checks. Test-only registrations must not leak into the production bundle; a build-time guard test asserts that the bundled catalog's available entries resolve only to bundled configs.

## Risks and mitigations

- *Silent beam save invalidation:* frozen beam result shape, recorded v1 fixture, no v1 → v2 migration.
- *Generic types leaking `any`:* the registry exposes an existential wrapper (`RegisteredModel`) whose methods are only called with values the same definition produced. Keep casts inside the registry module and cover them with dispatch tests.
- *Bundle size:* model UI/visualization chunks load lazily per model, while main-bundle fallbacks stay small. Existing chunk-size warnings remain nonblocking.
- *Over-generalization:* contracts cover the five scoped models only. Freeform, accounts (38) and AI (39) are out of scope.
