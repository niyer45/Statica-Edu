# Handoff: Statica MVP

Last updated: 2026-10-16. **Milestones 0–3 and maintenance UI-01–UI-07 are complete and verified.** Next planned task is **29.1: create the Milestone 4 review plan**, when directed. Milestones 4–6 (tasks 29–40) remain not started. This closeout changes documentation only.

## Implementation and verification

The existing learning loop implements prediction, immutable tested results/history, compare/restore, reflection/submission, validated local persistence, import/export, accessible dialogs and announcements. Preview challenges and Freeform remain unavailable by design.

[CI run 38936927907](https://github.com/niyer45/Statica-Edu/actions/runs/38936927907) passed on implementation commit `eb1b56757b42192934f1b4cd3240515bb02237de`, and the user confirmed success:

- Lint, typecheck, **879 tests across 109 files**, domain coverage thresholds, build and schema drift passed.
- Focused responsive regression: **2/2 passed**; full desktop Chromium/Pixel 7 E2E: **20/20 passed**, including axe gates.
- This run verifies the cumulative UI maintenance and import overflow repair; it supersedes pending verification notes for UI-01–UI-07. Earlier baseline and failed-run evidence in MILESTONE3.md is historical.

## Completed maintenance to preserve

- Challenge shows its opening statement and compact requirements summary. Test details contains only the constraint table; warnings/errors remain visible. Draft belongs in the viewport and stored acceptance in history. Not accepted has no exclamation prefix (D-28–D-30).
- Design history and Compare results use selectable list/detail layouts. Compare always includes Baseline and up to three selected iterations. Independent local compareId selects one stored result/delta panel and falls back to the latest remaining member after deletion/deselection. History keeps detailed explanations collapsed (D-30).
- Confirmed deletion archives non-Baseline entries via optional persisted `deletedIterationIds`; it never rewrites immutable TestResults, predictions, current draft, last tested analysis or iteration numbering. Prune comparison membership and referenced submission, preserve reflection, and reject restore/compare/submit actions on deleted ids. `selectVisibleHistory` drives visible choices; next iteration uses the last archived number + 1. Version-1 persistence accepts old saves without metadata and rejects duplicate/unknown/Baseline deletion ids or deleted comparison/submission references (D-31).
- Cancel and Run Test icon/text are centered. Some things are fixed. keeps its lock/title visible and expands read-only values via a native disclosure, collapsed by default (D-32).
- Informational feedback uses a five-second Toast plus LiveRegion, with timer cleanup and stable dismissal callback; errors stay inline. My designs shows a saved workspace card with Return to workbench, with no result table. Draft/deletion/reflection/submission state still identifies a saved workspace, even without visible tests (D-33).
- Import chooser overflow repair: the template's width:100% rule overrode sr-only and widened a 1280 px page to 2431 px in failed run 38935876295. In `src/ui/learningLoop.css`, the import label is positioned and its native input explicitly constrained to 1×1 px at the label origin with clipping and zero spacing. Preserve its accessible label/focus indicator and native file selection. The passing responsive pair verifies this fix without weakening assertions or masking page overflow.

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


For future implementation, push a verified batch once and await the user’s workflow result; do not continuously poll CI. This documentation closeout is pushed separately from the verified implementation; GitHub history records its commit.
