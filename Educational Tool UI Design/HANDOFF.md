# Handoff: Statica MVP

Last updated: 2026-10-16. **Milestone 3 complete:** tasks 19–27 (all 38 subtasks), pre-E2E checkpoint 26 and final checkpoint 28 are verified. The post-MVP roadmap now includes Milestones 4–6 (tasks 29–40). Next planned task: 29.1, the Milestone 4 review plan. Only roadmap documentation was requested; implementation has not started.

## Implementation and verification

The full learning loop is implemented in the existing architecture: prediction, immutable tested results/history, compare/restore, reflection/submission, validated local persistence, import/export, accessible dialogs and announcements. Preview challenges and Freeform remain unavailable by design. Preserve the uncluttered 3D presentation (D-26) and tested-snapshot deformation behavior.

[Passing CI run 38927191840](https://github.com/niyer45/Statica-Edu/actions/runs/38927191840) verified implementation commit `48bfdd33a33632aa443ebae105f864645724b4c1`:

- Lint zero errors (10 existing warnings), typecheck, **873 tests across 107 files**, build and schema drift passed.
- Domain line coverage: state 97.62%, geometry 99.05%, evaluation 98.76%, physics 100%; Properties 1–37 pass.
- Focused responsive regression: **2/2 passed** (desktop Chromium and Pixel 7).
- Full browser suite: **18/18 passed**, with no flaky results reported and no serious/critical axe violations. Includes native height/section dragging, real keyboard traversal and equality, invalid inputs, persistence/downloads, breakpoints, fallback, production CSP/network/no hook, and preview gating.

The final repair fixes workflow text extending to 332 px at a 320 px viewport, wraps orientation controls and stacks narrow design tools. Responsive assertions use the requested viewport width and check inputs stay inside their panel. Sidebar names remain accessible when collapsed, drawer/status text meets contrast checks, and the Workbench uses its specified sidebar thresholds. Total browser budgets are 60 seconds, or 90 for multi-flow keyboard/responsive scenarios; assertions remain intact.

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

## Delivery and future work

- Implementation is pushed at the verified commit above. This closeout updates only documentation/task markers; the final documentation commit is recorded in GitHub history. MILESTONE3.md preserves task-by-task evidence and earlier failed-run history.
- The user requested a roadmap extension for M4 engineer review/student pilot, M5 a second runnable challenge, and M6 Freeform/advanced physics/accounts/AI. These are unchecked planning tasks 29–40, not changes to the completed MVP requirements. Start with 29.1 when directed; independent review and student sessions require actual human participation.
- Active workflow is repository-root `../.github/workflows/ci.yml`, with app working directory, Node 22, frozen pnpm install, core gates, focused responsive regression and full E2E. The nested app workflow is historical.
- Local Kiro has no `.git`; authorized pushes use GitHub tree/commit/ref APIs with expected-head leases, preserving remote-only root README and sibling .kiro/app layout. Generated output stays ignored.
- Local sandbox denies server port binding and Chromium Mach-port startup; no local browser pass is claimed. Normal Terminal or CI can run Playwright with matching Chromium. The user prefers Safari for browser inspection; it successfully downloaded CI artifacts.

Known historical spec differences remain: configured TypeScript is 5.9.3 versus the design's 5.7, local Node is 24.15.0 versus target/CI 22; exact floating-point boundary/large-distance tolerance notes remain in the historical docs. Do not change pinned versions or regenerate specifications to hide these differences. No browser/GPU/performance/CSP pass is inferred from component tests. The lazy viewport still produces the existing non-failing Vite chunk-size warning and dependencies emit THREE_CJS_DEPRECATED during tests.

Post-MVP roadmap update (2026-10-16): tasks.md now tracks M4 review/pilot and remediation, M5 a reviewed second configuration and isolated multi-challenge flows, and scoped M6 extension tracks. All new tasks are unchecked; dependencies and milestone gates are explicit. Requirements/design for M0–M3 remain unchanged. Feature-specific specification extensions precede implementation. No new feature or pilot activity was performed in this documentation update.
