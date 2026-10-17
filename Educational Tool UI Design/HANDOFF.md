# Statica Edu — current development handoff

Last audited: **2026-10-17**, for transfer to Claude Code. This document is the current status; HANDOFF_HISTORY.md archives superseded notes. No source behavior changed in this handoff update.

## Repository and local locations

- GitHub: https://github.com/niyer45/Statica-Edu — default/development branch **main**.
- Current local mirror/repository-shaped root: `/Users/nikhiliyer/Documents/Kiro/`.
- App/source/command directory: `/Users/nikhiliyer/Documents/Kiro/Educational Tool UI Design/`.
- Specifications: `/Users/nikhiliyer/Documents/Kiro/.kiro/specs/` — a sibling of the app, not inside it.
- Active workflow: repository-root `.github/workflows/ci.yml` (working directory `Educational Tool UI Design`). The nested app workflow is historical.
- The current Kiro folder has **no .git directory**. Do not assume git status/pull/push work there, initialize unrelated history or overwrite local files. Prior pushes used GitHub tree/commit/ref APIs with expected-head leases. For normal Claude Code/git development, inspect the local mirror first and use a real clone in a separate location (for example `/Users/nikhiliyer/Documents/Statica-Edu/` if absent); reconcile local changes before switching. The remote has the app, sibling specs, root README and workflow. Preserve that layout and remote-only files; never force-push or delete unreviewed files.
- Root `CLAUDE.md` and `AGENTS.md` point to this app's authoritative instructions. User authorizes development and ordinary verified pushes; customer deployment, external invitations and human review outcomes are not authorized or implied.

## Verified implementation

Only **Cantilever Beam I** is runnable. It includes section presets (circle/tube/rectangle/I-section), numeric editing/orientation, 3D handles and SVG fallback, predictions, deterministic analysis/evaluation, immutable history, comparison/restore/deletion, reflection/submission, validated browser persistence and design import/export.

**Guided and Parametric now differ.** Guided provides four browsable instruction steps and optional hints/experiments. Parametric exposes direct editing without that scaffolding. Choose the mode **before entering** from the library/challenge details; there is **no in-workbench switch**. Resume/reload preserves the selected mode. Leaving to the library permits a new entry choice with the same shared saved workspace; there is no permanent account/project mode lock (D-37).

The dotted deformation is the **latest tested snapshot**, initially Baseline. Untested edits change the solid draft only; another successful Run Test updates the outline. This is intended behavior, not a cross-section bug. No envelope/static text overlays on the 3D model; active handle feedback belongs below Canvas (D-26).

My designs shows a compact saved-workspace card, not a dense results table. History/Compare use selectable list/detail views; comparison always includes Baseline plus at most three selected iterations. Challenge Test details contains only its table. Hints/details stay collapsed; no exclamation prefix on Not accepted. Deletion is persisted archival metadata, never a rewrite of immutable numerical records (D-28–D-33).

No accounts/backend/cloud sync/analytics or account-backed completion history exists. The challenge workspace survives same-browser/profile/origin reload; notebook/library saved selections are session-only. Design JSON export is not a complete session/history backup. A submission may be Not accepted; it is not proof of challenge completion.

## Verification evidence

[Implementation CI run 38970465802](https://github.com/niyer45/Statica-Edu/actions/runs/38970465802) passed on `878fb87bbf514e746f2ecd477a473b22a6b0bf75`; user confirmed success:

- Lint zero errors (10 existing warnings), strict typecheck, **906 tests across 111 files**, required 95% domain line coverage, production build and schema drift.
- **2/2 focused responsive cases** and **24/24 desktop Chromium/Pixel 7 E2E cases**, including axe gates.
- Eight mode component cases and four mode browser cases cover pre-entry selection, no in-workbench switch, predictions, saved results/reflection/submission/reload and Parametric SVG fallback.

The subsequent documentation-only head `eee795cd6aeed69526e8aef1cd0033b64bff9db4` also passed [run 38971286106](https://github.com/niyer45/Statica-Edu/actions/runs/38971286106), verified during this handoff audit. A later documentation commit will contain this handoff; its SHA is in GitHub history. Do not confuse historical counts in milestone logs with current verification.

## Current tasks and next work

- M0–M3 tasks 1–28 complete. UI maintenance 41.1–41.7 and CI repair 42 complete.
- 29.1 review plan and 31.1 prepared pilot materials complete. Nikhil is the nominated **owner** engineering reviewer; no external independence or completed human QA is claimed.
- 33.1–33.2 retain completed Cantilever Beam II specifications/configuration/14 tests. That configuration is dormant; further integration is **deferred to 52 after original-catalog gate 51**.
- 44.1–44.2 complete; 44.3 automated/browser verification passed. **Parent 44 and 44.3 remain in progress only for owner manual release-mode checks**, including screen-reader/touch evidence under 30.1. Do not mark them complete from CI alone.
- Human engineering review 29.2, manual checks 30, actual student sessions 31.2 and remediation/closeout 32 remain open before customer deployment. Software development can proceed while those are deferred (D-34).
- **Next development task is 45.1**. Scope the five existing preview challenges before any second editions: Mounting Bracket I, Torsion Shaft I, Heat Sink I, Braced Frame I and Vibration Isolation I. Their model choices/acceptance criteria/order have not been finalized. Do not start by activating cards or copying beam JSON.

For **45.1**, read CATALOG_ROADMAP.md, catalog.ts and tasks 45–52. Create additive scoped requirements for each preview: learner objective, fixed/adjustable variables, supported geometry/load/thermal/dynamic conditions, units and displayed metrics, constraint/acceptance rules, model assumptions/exclusions, independent reference benchmarks, validation/failure behavior and proposed delivery order with rationale. Distinguish proposed choices from owner review and actual benchmark evidence. Use authoritative references when selecting new equations/models; never claim the current cantilever solver supports torsion, heat transfer, frame analysis or vibration.

Then **45.2** defines shared model/config/result identity/versioning, validation, model-specific units/metrics/evaluation/explanations, visualization/fallback, prediction/reflection, imports/save migrations. **34.1–34.2** generalize selection/session integration against those contracts; **46–50** specify, implement, numerically verify and integrate each model. Follow the numeric dependency graph. No new model is chosen by merely listing these tasks.

Accounts/minimal user information/cloud-saved projects/cross-device progress and completion history remain required future scope under 38.1–38.2. Provider/backend, ownership, sync/conflicts, data lifecycle and changes to current no-network/CSP constraints require scoped specifications. Freeform 37.1, additional physics 37.2 and optional AI 39 are not implemented; keep unsupported capabilities unavailable.

## Architecture and invariants to preserve

- `units/challenge/geometry/physics/evaluation` are pure, independent of React/Three/UI/state. Physics cannot import evaluation; evaluation cannot import state/units. UI/state never implement solver formulas. Cross-layer tests belong under `test/`.
- React 19/strict TypeScript/Vite/Figma Make shell is retained. Keep pinned dependencies/plugins, existing template classes and external CSS; add learning-loop styles to `src/ui/learningLoop.css`.
- Reducer is pure: injected IDs/time only. Prediction confirmation uses `setPrediction` with `now: store.clock()`, then `store.runTest()` (D-27).
- StoreProvider synchronously reduces and persists **before the next action**, including batched renders. Browser storage is injected; isolated test providers default to memory.
- Persistence envelope: `{schemaVersion, savedAt, session, undefinedFields}`. Validation re-analyzes recorded geometry/results and rejects corrupt/unknown-version sessions; preserve v1 saves and explicit-undefined round trips. Keys include challenge id/version; the current shell/store still assumes one loaded challenge.
- `deletedIterationIds` is optional v1 metadata. Keep archived TestResults/prediction provenance and numbering; `selectVisibleHistory` filters user choices. Reject deleted restore/compare/submit targets, prune comparisons/referenced submission while preserving draft/latest analysis/reflection.
- Student challenge data structurally excludes `referenceDesign`; never expose the internal reference through UI/hooks. Invalid imports preserve the original session.
- Main-bundle ViewportBoundary/FallbackViewport/SVG recovery must remain independent of the lazy Three.js chunk. Body-portaled dialogs preserve focus/Escape/return behavior; one shared LiveRegion handles announcements.
- Current runtime is same-origin browser-only, self-hosted fonts and CSP `default-src 'self'`. No ad hoc network calls, analytics, inline scripts/styles or secrets in client code.
- Playwright: dev port 4174 exposes test-only `__EI_STATE__`; production port 4173 must not expose it. Test real Tab/native manipulation, requested viewport width and serious/critical axe gates. Do not weaken assertions/timeouts/retries to hide regressions.

## Verification, delivery and documentation

Run from the app directory using Node 22/pnpm 10.34.3: `pnpm install --frozen-lockfile`, lint, typecheck, full Vitest coverage, build, schema drift checks, then applicable Playwright tests/full gates. AGENTS.md lists exact commands. Do not run two coverage processes into the same directory at once. Preserve meaningful assertions and add regression coverage for new behavior.

Previous Codex sandbox denied server binding/Chromium startup and tsx CLI IPC (`EPERM`). These are historical environment limitations, **not necessarily Claude Code restrictions**. If present, report them accurately; `node --import tsx scripts/gen-schema.ts` generated identical schema bytes without the CLI IPC. User prefers Safari for manual browser inspection; configured automated gates use Chromium/Pixel 7. Local Node 24.15 differed from target/CI 22; TypeScript 5.9.3 differs from original design 5.7. Do not change pins/specs to hide differences. Existing Vite chunk-size and THREE_CJS_DEPRECATED warnings are nonblocking.

Before changing code, summarize current implementation, selected next task and discrepancies/blockers. After every completed task update tasks.md, HANDOFF.md and AGENTS.md, plus relevant README/spec/milestone docs. Use numeric task checkbox IDs; never mark unchecked human or browser work done without evidence. Push verified batches after a few tasks (standing authorization), preserve unrelated work, and record the commit/run. After triggering CI, **stop continuous polling and await the user's report**; do not continue endless fix/retry cycles or deploy to customers. This handoff task does not authorize contacting participants/reviewers.

Read archived HANDOFF_HISTORY.md or milestone ledgers only for historical evidence, never as current next-task/mode-priority instructions.
