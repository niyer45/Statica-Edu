# Handoff: Statica MVP

Last updated: 2026-10-15, completed task 22.2. Next: 21.1. Current work is verified locally; see MILESTONE3.md for per-task evidence and pushed batch records.

Current Milestone 3 progress: **22.2 complete; next 21.1**. The per-task ledger in [MILESTONE3.md](MILESTONE3.md) supersedes historical open-task statements below.

## A. Current state

Implemented and verified:
- **Milestone 0 (tasks 1–2):** template adaptation, exact dependency pins, ESLint import boundaries, architecture test, zod challenge schema and generator, self-hosted fonts, CSP build plugin, CI workflow (`.github/workflows/ci.yml`), README/DECISIONS. The template's prototype physics was removed.
- **Milestone 1 (tasks 3–12):** the full pure domain (units, challenge loader, geometry, physics, applicability, evaluation, explanations, prediction scoring, fixtures, pure import/export). Properties 1–27 and fixtures E1–E6 pass. Line coverage at the M1 gate:

  | Module | Coverage |
  |---|---|
  | physics | 100% |
  | geometry | 99.06% |
  | evaluation | 98.77% |
  | state | 97.89% |

- **Milestone 2, complete against Requirement 33.8/component gate:**
  - 13.1: session state, selectors, and reducer edit actions.
  - 13.2: store and bootstrap.
  - 13.3: Workbench layout and stubs.
  - 13.4: tests.
  - 13.5–13.6: platform shell and full navigation/filter/mode/session-preservation tests.
  - 14.1 and 14.2: three.js beam mesh and deformation, with tests.
  - 14.3–14.5: demand-rendered R3F viewport, shared controls/summary, beam drop raycast, typed SVG fallback, error recovery, and viewport tests. Automated checks pass; real-browser rendering validation remains pending.
  - 15.1–15.2: section palette/drop target and full palette component suite.
  - 16.1–16.2: dimension handles, ray/axis projection, frame throttling, limit feedback, and unit/integration tests.
  - 17.1–17.2: numeric controls and four-kind/invalid/locked-field component suite.
  - 18: four-profile Workbench gate; all component tests and required checks pass.
  - User override D-26: uncluttered 3D scene, with envelope/static annotations removed and handle feedback below Canvas.

- **Milestone 3, partial:** tasks 19.1–19.2 are implemented and verified. Task 19.3 adds the reusable model-based test harness; tasks 19.4–19.5 verify Properties 28–29 (append-only history and snapshot isolation). Reducer `runTest`, `setPrediction` and `cancelPrediction` now work; student-facing panel/dialog wiring remains later tasks.

What works in the running app (`pnpm run dev`):
- Platform shell:
  - Library with filters and search.
  - Challenge drawer.
  - Learning paths, My designs, Notebook, Help.
  - Preview challenges and Freeform are disabled ("Not available yet").
- Opening Cantilever Beam I in Guided or Parametric mode. Both open the same Workbench and store, and the Workbench stays mounted across navigation.
- Changing the section: click or Enter/Space on a palette tile, or drag a tile onto the viewport.
- Editing dimensions: number inputs with strict validation and inline errors, sliders in clamp mode, orientation radios, read-only locked fields, and clamped 3D dimension-handle drags.
- Without WebGL, or on viewport failure: typed SVG beam/section views, stored-result deformation, shared camera/toggle controls, and one fallback notice through the existing live region.
- Draft badge ("Draft" / "Tested #n"), workflow stepper, footer model-limits notice, and the live region.

Incomplete:
- **Run Test remains disabled in the UI.** Task 19.1 reducer behavior is implemented and tested through the existing store. Prediction confirmation/results panels are still unwired; restore, compare toggling, reflection, submission, import and reset are also implemented at reducer level; their UI wiring remains in later tasks.
- **Viewport code and automated tests are implemented.** Real browser rendering, CSP, label layout, touch ergonomics, and performance still need manual/browser verification; do not confuse the passing no-op-renderer integration tests with a real GPU/browser pass.
- These panels and dialogs are non-interactive stubs from 13.3: RequirementsPanel, HistoryCompare, ReflectionPrompt, PredictionDialog, SubmitDialog, HelpDialog, ImportExportBar.
- No persistence yet (task 20) and no E2E tests yet (`e2e/` is empty).

## B. Task progress

- **Last completed:** task 22.2.
- **Next implementation:** **21.1**, following the existing task specifications and dependency graph.
- **Gate evidence:** `src/ui/workbench/milestone2.test.tsx` drives the real Workbench/palette/controls/lazy fallback for all four profiles, checking each numeric value, oriented SVG outline/envelope summary and actual Three.js mesh bounds against typed state. Edits leave stored history/deformation unchanged. `BeamView.test.tsx` renders the real R3F scene with a no-op GPU renderer for all four profiles and checks the D-26 uncluttered presentation. Neither suite is a real-browser/GPU pass.
- **Viewport files:**

  | File | Role |
  |---|---|
  | `Viewport3D.tsx` / `BeamView.tsx` | Lazy WebGL scene, actual canvas accessible name, raycast drop highlight, local camera controls, context-loss detection, scene geometry and resource disposal. |
  | `ViewportBoundary.tsx` | Main-bundle error boundary outside Suspense; catches lazy import rejection and context/scene construction errors. |
  | `FallbackViewport.tsx` | Main-bundle recovery UI, local view controls, section drop target, and one announcement through Workbench's existing `notify`. |
  | `Fallback2D.tsx` / `projection.ts` | Template SVG projection/painter sorting, wall hatch/floor, pointer/arrow-key orbit; typed cross-section with tube hole and independent flange/web dimensions; SI coordinates mapped to 550 scene units per metre. |
  | `SceneControls.tsx` / `SceneSummary.tsx` / `sceneLayout.ts` | Shared chrome and state-derived summary/layout. `sceneLayout` imports the pure deformation helper and geometry outline directly, keeping the main-bundle fallback independent of Three.js. |
  | `DimensionHandles.tsx` / `handleDrag.ts` | One named sphere per geometry descriptor; pointer capture; closest-ray/axis projection; full-dimension/inward-flange scaling; latest-event-per-rAF clamp dispatch; feedback callbacks to the DOM bar below Canvas; immediate orbit suppression/restoration. |

- `src/BeamScene.tsx` and `LegacyFallback.tsx` are deleted. The architecture test now requires the typed fallback and verifies the old scene remains absent.
- Deformation remains static for all users, including reduced-motion users. Draft edits change solid geometry and dimensions; dashed deformation always comes from the latest frozen Test_Result or baseline. No formulas were moved out of the physics domain.
- Handle cleanup covers release, pointer cancel/lost capture, window blur, Escape, unmount, and section-kind/orientation changes. Pending unrendered motion is discarded on release/cancel, preserving the last clamped edit. Diameters/width/height/web map half-dimension handle motion to full parameter changes; flange thickness has reversed inward-face motion. At 90°, local-v motion maps onto negative global Z.
- **Tests:** viewport summary/control/raycast/layout tests; fallback hole/dimension/deformation/orbit tests; lazy-load/context-creation/context-loss recovery tests; palette Space/same-kind equivalence tests; handle projection/throttle/limit unit tests; real R3F reconciler + store integration with a no-op GPU renderer (capture, coalesced dispatch, clamping, labels, orbit, cancellation, and handle replacement).
- **Still open:** task 19.6 onward, including the dedicated property sequence suites and later Milestone 3 gates, plus the separately listed real-browser/CI integration follow-ups. All M2 checkboxes, including checkpoint 18, are complete. The original requirements/design and dependency graph were not rewritten; D-26 records the explicit user override.
- The optional and checkpoint tasks may need to be started by hand, because the task scheduler doesn't list them as ready.

## C. Technical context

### Decisions and why

- **Task 19.5 / Property 29:** `test/state/snapshot.p29.test.ts` captures detached full TestResult values at record time and checks them after every action through the existing command harness. The generated sequence records every section kind with stored predictions, applies dimension/orientation changes and rejected locked edits, records an iteration without prediction, and exercises restore/import/submission/reset before a random valid/hostile command tail. It also checks that draft objects/sections never alias stored snapshots. Four regression cases demonstrate detection of corrupted design snapshots, Analysis, Evaluation and stored predictions. Existing reducer/architecture/spec content required no changes or deviations.
- **Property runtime:** the first full run timed out while using many Vitest structural matchers. The final hook uses Node strict structural/reference assertions, preserving complete field coverage and 200 default sequences while reducing runtime. This property has a 30-second test timeout for the supported `PBT_RUNS=2000` mode; that targeted deep run passes in about nine seconds.
- **Standing documentation instruction:** after every completed task, synchronize HANDOFF.md, the current-task pointer/rules in AGENTS.md, and sibling tasks.md checkboxes; update other supporting Markdown when affected. Record verification results, next task and local/pushed status.

- **Task 19.4 / Property 28:** `test/state/history.p28.test.ts` registers an append-only hook with the existing command harness. It captures all recorded entry references independently of the history array, checks their original indexes after every action, verifies baseline value/iteration preservation, and checks exact growth against the independent model. A successful Run Test adds one fresh result with injected id/time and the next iteration; all other/rejected actions add zero. Each generated sequence first records three iterations and exercises gated rejection, cancel, restore, valid import and reset, then runs a random command tail with valid/hostile payloads. The tagged property uses `assertProperty` (200 runs by default, fixed seed, `PBT_RUNS` override). A regression test proves the hook catches replacement of a non-baseline entry even when ids, values and length match. No reducer changes or new deviations were needed.

- **Task 19.3 test infrastructure:** `test/state/model.ts` exports `createHarness`, `sessionCommands` (`fc.commands`, default max 50), `SessionCommand`, `commandInputs`, `reachableSession` (default max 30 actions) and `assertSessionInvariants`. The independent model tracks result ids/count, pending prediction, reflection and step count; it does not call the reducer to predict its own output. History targets resolve at command execution so valid/baseline/previous/missing targets remain meaningful after shrinking. Run Test ids and timestamps are deterministic and unique per step, following the injected factory contract. Trusted action discriminants/mode tags/clock/id factories stay typed; hostile input includes geometry numbers, unknown section kinds/fields/targets, bad prediction directions/orientations, oversized/non-string text and arbitrary/locked-field/malformed imports.
- **Harness reuse:** run `assertProperty(fc.property(sessionCommands(ch), commands => fc.modelRun(() => createHarness(ch, { hooks: [yourInvariant] }), commands)))`. The baseline invariant check and every registered hook execute after each command, including rejected actions; hooks receive action, before/after state, a detached model snapshot, challenge and step. Use `reachableSession(ch)` for persistence/state properties; it returns `{ state, actions }` produced only by real reducer transitions, with a concrete replayable trace. All randomized harness tests use the existing fixed-seed `assertProperty`/`PBT_RUNS` helper. Later property suites must add their own numbered feature tags; this infrastructure does not mark Properties 28–37 or later task checkboxes complete.

- **Task 19.2:** all six remaining reducer actions are implemented. Restore deep-copies the selected snapshot, clears stale pending prediction/dialog/errors and recomputes status against the latest result. Fresh draft ids are deterministic `snapshotId:restored:n`, choosing the first suffix absent from the current draft/result/snapshot ids; no randomness or Action extension. Unknown restore/compare ids and baseline comparison toggles are exact no-ops. Comparisons stay in history order, with a visible notice on a fourth selection.
- **Reflection/submission:** reflection is stored verbatim up to 2,000 characters; oversized/non-string payloads are rejected unchanged. Submit rejects unknown/baseline/blank-reflection targets unchanged and copies stored status/efficiency plus injected time, replacing the previous submission without grading text.
- **Import/reset semantics:** import delegates to the existing pure helper. Rejection returns the exact state (including UI), per Req 23.6; later import UI must call that helper to display every reason. Valid import clears errors/pending/dialog and recomputes status. Reset restores an isolated baseline draft, clears compare/reflection/submission/transient state, preserves mode and **all history entries by reference**, and recomputes status against the latest snapshot. It never regenerates the baseline or deletes tests (Req 15.4/18.1). No requirements/design were rewritten.

- **Task 19.1 reducer flow:** validate the draft before prediction gating (Requirement 17.2 takes precedence over the pseudocode's reversed order). Valid drafts require a pending prediction at configured iterations (1 and 3); stale iteration predictions cannot bypass gating. `setPrediction` validates the direction and optional 0–500-character explanation, stores a frozen pending prediction, and does not itself run analysis. `cancelPrediction` clears pending prediction and closes the dialog without changing draft/history.
- **D-27 action extension:** `setPrediction` now requires `now: string`, used for `Prediction.createdAt`; the original design Action omitted this despite requiring that field. Future task 22.2 must dispatch `setPrediction` with `now: store.clock()`, then call `store.runTest()`. Both actions can be dispatched in one event; the existing store integration test proves the sequence works. No new store API or clock access inside the reducer was added.
- **Recorded tests:** `runTest` clones/deep-freezes the draft, calls the existing analyze/evaluate/score functions, records injected id/time and optional prediction/outcome, and appends a deep-frozen result in a frozen history array. Prior entries retain identity; the draft/pending inputs are never frozen or mutated. Success clears errors/pending/dialog/old notice and marks the draft tested. Compare selection retains the highest-numbered three selected non-baseline results in history order, automatically including the new result; baseline remains implicitly comparable.
- **Failure paths:** invalid draft returns all geometry errors, closes the prediction dialog, and retains draft/status/history/pending prediction. `PhysicsInvariantError` creates an error notice, appends no result and retains the pending prediction for retry. Unexpected programming errors are rethrown. Out-of-assumption valid geometry still records a result with `modelNotApplicable` from the domain evaluator.

- **Built inside the Figma template, keeping its stack and look** (user choice). Region and class names from the template's `index.css` and `platform*.css` drive the responsive layout. The product is named "Statica".
- **3D view:** R3F main scene, with a typed adaptation of the template SVG projection for fallback. Recovery is available from the main application bundle even when the separate 3D chunk fails.
- **Shared types:** `TestResult`, `Prediction`, and `PredictionOutcome` live in `src/evaluation/types.ts`, so evaluation never imports state. `state/session.ts` re-exports them.
- **Tolerance:** `REL_TOL` and `withinLimit` live in `physics/tolerance.ts`, so physics never imports evaluation. `evaluation/tolerance.ts` re-exports them.
- **Section defaults (D-25):** Challenge has a required `sectionDefaults` field, which `convertSection` uses.
- **Grounded explanations:** every number in an explanation fact equals `formatBasis(v, d)` for a basis value `v` with `d` ∈ {0, 2} (Property 27).
- **Session start:** `initSession(ch, now, id, mode?)` returns `Result<SessionState, InitSessionError>` instead of throwing (Req 15.3). `compareSelection` starts as `[]`, because the baseline is implicitly always comparable (Req 18.7).
- **Rejected edits:** `setParam` on a parameter the current section doesn't have is rejected with `SECTION_NOT_ALLOWED`. Locked fields are rejected with `LOCKED_FIELD_CHANGED`.
- **Mode selection:** this is the provider-only action `selectMode`, handled in `ui/state/storeReducer.ts` and not in the domain Action union. It rejects modes outside `allowedModes`.
- **Dev snapshot:** `window.__EI_STATE__` is a frozen getter that exists only when `import.meta.env.DEV` is true or the mode is `'test'`. It is absent from production bundles.
- **Live region:** `ui/a11y/LiveRegion` is portaled to `document.body`, because the shell hides the Workbench with `hidden` during navigation (Req 30.6). Toast has no `role="status"`, so messages aren't announced twice.
- **Ranges:** NumericControls takes its ranges from `geometry/handlesFor`, so inputs, sliders and 3D handles agree, including dependent tube/flange/web bounds.
- **Drag and drop:** the palette uses `application/x-statica-section`. `Viewport3D` supplies a mesh raycast to `useSectionDrop` so only beam hits highlight in 3D; drops on empty canvas still apply the section. The SVG fallback highlights its whole scene.
- **Deformed shape:** `ui/mesh` scales it uniformly by min(15, 0.3·L/δ_tip). rectFlat is also in the capped regime, not only tinyCircle.

### Deviations from the spec, not yet written into the spec

- **D-27:** required injected `now` was added to `setPrediction` to populate the already-required `Prediction.createdAt`. See the decision and confirmation sequence above; original requirement/design documents were not regenerated.

- **D-26, explicit user direction:** remove the visible envelope, static annotations/guides and fixed-support text overlay from the 3D model; place active handle feedback below Canvas. The original visible-presentation requirements are superseded as listed in `DECISIONS.md`. Constraints, physical results and stored snapshots are unchanged; the separate 2D section diagram retains its labels/envelope. Future agents must preserve this preference.

- **Req 2.7:** the round-trip tolerance can't be met for |x| above roughly 16.8 km, because of double precision. The test uses a relative floor there.
- **Req 13.4:** the "exactly 0.02" boundary isn't representable as a double.
- **design.md arithmetic:** the design claims 0.06/0.6 = 0.09999999999999999. It actually evaluates to 0.1.
- **The template shell's "Tested this session"** learning-path label appears only when real session results exist.
- **My designs** reads `session.history` directly and uses `selectTestCount`. There is no dedicated list selector.

### Known limitations

- **Dotted deformation outline review (user report, 2026-10-15):** selecting a new section changes the solid draft beam but deliberately keeps the deformation from the latest stored result (initially Baseline), per Requirements 25.2–25.5. `BeamView` reads `selectLatestResult(session)` and uses that result's snapshot/inertia/deflection; draft changes must not recalculate this display. Pending tasks 21.1 (Run Test/results panel) and 22.2 (prediction confirmation) make recording a new result available in the UI. After a successful test, the outline reads that new stored result. No duplicate task or live-draft deformation change was added. The uniform 0.3·L visual cap may also make highly flexible tested designs appear similarly deflected; numerical results remain authoritative.

- **CSP and R3F:** the scene uses a procedural `DataTexture` and DOM Html labels, with no remote assets or blob/data URLs added. The production build retains `default-src 'self'`. Actual browser CSP validation remains pending; do not add exceptions without observed evidence.
- **Browser verification blocked in this environment.** Preview failed with `listen EPERM 127.0.0.1:4173`; launching cached Chromium aborted. The installed Playwright expects Chromium revision 1248, while the available cache contains 1208. In a normal development environment, run `pnpm exec playwright install chromium`, then verify the production preview. No browser/CSP/performance/visual pass is claimed.
- **Repository/upload:** private `niyer45/Statica-Edu`, branch `main`. Milestone 2 closeout is delivered in the commit titled `Finish Milestone 2 and simplify the 3D scene`; the preceding viewport/handle commit is `cfa40ccfbf31f0933afeed27ebb2c19b184f3e24`. The local Kiro directory still has no `.git`; previous authorized updates used GitHub's tree/commit API with a branch-head lease. Last verified pushed main is `a8a3c6b5b37bb162675de5738d2d9c9df85aec33` (`Complete reducer tasks 19.1–19.4 and document tested deformation`), based on M2 closeout `af02592edadc4a128958d66cc21ee2519927d019`. Task 19.5 is local and not yet pushed; inspect the current branch head before any future upload. Preserve the sibling application and `.kiro` directories and existing repository-root README. The CI workflow remains nested in the application directory; see audit below.
- **No horizontal scroll at 320–2560 px** isn't verified in a browser. It relies on the template CSS.

## D. Testing

Verified after task 19.5 (2026-10-15; Node 24.15.0, pnpm 10.34.3 in this environment; Node 22 remains the project/CI target):

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 860 tests pass; lint, typecheck and build pass |
| `pnpm run typecheck` | clean |
| `pnpm run lint` | 0 errors, 10 `no-explicit-any` warnings (in `src/challenge/*.test.ts` and `vite.config.ts`, left as is) |
| `pnpm run build` | passed; R3F remains in the lazy viewport chunk (~963 kB minified / 258 kB gzip), which triggers Vite's non-failing size warning |

- Task 19.5 adds one tagged model-based property and four regression-detection cases in `test/state/snapshot.p29.test.ts`; all five also pass with `PBT_RUNS=2000`.
- Task 19.4 adds the tagged model-based Property 28 and one regression-detection test in `test/state/history.p28.test.ts`. All required checks pass; Properties 30–37 remain open.
- Task 19.3 adds six tests in `test/state/model.test.ts`: randomized command execution, reachable-state replay in both modes, every action/hook ordering, detection of a broken runTest reducer, seed/path propagation on hook failure, and empty reachable-state generation. No application source or specification content was changed during 19.3.
- Task 19.2 adds 14 focused cases in `src/state/learningLoop.test.ts`, covering all six actions, frozen-input purity, restore/retest, comparison limits, exact rejection identity and submission replacement. Remaining property tasks remain open.
- Task 19.1 adds 18 focused reducer cases in `src/state/runTest.test.ts` plus one injected-time/id confirmation test in `src/ui/state/StoreProvider.test.tsx`. Dedicated reducer property/example suites (19.6–19.15) remain open; they were not marked complete.
- No known failing automated tests. Drei's dependency path emits `THREE_CJS_DEPRECATED` during Vitest; application code uses ES module imports.
- The pinned oxfmt 0.2.0 changed string quotes and removed a required separator from an inline TypeScript object type during formatting. The affected type was repaired and all checks rerun; inspect formatting diffs before accepting them. No formatter dependency/config changes were made.
- Property tests also passed at `PBT_RUNS=2000` at the Milestone 1 gate.
- Not tested yet:
  - Real WebGL rendering
  - Browser layout and breakpoints
  - E2E flows
  - Accessibility audit (axe)
  - Persistence
  - Reducer Properties 30–37

Commands, run from this folder:

```bash
pnpm exec vitest run                      # everything
pnpm exec vitest run src/ui               # UI component tests
pnpm exec vitest run src/state            # reducer/session
PBT_RUNS=2000 pnpm exec vitest run        # deeper property tests
pnpm exec vitest run --coverage           # 95% line thresholds: physics, geometry, evaluation, state
pnpm run typecheck && pnpm run lint && pnpm run build
```

## E. Outstanding issues and next steps

- **Known bugs:** none open.
- Original design/task descriptions still mention visible 3D overlays; D-26 is the user-directed override. Do not restore the overlays when implementing Milestone 3.
- **Unresolved questions:**
  - Whether to amend Req 2.7 and 13.4 and the design's arithmetic note (see Deviations). This needs the user's decision.
  - Whether CSP needs `blob:` for R3F.

### Takeover audit: documentation and specification discrepancies

- The core milestone claims agree with the inspected domain, fixtures/property tests, session skeleton, and UI stubs. The full test suite passes. Coverage percentages above are historical M1 gate results, not remeasured during the viewport task.
- The earlier parent/child task-progress discrepancy is resolved: 13.6, 15.2 and 17.2 now have full suites and all Milestone 2 tasks are checked only after passing verification.
- The old handoff said 14.3 was marked `[-]`; its actual task checkbox was `[ ]`. It is now `[x]` after the automated checks. Parent 14 is also complete after 14.4/14.5.
- 15.1 previously claimed beam-raycast highlighting before a raycast existed. Task 14.3 now supplies a real mesh raycast for highlighting while canvas drops remain accepted.
- `package.json` and the lockfile pin TypeScript 5.9.3, whereas Requirement 1.1/design D-01 specify 5.7. Existing dependency pins were preserved. The local Node runtime is 24.15.0 rather than the target 22; run CI checks under Node 22 when the CI location is corrected.
- The GitHub repository keeps the requested sibling directories. Therefore `.github/workflows/ci.yml` is nested under `Educational Tool UI Design/` and is not discovered by GitHub Actions. A future repository-integration fix must put the workflow at repository-root `.github/workflows/` and set its commands/setup-node lockfile path to the app subfolder. Do not flatten the app: its `../.kiro` spec paths rely on the sibling layout.
- `handlesFor` already requires a third `sectionLimits` argument, unlike the abbreviated design signature. Its existing comment explains why: descriptors expose challenge-dependent permissible ranges. This implementation was retained.
- No requirements, design content, dependency graph, completed domain functionality, or existing CSS was regenerated.

### Immediate next steps

1. **Continue at 19.7.** Read the corresponding specifications; see MILESTONE3.md for completed task evidence. Preserve D-26/D-27 and the existing architecture.
2. **Continue the wave graph and tests.** Complete 19.6–19.15 as scheduled, then persistence and the existing panel/dialog/history stubs. For task 22.2, use D-27's injected prediction `now` and dispatch confirmation then Run Test. Do not enable the current disabled UI button until the corresponding learning-loop UI is wired; do not fabricate numeric results.
3. **Preserve D-26.** No 3D envelope/static text or dimension/span/axis guide overlays. Keep transient handle values/limits below Canvas. Numeric controls, accessible summary, solver envelope checks, and dedicated 2D section diagram continue to provide the information.
4. **Real-browser follow-up:** install matching Playwright Chromium in an environment that permits the preview server/browser. Verify desktop/mobile layout, no horizontal scroll, pointer targets, handle cancellation, camera controls, SVG/context recovery, keyboard focus, reduced motion, CSP, network origins and idle rendering. Do not interpret the no-op GPU renderer as this validation.
5. **Repository/CI follow-up:** the workflow is still nested inside the application directory. Adapt it to repository-root `.github/workflows/` with the application working directory and lockfile path, preserving sibling `.kiro` paths. E2E specs remain a Milestone 3 deliverable. Node 22 CI and live browser checks are not claimed by the local M2 checkpoint.

Read `MILESTONE2.md`, this handoff, `AGENTS.md`, D-26, then D-27 and task 19.6 with its linked requirements. Keep supporting documentation, checkboxes, counts, deviations and next steps synchronized after each completed task.
