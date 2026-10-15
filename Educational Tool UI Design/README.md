# Statica (Engineering Intuition MVP)

Browser-only structures learning app built around "Cantilever Beam I: Reduce Deflection". Milestone 2 provides typed cross-section editing, a 3D viewport with dimension handles, a usable SVG fallback, and the platform shell. The domain solver is implemented; the student-facing prediction, test/results, comparison, persistence, and submission workflow is Milestone 3 work. Run Test is currently disabled.

**Milestone 2 is complete against its component-test gate**: 782 tests pass, along with lint, type checking, and build. [MILESTONE2.md](MILESTONE2.md) records the evidence and remaining browser-verification limits. [HANDOFF.md](HANDOFF.md) gives the current status and next task (19.1).

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
| `pnpm run e2e` | Playwright runner; end-to-end/axe specs are planned for Milestone 3 |
| `pnpm run gen:schema` | Regenerate `schemas/challenge.schema.json` from the zod schemas |
| `pnpm run format` | Format with oxfmt |

## Layout

- `src/units`, `src/challenge`, `src/geometry`, `src/physics`, `src/evaluation`: pure, deterministic domain code
- `src/state`: session model, edit reducer and import/export helpers; learning-loop actions and persistence are planned for Milestone 3
- `src/ui`: React, React Three Fiber, and the platform shell (template CSS in `src/*.css`)
- `test/`: shared arbitraries, fixtures, architecture tests; `e2e/`: Playwright specs
- `schemas/`: generated JSON Schema (committed; CI checks for drift); `scripts/`: build helpers

## Architecture boundary

`units`, `challenge`, `geometry`, `physics`, and `evaluation` must not import `react`, `three`, `@react-three/*`, `ui/`, or `state/`, and `physics` must not import `evaluation`. ESLint (`no-restricted-imports`) and an architecture test enforce this. Every numeric result comes from typed section parameters through pure functions, never from meshes or rendering state.
