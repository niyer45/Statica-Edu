# Handoff: Statica MVP

Last updated: 2026-10-15, Milestone 2 closeout and user-directed 3D scene simplification. See `MILESTONE2.md` for the checkpoint evidence. This handoff accompanies the authorized GitHub update. Spec: `../.kiro/specs/engineering-intuition-mvp/` (requirements.md, design.md, tasks.md). Rules and commands: `AGENTS.md`.

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
- **Run test is disabled.** The reducer's `runTest` and every other non-edit action are no-op stubs until task 19, so no results, pass/fail, or comparisons are shown.
- **Viewport code and automated tests are implemented.** Real browser rendering, CSP, label layout, touch ergonomics, and performance still need manual/browser verification; do not confuse the passing no-op-renderer integration tests with a real GPU/browser pass.
- These panels and dialogs are non-interactive stubs from 13.3: RequirementsPanel, HistoryCompare, ReflectionPrompt, PredictionDialog, SubmitDialog, HelpDialog, ImportExportBar.
- No persistence yet (task 20) and no E2E tests yet (`e2e/` is empty).

## B. Task progress

- **Completed:** all Milestone 2 tasks 13–18, including optional suites. This batch completes 13.6, 17.2 and checkpoint 18 and implements the user's D-26 presentation change.
- **Next implementation:** **19.1**, `runTest`, `setPrediction`, and `cancelPrediction` in the existing reducer. Then 19.2 and the remaining Milestone 3 wave graph. Keep the current domain/edit architecture and existing stubs.
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
- **Still open:** Milestone 3 (19–28), plus the separately listed real-browser/CI integration follow-ups. All M2 checkboxes, including checkpoint 18, are complete. The original requirements/design and dependency graph were not rewritten; D-26 records the explicit user override.
- The optional and checkpoint tasks may need to be started by hand, because the task scheduler doesn't list them as ready.

## C. Technical context

### Decisions and why

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

- **D-26, explicit user direction:** remove the visible envelope, static annotations/guides and fixed-support text overlay from the 3D model; place active handle feedback below Canvas. The original visible-presentation requirements are superseded as listed in `DECISIONS.md`. Constraints, physical results and stored snapshots are unchanged; the separate 2D section diagram retains its labels/envelope. Future agents must preserve this preference.

- **Req 2.7:** the round-trip tolerance can't be met for |x| above roughly 16.8 km, because of double precision. The test uses a relative floor there.
- **Req 13.4:** the "exactly 0.02" boundary isn't representable as a double.
- **design.md arithmetic:** the design claims 0.06/0.6 = 0.09999999999999999. It actually evaluates to 0.1.
- **The template shell's "Tested this session"** learning-path label appears only when real session results exist.
- **My designs** reads `session.history` directly and uses `selectTestCount`. There is no dedicated list selector.

### Known limitations

- **CSP and R3F:** the scene uses a procedural `DataTexture` and DOM Html labels, with no remote assets or blob/data URLs added. The production build retains `default-src 'self'`. Actual browser CSP validation remains pending; do not add exceptions without observed evidence.
- **Browser verification blocked in this environment.** Preview failed with `listen EPERM 127.0.0.1:4173`; launching cached Chromium aborted. The installed Playwright expects Chromium revision 1248, while the available cache contains 1208. In a normal development environment, run `pnpm exec playwright install chromium`, then verify the production preview. No browser/CSP/performance/visual pass is claimed.
- **Repository/upload:** private `niyer45/Statica-Edu`, branch `main`. Milestone 2 closeout is delivered in the commit titled `Finish Milestone 2 and simplify the 3D scene`; the preceding viewport/handle commit is `cfa40ccfbf31f0933afeed27ebb2c19b184f3e24`. The local Kiro directory still has no `.git`; the authorized update uses GitHub's tree/commit API and a branch-head lease. Preserve the sibling application and `.kiro` directories and existing repository-root README. The CI workflow remains nested in the application directory; see audit below.
- **No horizontal scroll at 320–2560 px** isn't verified in a browser. It relies on the template CSS.

## D. Testing

Verified at Milestone 2 closeout, including D-26 (2026-10-15; Node 24.15.0, pnpm 10.34.3 in this environment; Node 22 remains the project/CI target):

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 79 files, 782 tests, all pass (baseline at takeover: 72 files, 728 tests) |
| `pnpm run typecheck` | clean |
| `pnpm run lint` | 0 errors, 10 `no-explicit-any` warnings (in `src/challenge/*.test.ts` and `vite.config.ts`, left as is) |
| `pnpm run build` | passed; R3F remains in the lazy viewport chunk (~963 kB minified / 258 kB gzip), which triggers Vite's non-failing size warning |

- No known failing automated tests. Drei's dependency path emits `THREE_CJS_DEPRECATED` during Vitest; application code uses ES module imports.
- The pinned oxfmt 0.2.0 changed string quotes and removed a required separator from an inline TypeScript object type during formatting. The affected type was repaired and all checks rerun; inspect formatting diffs before accepting them. No formatter dependency/config changes were made.
- Property tests also passed at `PBT_RUNS=2000` at the Milestone 1 gate.
- Not tested yet:
  - Real WebGL rendering
  - Browser layout and breakpoints
  - E2E flows
  - Accessibility audit (axe)
  - Persistence
  - Reducer Properties 28–37

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

1. **Implement 19.1 in `state/reducer.ts`.** Validate before prediction gating; iterations 1 and 3 require a prediction. Analyze/evaluate a frozen snapshot, score the prediction, append a frozen Test_Result using injected id/time, and preserve history on validation/physics errors. Follow the exact task acceptance criteria.
2. **Then 19.2 and the remaining wave graph.** Complete restore/compare/reflection/submit/import/reset and their tests, followed by persistence and the existing panel/dialog/history stubs. Do not add parallel replacements or fabricate live numeric results. The current UI's Run Test remains disabled until the corresponding workflow is wired.
3. **Preserve D-26.** No 3D envelope/static text or dimension/span/axis guide overlays. Keep transient handle values/limits below Canvas. Numeric controls, accessible summary, solver envelope checks, and dedicated 2D section diagram continue to provide the information.
4. **Real-browser follow-up:** install matching Playwright Chromium in an environment that permits the preview server/browser. Verify desktop/mobile layout, no horizontal scroll, pointer targets, handle cancellation, camera controls, SVG/context recovery, keyboard focus, reduced motion, CSP, network origins and idle rendering. Do not interpret the no-op GPU renderer as this validation.
5. **Repository/CI follow-up:** the workflow is still nested inside the application directory. Adapt it to repository-root `.github/workflows/` with the application working directory and lockfile path, preserving sibling `.kiro` paths. E2E specs remain a Milestone 3 deliverable. Node 22 CI and live browser checks are not claimed by the local M2 checkpoint.

Read `MILESTONE2.md`, this handoff, `AGENTS.md`, D-26, then task 19.1 and its linked requirements. Keep supporting documentation, checkboxes, counts, deviations and next steps synchronized after each completed task.
