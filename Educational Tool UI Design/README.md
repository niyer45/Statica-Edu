# Statica (Engineering Intuition MVP)

Browser-only structures learning app built around "Cantilever Beam I: Reduce Deflection". Cross-section editing, 3D handles and SVG fallback, prediction, stored test/results, comparison/restore, reflection/submission, local persistence and design import/export are implemented in the existing platform shell.

**Milestone 3 is complete.** All 38 subtasks and final checkpoint 28 are complete. Subsequent maintenance UI-01–UI-07 also passed: 879 core tests, 2 focused responsive cases and all 20 desktop/Pixel 7 browser cases. [Passing CI run](https://github.com/niyer45/Statica-Edu/actions/runs/38936927907). See [HANDOFF.md](HANDOFF.md) for current handoff and [MILESTONE3.md](MILESTONE3.md) for task evidence.

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

Milestone 3 is complete. Milestone 4 task 29.1 is complete; see [MILESTONE4.md](MILESTONE4.md) for the review and local-only pilot plan. Next is 29.2, independent engineering review; reviewer and participants are not yet arranged. Accounts, saved user information and completed-challenge progress follow the pilot under tasks 38.1–38.2. The 320 px layout repair and strengthened responsive checks passed in CI.

Post-MVP roadmap update (2026-10-16): tasks.md now tracks M4 review/pilot and remediation, M5 a reviewed second configuration and isolated multi-challenge flows, and scoped M6 extension tracks. Task 29.1 is complete; remaining roadmap subtasks are unchecked, with explicit dependencies and gates. Requirements/design for M0–M3 remain unchanged. Feature-specific specification extensions precede implementation. No new feature or pilot activity was performed in this documentation update.

Verified UI maintenance (D-28–D-33): the challenge keeps a compact requirements summary and table-only Test details. History and comparison use selectable list/detail layouts; non-Baseline iterations support confirmed, persisted deletion while preserving archived records and numbering. Fixed values expand from Some things are fixed. My designs shows the saved workspace with Return to workbench; informational feedback dismisses after five seconds. Native import remains accessible without widening the page. See HANDOFF.md for preservation details and passing CI evidence.
