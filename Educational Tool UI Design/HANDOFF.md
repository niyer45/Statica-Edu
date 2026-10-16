# Handoff: Statica MVP

Last updated: 2026-10-16. **Milestone 3 complete:** tasks 19–27 (all 38 subtasks), pre-E2E checkpoint 26 and final checkpoint 28 are verified. The post-MVP roadmap now includes Milestones 4–6 (tasks 29–40). Next planned task: 29.1, the Milestone 4 review plan. Post-MVP milestone implementation has not started. Current maintenance fix is UI-07 (hidden import chooser overflow), pending CI; see the latest section below.

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

## Current maintenance — UI-01 compact challenge panel

User screenshots showed duplicated explanatory content and pass/fail labels wrapping vertically. D-28 keeps the opening statement and one compact stored value/limit list visible, moves the full table/fixed context/explanations/formulas behind Test details, and keeps warnings/errors visible. Badge widths and pass/fail colors are corrected; the detailed table wraps at word boundaries and scrolls within the disclosure when needed. Existing component tests now verify details start collapsed and retain stored result/precision/assumption behavior; the browser invalid-path test opens Test details before checking stored values.

Local checks passed: lint zero errors (10 existing warnings), typecheck, 873 tests and production build. The previous Milestone 3 passing run describes the baseline; this presentation change needs new CI browser/axe evidence. UI-01 remains in progress pending CI. Push the change and trigger the workflow, then stop polling per the user's standing instruction. Post-MVP roadmap work has not started.

## Current maintenance — UI-02 history and comparison density

User requested removing both challenge status blocks and returning history/compare to the existing template's compact visual language. Draft now has one accessible Test status label in the viewport; Result status is the selected stored test's badge in history. Compact iteration rows retain section identity, compare and Restore; the selected panel retains three domain metrics with small unit suffixes. Detailed prediction/constraint/explanation text is collapsed. Comparison cards retain value and baseline/previous deltas, with repetitive transitions in Constraint changes. Import uses a compact styled label and accessible hidden native file control. Existing component assertions cover the collapsed defaults and compare/restore semantics; the invalid-path E2E scopes Test details to the challenge to avoid ambiguity. D-29 records this user-directed presentation override.

CI browser/axe verification is pending for UI-01/UI-02; prior M3 passing evidence applies to the baseline. After pushing, stop polling and await the user's workflow result. Milestone 4 has not started.

UI-02 local verification: all 873 tests across 107 files pass; lint has zero errors (10 existing warnings), typecheck and production build pass. Documentation and source are being pushed together for CI; browser verification remains pending.

UI-02 presentation follow-up (2026-10-16): removed the exclamation prefix from Not accepted badges in history rows, selected results and comparison cards, as requested. Accepted and model-applicability indicators remain unchanged.

## Current maintenance — UI-03 comparison selection

Compare results now reuses the history list/detail layout: Baseline plus the comparison-member iterations appear in the list, and a design click displays one stored metric/delta panel. A separate local compareId preserves independent history focus; removing that member falls back to the latest remaining compared design. The selection limit and restore semantics are unchanged. The challenge Test details now contains only its evaluation table; all context prose, explanation paragraphs and college formulas were removed there. Applicability warnings/reasons remain visible outside it, and history retains its explanation disclosure. D-30 supersedes the earlier D-28/D-29 presentation choices. Component and E2E assertions now verify selecting Baseline and displaying only one comparison table. Local lint/typecheck/873 tests/build pass; browser/axe CI is pending. Push once, then stop polling and await the user.

## Current maintenance — UI-04 iteration deletion

History rows now have Delete (except Baseline) and a focus-safe confirmation/cancel dialog. `deleteIteration` adds optional `deletedIterationIds` without rewriting archived TestResults. It prunes comparison membership and clears a submission referencing the deleted result, while preserving reflection, draft, last tested analysis, predictions and numbering. `selectVisibleHistory` drives history/compare, submission choices and My designs; restore/compare/submit reject deleted ids. Visible test count controls submission availability, while next iteration uses the last archived number + 1. Serialized version-1 sessions accept the optional metadata and old saves; validation rejects Baseline/unknown/duplicate ids and hidden references. D-31 documents that this is removal from visible history, not erasure of archived numerical records.

Five new local tests cover protection/no-ops, frozen history/draft and submission/compare cleanup, persistence, numbering after deleting all rows, invalid metadata, and confirmation/cancel UI. The suite has 878 passing tests across 108 files. A new Playwright persistence scenario checks deletion/cancel, protected Baseline, comparison cleanup and reload persistence on desktop and Pixel 7 (20 browser cases total now). Browser/axe verification remains pending; push once and stop polling until the user reports the result.

UI-04 verification before push: lint zero errors (10 existing warnings), typecheck, 878 tests across 108 files and production build pass. Playwright discovers 20 cases; no local browser pass is claimed.

## Current maintenance — UI-05 action alignment and fixed-field disclosure

Delete confirmation Cancel is now a full-width centered secondary action. Run Test overrides the old template icon auto-margin, centering play icon and text together. NumericControls renders fixed fields in a collapsed native details element; lock/title remain in the summary, the explanatory sentence is removed, and expanded fields keep read-only labels/values. Summary has a visible keyboard focus style. Existing read-only component checks open and verify the disclosure, including collapsed default and removed prose. D-32 records this user direction. Browser/axe verification awaits the new pushed CI run; stop after triggering it and await the user.

UI-05 verification before push: lint zero errors (10 existing warnings), typecheck, 878 tests across 108 files and production build pass. No local browser pass is claimed.

## Current maintenance — UI-06 feedback and My designs

History no longer renders informational notices as permanent paragraphs; error notices remain. The existing Toast dismisses after five seconds, with a stable Workbench dismissal callback and timer cleanup on changes/unmount. LiveRegion remains separate/present. MyDesignsPage no longer receives or renders result data; it shows a workspace card with Return to workbench. Drafts, deletion metadata or reflections identify persisted workspaces even without visible test rows. Store persistence and recorded results are unchanged. Tests now verify no visible My designs table, same draft/history after returning, deletion notices absent from history, and timed toast cleanup. The deletion/reload E2E additionally visits My designs using desktop navigation or mobile selector and verifies return preserves state. D-33 records the presentation override. Push and trigger CI once, then stop polling until the user reports its result.

UI-06 local verification: lint zero errors (10 existing warnings), typecheck, 879 tests across 109 files and production build pass. Browser/axe verification remains pending.

## Responsive CI repair — import chooser overflow

Run 38935876295 failed the focused responsive pair on desktop and Pixel 7 before the full E2E suite ran. At requested width 1280, document width was 2431; diagnostics identified the `input.sr-only` file chooser. The template `.history-note input[type=file] { width:100% }` overrode the generic sr-only width, and the absolutely positioned input had no positioned label ancestor. On mobile, innerWidth expanded to 2431 too, which the strengthened requested-width assertion correctly rejected.

The targeted fix makes the import label position:relative and explicitly sets its file input to 1×1 px at the label origin with zero margin/padding/border and clipping. This preserves native file selection, its accessible label, keyboard focus-within indicator and Playwright setInputFiles; it does not hide page overflow or weaken any assertion. The existing responsive test is the regression case that will verify the exact failure on both viewports. Local browser launch remains sandbox-blocked. Push one candidate, then stop; the user will report workflow success/failure and any further solution can wait until credits reset.

UI-07 candidate verification: lint zero errors (10 existing warnings), typecheck, all 879 tests across 109 files and production build pass. The existing focused responsive pair and full 20-case E2E suite will verify the browser behavior in the workflow. No browser pass is claimed before that run completes.
