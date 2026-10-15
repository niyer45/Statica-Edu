# Handoff: Statica MVP

Last updated at the move from Kiro to Codex. Spec: `../.kiro/specs/engineering-intuition-mvp/` (requirements.md, design.md, tasks.md). Rules and commands: `AGENTS.md`.

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
  - 15.1: section palette and drop target.
  - 17.1: numeric controls.

What works in the running app (`pnpm run dev`):
- Platform shell:
  - Library with filters and search.
  - Challenge drawer.
  - Learning paths, My designs, Notebook, Help.
  - Preview challenges and Freeform are disabled ("Not available yet").
- Opening Cantilever Beam I in Guided or Parametric mode. Both open the same Workbench and store, and the Workbench stays mounted across navigation.
- Changing the section: click or Enter/Space on a palette tile, or drag a tile onto the viewport.
- Editing dimensions: number inputs with strict validation and inline errors, sliders in clamp mode, orientation radios, and read-only locked fields.
- Draft badge ("Draft" / "Tested #n"), workflow stepper, footer model-limits notice, and the live region.

Incomplete:
- **Run test is disabled.** The reducer's `runTest` and every other non-edit action are no-op stubs until task 19, so no results, pass/fail, or comparisons are shown.
- **The viewport is still the template 2D SVG scene** (`src/BeamScene.tsx`, through a display-only adapter). No R3F canvas exists yet.
- These panels and dialogs are non-interactive stubs from 13.3: RequirementsPanel, HistoryCompare, ReflectionPrompt, PredictionDialog, SubmitDialog, HelpDialog, ImportExportBar.
- No persistence yet (task 20) and no E2E tests yet (`e2e/` is empty).

## B. Task progress

- **Last completed:** 13.5 (platform shell).
- **Partially complete:** 14.3, marked `[-]`. An interrupted earlier run left these unwired files in `src/ui/viewport/`:

  | File | State |
  |---|---|
  | `SceneControls.tsx` | Zoom, reset, fit, deformation toggle, material strip. Not yet imported by Viewport3D, which still has its own inline chrome. |
  | `SceneSummary.tsx` | Accessible text summary. Imports `sceneLayout.ts`. Not mounted. |
  | `sceneLayout.ts` | Layout helpers used by SceneSummary. |
  | `LegacyFallback.tsx` | The template SVG scene wrapper, meant as the temporary non-WebGL path. Not imported. |

  Nothing imports `@react-three/*` yet. `Viewport3D.tsx` is still the 13.3 stub plus the 15.1 drop zone. Review these files, finish them, and wire them in.
- **Next recommended:** finish 14.3. Then do 14.4 (Fallback2D, `projection.ts`, ViewportBoundary, delete `src/BeamScene.tsx`) and 16.1 (DimensionHandles, which depends on 14.3). Then run checkpoint 18 (the Milestone 2 gate). Milestone 3 starts at 19.1.
- **Optional tests still open:** 13.6, 14.5, 15.2, 16.2, 17.2. Smoke tests exist for 13.5, 15.1, and 17.1, but the full optional suites don't. The user asked for all optional tests to be included.
- **Dependencies:** the wave graph is in JSON at the end of tasks.md.
  - Remaining Milestone 2: 14.3 → 14.4 and 16.1. 14.4 → 14.5. 16.1 → 16.2. Everything → 18.
  - Milestone 3: 19.1 → 19.2 → 20 / 21–25 → 26 → 27 → 28.
- The optional and checkpoint tasks may need to be started by hand, because the task scheduler doesn't list them as ready.

## C. Technical context

### Decisions and why

- **Built inside the Figma template, keeping its stack and look** (user choice). Region and class names from the template's `index.css` and `platform*.css` drive the responsive layout. The product is named "Statica".
- **3D view:** R3F for the main viewport. The template SVG scene is kept as the WebGL fallback (task 14.4).
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
- **Drag and drop:** the palette uses the MIME type `application/x-statica-section`. `ui/palette/useSectionDrop.ts` accepts an `isOverBeam` callback so 14.3 can add a raycast highlight. For now the whole viewport is the drop target.
- **Deformed shape:** `ui/mesh` scales it uniformly by min(15, 0.3·L/δ_tip). rectFlat is also in the capped regime, not only tinyCircle.

### Deviations from the spec, not yet written into the spec

- **Req 2.7:** the round-trip tolerance can't be met for |x| above roughly 16.8 km, because of double precision. The test uses a relative floor there.
- **Req 13.4:** the "exactly 0.02" boundary isn't representable as a double.
- **design.md arithmetic:** the design claims 0.06/0.6 = 0.09999999999999999. It actually evaluates to 0.1.
- **The template shell's "Tested this session"** learning-path label appears only when real session results exist.
- **My designs** reads `session.history` directly and uses `selectTestCount`. There is no dedicated list selector.

### Known limitations

- **CSP and R3F:** three.js or R3F may need a `blob:` exception (for workers or textures) under `default-src 'self'`. Check this against the production build (`pnpm run build && pnpm run preview`) once 14.3 is wired.
- **Playwright browsers aren't installed.** Run `pnpm exec playwright install chromium` before `pnpm run e2e`.
- **No git repository yet.** Ask the user before running `git init` or committing.
- **No horizontal scroll at 320–2560 px** isn't verified in a browser. It relies on the template CSS.

## D. Testing

Verified at handoff:

| Check | Result |
|---|---|
| `pnpm exec vitest run` | 72 files, 728 tests, all pass |
| `pnpm run typecheck` | clean |
| `pnpm run lint` | 0 errors, 10 `no-explicit-any` warnings (in `src/challenge/*.test.ts` and `vite.config.ts`, left as is) |
| `pnpm run build` | passed at the end of 13.5 (not re-run during handoff) |

- No known failing tests.
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

### Immediate next steps

1. **Finish 14.3.**
   - Build the R3F canvas with `frameloop="demand"`, using `ui/mesh`.
   - Wire in `SceneControls` and `SceneSummary`.
   - Use `LegacyFallback` when WebGL is unavailable, including in jsdom, so the existing tests keep passing.
   - Pass a beam raycast to `useSectionDrop`.
2. **Do 14.4.** Build `projection.ts`, `Fallback2D.tsx`, and `ViewportBoundary.tsx`, then delete `src/BeamScene.tsx` and `LegacyFallback.tsx`.
3. **Do 16.1**, then the optional tests (13.6, 14.5, 15.2, 16.2, 17.2), then checkpoint 18.
4. **Start Milestone 3 at 19.1.**
   - Add `runTest`, `setPrediction`, and `cancelPrediction` to the reducer.
   - Then re-enable Run test in the UI.
