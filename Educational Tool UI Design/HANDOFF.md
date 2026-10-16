# Handoff: Statica MVP

Last updated: 2026-10-16. M0–M3, UI maintenance (41.1–41.7) and CI repair 42 are verified. Tasks 29.1, 31.1 and development tasks 33.1–33.2 are complete. **Next software task: 45.1, scope the five remaining original catalog challenges.** Further Beam II integration is deferred until original-catalog gate 51 (D-35). Task 44 is active by explicit user request: 44.1–44.2 implemented; 44.3 automated/browser gates passed run 38970465802; only owner manual release-mode evidence remains. Nikhil is the nominated owner engineering reviewer; 29.2/manual checks/student QA are deferred to before customer deployment, remain unchecked and no longer block isolated development (D-34).

## Current implementation and verification

The learning loop includes prediction, immutable tested results/history, compare/restore/deletion, reflection/submission, validated local persistence, import/export, accessible dialogs and announcements. Guided adds four browsable instruction steps and optional hints; Parametric provides direct editing without that scaffolding. Choose the mode before entry; there is no mode switch in the workbench. Reload/resume retains the selected mode and saved workspace (D-37). Only Cantilever Beam I is available. Other catalog entries/Freeform remain previews; Beam II configuration/tests are retained but further integration is deferred.

[Passing CI run 38970465802](https://github.com/niyer45/Statica-Edu/actions/runs/38970465802) verified implementation `878fb87bbf514e746f2ecd477a473b22a6b0bf75`; the user confirmed success:

- Lint zero errors (10 existing warnings), typecheck, **906 tests across 111 files**, domain coverage thresholds, production build and schema drift passed.
- **2/2 focused responsive cases** and **24/24 desktop Chromium/Pixel 7 E2E cases** passed, including axe gates.
- Four mode cases verify keyboard pre-entry selection, no in-workbench switching, reload/state/submission preservation, prediction checkpoints and Parametric SVG fallback; responsive checks include narrow layouts.

Tasks 44.1–44.2 are complete and automated/browser verification under 44.3 is passed. **44.3 and parent 44 remain in progress solely for owner manual release-mode checks**, including screen-reader/touch evidence under 30.1. Do not fabricate those checks or mark the release gate complete from CI alone. They remain required before customer deployment, while next software task **45.1** may proceed. No new test/browser execution is needed for this documentation-only closeout.

Earlier appended status/candidate notes below are historical; this section and D-37 supersede pending-browser and in-workbench-switching descriptions.

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
- The user requested a roadmap extension for M4 engineer review/student pilot, M5 a second runnable challenge, and M6 Freeform/advanced physics/accounts/AI. Task 29.1 is complete; the remaining tasks stay open and do not change the completed MVP requirements. Independent review and student sessions require actual human participation.
- Active workflow is repository-root `../.github/workflows/ci.yml`, with app working directory, Node 22, frozen pnpm install, core gates, focused responsive regression and full E2E. The nested app workflow is historical.
- Local Kiro has no `.git`; authorized pushes use GitHub tree/commit/ref APIs with expected-head leases, preserving remote-only root README and sibling .kiro/app layout. Generated output stays ignored.
- Local sandbox denies server port binding and Chromium Mach-port startup; no local browser pass is claimed. Normal Terminal or CI can run Playwright with matching Chromium. The user prefers Safari for browser inspection; it successfully downloaded CI artifacts.

Known historical spec differences remain: configured TypeScript is 5.9.3 versus the design's 5.7, local Node is 24.15.0 versus target/CI 22; exact floating-point boundary/large-distance tolerance notes remain in the historical docs. Do not change pinned versions or regenerate specifications to hide these differences. No browser/GPU/performance/CSP pass is inferred from component tests. The lazy viewport still produces the existing non-failing Vite chunk-size warning and dependencies emit THREE_CJS_DEPRECATED during tests.


For future implementation, push a verified batch once and await the user’s workflow result; do not continuously poll CI. This documentation closeout is pushed separately from the verified implementation; GitHub history records its commit.

## Task 29.1 handoff — 2026-10-16

Read MILESTONE4.md for the authored plan. The owner chose a local-only pilot before accounts and confirmed reviewer/participants are not arranged. Proposed audience is introductory college mechanics learners, with a formative target of five adults; recruitment, access build/URL, reviewer and dates remain to arrange before launch. No independent review, manual pilot readiness, student sessions or deployment has occurred. Task 29.2 requires actual reviewer evidence; do not substitute agent review or CI.

Accounts, saved user information and completed-challenge history are now explicit required future scope in 38.1–38.2, after the local pilot. The plan records data/progress requirements and open decisions without selecting a provider. Preserve guest/local operation and pure solver/reducer boundaries; no-network/CSP changes require the future scoped account specification. A submitted unsuccessful result must not be labelled a completed challenge. No account code was added.

Validation: lint, typecheck, 879 tests across 109 files and production build passed for this documentation-only task. Existing browser evidence above remains the implementation baseline; no new browser execution is claimed. Documentation is delivered in a separate GitHub commit.

## CI repair and task format — 2026-10-16

Runs 38965356799 and 38965945029 failed in the coverage step: PlatformShell's combined unavailable-preview/Freeform test took about 6.9–7.2 seconds against the default 5-second budget. Build and browser steps were skipped; this is not a browser failure or evidence of a runtime regression. The repair parameterizes all five preview entries and gives Freeform its own test, retaining disabled-action, hidden-workbench and unchanged-session assertions, plus drawer-close verification. No timeout, retry, coverage threshold or production behavior is changed. The shell file now has 17 cases; the total is 884. Await the pushed CI result before closing repair task 42; do not continuously poll.

Task formatting: completed maintenance entries now use numeric parent 41 and subtasks 41.1–41.7, retaining UI-01–UI-07 as historical labels. Roadmap IDs 29–40 are unchanged; graph entries reflect the historical maintenance sequence. Use numeric checkbox task IDs in future tasks.md edits. Task 29.1 remains complete and the next feature/review task is 29.2 (independent reviewer not arranged).

Repair local verification: full `pnpm exec vitest run --coverage` passed all 884 tests across 109 files and the 95% domain line gates; lint zero errors (10 existing warnings), typecheck and production build passed. Numeric task-line format, unique IDs and dependency references validate. The focused shell run passed all 17 tests; its partial-coverage report cannot satisfy full-domain thresholds, so the full coverage run is the gate evidence. No new browser pass is claimed before CI.

## Current development batch and owner QA sequencing

CI repair 42 passed [run 38966388585](https://github.com/niyer45/Statica-Edu/actions/runs/38966388585) on a76b8ad215720b0691ba566520d94ad995ade087: 884 tests, coverage/core gates, 2 responsive and all 20 browser cases. Earlier pending-repair and reviewer-unarranged notes above are historical. Nikhil volunteered as owner reviewer; this is not external independent review. D-34 records permission to develop before QA, with customer release still blocked on 29.2/30–32 evidence and disposition. No deployment or actual pilot has occurred.

31.1: PILOT_PROTOCOL.md now supplies ready-to-review script, consent discussion, pre/post questions, rubric and blank observation/findings sheets; actual setting/retention/access/participants remain to arrange before sessions.

33.1–33.2: MILESTONE5.md and sibling .kiro/specs/cantilever-beam-2/ specify a rectangle-orientation challenge. JSON configuration and 14 domain tests validate initial deflection failure, same-mass rotated acceptance, arithmetic fixtures, constraints, invalid/applicability cases, redaction and cross-challenge imports. Configuration is dormant: shell/catalog still offers only Beam I; no second-challenge availability/browser integration is claimed. Tests are not owner engineering sign-off. Next 34.1 must bind the selected validated configuration to the actual StoreProvider lifecycle and isolate draft/history/reflection/submission/storage by challenge/version without changing old saves. Do not merely relabel a still-bound Beam I store. Follow with 34.2 and multi-challenge browser cases under 35.1; 35.2 explicitly depends on 32.2 before release. Task 36.1 account/extension planning may proceed after 33.1; accounts remain required future work, not shipped.

Local batch verification: lint zero errors (10 existing warnings), typecheck, full coverage with 898 tests across 110 files and production build passed. Schema generation via node --import tsx produced identical committed schema bytes; pnpm gen:schema itself hit the known sandbox IPC EPERM. No new browser pass is claimed before the pushed CI run.

During verification, the pre-existing lazy-viewport recovery test observed fallback DOM before its passive announcement effect. Its assertion now waits for the same single announcement rather than assuming effect timing. Production fallback behavior, timeouts and assertions remain unchanged. Cross-layer configuration regression is under test/challenges/ so import/export checks do not violate the pure challenge module boundary. No browser/server was started locally. Push this verified batch, then await the workflow result per standing instruction.

## Repository README refresh — 2026-10-16

The root README.md now explains the educational goal, the current Cantilever Beam I learning loop, implemented versus planned features, dormant Beam II configuration, model/storage limits, local setup and documentation links. The app README is a concise developer guide instead of an accumulated status log. Root README is now mirrored locally at Kiro/README.md and intentionally updated by the authorized GitHub tree push; continue preserving other remote-only files. No source/specification behavior changed. Next software task remains 34.1; the prior development workflow result was still pending at the read-only status check, so no new browser pass is claimed.

## Required Guided/Parametric distinction — 2026-10-16

Owner requested Parametric differentiation before deploying to users. Task 44.1–44.3 is unchecked: specify mode-specific guidance/direct editing, implement in the shared workbench, then verify accessible desktop/mobile flows and switch/reload state preservation. Current modes still share the same functionality and differ only in labels; do not claim the distinction exists. Keep solver, constraints, prediction checkpoints and saved workspace shared. Checkpoint 32.2 and M5 regression task 35.1 now explicitly depend on 44.3 so deployment cannot overlook it. Freeform remains separate task 37.1. This update changes planning/documentation only; next software task remains 34.1 and 44.1 is also ready for specification work.

## Current priority — original six catalog entries (D-35)

Owner directed the existing six library challenges ahead of second editions. Read CATALOG_ROADMAP.md and tasks 45–52. Next 45.1 scopes objectives, model boundaries/benchmarks and delivery order; 45.2 defines shared multi-model contracts before 34.1 selection/session work. Implement the five previews through their own specification/numerical/integration tracks 46–50. The old beam-only requirements cannot be silently applied to thermal/torsion/frame/dynamics models. All five remain unavailable.

Retain Beam II configuration/specification/tests and historical completed tasks 33.1–33.2; do not integrate or activate it now. Task 52 revisits it after original-catalog gate 51. This supersedes prior pointers making Beam II/34.1 the immediate next work. Required mode distinction 44 and pre-deployment human QA remain open. Update current task pointers, never mark dormant assets or preview cards as runnable. Planning-only update; no source/test/model or available-card changes. Numeric IDs, graph references and cycles validated.

## Historical task 44 implementation — D-36 (superseded by D-37)

User explicitly selected task 44 ahead of catalog scoping. 44.1 and 44.2 are complete: additive interaction-modes specifications precede the implementation. ModeExperience renders a native Interaction mode selector in Workbench. Guided includes the existing workflow stepper and compact four-step instruction panel with collapsed hints/section-sensitive suggested experiments; Parametric omits this scaffolding and keeps direct editing plus all test/result tools. Instructions live outside the challenge and Canvas; no dense challenge text or overlays return. Drawer descriptions now match behavior.

The shared editor, numeric fields, viewport, history and solver stay mounted. Existing selectMode persists only session.mode; unchanged draft/history/deletion metadata/comparison/predictions/reflection/submission are tested, including reload and identical numerical results from identical actions. Guided recommendations: recorded submission → Explain; untested draft → Experiment; reflection text → Explain; visible tests → Compare; otherwise Inspect. Compare membership is not evidence of learning because tests automatically join it. Browsed steps/hints are transient and never dispatch progress actions; returning to Guided/reloading derives focus from saved state. Normal blur commits retain existing behavior.

Local verification: lint zero errors (10 existing warnings), typecheck, full coverage/core suite **905 tests across 111 files**, production build passed. Seven new component cases pass. Playwright discovers **24 cases**, including four new mode cases (desktop/Pixel 7) for keyboard switching/reload with submitted workspace preservation and Parametric prediction + SVG fallback. Local browser launch is sandbox-blocked; no browser pass is claimed before pushed CI. Task 44.3 and parent 44 remain in progress pending browser evidence and owner manual screen-reader/touch/release-mode checks; retain task 30.1 human QA. Push this verified candidate and await the user's result, without continuous polling. After completing verification, resume original-catalog scoping 45.1; Beam II stays deferred.

## Mode correction — D-37 (now CI-verified)

User requires choosing Guided/Parametric before entry and keeping it fixed inside the workbench. Removed ModeExperience's native selector/callback and selector CSS. Guided still has four browsable steps and optional hints; Parametric still has direct editing without scaffolding. Existing library/challenge drawer is the pre-entry choice; reload/resume retains session.mode. Leaving to the library permits a new entry choice while preserving the shared workspace; no permanent project/account lock or mode-specific persistence was added. This supersedes D-36's selector and all earlier live-switch test expectations.

Eight focused component cases pass, including absence of mode controls in both modes and Parametric draft/history/deletion/prediction/reflection/submission persistence. Four replacement desktop/Pixel 7 browser cases choose mode before entry with keyboard, verify fixed presentation, retained prediction checkpoints/submission/reload, Parametric SVG fallback and 320 px/axe checks. Total browser discovery stays 24. No new browser pass or manual release QA is claimed before the pushed workflow. Parent 44/44.3 remain in progress; 44.1–44.2 remain implemented with corrected specifications.

D-37 local verification: full coverage suite passed all **906 tests across 111 files**, including all eight mode cases; 95% domain line gates, lint (zero errors/10 existing warnings), typecheck and production build passed. Playwright discovery confirms four replacement mode cases/24 total cases; browser execution remains for CI.

## Documentation closeout after passing mode workflow

Recorded the passing implementation above in tasks.md and AGENTS.md; implementation/browser work is verified, owner manual QA remains open, and next software task stays 45.1. This commit changes documentation only and does not begin new feature work or claim deployment. Push once and stop; do not continuously poll the documentation workflow.
