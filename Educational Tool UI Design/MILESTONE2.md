# Milestone 2 verification

Completed on 2026-10-15 against the component-test gate in task 18 / Requirement 33.8, with the user's D-26 presentation override. Milestone 3 starts at task 19.1.

## Results

| Check | Result |
|---|---|
| Lint | Pass; 0 errors, 10 existing `no-explicit-any` warnings |
| Type checking | Pass |
| Full Vitest suite | 79 files, 782 tests, all pass |
| Production build | Pass; 3D remains a separate lazy chunk (~963 kB / 258 kB gzip) |
| All four profiles | Component/UI-state, SVG outline and Three.js mesh bounds verified |
| Task progress | 13–18 complete, including optional M2 suites |

Commands, from `Educational Tool UI Design/`:

```sh
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build
```

Checks ran with Node 24.15.0 and pnpm 10.34.3. The project target remains Node 22. No dependency pins, solver formulas, challenge constants or specification content were regenerated.

## Evidence

| Area | Test evidence |
|---|---|
| Platform shell (13.6) | `src/ui/shell/PlatformShell.test.tsx`: all previews/Freeform blocked; UI filters/search/saved; navigation preserves edited draft, history, comparison, reflection and submission; My designs uses stored results; Guided/Parametric keep locked fields read-only; unsupported modes cannot open the Workbench. |
| Viewport/fallback (14) | `src/ui/viewport/Viewport3D.test.tsx`, `Fallback2D.test.tsx`, `sceneLayout.test.ts`: summary, view-state isolation, beam raycast, independent section dimensions, tube holes, exact stored/capped deformation, keyboard orbit and failure recovery. |
| Palette (15) | `src/ui/palette/SectionPalette.test.tsx`: click/Enter/Space/drop, active state, same-kind equivalence, cancellation and invalid payloads. |
| Handles (16) | `src/ui/viewport/handleDrag.test.ts`, `DimensionHandles.test.tsx`: projection and non-finite handling, frame coalescing, clamping, feedback, pointer capture/cancellation, orbit suppression/restoration and handle replacement. Uses the real R3F reconciler with a no-op GPU renderer. |
| Numeric controls (17.2) | `src/ui/controls/NumericControls.test.tsx`: all typed fields for circle/tube/rectangle/I-section, strict rejection and errors, Escape, dependent tube slider shrink, independent flange/web values, orientation restrictions, and real user-event typing/paste blocked by readonly controls. |
| Integrated checkpoint (18) | `src/ui/workbench/milestone2.test.tsx`: actual Workbench/palette/controls/lazy fallback; edit all parameters on all four profiles; compare input values, oriented outlines, envelope summary and mesh bounds against typed state; preserve history and baseline deformation. |
| D-26 regression | `src/ui/viewport/BeamView.test.tsx`: all four profiles render through real R3F with a no-op renderer; the force-arrow shaft is the only scene line with deformation hidden, and there are no text overlays. `Fallback2D.test.tsx` verifies drag feedback is outside the model and the 3D fixed-support text overlay is absent. |

## User-directed presentation change

The user asked to remove the envelope and text on the 3D model because they cluttered the view. D-26 in [DECISIONS.md](DECISIONS.md) records the override of the original viewport presentation. The 3D envelope, static annotation/guide overlays and fixed-support text overlay are removed. Active drag values and limit feedback appear below Canvas. The numeric controls and accessible summary retain dimensional/load information, and envelope checks remain part of evaluation. The dedicated 2D section diagram still shows its envelope and dimensions.

Do not restore the superseded 3D overlays when continuing development.

## Verification limits and remaining work

This is the specified M2 component gate, not a claim of full browser/GPU, accessibility or production certification. A preview server previously failed with `listen EPERM`, and Chromium launch was blocked; the cached browser also differs from the version expected by Playwright. No live browser/CSP/performance pass is claimed. Real browser layout, touch ergonomics, keyboard traversal, CSP/network behavior and idle rendering remain follow-ups.

The GitHub workflow is still nested under the application folder and is not discovered as a repository-root workflow. Node 22 CI checks therefore remain a repository-integration follow-up; local test success is the evidence recorded here.

Run Test is still disabled. Prediction, testing/results, comparison/restore, reflection/submission, persistence and E2E workflows are Milestone 3 tasks. See [HANDOFF.md](HANDOFF.md) for the exact continuation instructions.
