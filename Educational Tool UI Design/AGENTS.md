# Statica (Engineering Intuition MVP)

Browser-based structures learning tool. A student designs the cross-section of a cantilever beam
("Cantilever Beam I"), predicts how it will behave, runs an idealized Euler–Bernoulli test, and
compares iterations. It is built inside a Figma Make template ("figma-make-app"), and the
template's visual design and platform shell are kept.

Read `HANDOFF.md` first for the current status and the next task.

Current task progress (2026-10-17): 45.1 original-catalog scoping complete as specification (`../.kiro/specs/original-catalog/`, D-38: Torsion → Vibration → Heat Sink → Bracket → Frame; owner decisions HS-08/MB-07 open). 45.2 shared multi-model contracts complete as specification (`../.kiro/specs/multi-model-architecture/`, D-39: frozen beam v1 save shape, v2 envelopes for new models, registry/host-per-challenge). 47.1 Torsion Shaft I model specification and worksheet complete (`../.kiro/specs/torsion-shaft-1/`). 34.1 complete (CI). All five track specs 46.1–50.1 complete; 47.2 torsion model implemented and registered; Task 34 complete (model runtimes, generic store, `ui/models` UI-slot registry; production registers only the beam UI). All five models (46.2–50.2) implemented; beam and torsion registered. **Torsion Shaft I is openable** (47 complete, D-42). Vibration/heat sink/bracket workbenches merged but NOT activated (50.3/48.3/46.3 in progress; their E2E specs skip until activation). Braced Frame 49.3 is uncommitted in an agent worktree pending an owner decision. Head: 2403 tests/228 files, 28/28 E2E (+12 skipped). Session paused; activating each card needs explicit owner approval. D-40/D-41 record owner decisions. Cantilever Beam I and Torsion Shaft I are runnable. Guided/Parametric distinction implemented and CI verified: choose mode before entry, no in-workbench switch (D-37). 44.3/parent 44 open only for owner manual release-mode evidence; next development is not blocked on human QA. CI-verified baseline: 906 core tests, 2 responsive and all 24 E2E cases (run 38970465802); spec batch run 39071816823 passed. Beam II integration deferred to 52 after 51. Read HANDOFF.md; historical notes moved to HANDOFF_HISTORY.md.

## Specifications (source of truth)

The spec lives outside this folder, one level up:

- `../.kiro/specs/engineering-intuition-mvp/requirements.md`: Requirements 1–35 with numbered acceptance criteria.
- `../.kiro/specs/engineering-intuition-mvp/design.md`: architecture, decisions D-01…D-25, correctness Properties 1–37, fixtures, thresholds.
- `../.kiro/specs/engineering-intuition-mvp/tasks.md`: the completed MVP plan (Milestones 0–3, tasks 1–28) and post-MVP roadmap/maintenance (tasks 29–53) with a JSON wave dependency graph at the end.
- Additive specs: `../.kiro/specs/interaction-modes/` (task 44), `../.kiro/specs/original-catalog/` (task 45.1 scopes/models/benchmarks/delivery order for the five previews), `../.kiro/specs/multi-model-architecture/` (task 45.2 shared contracts for tasks 34 and 46–50), `../.kiro/specs/torsion-shaft-1/` (47.1), `../.kiro/specs/heat-sink-1/` (48.1), `../.kiro/specs/vibration-isolation-1/` (50.1), `../.kiro/specs/braced-frame-1/` (49.1), `../.kiro/specs/mounting-bracket-1/` (46.1) and dormant `../.kiro/specs/cantilever-beam-2/`.

Absolute path: `/Users/nikhiliyer/Documents/Kiro/.kiro/specs/engineering-intuition-mvp/`.
`DECISIONS.md` records D-01…D-42 and the 14 applicability thresholds. D-25 defines required `sectionDefaults`; D-26 records the user-directed uncluttered 3D presentation and overrides the original visible-overlay requirements.

## Rules for following the spec

- Implement tasks in `tasks.md` order, respecting the wave graph. Each task lists the requirement IDs it must satisfy.
- Milestone 2 and its component gate are complete; see `MILESTONE2.md` for evidence and limitations. Follow the current-task pointer above; HANDOFF.md records verified browser results and remaining work.
- Prediction actions use D-27: `setPrediction` requires `now` from the injected store clock. Confirm by dispatching `setPrediction`, then `runTest`; the reducer never reads time itself.
- Follow D-26: no visible envelope or static annotations on the 3D model. Keep active drag feedback below Canvas, numerical controls and the accessible summary. Do not restore the original spec overlays; the user explicitly requested their removal.
- Do not regenerate completed MVP requirements/design or rewrite completed functionality. Update task progress/dependencies when authorized; create additive scoped specifications for new models/features. Record deviations in HANDOFF.md and design decisions in DECISIONS.md.
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
- `src/challenge`: types, zod schema, loader, bundled challenges via `bundled.ts` (`cantilever-beam-1`, `torsion-shaft-1`), `catalog.ts` (cards 001 and 003 available), `content.ts`.
- `src/geometry`: sections, validation, clamp/strict set, conversion, envelope, outline, handle descriptors.
- `src/physics`: section properties, beam formulas, applicability checks, `analyze`.
- `src/evaluation`: constraints, acceptance, efficiency, explanations (`explain.ts`), prediction scoring. Also holds the TestResult/Prediction types.
- `src/state`: `session.ts` (types incl. generic `SessionStateOf`, `initSession`), `engine.ts` (model-generic reducer/init), `reducer.ts` (beam edits + engine), `selectors.ts`, `importExport.ts` (beam v1) / `importV2.ts`, `persistence.ts` (v1 beam + v2), `models.ts` (registry; dispatch by explicit identity), `torsionModel.ts`.
- Per-model pure code: `src/{challenge,geometry,physics,evaluation}/{torsion,heatSink,bracedFrame,vibration}/`; engine definitions `src/state/{torsion,heatSink,bracedFrame,vibration}Model.ts`; `src/state/runtimes.ts` (registered runtimes: beam, torsion).
- `src/ui/models/`: model UI registry (`registry.ts`), contract (`types.ts`), beam entry (`beam.tsx`). Workbench regions, dialogs wording, footer, chrome and drawer text come from the active model's entry.
- `src/challenge/bundled.ts`: bundled challenge registry (only configs an available card links to).
- `src/ui`: app, store, shell, workbench, palette, controls, mesh, viewport, dialogs, panels, history, a11y, icons.
  - `ui/App.tsx`: bootstrap.
  - `ui/state`: StoreProvider, hooks, dev snapshot.
  - `ui/shell`: platform shell; `CatalogHost` owns one store per active challenge (34.1).
  - `ui/workbench`: layout.
  - `ui/mesh`: three.js geometry.
  - `ui/viewport`: lazy R3F Canvas/`BeamView`, `DimensionHandles`/`handleDrag`, shared controls/summary/layout; main-bundle `ViewportBoundary`, `FallbackViewport`, typed `Fallback2D`, and pure `projection` helpers.
- The template `src/BeamScene.tsx` and temporary `LegacyFallback` are deleted. Their SVG projection now lives in `ui/viewport/projection.ts` and `Fallback2D.tsx`. Keep this fallback independent of Three.js so recovery works when the 3D chunk fails to load.
- `test/state/model.ts`: reusable fast-check command harness, per-action invariant hooks and reachable-session generator (task 19.3). Dedicated reducer properties reuse it and the `test/pbt.ts` helper.
- `test/`: shared arbitraries, pbt helper, fixtures (`test/fixtures/designs.ts`), architecture and config guard tests.
- `e2e/`: 24 verified Playwright desktop/Pixel 7 scenarios (including four mode cases; run 38970465802); CI also runs the focused responsive pair before the full suite.
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

## Current user directives and handoff

- Prioritize the original six catalog challenges before second editions (D-35). Read CATALOG_ROADMAP.md, tasks 45–52 and `../.kiro/specs/original-catalog/` (D-38 order; never substitute beam results for torsion, vibration, thermal, bracket or frame physics). Beam II artifacts/tests stay preserved/dormant; no card activation or non-beam outputs from the cantilever solver.
- Guided includes staged instructions/optional hints; Parametric omits scaffolding. Mode is selected in library/challenge details before entry and fixed inside the workbench; resume/reload retains it. No live mode selector. Leaving to the library permits a new entry choice with shared saved work (D-37).
- Preserve compact challenge/history/compare/My designs presentation (D-28–D-33); no permanent informational history paragraphs, no exclamation prefix on Not accepted, no dense My designs result table.
- Human engineering/manual/student review is deferred until before deployment, not completed (D-34). Nikhil is owner reviewer. 44.3/parent 44 remain open solely for manual release evidence. CI success does not prove screen-reader/touch/student QA.
- Accounts, saved user information and completed-challenge history are required future scope (38), not implemented. Current runtime has no backend/network/sync; scoped provider/ownership/data/CSP decisions precede those changes. Submission can record Not accepted; it is not a completion flag.
- Node 22/pnpm 10.34.3 are target/CI versions. Local historical Node/sandbox differences are recorded in HANDOFF.md; do not assume they apply to a new Claude environment. Keep pinned dependencies/Figma plugins.
- Use Safari for manual browser inspection if needed; retain Chromium/Pixel 7 automated gates. Never infer a browser pass from component tests or weaken regression assertions.
- Push authorized verified batches. User update 2026-10-17: after pushing, continuously monitor the GitHub workflow yourself (public Actions API) without waiting for user confirmation; run independent tasks in parallel with agents. Do not deploy/contact others without a specific instruction.

## Repository and contributor entry points

GitHub: https://github.com/niyer45/Statica-Edu, branch main. Root CLAUDE.md/AGENTS.md point here. The existing local Kiro mirror is not a git checkout; use a real separate clone for ordinary CLI git work after reconciling local files. Preserve root README, sibling .kiro specs and workflow layout, unrelated changes and remote-only files. Do not initialize unrelated history, force-push or silently delete files.

Read HANDOFF.md for paths, exact verified implementation/run, next task and architectural edge cases. DECISIONS.md records D-01–D-42 (D-40: owner HS-08/MB-07 decisions; D-41: bracket K-1–K-5; D-42: Torsion Shaft I activation); D-35 and D-37 supersede earlier priority/mode choices; D-38 records proposed original-catalog models and delivery order; D-39 records the multi-model contracts and frozen beam save format. HANDOFF_HISTORY.md contains archived status only. Keep root product README and app developer README accurate when feature availability changes.

For documentation-only edits, validate task IDs/dependency graph, local Markdown links and factual capability/status claims; do not claim new runtime/browser testing. For source changes run all required core checks and affected/full browser gates. Never run concurrent Vitest coverage processes into the same report directory.
