# Statica Edu — developer guide

Statica Edu helps students build engineering intuition by changing a design, predicting its behavior, testing constraints and explaining results. See the [repository README](../README.md) for the product overview, current features, roadmap and model/storage limitations.

Current UI: all six original challenges (Cantilever Beam I, Mounting Bracket I, Torsion Shaft I, Heat Sink I, Braced Frame I, Vibration Isolation I) with Guided/Parametric modes, section editing, 3D/SVG visualization, prediction, tested history, comparison/restore/deletion, reflection/submission and validated local saving/design import/export. Cantilever Beam II has a tested configuration but is not available in the UI yet. Accounts, cloud saves and completed-challenge history remain planned. Since 2026-10-18: a Home page presenting the product and roadmap (D-53) with optional device-only accounts (D-50) and per-challenge progress in My designs, Guided structured experiments vs Parametric open design (D-49), Reset to baseline, and hardest-possible baselines (D-47).

## Setup

From this directory, use Node 22 and pnpm 10.34.3 (pinned in `.mise.toml` and `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

`.figma/make/install` is for Figma Make preview only; do not use it for local development or CI. Open the URL Vite prints.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run lint` | ESLint and import boundaries |
| `pnpm run typecheck` | Strict TypeScript checking |
| `pnpm run test` | Unit, component, property and architecture tests |
| `pnpm exec vitest run --coverage` | Full suite with 95% domain line coverage gates |
| `pnpm run build` | Production build with CSP |
| `pnpm run preview` | Serve the built production app locally |
| `pnpm exec playwright install chromium` | Install the browser before running E2E locally |
| `pnpm run e2e` | Desktop Chromium and Pixel 7 flows, including axe checks |
| `pnpm run gen:schema` | Regenerate the committed challenge JSON Schema |
| `pnpm run format` | Format with oxfmt |

The current development suite has 906 tests across 111 files. The browser suite now has 24 verified cases (run 38970465802, including four mode cases), with a focused responsive pair also run separately in CI. See [GitHub Actions](https://github.com/niyer45/Statica-Edu/actions) and [HANDOFF.md](HANDOFF.md) for exact verified commits; local tests alone do not establish browser or human QA results.

## Structure and architecture

| Path | Responsibility |
| --- | --- |
| `src/units`, `src/challenge`, `src/geometry`, `src/physics`, `src/evaluation` | Pure deterministic domain modules and validated challenge content |
| `src/state` | Session model, reducer, validated persistence and design import/export |
| `src/ui` | React shell/workbench, controls, R3F viewport, SVG fallback and accessibility primitives |
| `test/` | Shared fixtures, property helpers, architecture and cross-layer integration tests |
| `e2e/` | Playwright desktop/mobile scenarios |
| `schemas/`, `scripts/` | Committed generated schema and generation helpers |
| `../.kiro/specs/` | MVP specifications, roadmap and additive challenge specifications |
| `../.github/workflows/ci.yml` | Active repository workflow; its working directory is this app |

Domain modules cannot import React, Three.js, UI or state; physics cannot import evaluation. UI/state call the domain functions instead of reimplementing formulas. Solver results come from typed geometry, not rendered meshes. Reducer clock/IDs/storage are injected; preserve synchronous reduce/persist ordering.

Keep the existing Figma Make shell/plugins and external styling architecture. Preserve D-26's uncluttered model: no envelope/static annotation overlays, with active handle feedback below Canvas. The deformation outline follows the latest tested snapshot until another successful Run Test.

## Development handoff

Read [AGENTS.md](AGENTS.md) and [HANDOFF.md](HANDOFF.md) before editing. Update those files and the [task list](../.kiro/specs/engineering-intuition-mvp/tasks.md) after completed work; preserve numeric task IDs and truthful evidence.

Done: original-catalog scoping (45), multi-challenge infrastructure with model runtimes and UI slots (34), all five model implementations (46.2–50.2), and the openable Torsion Shaft I (47). All six challenges are openable (D-42–D-44). Mounting Bracket I, Torsion Shaft I and Braced Frame I have 3D views with 2D fallbacks (task 54, D-45); next: gate 51. See [MILESTONE5.md](MILESTONE5.md). Nikhil is the nominated owner engineering reviewer; human engineering/manual/student QA remains required before customer deployment under D-34. [MILESTONE4.md](MILESTONE4.md) and [PILOT_PROTOCOL.md](PILOT_PROTOCOL.md) contain prepared materials, not completed review/pilot evidence.

The app remains browser-local with no backend, sign-in or cloud sync. Future account work must explicitly specify the required network/CSP changes and user ownership rules; do not describe current local storage as account-backed saving.

Task 44 tracks the required pre-deployment Guided/Parametric distinction. Guided now includes short browsable instructions and optional hints; Parametric offers direct editing without the scaffolding. Choose the mode before opening the challenge. It stays fixed in the workbench and survives reload/resume, preserving the same session and numerical behavior. Browser verification passed run 38970465802; owner manual release verification remains pending under 44.3. This is separate from Freeform geometry work.

Original-catalog priority (D-35): develop the six existing library challenges before second editions. See CATALOG_ROADMAP.md and tasks 45–52. Beam II configuration/tests are retained but further integration is deferred; the remaining four preview challenges stay unavailable until their integration is verified and the owner approves activation. 45.1 scoping is complete as specification (`../.kiro/specs/original-catalog/`, D-38 order Torsion → Vibration → Heat Sink → Bracket → Frame); shared multi-model contracts 45.2 are specified (`../.kiro/specs/multi-model-architecture/`); next is 34.1, registry/integration. Required mode distinction and human release gates are unchanged.

For a fresh Claude Code session, start at repository-root CLAUDE.md and read the current HANDOFF.md/AGENTS.md. Superseded status logs are archived in HANDOFF_HISTORY.md.
