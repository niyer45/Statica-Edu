# Handoff: Statica MVP

Last updated: 2026-10-15, viewport fallback/recovery, dimension handles, and related test suites. This handoff accompanies the authorized GitHub update. Spec: `../.kiro/specs/engineering-intuition-mvp/` (requirements.md, design.md, tasks.md). Rules and commands: `AGENTS.md`.

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

- **Milestone 2, partial:**
  - 13.1: session state, selectors, and reducer edit actions.
  - 13.2: store and bootstrap.
  - 13.3: Workbench layout and stubs.
  - 13.4: tests.
  - 13.5: platform shell.
  - 14.1 and 14.2: three.js beam mesh and deformation, with tests.
  - 14.3–14.5: demand-rendered R3F viewport, shared controls/summary, beam drop raycast, typed SVG fallback, error recovery, and viewport tests. Automated checks pass; real-browser rendering validation remains pending.
  - 15.1–15.2: section palette/drop target and full palette component suite.
  - 16.1–16.2: dimension handles, ray/axis projection, frame throttling, limit feedback, and unit/integration tests.
  - 17.1: numeric controls.

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

- **Completed this work batch:** 14.4, 14.5, 15.2, 16.1, 16.2. Parent tasks 14 and 16 are now checked; task 15's previously open test child is complete. Task 14.3 from the preceding session is included in the same GitHub update.
- **Next:** complete the remaining component suites **13.6** (platform shell) and **17.2** (numeric controls), then evaluate **18**, the Milestone 2 gate. Do not mark the gate complete without the full four-section/UI-state checks. After that, start 19.1 (learning-loop reducer).
- **Viewport files:**

  | File | Role |
  |---|---|
  | `Viewport3D.tsx` / `BeamView.tsx` | Lazy WebGL scene, actual canvas accessible name, raycast drop highlight, local camera controls, context-loss detection, scene geometry and resource disposal. |
  | `ViewportBoundary.tsx` | Main-bundle error boundary outside Suspense; catches lazy import rejection and context/scene construction errors. |
  | `FallbackViewport.tsx` | Main-bundle recovery UI, local view controls, section drop target, and one announcement through Workbench's existing `notify`. |
  | `Fallback2D.tsx` / `projection.ts` | Template SVG projection/painter sorting, wall hatch/floor, pointer/arrow-key orbit; typed cross-section with tube hole and independent flange/web dimensions; SI coordinates mapped to 550 scene units per metre. |
  | `SceneControls.tsx` / `SceneSummary.tsx` / `sceneLayout.ts` | Shared chrome and state-derived summary/layout. `sceneLayout` imports the pure deformation helper and geometry outline directly, keeping the main-bundle fallback independent of Three.js. |
  | `DimensionHandles.tsx` / `handleDrag.ts` | One named sphere per geometry descriptor; pointer capture; closest-ray/axis projection; full-dimension and inward-flange scaling; latest-event-per-rAF clamp dispatch; live mm/limit feedback; immediate orbit suppression/restoration. |

- `src/BeamScene.tsx` and `LegacyFallback.tsx` are deleted. The architecture test now requires the typed fallback and verifies the old scene remains absent.
- Deformation remains static for all users, including reduced-motion users. Draft edits change solid geometry and dimensions; dashed deformation always comes from the latest frozen Test_Result or baseline. No formulas were moved out of the physics domain.
- Handle cleanup covers release, pointer cancel/lost capture, window blur, Escape, unmount, and section-kind/orientation changes. Pending unrendered motion is discarded on release/cancel, preserving the last clamped edit. Diameters/width/height/web map half-dimension handle motion to full parameter changes; flange thickness has reversed inward-face motion. At 90°, local-v motion maps onto negative global Z.
- **Tests:** viewport summary/control/raycast/layout tests; fallback hole/dimension/deformation/orbit tests; lazy-load/context-creation/context-loss recovery tests; palette Space/same-kind equivalence tests; handle projection/throttle/limit unit tests; real R3F reconciler + store integration with a no-op GPU renderer (capture, coalesced dispatch, clamping, labels, orbit, cancellation, and handle replacement).
- **Still open:** 13.6 and 17.2 before gate 18; all Milestone 3 tasks. The dependency graph/specification content is unchanged; only completed task checkboxes were updated.
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
- **Ranges:** NumericControls takes its ranges from `geometry/handlesFor`, so inputs, sliders, and future handles agree.
- **Drag and drop:** the palette uses `application/x-statica-section`. `Viewport3D` supplies a mesh raycast to `useSectionDrop` so only beam hits highlight in 3D; drops on empty canvas still apply the section. The SVG fallback highlights its whole scene.
- **Deformed shape:** `ui/mesh` scales it uniformly by min(15, 0.3·L/δ_tip). rectFlat is also in the capped regime, not only tinyCircle.

### Deviations from the spec, not yet written into the spec

- **Req 2.7:** the round-trip tolerance can't be met for |x| above roughly 16.8 km, because of double precision. The test uses a relative floor there.
- **Req 13.4:** the "exactly 0.02" boundary isn't representable as a double.
- **design.md arithmetic:** the design claims 0.06/0.6 = 0.09999999999999999. It actually evaluates to 0.1.
- **The template shell's "Tested this session"** learning-path label appears only when real session results exist.
- **My designs** reads `session.history` directly and uses `selectTestCount`. There is no dedicated list selector.

### Known limitations

- **CSP and R3F:** the scene uses a procedural `DataTexture` and DOM Html labels, with no remote assets or blob/data URLs added. The production build retains `default-src 'self'`. Actual browser CSP validation remains pending; do not add exceptions without observed evidence.
- **Browser verification blocked in this environment.** Preview failed with `listen EPERM 127.0.0.1:4173`; launching cached Chromium aborted. The installed Playwright expects Chromium revision 1248, while the available cache contains 1208. In a normal development environment, run `pnpm exec playwright install chromium`, then verify the production preview. No browser/CSP/performance/visual pass is claimed.
- **Repository/upload:** private `niyer45/Statica-Edu`, branch `main`. This work is delivered in the commit titled `Complete typed viewport fallback and dimension handles`, including the prior session's 14.3 changes. The local Kiro directory still has no `.git`; the authorized update uses GitHub's tree/commit API and a branch-head lease. Preserve the sibling application and `.kiro` directories and existing repository-root README. The CI workflow remains nested in the application directory; see audit below.
- **No horizontal scroll at 320–2560 px** isn't verified in a browser. It relies on the template CSS.

## D. Testing

Verified after tasks 14.4/14.5/15.2/16.1/16.2 (2026-10-15; Node 24.15.0, pnpm 10.34.3 in this environment; Node 22 remains the project/CI target):

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 77 files, 754 tests, all pass (baseline at takeover: 72 files, 728 tests) |
| `pnpm run typecheck` | clean |
| `pnpm run lint` | 0 errors, 10 `no-explicit-any` warnings (in `src/challenge/*.test.ts` and `vite.config.ts`, left as is) |
| `pnpm run build` | passed; R3F remains in the lazy viewport chunk (~971 kB minified / 261 kB gzip), which triggers Vite's non-failing size warning |

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
- **Stale comments:** a few code comments refer to tasks that have since finished. For example, `layout.test.tsx` says the palette tiles are stubs "until task 15.1". These are harmless.
- **Unresolved questions:**
  - Whether to amend Req 2.7 and 13.4 and the design's arithmetic note (see Deviations). This needs the user's decision.
  - Whether CSP needs `blob:` for R3F.

### Takeover audit: documentation and specification discrepancies

- The core milestone claims agree with the inspected domain, fixtures/property tests, session skeleton, and UI stubs. The full test suite passes. Coverage percentages above are historical M1 gate results, not remeasured during the viewport task.
- Parent task 13 remains checked although optional child 13.6 is open. Existing shell smoke tests do not establish its full suite. Task 15.2 is now implemented and verified; the palette parent is accurate.
- The old handoff said 14.3 was marked `[-]`; its actual task checkbox was `[ ]`. It is now `[x]` after the automated checks. Parent 14 is also complete after 14.4/14.5.
- 15.1 previously claimed beam-raycast highlighting before a raycast existed. Task 14.3 now supplies a real mesh raycast for highlighting while canvas drops remain accepted.
- `package.json` and the lockfile pin TypeScript 5.9.3, whereas Requirement 1.1/design D-01 specify 5.7. Existing dependency pins were preserved. The local Node runtime is 24.15.0 rather than the target 22; run CI checks under Node 22 when the CI location is corrected.
- The GitHub repository keeps the requested sibling directories. Therefore `.github/workflows/ci.yml` is nested under `Educational Tool UI Design/` and is not discovered by GitHub Actions. A future repository-integration fix must put the workflow at repository-root `.github/workflows/` and set its commands/setup-node lockfile path to the app subfolder. Do not flatten the app: its `../.kiro` spec paths rely on the sibling layout.
- `handlesFor` already requires a third `sectionLimits` argument, unlike the abbreviated design signature. Its existing comment explains why: descriptors expose challenge-dependent permissible ranges. This implementation was retained.
- No requirements, design content, dependency graph, completed domain functionality, or existing CSS was regenerated.

### Immediate next steps

1. **Finish 13.6 and 17.2.** Preserve existing tests; extend them for full shell navigation/filter/saved/mode equivalence and every numeric section/invalid/locked-field case. Task 17.1 uses permissible dependent ranges from `handlesFor`; retain the documented architecture while comparing exact acceptance criteria.
2. **Evaluate checkpoint 18.** Verify all four profiles and UI values against typed state. Run lint → typecheck → tests → build. Real browser checks remain outstanding because this environment cannot bind a preview server or launch Chromium; install the matching Playwright browser in a normal development environment.
3. **Browser verification:** open the production preview at desktop/mobile widths, exercise handle drags/cancellation and camera controls, check label overlap and pointer targets, context failure/recovery, zero CSP violations, zero third-party requests, keyboard focus leaving SVG/Canvas, reduced-motion static shape, and idle rendering. No browser/CSP/performance pass is claimed by this handoff.
4. **Then 19.1:** implement `runTest`, `setPrediction`, `cancelPrediction` in the existing reducer; follow the wave graph for remaining learning-loop UI. Run Test remains disabled until that work is wired.
5. **Repository integration follow-up:** move/adapt the workflow to repository-root `.github/workflows/` with the application working directory and pnpm lockfile path; the root layout must continue to preserve sibling `.kiro` paths. E2E specs are still a Milestone 3 deliverable.

Start with this document, `AGENTS.md`, and the remaining task/acceptance criteria. Keep task checkboxes, relevant architecture instructions, test counts, known limitations, and this handoff synchronized after each completed task.
