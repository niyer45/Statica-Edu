# Statica (Engineering Intuition MVP)

Browser-based structures learning tool. A student designs the cross-section of a cantilever beam
("Cantilever Beam I"), predicts how it will behave, runs an idealized Euler–Bernoulli test, and
compares iterations. It is built inside a Figma Make template ("figma-make-app"), and the
template's visual design and platform shell are kept.

Read `HANDOFF.md` first for the current status and the next task.

Current task progress (2026-10-16): M0–M3 and maintenance UI-01–UI-07 complete. CI run 38936927907 verified implementation eb1b56757b42192934f1b4cd3240515bb02237de: 879 core tests, 2 focused responsive cases and all 20 browser cases passed. Post-MVP M4–M6 remain planned; next task is 29.1 when directed. Read HANDOFF.md for current behavior and evidence. Push verified batches once and await the user; do not continuously poll CI.

## Specifications (source of truth)

The spec lives outside this folder, one level up:

- `../.kiro/specs/engineering-intuition-mvp/requirements.md`: Requirements 1–35 with numbered acceptance criteria.
- `../.kiro/specs/engineering-intuition-mvp/design.md`: architecture, decisions D-01…D-25, correctness Properties 1–37, fixtures, thresholds.
- `../.kiro/specs/engineering-intuition-mvp/tasks.md`: the completed MVP plan (Milestones 0–3, tasks 1–28) and post-MVP roadmap (Milestones 4–6, tasks 29–40) with a JSON wave dependency graph at the end.

Absolute path: `/Users/nikhiliyer/Documents/Kiro/.kiro/specs/engineering-intuition-mvp/`.
`DECISIONS.md` records D-01…D-33 and the 14 applicability thresholds. D-25 defines required `sectionDefaults`; D-26 records the user-directed uncluttered 3D presentation and overrides the original visible-overlay requirements.

## Rules for following the spec

- Implement tasks in `tasks.md` order, respecting the wave graph. Each task lists the requirement IDs it must satisfy.
- Milestone 2 and its component gate are complete; see `MILESTONE2.md` for evidence and limitations. Follow the current-task pointer above; HANDOFF.md records verified browser results and remaining work.
- Prediction actions use D-27: `setPrediction` requires `now` from the injected store clock. Confirm by dispatching `setPrediction`, then `runTest`; the reducer never reads time itself.
- Follow D-26: no visible envelope or static annotations on the 3D model. Keep active drag feedback below Canvas, numerical controls and the accessible summary. Do not restore the original spec overlays; the user explicitly requested their removal.
- Do not rewrite requirements, design, or tasks. If the code must deviate, record it under "Deviations" in `HANDOFF.md` (and in `DECISIONS.md` if it is a design decision).
- Property tests must carry the tag comment `// Feature: engineering-intuition-mvp, Property N: <title>` and use the `test/pbt.ts` helper (`PBT_RUNS` env var, default 200, fixed seed).
- Never show fabricated numbers in the UI. Every displayed result comes from a stored Test_Result produced by `physics/analyze` and `evaluation/evaluate`.
- Later tasks fill existing stub files in place (each stub header names its task). Don't create parallel components.

## Tech stack

- React 19, TypeScript (strict), Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), and the four Figma Make Vite plugins in `vite.config.ts` (leave them unchanged).
- 3D: three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9. Milestone 2 is complete: viewport, typed SVG fallback/recovery, handles, shell/numeric test suites and four-profile component gate. Real-browser rendering/CSP verification passed in CI; see MILESTONE2.md and HANDOFF.md.
- zod 3.25.76 (challenge and import schemas), zod-to-json-schema.
- Testing: Vitest 5 (jsdom for `src/ui/**`), fast-check 4, Testing Library, Playwright 1.64 with axe-core.
- ESLint 10 with typescript-eslint, oxfmt.
- Node 22, pnpm 10.34.3 (`.mise.toml`, `packageManager`). Use pnpm only. Pin new dependencies to exact versions (`pnpm add -E`).

## Architecture and structure

- `src/units`: mm/m/MPa conversion, `parseMmInput`, `formatMm`.
- `src/challenge`: types, zod schema, loader, bundled `challenges/cantilever-beam-1.json`, `catalog.ts` (shell cards; only cantilever-beam-1 is available), `content.ts`.
- `src/geometry`: sections, validation, clamp/strict set, conversion, envelope, outline, handle descriptors.
- `src/physics`: section properties, beam formulas, applicability checks, `analyze`.
- `src/evaluation`: constraints, acceptance, efficiency, explanations (`explain.ts`), prediction scoring. Also holds the TestResult/Prediction types.
- `src/state`: `session.ts` (types, `initSession`), `reducer.ts` (pure `sessionReducer`), `selectors.ts`, `importExport.ts`.
- `src/ui`: app, store, shell, workbench, palette, controls, mesh, viewport, dialogs, panels, history, a11y, icons.
  - `ui/App.tsx`: bootstrap.
  - `ui/state`: StoreProvider, hooks, dev snapshot.
  - `ui/shell`: platform shell.
  - `ui/workbench`: layout.
  - `ui/mesh`: three.js geometry.
  - `ui/viewport`: lazy R3F Canvas/`BeamView`, `DimensionHandles`/`handleDrag`, shared controls/summary/layout; main-bundle `ViewportBoundary`, `FallbackViewport`, typed `Fallback2D`, and pure `projection` helpers.
- The template `src/BeamScene.tsx` and temporary `LegacyFallback` are deleted. Their SVG projection now lives in `ui/viewport/projection.ts` and `Fallback2D.tsx`. Keep this fallback independent of Three.js so recovery works when the 3D chunk fails to load.
- `test/state/model.ts`: reusable fast-check command harness, per-action invariant hooks and reachable-session generator (task 19.3). Dedicated reducer properties reuse it and the `test/pbt.ts` helper.
- `test/`: shared arbitraries, pbt helper, fixtures (`test/fixtures/designs.ts`), architecture and config guard tests.
- `e2e/`: 20 verified Playwright desktop/Pixel 7 scenarios (including deletion/reload); CI also runs the focused responsive pair before the full suite.
- `schemas/`: generated JSON Schema. `scripts/`: schema generator.
- Unit tests are colocated as `*.test.ts(x)`. Property tests are named `*.pN.test.ts`.

### Import boundary (enforced by ESLint and `test/architecture.test.ts`)

- `units`, `challenge`, `geometry`, `physics`, and `evaluation` are pure. They must not import `react`, `three`, `@react-three/*`, `ui/`, or `state/`.
- `physics` must not import `evaluation`, and `evaluation` must not import `units` or `state`.
- No section, mass, deflection, or stress formulas anywhere in `src/ui` or `src/state`. Call the domain functions instead. `ui/mesh` and the 2D fallback may call `physics.deflectionShape` and `geometry.sectionOutline` for display only.
- Don't recreate `src/physics.ts`.
- The reducer is pure: no `Date`, randomness, DOM, or storage. Clock and id are injected via StoreProvider.

### Runtime constraints

- No network requests at runtime. Fonts are self-hosted through `@fontsource`.
- The production build injects the CSP `default-src 'self'`, so avoid inline styles/scripts, `data:` URLs, and remote assets. Keep `.figma/make/site.json` free of analytics and custom scripts, and leave `addBypassLinks` false.
- Keep the template class names, `index.css`, and `platform*.css`. Only make contrast fixes there.

## Code conventions

- TypeScript strict. Components use default exports.
- Single quotes in TS. Use double quotes for strings containing apostrophes.
- Keep CSS `@import` statements first in `src/index.css`.
- Accessibility: every control has an accessible name, and state is never conveyed by color alone. Announcements go through the single `ui/a11y/LiveRegion`.

## Commands (run from this folder; quote the path, it contains spaces)

```bash
pnpm install
pnpm run dev          # http://localhost:8443
pnpm run lint
pnpm run typecheck
pnpm run test         # all Vitest tests
PBT_RUNS=2000 pnpm run test   # deeper property-test run
pnpm exec vitest run --coverage
pnpm run build && pnpm run preview
pnpm exec playwright install chromium   # once, before e2e
pnpm run e2e
pnpm run gen:schema   # then check schemas/ for drift
pnpm run format
```

Before finishing any task, all of these must pass: lint (0 errors), typecheck, test, build.

## Maintaining task progress

`tasks.md` checkbox markers:
- `- [x]` done and verified
- `- [ ]` not started
- `- [-]` in progress
- `- [~]` queued
- `*` after the box means optional (the user chose to include optional tests)

When you finish a task:
1. Run the full verification above.
2. Change only that task's box to `[x]`. Mark a parent `[x]` once all its children are `[x]`.
3. Don't mark a task done without verifying it.

## Updating handoff docs

After every completed task and at the end of each work session, update `HANDOFF.md`:
- the last completed task and the next task
- test counts
- new deviations and known issues

Per the user's standing instruction, also update this file's current-task pointer and the relevant sibling `tasks.md` checkboxes after every completed task. Keep README status/counts synchronized when they change. Record whether work is local or pushed, and keep commands, structure and rules current.

## Milestone 3 execution notes

Milestone 3 is complete through checkpoint 28. CI run 38927191840 passed all core gates, 2 focused responsive cases and all 18 E2E cases on commit 48bfdd33a33632aa443ebae105f864645724b4c1. Post-MVP tasks 29–40 are planned; next planned task is 29.1. This planning update does not start implementation. Root workflow is `../.github/workflows/ci.yml`; app servers use 4174 (dev state hook) and 4173 (production CSP/no hook). Complete browser flows have a 60-second budget, with 90 seconds for keyboard and multi-breakpoint scenarios. Preserve assertions and real Tab/native drag interactions. Local sandbox restrictions still prevent server/browser startup; Safari is the user's preferred browser for artifact inspection. Preserve synchronous reduce/persist ordering in StoreProvider.

Post-MVP roadmap update (2026-10-16): tasks.md now tracks M4 review/pilot and remediation, M5 a reviewed second configuration and isolated multi-challenge flows, and scoped M6 extension tracks. All new tasks are unchecked; dependencies and milestone gates are explicit. Requirements/design for M0–M3 remain unchanged. Feature-specific specification extensions precede implementation. No new feature or pilot activity was performed in this documentation update.

UI-02 presentation follow-up (2026-10-16): removed the exclamation prefix from Not accepted badges in history rows, selected results and comparison cards, as requested. Accepted and model-applicability indicators remain unchanged.

UI-03 (D-30): Compare results uses the history list/detail layout with one selected design; challenge Test details contains only the table. Verified in CI run 38936927907. Preserve this newer user direction over D-28/D-29 descriptions of comparison cards or challenge explanation prose.

UI-04 (D-31): user-visible iteration deletion uses optional persisted deletedIterationIds; keep archived TestResults/iteration numbering intact. Use selectVisibleHistory for user-facing lists and choices; latest tested analysis stays unchanged. Baseline is protected. Current suite: 879 tests; deletion/reload browser pair passed in CI run 38936927907.

UI-05/D-32: fixed fields are collapsed under the lock/title summary; Cancel and Run Test icon/text are centered. Preserve read-only fields and native keyboard disclosure behavior. Browser verification passed in CI run 38936927907.

UI-06/D-33: informational notices belong in temporary Toast/LiveRegion, not permanent history paragraphs. My designs is a saved workspace card with no results table; Return to workbench reveals results without changing session state. Browser CI passed in run 38936927907.

Responsive repair: scope the accessible Import design file input to 1×1 px inside its positioned label. The old history-note input width:100% rule overrode sr-only and caused a 2431 px document at 1280 px (run 38935876295). Preserve this specificity fix and the requested-width responsive assertion; verified by the focused responsive pair and full suite in run 38936927907.
