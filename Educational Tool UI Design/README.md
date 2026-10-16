# Statica (Engineering Intuition MVP)

Browser-only structures learning app built around "Cantilever Beam I: Reduce Deflection". Cross-section editing, 3D handles and SVG fallback, prediction, stored test/results, comparison/restore, reflection/submission, local persistence and design import/export are implemented in the existing platform shell.

**Milestone 3: 35/38 Milestone 3 subtasks complete; next 27.4. Browser tasks verified: 27.2, 27.3, 27.5.** The core gate passes with **873 tests**, lint, typecheck, build, coverage and schema checks. See [HANDOFF.md](HANDOFF.md) for current browser evidence and remaining work; [MILESTONE3.md](MILESTONE3.md) preserves the task ledger.

The dotted deformation outline shows the latest **tested** design (initially the Baseline), so selecting or resizing a cross-section does not change it until a successful Run Test. This follows Requirements 25.2–25.5. The pending Run Test/results panel (21.1) and prediction confirmation (22.2) complete that UI flow; no separate deformation fix is needed.

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
| `pnpm run e2e` | Playwright runner; 18 desktop/mobile cases authored, browser gate failing |
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




























Current Milestone 3 progress: 35/38 Milestone 3 subtasks complete; next 27.4. Browser tasks verified: 27.2, 27.3, 27.5. See [MILESTONE3.md](MILESTONE3.md) for the verified task ledger.
