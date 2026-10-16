# Milestone 3 progress

Tasks 19.1–19.5 were verified before this batch (828 tests). The last pushed starting point is a8a3c6b5b37bb162675de5738d2d9c9df85aec33 (through 19.4).

Each completed task below passed lint (zero errors), typecheck, the full Vitest suite and build. Browser gates remain separate.

- **19.6 complete** — Property 30 checks exact draft/latest equality ignoring only id after every generated action. Verification: 831 tests pass. Next: 19.7.
- **19.7 complete** — Property 31 checks restore isolation, unknown ids, unchanged history and repeated analysis on retest. Verification: 831 tests pass. Next: 19.8.
- **19.8 complete** — Property 32 checks every reachable draft and recorded design after valid and hostile actions. Verification: 831 tests pass. Next: 19.9.
- **19.9 complete** — Property 33 verifies exact locked length/material across all draft and history transitions. Verification: 835 tests pass. Next: 19.10.
- **19.10 complete** — Property 34 verifies deterministic replay on frozen state/action/challenge, including null-prototype hostile imports. Verification: 835 tests pass. Next: 19.11.
- **19.11 complete** — Property 36 verifies required-iteration prediction gating, cancellation and no consumed iteration on rejection. Verification: 835 tests pass. Next: 19.12.
- **19.12 complete** — Property 37 verifies valid and rejected submissions preserve stored status/efficiency and untrimmed reflection. Verification: 835 tests pass. Next: 19.13.
- **19.13 complete** — Properties 14,17,26 now cover hostile drafts/imports, strict rejection and immutable challenges in reducer sequences. Verification: 841 tests pass. Next: 19.14.
- **19.14 complete** — The full specified example flow, cancel/confirm, bad restore, baseline submission, locked import reasons and invalid init are verified. Verification: 841 tests pass. Next: 19.15.
- **19.15 complete** — Generated sequences produce identical state and evaluations in Guided and Parametric modes apart from mode. Verification: 841 tests pass. Next: 20.1.
- **20.1 complete** — Implemented versioned persistence, strict validation, reanalysis/re-evaluation, 1e-9 numeric tolerance, immutable history and storage-failure controller. Explicit undefined optional fields are tracked in the envelope for exact round-trips; save time is injected. Verification: 856 tests pass. Next: 20.2.
- **20.2 complete** — Property 35 round-trips reachable sessions exactly; arbitrary corrupted strings are rejected without throwing. Verification: 856 tests pass. Next: 20.3.
- **20.3 complete** — Verified corrupt/version/missing/invalid/tampered sessions, migration ordering, tolerance boundaries and once-per-load storage exception notices. Verification: 856 tests pass. Next: 20.4.
- **20.4 complete** — App injects browser storage; the provider loads before children render and reduces/persists synchronously before the next action, including batched confirmation and submit. Isolated providers default to memory only; storage failures retain the in-memory session. Verification: 858 tests pass. Next: 22.1.
- **22.1 complete** — Shared Dialog preserves template classes, uses a body portal, labelled modal semantics, initial focus, Tab/Shift+Tab trapping, Escape and opener/fallback focus restoration. Verification: 860 tests pass. Next: 22.2.
- **22.2 complete** — Prediction dialog opens from reducer state, starts with no selected radio, validates explanation/direction, cancels cleanly and confirms via injected clock then runTest. Help shares the focus-safe primitive. Verification: 860 tests pass. Next: 21.1.
- **21.1 complete** — Requirements/results panel now enables Run Test through the prediction flow and renders stored constraint marks, formatted values, status, reasons, warnings, facts, validation errors and optional college details. Verification: 864 tests pass. Next: 21.2.
- **21.2 complete** — Component tests verify precision/order, unchanged tested values during edits, confirmed-test badge changes, wide-I envelope failure and out-of-assumption labels. Verification: 864 tests pass. Next: 22.3.
- **22.3 complete** — Single live-region/Toast owner now announces successful section apply, appended result status/failure count, known restore and analysis/validation notices. Last action metadata is UI-only; import UI uses the same announcement context. Verification: 865 tests pass. Next: 22.4.
- **22.4 complete** — Verified modal focus trapping/restoration, Escape cancellation, unselected/invalid prediction, injected confirm and per-event announcements without focus movement. Verification: 865 tests pass. Next: 23.1.
- **23.1 complete** — History/compare now renders stored metrics, predictions, pass states and facts with keyboard tabs, max-three selection, baseline/previous deltas and restore. Verification: 866 tests pass. Next: 23.2.
- **23.2 complete** — Verified fourth-selection blocking, baseline/previous delta semantics, restore draft status and keyboard tab state preservation. Verification: 866 tests pass. Next: 24.1.
- **24.1 complete** — Reflection and submission UI now preserve untrimmed text, cap 2000 characters, expose disabled reasons, list only tested iterations, default to latest and show recorded status with separate efficiency. Verification: 868 tests pass. Next: 24.2.
- **24.2 complete** — Verified no-test/blank-reflection reasons, latest-only selector semantics, reflection cap, literal script input and unchanged stored status across reflection content. Verification: 868 tests pass. Next: 25.1.
- **25.1 complete** — Import/export UI downloads validated current-design JSON, checks file size before reads, lists every error and announces causes without changing rejected session state. Public-only challenge typing avoids exposing referenceDesign. Verification: 873 tests pass. Next: 25.2.
- **25.2 complete** — Verified size/read boundaries, failed-read handling, literal malicious text, all error reasons, state identity on rejection, valid import and object-URL download/revocation. Source scan enforces escaped React rendering. Verification: 873 tests pass. Next: 26.
- **26 complete** — Pre-E2E gate passed: all Properties 1–37 are tagged and pass; line coverage state 97.62%, geometry 99.05%, evaluation 98.76%, physics 100%. Full lint/typecheck/test/build pass. Verification: 873 tests pass. Next: 27.1.

## Batch delivery and browser gate

Verified batches were pushed as 9309633, 517ff2d, 19b2e30, 71fe69b, 6ed9265 and 6120f846ea22437b1268fdfcfb723102fbe86095. The last of these delivers the full learning-loop UI through task 25.

Pre-E2E coverage passed: state 97.62%, geometry 99.05%, evaluation 98.76%, physics 100%. All 37 property tags are present. The 18 Playwright scenarios are discovered/typechecked, but local execution fails before the first page with `listen EPERM 127.0.0.1:4174`. No browser pass is claimed. Tasks 27.2–27.7 are in progress after failed CI execution, and 28 is unchecked. Repository-root CI now supplies the application working directory, matching Chromium, coverage/schema checks and browser artifact upload.
- **27.1 complete** — E2E helpers load native ESM-safe challenge data, read the dev state hook, normalize ids/times, audit axe severity, record origins and perform true pointer/keyboard interactions. Playwright discovers all 18 desktop/Pixel scenarios; external CI execution failed; see the audit below. Verification: 873 tests pass. Next: 27.2.

## Completion audit — 2026-10-16

Implementation and existing documentation through task 27.1 were already pushed at `0eadb1425d2075aafa394968892ee26ba0dda747`; local/remote file hashes matched before this audit. No unpublished code was found.

[Run 38841912543](https://github.com/niyer45/Statica-Edu/actions/runs/38841912543) passed lint, typecheck, coverage tests, build, schema drift and browser installation. All 18 browser scenarios failed, including retries. Failures include ambiguous reflection/Freeform selectors, a case-sensitive Tube lookup, drag/drop not updating the section, and serious axe color-contrast violations. HANDOFF.md records actionable details. Browser report artifacts are available on the run.

Completed: tasks 19–25 (learning-loop implementation and unit/component/property tests), checkpoint 26, and helper task 27.1. Remaining: six subtasks 27.2–27.7 plus final checkpoint 28. The six test tasks have authored implementations but are not verified complete. This is 32 of 38 Milestone 3 subtasks complete, excluding checkpoints from the subtask count. No task completion was claimed during this documentation-only audit.

Browser repair batch in progress: scoped ambiguous locators, fixed palette casing, darkened reported contrast colors, and made the native HTML5 drag movement deliberate. CI execution is required because local server startup remains blocked by EPERM. Tasks 27.2–27.7 remain in progress pending that evidence.

The browser repair batch also strengthens real Tab traversal, projected beam hover/drop, active-tile checks, distinct-history restore assertions, and input/tab preservation at every layout boundary. Fixed the embedded Workbench sidebar threshold mismatch with scoped supplemental styles. Completion remains dependent on CI evidence.

- **27.2 complete** — Happy path verifies native height-handle drag, prediction, four distinct iterations, comparison, isolated restore, reflection and Accepted submission. Desktop and Pixel 7 plus axe passed in [run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051); core checks and 873 tests passed. Next: 27.3.

- **27.3 complete** — Native HTML5 drag reaches the projected beam, verifies hover/clear and active tile, and preserves result history at desktop and mobile widths. Desktop and Pixel 7 plus axe passed in [run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051); core checks and 873 tests passed. Next: 27.4.

- **27.5 complete** — Invalid tube/flange input preserves draft and history; editing after a test leaves stored numerical results unchanged and displays Draft. Desktop and Pixel 7 plus axe passed in [run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051); core checks and 873 tests passed. Next: 27.4.

- **27.6 complete** — Reload restores reflection and submission; native JSON downloads round-trip through import without changing history, and corrupt storage restarts with a notice. Desktop and Pixel 7 plus axe passed in [run 38890827051](https://github.com/niyer45/Statica-Edu/actions/runs/38890827051); core checks and 873 tests passed. Next: 27.4.

- **27.4 complete** — Real Tab/Enter/Space traversal completes the flow, focus leaves the canvas, and normalized keyboard and mouse sessions are identical; axe passes for both flows. Desktop and Pixel 7 plus axe passed in [run 38891807513](https://github.com/niyer45/Statica-Edu/actions/runs/38891807513); core checks and 873 tests passed. Next: 27.7.

## Targeted repair — 2026-10-16, awaiting new CI

Run 38892699099 confirms the exact overflow: viewport/client width 320 px, document scroll width 332 px, offending element `span.step.active` at right=332. The existing local fix wraps workflow steps below 620 px, wraps orientation radios and stacks tools below 360 px to prevent the clipped controls seen in the screenshot. The responsive regression now compares against the requested viewport width (rather than potentially expanded mobile innerWidth) and checks every design input stays inside its panel.

The same run had five additional scenario failures from the 30-second total budget (happy path on both projects, persistence on both, desktop fallback); earlier runs passed these flows. Set the default complete-flow budget to 60 seconds; keyboard and multi-breakpoint tests retain 90 seconds. Assertions and per-control reachability limits are unchanged. The root CI now runs the focused responsive regression on both projects before the full E2E suite, preserving all existing gates. Task 27.7 and checkpoint 28 remain incomplete until verified. Per user instruction, trigger this run once and stop; do not continuously poll.

Targeted repair local verification: lint zero errors (10 existing warnings), typecheck, all 873 tests across 107 files, and build pass. The next push triggers the focused responsive regression followed by the full browser suite. Stop after confirming the run is queued; await the user before further work.

- **27.7 complete** — Both responsive regressions and all platform scenarios pass: breakpoints preserve input/state, 320 px has no overflow or clipped inputs, fallback matches 3D, production CSP/network/no-hook checks pass, and previews remain gated. Desktop and Pixel 7 plus axe passed in [run 38927191840](https://github.com/niyer45/Statica-Edu/actions/runs/38927191840); core checks and 873 tests passed. Next: 28.

## Final checkpoint 28 — complete (2026-10-16)

[Run 38927191840](https://github.com/niyer45/Statica-Edu/actions/runs/38927191840) on implementation commit `48bfdd33a33632aa443ebae105f864645724b4c1` passed lint, typecheck, 873 tests, domain coverage thresholds, build, schema drift, both focused responsive cases and all 18 desktop/Pixel 7 browser cases, with no flaky results reported. All Properties 1–37 and serious/critical axe gates pass. Task 27 and checkpoint 28 are checked complete; all 38 Milestone 3 subtasks are finished. Earlier failures/pending notes in this ledger are historical. No implementation task remains in the current specification; await user direction. This closeout is documentation-only and uses the passing implementation evidence above.

## Post-MVP UI maintenance closeout — 2026-10-16

UI-01–UI-07 are complete. [CI run 38936927907](https://github.com/niyer45/Statica-Edu/actions/runs/38936927907) on implementation `eb1b56757b42192934f1b4cd3240515bb02237de` passed lint, typecheck, 879 tests across 109 files, coverage thresholds, build, schema drift, 2 focused responsive cases and all 20 desktop/Pixel 7 E2E cases including axe gates. The user confirmed success. This verifies the cumulative UI changes and the hidden import chooser overflow repair after failed run 38935876295. HANDOFF.md records final behavior; tasks.md marks all seven items complete. M4–M6 remain not started; next planned task is 29.1 when directed. No application code changed in this documentation closeout.
