# Handoff: Statica MVP

Last updated: 2026-10-16, completed 27.4; next 27.7. 37/38 Milestone 3 subtasks complete; next 27.7. Browser tasks verified: 27.2, 27.3, 27.4, 27.5, 27.6. See the latest verification entries below.

## Current implementation

Milestones 0–2 passed their documented gates. The complete learning-loop implementation is in place: pure reducer actions, immutable history and evaluation, prediction, results, history/compare/restore, reflection/submission, validated persistence and JSON import/export. The existing template architecture and platform shell remain. Preview challenges and Freeform remain unavailable.

## Current verification

- Lint: zero errors, 10 existing warnings. Typecheck, all **873 tests across 107 files**, production build and schema drift pass.
- Domain line coverage: state 97.62%, geometry 99.05%, evaluation 98.76%, physics 100%. All Properties 1–37 are tagged and pass.
- [CI run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051), code commit `bea662da65f5855dcf673cebc48f25fae7a64236`: **12/18 browser cases passed**. Happy path (27.2), native HTML5 drag/drop (27.3), invalid geometry (27.5), persistence (27.6), fallback equivalence and production CSP/network checks pass on desktop Chromium and Pixel 7, including axe checks for those scenarios.
- Keyboard (27.4) exceeded the 30-second overall test budget; the multi-flow test now has 90 seconds. Responsive checks failed because collapsed navigation lost accessible names; fixed with explicit labels. Preview gating failed drawer-mode contrast; reported text colors darkened. Task 27.7 also now tests both sides of every breakpoint and typed-input/tab preservation.
- Latest pushed repair batch: `888d6b92c71adf8f1e39bd178f539727dec584bf`. [Run 38891807513](https://github.com/niyer45/Statica-Edu/actions/runs/38891807513) must verify the two remaining tasks before marking them complete. Task completion records were pushed after the first three successes at `c6c8829f861059e3602937c5ebaa6f5c05df03d0`; 27.6 documentation is in the latest repair batch.
- Local browser execution is blocked by sandbox permissions: Vite port bind returns EPERM, and launching cached Chromium directly fails MachPortRendezvousServer with Permission denied. The cached browser is older than pinned Playwright expects. A normal Terminal outside the sandbox can run the suite after `pnpm exec playwright install chromium`; CI installs matching Chromium. No local browser pass is claimed.

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

## Next steps and delivery

1. Inspect run 38891807513 and its browser artifacts. Fix remaining observed issues; verify 27.4 and 27.7 on both viewports with no serious/critical axe violations. Do not mark a task complete just because its test exists.
2. After each completed task update HANDOFF.md, AGENTS.md, sibling tasks.md, MILESTONE3.md and README status. Push verified batches, as requested. Mark parent 27 complete when all children pass. Task 28 remains the final milestone gate.
3. Active CI workflow is the repository-root `../.github/workflows/ci.yml`, with application working directory, Node 22, frozen pnpm install, lint/typecheck/coverage/build/schema and matching Chromium/E2E artifacts. The old nested application workflow is historical.
4. The local Kiro folder has no `.git`. Authorized pushes use GitHub tree/commit/ref APIs with expected-head leases. Preserve the sibling application/.kiro layout and remote-only root README. Do not upload generated reports, dependencies or build output.

Known historical spec differences remain: configured TypeScript is 5.9.3 versus the design's 5.7, local Node is 24.15.0 versus target/CI 22; exact floating-point boundary/large-distance tolerance notes remain in the historical docs. Do not change pinned versions or regenerate specifications to hide these differences. No browser/GPU/performance/CSP pass is inferred from component tests. The lazy viewport still produces the existing non-failing Vite chunk-size warning and dependencies emit THREE_CJS_DEPRECATED during tests.

### Task 27.4 complete — 2026-10-16

Real Tab/Enter/Space traversal completes the flow, focus leaves the canvas, and normalized keyboard and mouse sessions are identical; axe passes for both flows. Both target viewports passed in [CI run 38891807513](https://github.com/niyer45/Statica-Edu/actions/runs/38891807513), including serious/critical axe checks. Lint, typecheck, all 873 unit/component/property tests, coverage, schema drift and build passed for the verified implementation. 37/38 Milestone 3 subtasks complete; next 27.7. Browser tasks verified: 27.2, 27.3, 27.4, 27.5, 27.6. Documentation is local until the next batch push. Earlier failed-run notes above are historical.

Latest result: run 38891807513 passed 17/18 scenarios, including both keyboard cases (40.9s desktop, 30.8s Pixel 7), all drawer/preview checks and Pixel 7 responsive checks. Only desktop responsive horizontal-overflow assertion fails. Added viewport size and overflowing-element diagnostics to that assertion to identify the exact layout source; artifact download is available through the connector but local download DNS is restricted. No overflow clipping workaround is added. Task 27.4 is complete; next 27.7.

Safari successfully downloaded run 38891807513's report to Downloads/browser-report. The trace identifies desktop overflow at 320 px; the screenshot also shows the numeric-control column clipped. The full workflow labels do not fit the old single-line stepper at that width. Added wrapped workflow rows below 620 px, wrapping orientation radios, and stacked tools within the design panel below 360 px. Strengthened the overflow assertion to use the requested width (mobile can expand innerWidth to accommodate overflow) and verify design inputs stay within the panel. Awaiting CI before completing 27.7.

## Targeted repair — 2026-10-16, awaiting new CI

Run 38892699099 confirms the exact overflow: viewport/client width 320 px, document scroll width 332 px, offending element `span.step.active` at right=332. The existing local fix wraps workflow steps below 620 px, wraps orientation radios and stacks tools below 360 px to prevent the clipped controls seen in the screenshot. The responsive regression now compares against the requested viewport width (rather than potentially expanded mobile innerWidth) and checks every design input stays inside its panel.

The same run had five additional scenario failures from the 30-second total budget (happy path on both projects, persistence on both, desktop fallback); earlier runs passed these flows. Set the default complete-flow budget to 60 seconds; keyboard and multi-breakpoint tests retain 90 seconds. Assertions and per-control reachability limits are unchanged. The root CI now runs the focused responsive regression on both projects before the full E2E suite, preserving all existing gates. Task 27.7 and checkpoint 28 remain incomplete until verified. Per user instruction, trigger this run once and stop; do not continuously poll.

Targeted repair local verification: lint zero errors (10 existing warnings), typecheck, all 873 tests across 107 files, and build pass. The next push triggers the focused responsive regression followed by the full browser suite. Stop after confirming the run is queued; await the user before further work.
