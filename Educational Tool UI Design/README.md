# Statica (Engineering Intuition MVP)

Browser-only structures learning app built around "Cantilever Beam I: Reduce Deflection". Cross-section editing, 3D handles and SVG fallback, prediction, stored test/results, comparison/restore, reflection/submission, local persistence and design import/export are implemented in the existing platform shell.

**Milestone 3 is complete.** All 38 subtasks and final checkpoint 28 passed: 873 core tests, 2 focused responsive cases and all 18 desktop/Pixel 7 browser cases. [Passing CI run](https://github.com/niyer45/Statica-Edu/actions/runs/38927191840). See [HANDOFF.md](HANDOFF.md) for current handoff and [MILESTONE3.md](MILESTONE3.md) for task evidence.

The dotted deformation outline shows the latest **tested** design (initially the Baseline), so selecting or resizing a cross-section does not change it until a successful Run Test. This follows Requirements 25.2–25.5. Run Test and prediction confirmation are implemented; no separate deformation fix is needed.

The 3D model view deliberately omits its envelope and static text overlays; drag feedback appears below the Canvas. Numerical controls and the accessible summary retain the dimension/load information, and envelope constraints remain active. See decision D-26 in [DECISIONS.md](DECISIONS.md).

## Install

Requires Node 22 and pnpm 10.34.3 (pinned in `.mise.toml` and `package.json#packageManager`).

```sh
mise install            # or: corepack enable && corepack prepare pnpm@10.34.3 --activate
pnpm install --frozen-lockfile
pnpm exec playwright install chromium   # needed once before `pnpm run e2e`
```

`.figma/make/install` is for the Figma Make preview environment only. Do not use it for local development or CI.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | Vite dev server |
| `pnpm run lint` | ESLint, including the domain import-boundary rule |
| `pnpm run typecheck` | `tsc --noEmit` (strict) |
| `pnpm run test` | Vitest unit, property-based (fast-check), and architecture tests |
| `pnpm run build` | Production build to `dist/` (CSP injected) |
| `pnpm run e2e` | Playwright runner; 18 desktop/mobile cases; browser gate passed |
| `pnpm run gen:schema` | Regenerate `schemas/challenge.schema.json` from the zod schemas |
| `pnpm run format` | Format with oxfmt |

## Layout

- `src/units`, `src/challenge`, `src/geometry`, `src/physics`, `src/evaluation`: pure, deterministic domain code
- `src/state`: session model, learning-loop reducer, validated persistence and import/export helpers
- `src/ui`: React, React Three Fiber, and the platform shell (template CSS in `src/*.css`)
- `test/`: shared arbitraries, fixtures, architecture tests; `e2e/`: Playwright specs
- `schemas/`: generated JSON Schema (committed; CI checks for drift); `scripts/`: build helpers

## Architecture boundary

`units`, `challenge`, `geometry`, `physics`, and `evaluation` must not import `react`, `three`, `@react-three/*`, `ui/`, or `state/`, and `physics` must not import `evaluation`. ESLint (`no-restricted-imports`) and an architecture test enforce this. Every numeric result comes from typed section parameters through pure functions, never from meshes or rendering state.

Milestone 3 is complete. Post-MVP Milestones 4–6 are planned in tasks.md; next planned task is 29.1. The 320 px layout repair and strengthened responsive checks passed in CI.

Post-MVP roadmap update (2026-10-16): tasks.md now tracks M4 review/pilot and remediation, M5 a reviewed second configuration and isolated multi-challenge flows, and scoped M6 extension tracks. All new tasks are unchecked; dependencies and milestone gates are explicit. Requirements/design for M0–M3 remain unchanged. Feature-specific specification extensions precede implementation. No new feature or pilot activity was performed in this documentation update.

The challenge panel keeps a compact value/limit summary visible. Test details expands the full result table, explanations and technical context; model warnings remain visible. This user-directed presentation change is recorded in D-28 and tracked as UI-01 pending CI.

Draft status appears in the viewport; recorded test acceptance appears in design history. History and comparison views keep compact rows/cards, with extended explanations under disclosures (D-29). UI-01/UI-02 await CI verification.

UI-02 presentation follow-up (2026-10-16): removed the exclamation prefix from Not accepted badges in history rows, selected results and comparison cards, as requested. Accepted and model-applicability indicators remain unchanged.

Compare results uses the same selectable list/detail layout as Design history. The challenge Test details disclosure contains only the constraint table (D-30). These updates are tracked as UI-03 pending CI.

Design history supports confirmed deletion of non-Baseline entries. Deletion persists across reloads and removes comparison/submission choices, while current draft and last tested analysis stay unchanged. Archived numerical records preserve prediction provenance and iteration numbering (D-31). UI-04 awaits browser verification; the local suite has 878 passing tests.

Fixed challenge values expand from Some things are fixed.; the lock/title remain visible and the redundant explanatory sentence is removed. Confirmation Cancel and Run Test icon/text are centered (UI-05/D-32, browser verification pending).

My designs shows the saved local workspace and Return to workbench, with test results kept in the workbench. Informational feedback dismisses after five seconds (UI-06/D-33, browser CI pending).

Responsive import fix (UI-07): the hidden native chooser is constrained inside its label so it cannot widen the page. The existing desktop/mobile responsive regression verifies this; CI verification is pending.
