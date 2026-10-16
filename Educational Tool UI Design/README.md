# Statica (Engineering Intuition MVP)

Browser-only structures learning app built around "Cantilever Beam I: Reduce Deflection". Milestone 2 provides typed cross-section editing, a 3D viewport with dimension handles, a usable SVG fallback, and the platform shell. The domain solver is implemented; the student-facing prediction, test/results, comparison, persistence, and submission workflow is Milestone 3 work. Run Test is currently disabled.

**Milestone 2 is complete against its component-test gate** (782 tests at closeout). Tasks 19.1–19.2 are implemented in the reducer: prediction gating, immutable test results, scoring, restore, comparison selection, reflection/submission, import and reset. Task 19.3 adds the reusable model-based command harness and reachable-session generator. Tasks 19.4–19.5 verify append-only history and snapshot isolation (Properties 28–29) after every generated action. The current full suite has **860 passing tests**, with lint, type checking and build passing too. [MILESTONE2.md](MILESTONE2.md) records the evidence and remaining browser-verification limits. [HANDOFF.md](HANDOFF.md) gives the current status and next task (21.1).

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
















Current Milestone 3 progress: task 22.2 complete; next 21.1. See [MILESTONE3.md](MILESTONE3.md) for the verified task ledger.
