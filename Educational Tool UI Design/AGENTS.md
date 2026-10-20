# Statica development rules

Statica is a browser-based tool for building engineering intuition: ten design challenges and three Learn
modules where students predict, test against an idealized model, and iterate. It is built on a Figma Make
template ("figma-make-app") whose visual design and platform shell are kept. This file holds rules only;
the current state and next work live in `HANDOFF.md`.

## Where to start

1. `HANDOFF.md`: the state right now, what waits on the owner, recent changes.
2. `../PROGRAM.md` (repository root, written by the director): the plan and the agent hierarchy.
3. `DECISIONS.md`: D-01–D-64 and the 14 applicability thresholds. Later decisions supersede earlier ones
   where they say so (for example D-37 over D-36; D-26 over the original 3D overlay requirements).
4. `OWNER_REVIEW_CHECKLIST.md`: open owner questions. Defaults stay live until the owner answers.
5. `../.kiro/specs/`: `engineering-intuition-mvp/` (requirements 1–35; design D-01–D-25 and Properties
   1–37; `tasks.md` for open work, `tasks-history.md` for completed detail and the wave graph), additive specs (`interaction-modes/`, `original-catalog/`,
   `multi-model-architecture/`, `learn-modules/`), one folder per later challenge, dormant `cantilever-beam-2/`.

`HANDOFF_HISTORY.md` and the `MILESTONE*.md` ledgers are historical evidence, never current instructions.

## Standing rules

Engineering content
- Spec first. Before coding or changing a model, write or extend `../.kiro/specs/<challenge>/` with
  requirements, design and a worksheet of independent hand calculations (a standalone script, not app
  code). Tests check the model against the worksheet.
- Cite textbooks by name and topic. Never invent edition, page or equation numbers; mark them "pending
  engineering review" until someone transcribes them from a printed copy.
- Every number a student sees comes from the physics and evaluation code (for the beam, a stored
  Test_Result from `physics/analyze` and `evaluation/evaluate`). Never show fabricated numbers, and never
  use one model's results for another challenge (D-38).
- Each baseline is the hardest valid design: applicable, without warnings, failing as many checks as
  possible (D-47). Each challenge has a hidden reference design that passes; student challenge data
  excludes `referenceDesign`, so never expose it through the UI or hooks.
- A changed constant, limit or meaning-changing wording gets a new challenge content version and storage
  key (MM-04). Changed model outputs also bump the model version.

Product behaviour
- Guided or Parametric is chosen before entering a challenge; there is no in-workbench switch. Resume
  keeps the mode; leaving to the library allows a new choice over the same saved work (D-37, D-49).
- No visible envelope or static annotations on any 3D model (D-26). Drag feedback goes below the canvas,
  in the numeric controls and in the accessible summary.
- Prediction follows D-27: dispatch `setPrediction` with `now: store.clock()`, then `store.runTest()`.
  The reducer never reads the time itself.
- Keep the compact challenge, history, compare and My designs presentation (D-28–D-33): no permanent
  explanatory paragraphs, no exclamation prefix on Not accepted, no dense results table.
- Do not regenerate completed requirements or design or rewrite completed features; add scoped specs.
  Later tasks fill existing stub files in place; do not create parallel components.

Owner, QA and release
- Never fabricate human QA, student sessions or owner review. Passing CI, axe or component tests does not
  prove screen-reader, touch, engineering or student review. Nikhil is the owner reviewer (D-34); tasks
  29.2, 30, 31.2, 32 and 44.3 stay open until he records evidence.
- Activating a card, deploying, or merging work an agent was blocked from committing needs explicit owner
  approval. An owner request for a challenge counts as approval to activate it.
- Cantilever Beam II stays dormant. Its configuration and tests are kept; integration is task 52.
- No deployment and no contact with participants, reviewers or anyone else without a specific owner
  instruction.

Git, CI and tracking documents
- No force-push, no unrelated history, no silent deletion. Preserve the root README, `.kiro/`,
  `.github/workflows/`, `design/` and remote-only files.
- Push verified batches (standing authorization), then watch the CI run yourself until it finishes
  (user, 2026-10-17; the public Actions API works without `gh`). No endless fix-and-retry loops.
- After every task, update the `tasks.md` checkboxes and `HANDOFF.md`, add decisions to `DECISIONS.md`,
  and update READMEs, specs and Home copy when availability or counts change.
- One agent at a time edits the shared tracking documents (`tasks.md`, `HANDOFF.md`, `AGENTS.md`,
  `DECISIONS.md`, `OWNER_REVIEW_CHECKLIST.md`). In parallel work the integrator updates them after merging.
- Documentation-only edits: validate task IDs, the dependency graph, local Markdown links and every
  capability or status claim against the code. Do not claim new runtime or browser testing.

Parallel agents and merges
- Registration files conflict whenever parallel branches each add a challenge: `src/challenge/catalog.ts`,
  `src/challenge/bundled.ts`, `src/state/models.ts`, `src/state/runtimes.ts`, `src/ui/models/registry.ts`
  and `src/ui/shell/TechnicalArt.tsx`. Merge them by hand and keep every entry.
- Count-based tests and copy (catalog, platform and accounts E2E specs, Home counts) must list every
  entry after a merge.
- Playwright `reuseExistingServer` tests whatever server holds the E2E ports. Give each worktree its own
  `PW_DEV_PORT`/`PW_PREVIEW_PORT` and check `lsof -iTCP:4173 -iTCP:4174` first.
- Never run two Vitest coverage processes into the same report directory.

## Tech stack

- React 19.2, TypeScript 5.9 strict, Vite 8, Tailwind CSS 4, and the four Figma Make Vite plugins in
  `vite.config.ts` (leave them unchanged). three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei
  10.7.9; zod 3.25.76; KaTeX 0.18.11 loaded lazily by `ui/math/TeX.tsx` (D-56); `@fontsource` fonts.
- Vitest 5 (jsdom for `src/ui/**`), fast-check 4, Testing Library, Playwright 1.64 with axe-core,
  ESLint 10 with typescript-eslint, oxfmt. Node 22 and pnpm 10.34.3 (`.mise.toml`, `packageManager`);
  pnpm only; pin new dependencies exactly (`pnpm add -E`).

## Architecture and structure

- Pure domain code: `src/units`, `src/challenge` (types, zod schema, loader, `challenges/*.json`,
  `bundled.ts`, `catalog.ts` with ten available cards numbered 001–010 by difficulty, `content.ts`),
  `src/geometry`, `src/physics`, `src/evaluation` (plus TestResult/Prediction types and `guided/<model>.ts`).
  The beam lives at the top level of each; other models in `<layer>/<model>/` for `torsion`, `heatSink`,
  `bracedFrame`, `vibration`, `bracket`, `column`, `vessel`, `fatigue` and `axial`.
- `src/state`: `session.ts`, `engine.ts` (model-generic reducer), `reducer.ts` (beam), `selectors.ts`,
  `importExport.ts` (beam v1) and `importV2.ts`, `persistence.ts`, `models.ts` (registry, dispatch by
  explicit identity), `<model>Model.ts`, `guided.ts`, `runtimes.ts` (all ten models registered).
- `src/account`: framework-free account provider and local implementation (D-50).
- `src/learn`: pure Learn types, `modules/` (beamBending, torsion, stressStrain), physics-only demos,
  `catalog.ts` (three available, the rest Planned), `progress.ts`. Spec `../.kiro/specs/learn-modules/`.
- `src/ui`: `App.tsx`; `state/`; `shell/` (platform shell, `CatalogHost` with one store per active
  challenge, `HomePage.tsx`, library, My designs, `routes.ts`, `TechnicalArt.tsx` card art); `models/`
  (`registry.ts`, `types.ts`, `beam.tsx`, one folder per other model, which supplies workbench regions
  and wording); `viewport/` (lazy R3F canvas; main-bundle `ViewportBoundary`, `FallbackViewport`,
  `Fallback2D`, `webgl.ts`); `learn/`, `account/`, `math/` and the template's other folders. Models with
  a 3D view load it lazily inside `ViewportBoundary`; their 2D view stays in the main bundle.
- Routes: Home at `/`, library at `/#challenges`, Learn at `#learn` and `#learn/<moduleId>`. The
  workbench is not a route.
- `test/`: arbitraries, `pbt.ts`, fixtures, the `state/model.ts` harness, architecture and config guards,
  `challenges/` baseline-difficulty tests. Unit tests are colocated `*.test.ts(x)`; property tests are
  `*.pN.test.ts`. `e2e/`: a Playwright spec per challenge plus catalog, platform, accounts, learn and others.
- CI (`../.github/workflows/ci.yml`): a `verify` job (lint, typecheck, unit tests with coverage, build,
  schema drift) and four Playwright shards (responsive pair first in shard 1), each with a 30-minute
  limit. `pages.yml` is the manual, CI-gated Pages deploy (`DEPLOY.md`).

### Import boundary (enforced by ESLint and `test/architecture.test.ts`)

- `units`, `challenge`, `geometry`, `physics`, `evaluation`, `learn` and `account` must not import
  `react`, `three`, `@react-three/*`, `ui/` or `state/` (`account` is checked by ESLint only).
- `physics` must not import `evaluation`; `evaluation` must not import `units` or `state`.
- No section, mass, deflection or stress formulas in `src/ui` or `src/state`. `ui/mesh` and the 2D
  fallback may call `physics.deflectionShape` and `geometry.sectionOutline` for display only. Do not
  recreate `src/physics.ts`.
- The reducer is pure: no `Date`, randomness, DOM or storage. Clock and ids are injected by StoreProvider.

### Runtime constraints

- No network requests at runtime. The production CSP is `default-src 'self'`: no inline styles or
  scripts, `data:` URLs or remote assets. Keep `.figma/make/site.json` free of analytics and custom
  scripts, and leave `addBypassLinks` false. The 2D fallback must work when the 3D chunk fails to load.
- Keep the template class names, `index.css` and `platform*.css`; only make contrast fixes there.
  Learning-loop styles go in `ui/learningLoop.css`.

## Code conventions

- TypeScript strict; default-export components; single quotes in TS (double quotes for strings with
  apostrophes); CSS `@import` statements first in `src/index.css`. Every control has an accessible name;
  state is never shown by colour alone; announcements go through the single `ui/a11y/LiveRegion`.
- Property tests carry `// Feature: engineering-intuition-mvp, Property N: <title>` and use `test/pbt.ts`
  (`PBT_RUNS`, default 200, fixed seed).

## Commands

Run from this folder (quote the path; it contains spaces) with Node 22: prefix `PATH` with
`/opt/homebrew/opt/node@22/bin` (keg-only; the default `node` here is 24).

```bash
pnpm install --frozen-lockfile
pnpm run lint && pnpm run typecheck
pnpm exec vitest run --coverage    # all unit tests; 95% lines on physics, geometry, evaluation, state
PBT_RUNS=2000 pnpm run test        # deeper property-test run
pnpm run build
PORT=4180 pnpm run preview         # the director's preview port
pnpm exec playwright install chromium   # once, before E2E
pnpm run e2e                       # dev server 4174, production preview 4173
pnpm run gen:schema                # then check schemas/ for drift
pnpm run format
```

`pnpm run dev` and `preview` default to port 8443, the user's Kiro dev server: always set `PORT`. E2E
uses 4174 (dev, exposes test-only `__EI_STATE__`) and 4173 (production, must not expose it).

Before finishing a task: lint (0 errors), typecheck, tests with coverage, build and schema drift pass,
plus the affected Playwright specs. Never weaken assertions, timeouts or retries to hide a regression.

## Maintaining tasks.md and the handoff

Markers: `- [x]` done and verified, `- [ ]` not started, `- [-]` in progress, `- [~]` queued; `*` after
the box marks an optional task. Change only the finished task's box; mark a parent `[x]` once all its
children are. Never mark work done without verification, or human and browser work without evidence.

After each task, update `HANDOFF.md` (state, a recent-changes row with task, date, commit, CI run and
decision, new known issues, test counts). Move superseded material to `HANDOFF_HISTORY.md` verbatim.
