# Handoff: Statica MVP

Last updated: 2026-10-16, completed 27.5; next 27.4. 35/38 Milestone 3 subtasks complete; next 27.4. Browser tasks verified: 27.2, 27.3, 27.5. See the latest verification entries below.

## Current implementation

Milestones 0–2 are complete against their documented gates; `MILESTONE2.md` preserves the historical checkpoint. Milestone 3 now provides the full learning loop:

- Pure reducer actions for editing, prediction/cancellation, immutable recorded tests, comparison selection, isolated restore, reflection/submission, all-or-nothing import and reset. History, including Baseline, remains append-only even on reset.
- Model-based tests and every tagged correctness Property 1–37. `test/state/model.ts` provides command generation and invariant hooks; `sequence.ts` provides shared recorded-test/restore setup.
- Local persistence validates the entire session, migrates registered versions, validates every design and re-analyzes/re-evaluates history. Stored numeric results must agree within 1e-9 relative tolerance. Invalid saves are removed as a whole; storage errors keep the app usable in memory with a once-per-load notice.
- Results panel, prediction/help dialogs, history/comparison/restore, reflection/submission and design JSON import/export are interactive. Run Test is enabled. Numerical results and marks always come from stored domain results.
- Shared body-portal modal primitive with keyboard trapping, Escape, and opener/fallback focus restoration. Workbench owns the single live region and visual Toast; successful actions and errors use that channel.
- The platform shell, palette, numeric controls, 3D drag handles and typed SVG fallback remain in the existing template architecture. Preview challenges and Freeform are still unavailable.

## Verification and task status

- Latest full local checks: lint has zero errors (10 existing no-explicit-any warnings), typecheck passes, **873 Vitest tests across 107 files pass**, production build passes.
- Pre-E2E coverage gate: state **97.62%**, geometry **99.05%**, evaluation **98.76%**, physics **100%** line coverage. Property tags cover all numbers 1–37.
- `pnpm exec playwright test --list` discovers **18 scenarios across Chromium desktop and Pixel 7**. These cover happy path with a real height-handle drag, HTML5 section drop, keyboard/mouse state equivalence, invalid geometry, reload/import/export, breakpoints, fallback equivalence, production CSP/no third-party requests/no state hook, and preview gating. Each scenario checks serious/critical axe violations.
- Actual local browser execution is blocked: `listen EPERM: operation not permitted 127.0.0.1:4174`. Earlier cached Chromium also mismatched the pinned Playwright version. Discovery/typechecking is not a browser pass.
- The active CI workflow now lives at **repository root** `../.github/workflows/ci.yml`, with the application working directory and lockfile path. It installs matching Chromium and runs coverage/build/schema/E2E on Node 22. The older workflow nested inside this app is historical and is not discovered by GitHub. The root workflow executed; its browser step failed (details below).
- Tasks 27.2–27.7 must remain in progress until their browser scenarios actually pass; task 28 remains unchecked until the final desktop/mobile/axe gate passes. Do not mark them complete merely because files exist.

## Technical details for the next agent

- Preserve D-26: no visible envelope/static text/dimension/span/axis overlays on the 3D model. Active handle feedback belongs below Canvas. Solver constraints and the dedicated SVG section diagram retain their information.
- The dotted deformation outline intentionally represents the **latest tested snapshot**, initially Baseline. Untested section/dimension changes alter the solid draft beam but not this outline (Requirements 25.2–25.5). A successful Run Test changes the displayed stored result. Visual offsets are uniformly capped at 0.3·L.
- Follow D-27: prediction confirmation dispatches `setPrediction` with `now: store.clock()`, then `store.runTest()`. Reducer code never reads clocks/randomness.
- `StoreProvider` preserves its context/hooks API while synchronously reducing and saving through an injected storage adapter **before the next action**. React may batch renders; it cannot skip an intermediate persistence write. App supplies browser storage; isolated test providers default to memory only. UI-only lastAction metadata supports announcements and is not persisted.
- Persistence envelope: `{schemaVersion, savedAt, session, undefinedFields}`. The last field preserves explicitly undefined optional root/UI fields for strict round-trip equality. Save time is injected; pure serialization defaults to the deterministic epoch. No legacy migration has shipped; unknown versions reject unless a registered migration advances one version at a time.
- Import/validation signatures now accept only their needed public challenge fields, so UI can preflight imports without access to `referenceDesign`. Invalid import actions return the exact previous session; the dialog and error announcement are local UI state.
- `Dialog.tsx` implements the primitive. `ModalFrame.tsx` re-exports it for existing callers. `useAnnouncements` is mounted in App's Workbench subtree, the owner of the live region; local import errors use its announcement context.
- `src/ui/learningLoop.css` adds external styles for new tables/forms/responsive content without rewriting the template styles or adding inline styles. The existing CSP remains `default-src 'self'`.
- Playwright uses development port 4174 for the read-only `window.__EI_STATE__` hook and production preview port 4173 for CSP/no-hook verification. The production bundle never exposes the hook. E2E helpers read challenge JSON via Node fs because native ESM JSON imports otherwise require an import attribute.

## Outstanding work and constraints

1. Fix the observed browser failures described below, then rerun the scenarios and required checks. The suite has executed in CI and has no passing scenarios yet.
2. Mark each browser task complete only after evidence, updating HANDOFF.md, AGENTS.md, tasks.md and MILESTONE3.md after every task. Push verified batches, as explicitly requested by the user.
3. Complete task 28 only after all desktop/mobile scenarios and serious/critical axe checks pass. Record the final commit/workflow evidence.
4. Preserve the sibling application/.kiro layout and repository-root README. The local Kiro folder has no `.git`; authorized uploads use GitHub tree/commit/ref APIs with expected-head leases and preserve remote-only files.

## Completion audit — 2026-10-16

All local application, spec/task and workflow files matched remote main `0eadb1425d2075aafa394968892ee26ba0dda747` before this documentation audit. No implementation work was left unpublished. The remote-only root README is intentionally preserved.

[GitHub Actions run 38841912543](https://github.com/niyer45/Statica-Edu/actions/runs/38841912543) passed frozen dependency installation, lint, typecheck, coverage tests, production build, schema drift and Chromium installation. All 18 desktop/Pixel 7 browser scenarios failed, including retries; artifacts were uploaded. This is a failed browser gate, not merely pending execution.

Observed failures to address next:

- Happy path, keyboard, persistence and production flow use an ambiguous `getByRole('textbox')`: four read-only fields also match the reflection textarea. Scope the dialog or use an accessible label.
- HTML5 drag/drop leaves the draft as `circle` instead of `iSection`; investigate the interaction and implementation before deciding the fix.
- Invalid-path palette lookup uses case-sensitive `/Tube/`, which does not match the displayed label.
- Responsive and WebGL-fallback audits report serious axe contrast failures, including `#7e9363` on `#f2f6eb` (3.06 versus required 4.5). Fix the actual reported elements and rerun axe.
- Preview/Freeform gating uses an ambiguous Freeform button locator matching both the library card and drawer choice; scope the intended surface.

Milestone 3 has **32 of 38 subtasks complete**. Tasks **27.2–27.7** remain in progress despite authored test files, followed by final checkpoint **28**. Task 26's unit/component/property coverage gate is complete; it does not certify browser behavior. No additional task is marked complete in this audit.


Known historical spec differences remain: configured TypeScript is 5.9.3 versus the design's 5.7, local Node is 24.15.0 versus target/CI 22; exact floating-point boundary/large-distance tolerance notes remain in the historical docs. Do not change pinned versions or regenerate specifications to hide these differences. No browser/GPU/performance/CSP pass is inferred from component tests. The lazy viewport still produces the existing non-failing Vite chunk-size warning and dependencies emit THREE_CJS_DEPRECATED during tests.

## Browser repair batch in progress — 2026-10-16

Scoped reflection inputs to the submission dialog and Freeform to the challenge drawer; corrected the Hollow tube lookup. Darkened pass-mark and challenge-paragraph text for the observed axe failures. Replaced single-step dragTo with repeated native mouse movement before release. No task completion is claimed until the updated CI browser scenarios pass. Local E2E startup still fails with port-bind EPERM. Next: inspect the CI result for this repair batch, starting with 27.2.

The keyboard scenario now reaches controls using real Tab traversal (including opening the challenge), rather than programmatic focus. The native drag scenario keeps each project's viewport width while increasing height so source and target are simultaneously on screen in the stacked mobile layout, and asserts the active tile after drop. These changes still await CI; do not mark 27.3/27.4 complete yet.

Further browser repairs: the palette's actual tube label is "Hollow circle" (not "Hollow tube"). Drag coordinates now project the beam midpoint and verify hover/clear plus active state. Happy path uses distinct tested heights and verifies restore leaves history unchanged. Invalid-path and persistence scenarios explicitly compare stored history. Platform checks cover both sides of 1050/870/620, preserve a typed uncommitted dimension and active tab, and assert sidebar width/visibility. A `workbench-open` shell class scopes required 1050/620 sidebar behavior in learningLoop.css, preserving the library's template rules. These additions await CI.

### Task 27.2 complete — 2026-10-16

Happy path verifies native height-handle drag, prediction, four distinct iterations, comparison, isolated restore, reflection and Accepted submission. Both target viewports passed in [CI run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051), including serious/critical axe checks. Lint, typecheck, all 873 unit/component/property tests, coverage, schema drift and build passed for the verified implementation. 33/38 Milestone 3 subtasks complete; next 27.3. Browser tasks verified: 27.2. Documentation is local until the next batch push. Earlier failed-run notes above are historical.

### Task 27.3 complete — 2026-10-16

Native HTML5 drag reaches the projected beam, verifies hover/clear and active tile, and preserves result history at desktop and mobile widths. Both target viewports passed in [CI run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051), including serious/critical axe checks. Lint, typecheck, all 873 unit/component/property tests, coverage, schema drift and build passed for the verified implementation. 34/38 Milestone 3 subtasks complete; next 27.4. Browser tasks verified: 27.2, 27.3. Documentation is local until the next batch push. Earlier failed-run notes above are historical.

### Task 27.5 complete — 2026-10-16

Invalid tube/flange input preserves draft and history; editing after a test leaves stored numerical results unchanged and displays Draft. Both target viewports passed in [CI run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051), including serious/critical axe checks. Lint, typecheck, all 873 unit/component/property tests, coverage, schema drift and build passed for the verified implementation. 35/38 Milestone 3 subtasks complete; next 27.4. Browser tasks verified: 27.2, 27.3, 27.5. Documentation is local until the next batch push. Earlier failed-run notes above are historical.
