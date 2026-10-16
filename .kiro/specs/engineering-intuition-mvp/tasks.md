# Implementation Plan: Engineering Intuition Platform MVP (Cantilever Beam I)

## Overview

Incremental, test-driven plan in TypeScript (strict) following design Milestones 0–3. All work happens in the existing Figma Make template at `Educational Tool UI Design/` (project root; every path below is relative to it) using pnpm. M0 adapts the template (exact pins, test tooling, self-hosted fonts, CSP, removal of prototype physics), adds CI, the zod schema, and documentation. M1 builds the pure domain (units, challenge, geometry, physics, applicability, evaluation, fixtures, import/export) and verifies Properties 1–27 plus fixtures E1–E6. M2 adds a minimal session skeleton, refactors the template's `App.tsx` / `Workspace.tsx` / `BeamScene.tsx` into the spec's `ui/` components while keeping the look, and builds the 3D/2D UI (viewport, palette, handles, numeric controls, SVG fallback). M3 completes the reducer and the learning loop (prediction, Run Test, results, history/compare/restore, reflection/submit, persistence, import/export UI, dialogs, live region) and verifies Properties 28–37 and the E2E scenarios. Milestones 4–6 are now tracked below as a post-MVP roadmap; their feature-specific requirements are extensions to the completed MVP scope.

Every property test uses fast-check through a shared helper that reads `PBT_RUNS` (default 200) and a fixed recorded seed, and carries the tag comment `// Feature: engineering-intuition-mvp, Property N: <title>`.

## Tasks

### Milestone 0: Template adaptation, CI, schema, decisions

- [x] 1. Adapt the template project, boundaries, schema, CI, and docs
  - [x] 1.1 Adapt the existing template project and add test tooling
    - Do not scaffold a new project. Keep React 19, Vite 8, Tailwind v4 (`@tailwindcss/vite`), TypeScript 5.7, oxfmt, `vite.config.ts` with the four Figma Make plugins and the `@` alias, `.mise.toml` (Node 22, pnpm 10.34.3), and `.figma/make/*`
    - Convert every existing caret range in `package.json` to the exact version resolved in the current `pnpm-lock.yaml`; add `"packageManager": "pnpm@10.34.3"`
    - `pnpm add -E` three, @react-three/fiber, @react-three/drei, zod, zod-to-json-schema, @fontsource/dm-sans, @fontsource/manrope; `pnpm add -D -E` vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/user-event, fast-check, @playwright/test, @axe-core/playwright, eslint, typescript-eslint, eslint-plugin-react-hooks, tsx (versions compatible with React 19 / Vite 8); commit `pnpm-lock.yaml`
    - Scripts: keep `dev`, `build`, `preview`, `format`; add `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `e2e`, `gen:schema`
    - Create the folder layout from the design under `src/` (`units`, `challenge`, `geometry`, `physics`, `evaluation`, `state`, `ui`) plus `test/fixtures`, `e2e`, `schemas`, `scripts`; extend `tsconfig.json` `include` to `test`, `e2e`, `scripts` (keep `strict: true`)
    - `vitest.config.ts` reusing the `@` alias, jsdom for `src/ui/**`, per-directory line coverage thresholds of 95% for `physics/`, `geometry/`, `evaluation/`, `state/`
    - `test/pbt.ts` helper: `pbtParams()` returning `{ numRuns: Number(process.env.PBT_RUNS ?? 200), seed: FIXED_SEED }` and reporting seed + counterexample on failure
    - `playwright.config.ts` with projects Chromium desktop and Pixel 7, `webServer` running `pnpm run build && pnpm run preview` on a fixed port
    - _Requirements: 1.1, 1.2, 1.12, 33.1, 33.4, 33.5, 33.11_

  - [x] 1.2 Configure ESLint import boundaries
    - `eslint.config.js` with `no-restricted-imports`: domain modules may not import `react`, `three`, `@react-three/*`, `ui/`, `state/`; `physics/` may not import `evaluation/`; ban `dangerouslySetInnerHTML`
    - _Requirements: 1.5, 1.6, 1.7, 23.7_

  - [x] 1.3 Write the architecture unit test (fixture E6)
    - `test/architecture.test.ts` scans every source file in the domain modules and fails naming the file and import path for any forbidden import; also checks `physics/` → `evaluation/`
    - Also fails if `src/physics.ts` exists or if any file under `src/ui/` contains section-property, mass, deflection, or stress formulas (pattern scan for e.g. `Math.PI *`, `** 3 / 12`, `/ (3 *`)
    - Required (not optional) because Requirements 1.5 and 1.14 mandate it as an enforcement mechanism
    - _Requirements: 1.5, 1.6, 1.7, 1.14_

  - [x] 1.4 Define challenge types and the zod schema, plus schema generation
    - `challenge/types.ts` (Challenge, Material, ParamRange, SectionLimits, Difficulty, InteractionMode, LockedField, SectionKind, SchemaIssue, `Result<T,E>`)
    - `challenge/schema.ts` zod schema with `.strict()` at every level; `difficulty` and `allowedModes` (non-empty) independent
    - `scripts/gen-schema.ts` writing `schemas/challenge.schema.json` deterministically (stable key order, trailing newline); commit the output
    - _Requirements: 1.8, 3.1, 3.5, 3.8_

  - [x] 1.5 Self-host fonts, fix tokens, set site title, and add the CSP plugin
    - `src/index.css`: replace the Google Fonts `@import url(...)` with `@fontsource/dm-sans` and `@fontsource/manrope` imports for the weights the CSS uses (keep CSS `@import` statements first, per AGENTS.md); keep `@import 'tailwindcss'`
    - In `index.css`, darken only the template color tokens that fail 4.5:1 (normal) / 3:1 (large) and add a ≥3:1 `:focus-visible` ring; record each changed token in DECISIONS.md; do not restyle `platform.css` / `platform-base.css` beyond contrast fixes
    - `.figma/make/site.json`: add `"title": "Statica"`; keep `addBypassLinks: false`; add no analytics or custom scripts
    - `vite.config.ts`: add a build-only plugin (`apply: 'build'`, `transformIndexHtml` `order: 'post'`) injecting `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`; set `build.assetsInlineLimit: 0`; leave the Figma plugins unchanged
    - _Requirements: 1.1, 1.11, 1.12, 1.13, 23.8, 32.5, 32.6, 34.9_

  - [x] 1.6 Add the CI workflow
    - `.github/workflows/ci.yml` on push and pull_request: setup Node 22 and pnpm 10.34.3 (`pnpm/action-setup` or `jdx/mise-action` reading `.mise.toml`) → `pnpm install --frozen-lockfile` → lint → typecheck → test → build → schema drift check (`pnpm run gen:schema && git diff --exit-code schemas/`) → Playwright E2E; each step depends on the previous; non-blocking `pnpm audit --prod` report
    - _Requirements: 1.3, 1.4, 1.9, 33.6, 33.10_

  - [x] 1.7 Write README.md and merge DECISIONS.md
    - README documents the pnpm install, dev, lint, typecheck, test, build, e2e, gen:schema, format commands and notes that `.figma/make/install` is for the Figma preview environment only
    - Rewrite the template's `DECISIONS.md` to record D-01 through D-24 and the 14 applicability thresholds (warning value, not-applicable value, rationale), plus a "Template decisions" section listing every original template entry as retained or superseded with the superseding decision ID (per the design merge table)
    - Update `AGENTS.md` with the new scripts and the domain import-boundary rule
    - _Requirements: 1.10_

  - [x]* 1.8 Write unit test for schema generation determinism
    - Generate the schema twice in-process and assert byte-identical output equal to the committed file
    - _Requirements: 1.8, 1.9_

  - [x] 1.9 Remove the template's prototype physics
    - Delete `src/physics.ts` and `src/physics.test.ts` (node:test); no code from them is ported (the spec modules are written fresh in M1, and the still-valid checks are re-expressed in tasks 8.3 and 11.4)
    - Keep `src/Workspace.tsx`, `src/App.tsx`, and `src/BeamScene.tsx` compiling by inlining a local display-only design type until tasks 13.3, 13.5, and 14.4 replace them
    - Remove every number derived from the prototype analysis (metrics, requirement pass marks, history "Passed/Needs work", explanation strings) and show a neutral "Not yet tested" placeholder; disable Run test until task 13.2 wires the store, so no fabricated result is ever shown
    - _Requirements: 1.14_

  - [x] 1.10 Write the site configuration guard test
    - `test/siteConfig.test.ts` reads `.figma/make/site.json` and fails if `analytics.googleAnalyticsId` is set, any `customScripts` key is present, or `accessibility.addBypassLinks` is true
    - Required (not optional) because Requirement 23.9 mandates the test
    - _Requirements: 23.9_

- [x] 2. Checkpoint – Milestone 0 gate
  - Run `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build`; ensure all pass, and confirm `pnpm run dev` still starts with the Figma plugins; ask the user if questions arise.
  - _Requirements: 1.12, 33.6_

### Milestone 1: Pure domain

- [x] 3. Units module
  - [x] 3.1 Implement `units/units.ts`
    - `mToMm`, `mmToM`, `paToMpa`, `m4ToMm4`, `m2ToMm2`; `parseMmInput` (strict decimal regex after trim, returns null otherwise, never throws); `formatMm(m, digits = 2)` locale-independent via `toFixed`, placeholder for non-finite
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x]* 3.2 Write unit tests for units, including the Requirement 2.7 round-trip
    - Examples for each conversion and parse rejections ("12abc", "12mm", "1,200", "", "NaN", "Infinity")
    - Round-trip test for 2.7: table-driven over sampled |x| ≤ 1e6 m and every D in 0..6, asserting `parseMmInput(formatMm(x, D))` is non-null and within 0.5×10⁻ᴰ mm + 1e-9 mm of `mToMm(x)` (no design property exists for this criterion)
    - Locale check: run formatting with a non-English default locale and assert identical output
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 4. Challenge loader and bundled challenge
  - [x] 4.1 Implement `challenge/loader.ts`
    - `loadChallenge(json: unknown)`: accept a string (parse with `JSON.parse`, issue on parse failure) or object; run zod plus cross-field rules (range min ≤ max, defaults within range, I-section tf/tw ≥ 0.003, h − 2tf ≥ 0.003, tw ≤ b, tube wall ≥ 0.002 and < D/2); collect all issues with path and rule; `deepFreeze` on success
    - _Requirements: 3.1, 3.2, 3.4, 3.8, 3.9, 3.10_

  - [x] 4.2 Author `challenges/cantilever-beam-1.json` and `content.ts`
    - Values from the design data table (L, F, material, baseline Ø30, limits, ranges, defaults, predictionPolicy [1, 3], visualization 15 / 0.3, `allowedModes: ['guided', 'parametric']`, reflection prompt, concept notes)
    - `challenge/catalog.ts`: static shell metadata moved from the template `App.tsx` (six challenge cards with title, discipline, difficulty, time, concepts, art kind, `available`); only `cantilever-beam-1` is `available: true`; no physics data for previews
    - Add `toStudentChallenge(ch)` selector that omits `referenceDesign`
    - _Requirements: 3.5, 3.6, 3.7_

  - [x]* 4.3 Write unit tests for the loader
    - Bundled challenge loads with no issues; unknown keys at nested levels rejected with paths; each cross-field rule produces its own issue; multiple failures all reported; unparseable input; student view omits `referenceDesign`
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x]* 4.4 Write property test for challenge immutability (loader portion)
    - **Property 26: Constraints immutable** (loader/freeze half; reducer sequences added in 19.13)
    - Random assign/add/delete attempts at random nesting paths leave the loaded challenge deep-equal to a pre-captured clone
    - **Validates: Requirements 3.4, 4.6, 4.7**

- [x] 5. Geometry core and validation
  - [x] 5.1 Implement `geometry/sections.ts` and `geometry/envelope.ts`
    - Section union, Orientation, BeamDesign, GeometryError types, `GEOM_TOL`, `sectionBoundingBox`, `orientedEnvelope` (0° → Z=b, Y=h; 90° → Z=h, Y=b)
    - _Requirements: 5.1, 7.1, 7.2, 7.3_

  - [x] 5.2 Implement `geometry/validate.ts`
    - `validateSection` and `validateDesign` with deterministic error order: per-parameter NON_FINITE / NON_POSITIVE (exclusive, inner d = 0 allowed), BELOW_MIN / ABOVE_MAX with GEOM_TOL, INNER_NOT_LESS_THAN_OUTER, WALL_TOO_THIN, FLANGES_OVERLAP, WEB_WIDER_THAN_FLANGE, FLANGE_TOO_THIN, WEB_TOO_THIN, SECTION_NOT_ALLOWED (suppresses dimension errors), BAD_ORIENTATION, LOCKED_FIELD_CHANGED per locked field; non-empty messages; no input mutation
    - _Requirements: 4.3, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 7.8_

  - [x] 5.3 Create shared fast-check arbitraries in `test/arbitraries.ts`
    - `arbValidSection(limits)`, `arbDesign(ch)` (valid by construction), `arbAnySection`, `arbHostileNumber` (NaN, ±Infinity, −0, 0, negatives, 1e308, 5e-324), `arbParamFor(kind)`
    - _Requirements: 33.1, 33.2_

  - [x]* 5.4 Write property test for hostile input rejection (validator portion)
    - **Property 14: Hostile input rejection** (runTest half added in 19.13)
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 17.2**

  - [x]* 5.5 Write property test for envelope swap
    - **Property 19: Envelope swap**
    - **Validates: Requirements 7.2, 7.3**

  - [x]* 5.6 Write unit tests for the validator
    - One example per error code with expected `param`; GEOM_TOL boundary values; multi-error lists in stable order; frozen input not mutated; SECTION_NOT_ALLOWED suppression; locked-field errors per field
    - _Requirements: 4.3, 5.2–5.15, 7.8_

- [x] 6. Clamp, strict set, and conversion
  - [x] 6.1 Implement `geometry/clamp.ts`
    - `clampParam` with permissible ranges (tube d ∈ [0, D − 2·minWall], tf ∈ [minTf, (h − minClear)/2], tw ∈ [minTw, b]) and coupled shrink-only adjustments; non-finite returns input unchanged
    - `trySetParam` replacing only the parameter and returning all validator errors on failure (NON_FINITE for non-finite)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [x]* 6.2 Write property test for clamp validity and idempotence
    - **Property 15: Clamp validity**
    - **Validates: Requirements 6.1, 6.3, 6.4**

  - [x]* 6.3 Write property test for clamp locality
    - **Property 16: Clamp locality**
    - **Validates: Requirements 6.2**

  - [x]* 6.4 Write property test for strict set (function portion)
    - **Property 17: Strict set** (reducer half added in 19.13)
    - **Validates: Requirements 6.5, 6.6, 6.7**

  - [x] 6.5 Implement `geometry/convert.ts`
    - `SectionDefaults` (tube wall 0.004, tf = tw = 0.004) and `convertSection` preserving clamped bounding box (circle/tube use max(b, h)); defaults fall back to largest permissible value; same kind returns deep-equal input
    - _Requirements: 6.9, 6.10, 6.11_

  - [x]* 6.6 Write property test for conversion validity
    - **Property 18: Conversion validity**
    - **Validates: Requirements 6.9, 6.11**

  - [x]* 6.7 Write unit tests for clamp/convert examples
    - Coupled cases 6.2(a)(b)(c); default fallback for small sections (6.10); circle → I-section Ø30 gives 30×30 bbox
    - _Requirements: 6.2, 6.9, 6.10_

- [x] 7. Outline and handle descriptors
  - [x] 7.1 Implement `geometry/outline.ts` and `geometry/handles.ts`
    - `sectionOutline(s, segments = 48)` with tube hole; `handlesFor(s, o)` returning one descriptor per editable parameter with axis, anchor, label, permissible range
    - _Requirements: 25.1, 27.1_

  - [x]* 7.2 Write unit tests for outline and handles
    - Outline extents equal bounding box; tube has one hole; descriptor count and params per kind; axes swap at 90°
    - _Requirements: 25.1, 27.1_

- [x] 8. Section properties and tolerance
  - [x] 8.1 Implement `physics/constants.ts` and `physics/tolerance.ts`
    - 14 applicability thresholds, `UNSUPPORTED_EFFECTS` (9 entries), `ASSUMPTIONS`; `REL_TOL` and `withinLimit` live in `physics/tolerance.ts` (re-exported by `evaluation/`) so `physics/` never imports `evaluation/`
    - _Requirements: 1.7, 10.9, 10.10, 11.3_

  - [x] 8.2 Implement `physics/sectionProperties.ts` and `physics/beam.ts`
    - `sectionProperties`, `bendingProperties`, `tipDeflection`, `maxMoment`, `nominalStress`, `deflectionShape` per the design formulas
    - _Requirements: 8.1, 8.2, 8.9, 8.11, 9.5_

  - [x]* 8.3 Write property test for rectangle orientation swap
    - **Property 7: Rectangle orientation swap**
    - **Validates: Requirements 8.4, 8.5**

  - [x]* 8.4 Write property test for axisymmetric invariance
    - **Property 8: Axisymmetric invariance**
    - **Validates: Requirements 8.3**

  - [x]* 8.5 Write property test for cubic depth scaling
    - **Property 9: Cubic depth scaling**
    - **Validates: Requirements 8.6**

  - [x]* 8.6 Write property test for containment bounds
    - **Property 10: Containment bounds**
    - **Validates: Requirements 8.7**

  - [x]* 8.7 Write property test for section consistency
    - **Property 11: Section consistency**
    - **Validates: Requirements 8.8**

- [x] 9. Applicability and analysis
  - [x] 9.1 Implement `physics/applicability.ts`
    - `checkApplicability`: DEPTH_SPAN, LARGE_DEFLECTION, PLASTICITY always; TUBE_SLENDERNESS for tubes; FLANGE_OUTSTAND and WEB_SLENDERNESS for I-sections; RECT_ASPECT only for rectangles with envelope height > width; not-applicable checked first, each code at most once; thresholds read only from `constants.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.10_

  - [x] 9.2 Implement `physics/analyze.ts`
    - `analyze(d, ch)`: compute fields, throw `PhysicsInvariantError` naming the field on non-finite/≤0, call `checkApplicability`, set `applicable`, `modelId`, `assumptions`, `unsupportedEffects`; return frozen result; no input mutation
    - _Requirements: 9.1, 9.2, 9.3, 9.10, 9.11, 9.12, 10.8, 10.9_

  - [x]* 9.3 Write property test for finiteness
    - **Property 1: Finiteness**
    - **Validates: Requirements 8.2, 9.2**

  - [x]* 9.4 Write property test for the deflection formula and shape
    - **Property 2: Deflection formula**
    - **Validates: Requirements 9.1, 9.5**

  - [x]* 9.5 Write property test for length scaling
    - **Property 3: Length scaling**
    - **Validates: Requirements 9.6**

  - [x]* 9.6 Write property test for modulus scaling
    - **Property 4: Modulus scaling**
    - **Validates: Requirements 9.7**

  - [x]* 9.7 Write property test for force linearity
    - **Property 5: Force linearity**
    - **Validates: Requirements 9.8**

  - [x]* 9.8 Write property test for the mass formula
    - **Property 6: Mass formula**
    - **Validates: Requirements 9.1, 9.9**

  - [x]* 9.9 Write property test for extreme fiber
    - **Property 12: Extreme fiber**
    - **Validates: Requirements 8.9, 9.1, 9.10**

  - [x]* 9.10 Write property test for determinism
    - **Property 13: Determinism**
    - **Validates: Requirements 8.11, 9.11**

  - [x]* 9.11 Write unit tests for applicability thresholds (Requirements 10.4–10.7)
    - For each of the 7 codes, construct metric values at, just within REL_TOL above (e.g. 0.1000000000000001 vs 0.10), just above warning, at not-applicable, and above not-applicable; assert the issue lands in the correct list with code, message, value, threshold; assert each code appears at most once; assert non-evaluated metrics record nothing (no design property exists for these criteria)
    - Also assert `unsupportedEffects` lists exactly the 9 effects and `PhysicsInvariantError` is thrown for a forced non-finite input
    - _Requirements: 9.3, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9_

- [x] 10. Evaluation, explanations, and prediction scoring
  - [x] 10.1 Implement `evaluation/constraints.ts`, `acceptance.ts`, `efficiency.ts`, and single-result facts in `explain.ts`
    - Domain types `TestResult`, `Prediction`, `PredictionOutcome` defined in `evaluation/types.ts` (re-exported by `state/`) so evaluation never imports `state/`
    - `evaluate(d, a, ch)`: 7 constraints in fixed order with utilization, re-runs `validateDesign` for featureGeometry, failures in order, status rules, unclamped efficiency, frozen result; `explainSingle` includes exactly one idealized-model fact
    - _Requirements: 11.1–11.8, 12.1–12.6, 12.10, 13.8_

  - [x]* 10.2 Write property test for acceptance iff all pass
    - **Property 21: Acceptance iff all pass**
    - **Validates: Requirements 11.8, 12.2, 12.3, 12.4**

  - [x]* 10.3 Write property test for not-applicable dominance
    - **Property 22: Not-applicable dominance**
    - **Validates: Requirements 10.8, 12.1**

  - [x]* 10.4 Write property test for the inclusive boundary
    - **Property 23: Inclusive boundary**
    - **Validates: Requirements 11.3**

  - [x]* 10.5 Write property test for limit monotonicity
    - **Property 24: Monotonicity**
    - **Validates: Requirements 11.9, 11.10**

  - [x]* 10.6 Write property test for non-finite never passing
    - **Property 25: Non-finite never passes**
    - **Validates: Requirements 11.4**

  - [x] 10.7 Implement `compareResults` and `explainChange` in `explain.ts`
    - I/δ ratio fact, same-mass fact (|rm − 1| ≤ 0.02 and rδ < 0.98), section/orientation change fact, per-constraint pass-state change facts, model-limitation fact; every number in text formatted from `basis`; deterministic ids and order
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9_

  - [x]* 10.8 Write property test for grounded facts
    - **Property 27: Grounded facts**
    - **Validates: Requirements 13.1, 13.2**

  - [x] 10.9 Implement `evaluation/prediction.ts`
    - `scorePrediction(p, prev, nextAnalysis)` with r thresholds 0.98 / 1.02 and match flag
    - _Requirements: 14.7, 14.8_

  - [x]* 10.10 Write unit tests for prediction scoring and explanation conditions
    - r exactly 0.98, 1.02, and just outside; same-mass fact present/absent boundaries; repeated comparisons identical
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 13.9, 14.7, 14.8_

- [x] 11. Fixtures and pure import/export
  - [x] 11.1 Create `test/fixtures/designs.ts`
    - baseline, reference, tubeSameMass, rectTall, rectFlat, heavySquare, wideI, tinyCircle with expected A, m, I_bend, δ, σ, status, failures, warnings from the design table
    - _Requirements: 8.10_

  - [x]* 11.2 Write example tests E1 and E2 (baseline and reference)
    - E1: baseline `notAccepted`, failures `['deflection']`, δ ≈ 7.87 mm, m ≈ 1.145 kg, σ ≈ 67.9 MPa, deflectionMargin < 0
    - E2: reference `accepted`, warnings `[]`, values match table within 1e-3
    - _Requirements: 8.10, 12.7, 12.8_

  - [x]* 11.3 Write example test E3 (remaining fixtures)
    - Each fixture's status, failures (in order), and warning codes (LARGE_DEFLECTION for rectFlat, FLANGE_OUTSTAND for wideI)
    - _Requirements: 8.10, 12.9_

  - [x]* 11.4 Write example test E4 (hand-calculated section values)
    - Rect 20×40 (A = 8e-4, Ixx = 1.0667e-7, Iyy = 2.6667e-8) and one hand case per remaining kind
    - Re-express the still-valid checks from the deleted template `physics.test.ts`: rect 20×40 at 90° gives 4× deflection and 2× stress; tube D = 40, d = 34 matches annular A and I. Do not port its 40×50×3 reference, 80 mm cap, or "deep section not applicable" cases
    - _Requirements: 8.1, 8.10_

  - [x]* 11.5 Write example test E5 (solvability)
    - Reference passes; tubeSameMass has baseline mass within 2% and passes
    - _Requirements: 12.8, 12.9_

  - [x] 11.6 Implement `state/importExport.ts` (pure functions)
    - `exportDesign` with exactly `{format, schemaVersion, challengeId, design}`; `importDesign` accepting unknown or text: reject > 102,400 bytes before parsing, `JSON.parse` only, strict zod schema rejecting unknown keys including `__proto__`/`constructor`/`prototype` (scan own keys), one reason per failed check (format, schemaVersion, challengeId, each locked field, geometry); never throws
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 23.1, 23.2, 23.3, 23.4_

  - [x]* 11.7 Write property test for import round-trip and totality
    - **Property 20: Import round-trip**
    - **Validates: Requirements 22.2, 22.3, 23.3**

  - [x]* 11.8 Write unit tests for import security
    - 102,400 bytes accepted, 102,401 rejected; `__proto__` payload rejected and `Object.prototype` unchanged; wrong format/version/challenge; locked-field changes yield one reason per field
    - _Requirements: 22.4, 23.1, 23.2, 23.4_

- [x] 12. Checkpoint – Milestone 1 gate
  - Ensure all unit, fixture (E1–E6), and property tests for Properties 1–27 pass and coverage ≥ 95% for `physics/`, `geometry/`, `evaluation/`; ask the user if questions arise.
  - _Requirements: 33.4, 33.7_

### Milestone 2: 3D interaction

- [x] 13. Session skeleton and app shell
  - [x] 13.1 Implement `state/session.ts`, `state/selectors.ts`, and edit actions in `state/reducer.ts`
    - SessionState types; `initSession` (analyze + evaluate baseline as iteration 0, error result if initial design invalid or throws); reducer branches `applySection`, `setParam` (clamp/strict), `setOrientation`, with locked-field rejection, `draftErrors`, and `draftStatus` recomputed by deep-equal ignoring id
    - Required by M2 UI; remaining actions are added in task 19
    - _Requirements: 4.1, 4.2, 4.4, 6.6, 6.8, 7.6, 7.8, 15.1, 15.2, 15.3, 15.7, 16.1, 16.2, 16.7, 16.9_

  - [x] 13.2 Implement the store provider and app bootstrap
    - `ui/state/StoreProvider.tsx` (useReducer bound to the frozen challenge, injected clock/id factory outside the reducer, `mode` from the selected Interaction_Mode); `ui/App.tsx` loads the bundled challenge and renders a full-page error listing every issue on failure; `src/main.tsx` mounts `ui/App`
    - `window.__EI_STATE__` read-only snapshot in dev/test builds only (the CSP plugin itself was added in 1.5)
    - _Requirements: 3.3, 3.7, 23.10, 23.11, 35.1_

  - [x] 13.3 Refactor the template Workspace into the Workbench layout, lazy viewport slot, and LiveRegion
    - Split `src/Workspace.tsx` into `ui/workbench/Workbench.tsx` (template `.workbench` grid and regions with their original class names), `WorkbenchChrome.tsx` (sidebar, topbar, page heading, workspace context), `WorkflowStepper.tsx` (step state from selectors), `PageFooter.tsx` (model-limits notice + "Explain & submit"), and `ui/icons/Icon.tsx` / `SectionIcon.tsx` (moved unchanged); delete `src/Workspace.tsx` when done
    - Layout is driven by the existing `index.css` breakpoints (> 870 three columns + full-width results; ≤ 870 two columns with challenge panel spanning; ≤ 620 single column viewport → design → challenge → results; sidebar collapsed ≤ 1050, hidden ≤ 620); no horizontal scroll 320–2560 px
    - `React.lazy` viewport inside the template `section.viewport` with a same-footprint "3D view is loading" placeholder; panels render first
    - Stub components mounted in the regions so later tasks fill only their own files: SectionPalette, NumericControls, RequirementsPanel, HistoryCompare, ReflectionPrompt, PredictionDialog, SubmitDialog, HelpDialog, ImportExportBar; move each region's template JSX into its stub unchanged (non-interactive, no numbers) so tasks 15.1, 17.1, 21.1, 22.2, 23.1, 24.1, and 25.1 adapt it in place
    - `ui/a11y/LiveRegion.tsx` (`aria-live="polite"`, always present, replace message, re-announce duplicates) and `ui/a11y/Toast.tsx` (template `.toast`, visual only)
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.9, 24.10, 24.11, 29.7, 30.6, 30.7, 35.5, 35.6_

  - [x]* 13.4 Write component tests for bootstrap and layout
    - Invalid challenge renders the issue list and no controls; panels present before the viewport resolves; template region class names present; stepper states by text; footer notice always shown; LiveRegion replaces and re-announces messages
    - _Requirements: 3.3, 24.6, 24.7, 24.11, 29.7, 30.6, 30.7, 35.5_

  - [x] 13.5 Refactor the template App into the platform shell
    - Split `src/App.tsx` into `ui/shell/PlatformShell.tsx`, `LibraryPage.tsx` (filters, search, Explore/Saved), `ChallengeDrawer.tsx` (mode cards), `LearningPathsPage.tsx`, `MyDesignsPage.tsx`, `NotebookPage.tsx`, `ResourceDialog.tsx`; move `TechnicalArt.tsx` to `ui/shell/` unchanged; read cards from `challenge/catalog.ts`; delete `src/App.tsx` when done
    - Previews: "Planned challenge" labels, open disabled with "Not available yet"; Freeform "Planned" with open disabled; learning-path steps other than Cantilever Beam I "Planned"; no fabricated progress
    - Guided and Parametric both open the same Workbench with the same store (only `mode` differs); modes outside `allowedModes` are rejected; Workbench stays mounted across navigation
    - My designs lists session Test_Results via selectors; saved list and notebook stay in memory; "Statica" brand and help text
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7, 34.8, 34.9, 35.1, 35.2, 35.4_

  - [x]* 13.6 Write component tests for the platform shell
    - Preview challenge and Freeform cannot open a Workbench; filters/search/saved narrow the list; navigating away and back keeps draft and history; My designs shows only session results; Guided vs Parametric open the same challenge with locked fields read-only in both
    - _Requirements: 34.2, 34.3, 34.4, 34.5, 34.6, 34.7, 35.2, 35.4_

- [x] 14. Mesh, viewport, and WebGL fallback
  - [x] 14.1 Implement `ui/mesh/`
    - Outline → `THREE.Shape` (with tube hole) extruded along X with 40 segments; `deformedVertexY` using `deflectionShape` × exaggeration with uniform scale-down to 0.3·L
    - _Requirements: 25.1, 25.2, 25.3, 25.6_

  - [x]* 14.2 Write unit tests for mesh deformation
    - Max visual offset ≤ 0.3·L (tinyCircle); offset = 15·w(x) when under the cap; analysis deep-equal with and without mesh generation
    - _Requirements: 25.2, 25.3, 25.6, 9.12_

  - [x] 14.3 Implement `ui/viewport/Viewport3D.tsx` and `ui/viewport/SceneControls.tsx`
    - Template styling: green beam material (`#345640`–`#91a99b`), wall with code-generated hatch texture (no `data:` URL), floor grid, orange `#cf744b` −Y force arrow at X = L with force/“TIP LOAD” label, span guide "{L} mm · fixed span", dashed orange deformed outline; all numbers from the challenge/draft; labels via drei `Html` (no remote fonts or environment maps)
    - Clamped root, extruded beam rotated by orientation, mm dimension guides, axis triad X/Y/Z, "Bending axis (resists vertical load)" label, 80×80 mm envelope wireframe with live envelope dims, deformed shape from latest tested snapshot (or baseline) only, `frameloop="demand"`, canvas `aria-label` plus text summary, reduced-motion static shape, default camera that keeps handles unoccluded
    - `SceneControls` (shared with the fallback): template Zoom in / Zoom out / Reset view / Fit view buttons, "Show deformation" toggle (`aria-pressed`, default on), "Exaggerated visualization (×15)" label, "Fixed support" label, material strip (name, E in GPa, ρ) with accessible lock icon; none dispatch session actions
    - _Requirements: 7.5, 7.7, 16.6, 25.1, 25.2, 25.3, 25.4, 25.5, 25.8, 25.9, 25.10, 25.12, 25.13, 25.14, 25.15, 32.2, 32.3, 32.7_

  - [x] 14.4 Refactor `BeamScene.tsx` into the SVG fallback and add the viewport error boundary
    - `ui/viewport/ViewportBoundary.tsx` detects WebGL context failure or lazy-load failure
    - Move the template projection math into pure `ui/viewport/projection.ts`; `ui/viewport/Fallback2D.tsx` keeps its look (painter's sort, wall hatch, floor pattern, drag/arrow-key orbit, zoom/reset via `SceneControls`) but reads `sectionOutline(draft.section)` and `orientedEnvelope` (independent tf/tw, tube inner diameter) instead of `width/height/thickness`, and draws the deformed shape from `deflectionShape` × exaggeration capped at 0.3·L for the latest tested snapshot instead of the fixed `42·(x/330)²` curve; force/span labels read from the challenge
    - Adds the 2D section view (outline with hole, mm dims, envelope box), accessible names and summary, and the "3D view unavailable" notice announced once; delete `src/BeamScene.tsx` when done
    - _Requirements: 24.8, 25.11, 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7, 31.8_

  - [x]* 14.5 Write component tests for the viewport summary, scene controls, and fallback
    - Text summary updates on section/orientation/param change; scene controls and deformation toggle leave session state unchanged; fallback renders with WebGL mocked unavailable and controls remain operable; fallback outline matches typed I-section with tf ≠ tw; fallback tip offset equals min(15·δ, 0.3·L) in scene units; draft unchanged across the switch
    - _Requirements: 25.11, 25.13, 25.14, 31.1, 31.2, 31.3, 31.6, 31.7, 32.2, 32.3_

- [x] 15. Section palette
  - [x] 15.1 Implement `ui/palette/SectionPalette.tsx` and viewport drop target
    - Extracted from the template `design-panel` `.shape-grid` (keep `.shape-tile`, `SectionIcon`, `.selected-check`, drag caption); replace the template's hard-coded `apply()` presets with `applySection` → `convertSection`
    - One tile per `allowedSections` entry (`role="button"`, icon, label, `draggable`); click and Enter/Space dispatch `applySection` keeping focus; active tile shows icon + "Active" + `aria-pressed="true"`
    - In `Viewport3D.tsx`: HTML5 drop zone with beam raycast highlight (fallback to canvas), highlight cleared on leave/drop/cancel; drops outside canvas or Escape leave state unchanged
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 32.1_

  - [x]* 15.2 Write component tests for the palette
    - Click and Enter/Space apply; exactly one `aria-pressed="true"`; same-kind apply leaves draft and status unchanged; different kind sets `draft`
    - _Requirements: 26.1, 26.4, 26.5, 26.6, 26.8, 26.9_

- [x] 16. Dimension handles
  - [x] 16.1 Implement `ui/viewport/DimensionHandles.tsx`
    - One sphere per `HandleDescriptor`; pointer capture; pure `projectToAxis` helper (non-finite → skip); rAF-throttled clamp dispatch using latest pointer; live mm label via `formatMm`; "limit reached" tooltip; orbit disabled during drag and re-enabled on release/cancel
    - _Requirements: 25.7, 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_

  - [x]* 16.2 Write unit tests for handle projection and throttling
    - Projection math, non-finite skip, one dispatch per frame with the latest value, limit-reached flag toggling
    - _Requirements: 25.10, 27.2, 27.4, 27.5, 27.7_

- [x] 17. Numeric controls
  - [x] 17.1 Implement `ui/controls/NumericControls.tsx`
    - Extracted from the template `design-panel` (keep `.dimension-field`, `.number-field`, range slider, `.rotate-button` look, `.locked-features`); one field per typed parameter (separate flange and web thickness; tube inner diameter) replacing the shared "Web & flange" / "Wall thickness" fields and the hard-coded 8–80 / 3–15 mm ranges; sliders dispatch clamp-mode `setParam`; same fields in Guided and Parametric
    - Labeled mm inputs with min/max/step from challenge ranges; blur/Enter parse → mm→m → strict `setParam`; `aria-invalid` + `aria-describedby` inline errors and one live announcement; Escape reverts; orientation radio group (disabled, non-focusable for circle/tube); read-only locked fields with lock icon (accessible name) and "Fixed by challenge"
    - _Requirements: 2.3, 4.8, 4.9, 7.4, 7.6, 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8, 35.2_

  - [x]* 17.2 Write component tests for numeric controls
    - For each of the four section kinds, rendered input values equal typed state; invalid text, out-of-range, and d ≥ D keep draft unchanged with error; Escape revert; locked fields reject typing and paste; orientation disabled for circle/tube
    - _Requirements: 4.8, 4.9, 7.4, 28.1–28.8, 33.8_

- [x] 18. Checkpoint – Milestone 2 gate
  - Ensure all component tests pass, all four section kinds render, and UI matches typed state; ask the user if questions arise.
  - _Requirements: 33.8_

### Milestone 3: Learning loop

- [x] 19. Complete the session reducer
  - [x] 19.1 Add `runTest`, `setPrediction`, and `cancelPrediction` to `state/reducer.ts`
    - Prediction gating via `requiredOnIterations`; invalid draft sets `draftErrors` without opening dialog; frozen snapshot, analyze, evaluate, scorePrediction, append frozen TestResult with payload id/timestamp; catch `PhysicsInvariantError` (no iteration, error notice); compare selection keeps the last three non-baseline iterations
    - `cancelPrediction` is added to the design's Action union to satisfy 14.5
    - _Requirements: 9.4, 14.1, 14.3, 14.5, 14.6, 14.9, 14.10, 15.8, 16.8, 17.1, 17.2, 17.3, 17.7_

  - [x] 19.2 Add `restore`, `toggleCompare`, `setReflection`, `submit`, `importDesign`, and `reset`
    - Restore deep copy with fresh id, history untouched, status recomputed, unknown id no-op; compare selection max three with notice; reflection ≤ 2000 chars; submit gating (iteration ≥ 1, non-whitespace reflection) with untrimmed text and efficiency; import uses `importDesign`, all-or-nothing; reset keeps baseline and locked fields
    - _Requirements: 4.4, 15.4, 18.5, 18.6, 19.1, 19.2, 19.3, 19.4, 19.6, 19.7, 20.2, 20.4, 20.8, 22.5, 22.6, 22.7, 23.5, 23.6_

  - [x]* 19.3 Build the model-based test harness
    - `test/state/model.ts` with `fc.commands` for every action (valid and hostile payloads), a reachable-state arbitrary, and an invariant hook run after every action
    - _Requirements: 33.3_

  - [x]* 19.4 Write property test for append-only history
    - **Property 28: Append-only**
    - **Validates: Requirements 15.4, 17.1, 18.1**

  - [x]* 19.5 Write property test for snapshot isolation
    - **Property 29: Snapshot isolation**
    - **Validates: Requirements 18.2**

  - [x]* 19.6 Write property test for draft status
    - **Property 30: Draft status**
    - **Validates: Requirements 16.1, 16.2**

  - [x]* 19.7 Write property test for restore
    - **Property 31: Restore**
    - **Validates: Requirements 19.1, 19.2, 19.5**

  - [x]* 19.8 Write property test for draft validity invariant
    - **Property 32: Draft validity invariant**
    - **Validates: Requirements 15.9, 23.6**

  - [x]* 19.9 Write property test for locked fields
    - **Property 33: Locked fields**
    - **Validates: Requirements 4.1**

  - [x]* 19.10 Write property test for reducer purity
    - **Property 34: Reducer purity**
    - **Validates: Requirements 15.5, 15.6**

  - [x]* 19.11 Write property test for prediction gating
    - **Property 36: Prediction gating**
    - **Validates: Requirements 14.1, 14.11**

  - [x]* 19.12 Write property test for submit gating
    - **Property 37: Submit gating**
    - **Validates: Requirements 20.2, 20.4**

  - [x]* 19.13 Extend Properties 14, 17, and 26 to reducer sequences
    - **Property 14: Hostile input rejection** – hostile drafts/imports never add an iteration (**Validates: Requirements 17.2**)
    - **Property 17: Strict set** – rejected strict sets leave the draft deep-equal (**Validates: Requirements 6.6, 6.7**)
    - **Property 26: Constraints immutable** – no action sequence changes the challenge (**Validates: Requirements 4.6, 4.7**)

  - [x]* 19.14 Write unit tests for reducer example flows
    - Design "Example Usage" flow end to end; prediction dialog open/cancel/confirm; restore unknown id; submit on baseline rejected; locked-field import rejected with one reason per field; initSession error on invalid initial design
    - _Requirements: 4.4, 14.1, 14.5, 15.3, 19.7, 20.4_

  - [x]* 19.15 Write model-based test for mode invariance
    - Run each generated action sequence from `initSession` under `mode: 'guided'` and `mode: 'parametric'`; assert drafts, history, and Evaluations are deep-equal apart from `mode` (separate file `test/state/modeInvariance.test.ts`)
    - _Requirements: 35.1, 35.3_

- [x] 20. Persistence
  - [x] 20.1 Implement `state/persistence.ts` and `state/migrations.ts`
    - `serializeSession` / `deserializeSession` (never throw); key `ei:session:{id}:v{version}` with `schemaVersion` and UTC `savedAt`; load applies migrations, re-validates and re-analyzes snapshots (1e-9 relative), removes entry and returns notice on failure; storage exceptions surface a once-per-load notice
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.8_

  - [x]* 20.2 Write property test for persistence round-trip
    - **Property 35: Persistence round-trip**
    - **Validates: Requirements 21.7, 21.8**

  - [x]* 20.3 Write unit tests for persistence failure modes
    - Unknown `schemaVersion`, tampered analysis value, invalid snapshot, truncated JSON → entry removed and fresh session; throwing `localStorage` → in-memory with single notice; no entry → no notice
    - _Requirements: 21.4, 21.5, 21.6_

  - [x] 20.4 Wire persistence into the store
    - Load on startup (before first render of the session) and save after each appended Test_Result, submission, and state change; show notices
    - _Requirements: 17.4, 20.7, 21.3, 21.4, 21.5, 21.6_

- [x] 21. Requirements and results panel
  - [x] 21.1 Implement `ui/panels/RequirementsPanel.tsx`
    - Fills the template `aside.challenge-panel` (keep `.requirement`, `.insight`, `.test-action`, `.run-test` styling); every requirement pass mark, including "Section envelope" and "Min. feature size", comes from the latest Evaluation (remove the template's always-true rows); "Draft" / "Tested #n" badge replaces the template's "Draft"/"Baseline" text; the model-limits notice lives in `PageFooter` (13.3)
    - Statement, locked load/material/span, constraint list (mm/MPa/kg); "Draft" / "Tested #n" badge; sole primary "Run Test" button; `draftErrors` list; results table in fixed order with 2/1/3 decimals and ✓ Pass / ✗ Fail text; status banner with icon + text; warnings; facts; outside-model labels and reasons for `modelNotApplicable`; analysis error banner; persistent model-limits notice; college-details disclosure when enabled; numbers only from latest Test_Result
    - _Requirements: 9.4, 16.3, 16.4, 16.5, 16.7, 16.8, 17.5, 17.6, 17.8, 29.1–29.10, 32.4_

  - [x]* 21.2 Write component tests for the panel
    - Badge transitions; draft edits do not change displayed numbers; formatting precision; Pass/Fail text without color; banner text per status; college details hidden when disabled; wideI shows the envelope row as failed
    - _Requirements: 16.3, 16.4, 16.5, 29.3, 29.4, 29.5, 29.6, 29.8, 29.9, 29.10_

- [x] 22. Dialogs and live announcements
  - [x] 22.1 Implement `ui/dialogs/Dialog.tsx` primitive
    - `role="dialog"`, `aria-modal`, labelled by title, initial focus, Tab/Shift+Tab trap, Escape close, focus restore to opener or RequirementsPanel
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

  - [x] 22.2 Implement `ui/dialogs/PredictionDialog.tsx` and `ui/dialogs/HelpDialog.tsx`
    - Keep the template `.modal` / `.prediction-options` look; wording compares against the previous tested iteration; opens only when the reducer sets `predictionDialogOpen` (iterations 1 and 3), not on every Run Test as in the template; `HelpDialog` keeps the template help/stiffness-reference content with no computed numbers
    - Three unselected radios, optional explanation ≤ 500 chars, inline errors on invalid confirm, confirm dispatches `setPrediction` then `runTest`, cancel dispatches `cancelPrediction`
    - _Requirements: 14.2, 14.3, 14.4, 14.5_

  - [x] 22.3 Wire live announcements
    - `ui/a11y/useAnnouncements.ts` mounted in `App.tsx`: section applied (name), test appended (iteration, status, failure count, focus unchanged), restore (iteration), validation/import/analysis errors (cause), locked-field import rejection
    - _Requirements: 4.5, 30.5, 32.10_

  - [x]* 22.4 Write component tests for dialogs and announcements
    - Focus trap and restore; Escape leaves state unchanged; prediction validation errors; announcement text per event
    - _Requirements: 14.2, 14.4, 30.1–30.5, 32.10_

- [x] 23. History and compare
  - [x] 23.1 Implement `ui/history/HistoryCompare.tsx`
    - Fills the template `section.results-panel`: "Design history" and "Compare results" tabs as an accessible tablist, `.iteration-list`, `.metrics` cards, `.result-explanation` (from `ExplanationFact`s, replacing the template's generic strings), "Restore design"; all values from stored Test_Results
    - Baseline first then ascending iterations with status, key results, section type, prediction outcome ("no prediction" when absent); compare checkboxes (baseline always included, max three with message); deltas vs baseline and vs previous iteration; per-constraint changes; Restore buttons
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 19.1, 29.11_

  - [x]* 23.2 Write component tests for history and compare
    - Fourth selection blocked with message; delta values; iteration 1 uses baseline as previous; restore updates draft and badge; tab switching by keyboard keeps state
    - _Requirements: 18.4, 18.6, 18.7, 18.8, 19.3, 29.11_

- [x] 24. Reflection and submission
  - [x] 24.1 Implement `ui/panels/ReflectionPrompt.tsx` and `ui/dialogs/SubmitDialog.tsx`
    - Opened from the `PageFooter` "Explain & submit" button (template submit modal look); enablement follows submit gating rather than the template's `draft || runs.length < 2` rule
    - Verbatim prompt text, labelled textarea capped at 2000 chars; disabled submit with reason text (no tested iteration / empty reflection / both); iteration selector listing only iteration ≥ 1, latest preselected; result status text with iteration number and separate efficiency region
    - _Requirements: 20.1, 20.3, 20.5, 20.6, 20.8, 35.6_

  - [x]* 24.2 Write component tests for reflection and submit
    - Disabled reasons for each condition; selector contents; status text identical regardless of reflection content; `<script>` reflection rendered literally
    - _Requirements: 20.3, 20.5, 20.6, 20.8, 23.7_

- [x] 25. Import/export UI
  - [x] 25.1 Implement `ui/panels/ImportExportBar.tsx` and import error dialog
    - Replaces the template's `.history-note` export button (which dumped raw prototype runs) using the same icon button styling; the download uses an object URL created on click (same-origin, not a CSP-blocked asset)
    - Export downloads `exportDesign` output; import checks `File.size` > 102,400 before reading, then dispatches `importDesign`; error dialog lists every reason
    - _Requirements: 4.5, 22.1, 22.5, 23.1, 23.7_

  - [x]* 25.2 Write component tests for import/export UI and escaping
    - Oversize file rejected without read; reasons listed; `<img onerror>` reasons rendered literally; source scan asserts zero `dangerouslySetInnerHTML`
    - _Requirements: 4.5, 22.5, 23.1, 23.7_

- [x] 26. Checkpoint – pre-E2E
  - Ensure all unit, component, and property tests (Properties 1–37) pass and coverage ≥ 95% for `state/`; ask the user if questions arise.
  - _Requirements: 33.1, 33.2, 33.4_

- [x] 27. End-to-end tests
  - 2026-10-16 closeout: all subtasks and checkpoint 28 passed in CI run 38927191840 (873 core tests, focused responsive 2/2 and full E2E 18/18). See application HANDOFF.md and MILESTONE3.md.
  - [x] 27.1 Create E2E helpers
    - `e2e/helpers.ts`: read `window.__EI_STATE__`, normalize state (strip timestamps/ids), axe check failing on serious/critical violations, network request recorder
    - _Requirements: 23.10, 33.5_

  - [x]* 27.2 Write E2E happy-path scenario
    - Baseline "Not accepted"; apply I-section by click; drag height handle; set values numerically; predict; run; Accepted; compare baseline + three iterations; restore; reflect; submit Accepted
    - _Requirements: 14.1, 17.1, 18.5, 19.1, 20.2, 20.6, 33.5, 33.9_

  - [x]* 27.3 Write E2E drag-drop scenario
    - Drag I-section tile onto the beam; active tile and draft update
    - _Requirements: 26.2, 26.3, 26.6_

  - [x]* 27.4 Write E2E keyboard scenario
    - Full flow by keyboard; normalized state equals mouse flow; focus order and escape from canvas
    - _Requirements: 32.1, 32.8, 32.9, 33.9_

  - [x]* 27.5 Write E2E invalid-path scenario
    - d ≥ D and overlapping flanges show errors with draft/history unchanged; edit after test shows "Draft" while tested numbers remain
    - _Requirements: 5.5, 5.7, 16.2, 16.5, 28.5, 33.9_

  - [x]* 27.6 Write E2E persistence scenario
    - Reload restores session; import → export → import stable; corrupted storage shows notice
    - _Requirements: 21.3, 21.4, 22.3, 33.9_

  - [x]* 27.7 Write E2E platform checks
    - Zero requests to other origins during a full flow (fonts included); built CSS/HTML contain no `fonts.googleapis.com`/`fonts.gstatic.com`; layout at 1280, 1000, 800, and 375 px matches the template grid (three columns / collapsed sidebar / two columns / single column with viewport first), crossing 1050, 870, and 620 px preserves state, and no horizontal scroll at 320 px; WebGL-disabled flow reaches the same normalized state; production build has CSP meta, zero CSP console violations through a full flow, and no `__EI_STATE__`; preview challenge and Freeform cannot open a Workbench
    - _Requirements: 1.11, 1.13, 23.8, 23.9, 23.11, 24.1, 24.2, 24.3, 24.4, 24.9, 24.10, 31.6, 34.3, 34.4_

- [x] 28. Final checkpoint – Milestone 3 gate
  - Ensure Properties 28–37 and the happy-path, invalid-path, keyboard, and persistence E2E scenarios pass on Chromium desktop and Pixel 7 with no serious/critical axe violations; ask the user if questions arise.
  - _Requirements: 33.5, 33.9, 33.10_

### User-requested maintenance after MVP closeout

All seven maintenance tasks are complete. [CI run 38936927907](https://github.com/niyer45/Statica-Edu/actions/runs/38936927907) verified implementation commit `eb1b56757b42192934f1b4cd3240515bb02237de`: lint, typecheck, 879 tests across 109 files, domain coverage gates, build, schema drift, 2/2 focused responsive cases and 20/20 desktop/Pixel 7 E2E cases passed, including axe checks. The user confirmed the workflow passed. D-30 supersedes the earlier challenge prose/comparison-card presentation choices.

- [x] 41. Complete post-MVP UI maintenance
  - [x] 41.1 UI-01 Simplify The challenge panel (2026-10-16)
    - Keep the opening statement and compact stored value/limit summary; keep warnings/errors visible and fix badge/table wrapping (D-28). Final Test details content is table-only under UI-03.

  - [x] 41.2 UI-02 Restore compact history and comparison presentation (2026-10-16)
    - Remove challenge draft/acceptance banners; keep draft in the viewport and recorded status in history. Compact rows and selected metrics preserve predictions, restore and accessible import/export (D-29). Not accepted has no exclamation prefix. Final comparison layout follows UI-03.

  - [x] 41.3 UI-03 Selectable comparison details and table-only challenge disclosure (2026-10-16)
    - Compare results reuses history's list/detail layout; clicking a design displays its stored values and deltas. Preserve Baseline and the maximum-three iteration selection rule. Challenge Test details contains only the stored constraint table (D-30).

  - [x] 41.4 UI-04 Delete non-Baseline history entries (2026-10-16)
    - Confirm deletion, persist archival metadata, prune comparison/submission references and hide deleted choices. Protect Baseline, draft, last tested analysis and stable numbering (D-31). Protection/no-op, persistence, rejected hidden-reference and deletion/reload regressions pass. My designs results were subsequently removed under UI-06.

  - [x] 41.5 UI-05 Center actions and collapse fixed-field details (2026-10-16)
    - Center confirmation Cancel and Run Test icon/text. Keep the lock/title summary visible; fixed values expand from a collapsed native disclosure with read-only values and keyboard access (D-32).

  - [x] 41.6 UI-06 Temporary feedback and uncluttered My designs (2026-10-16)
    - Remove permanent informational history paragraphs; dismiss the visual toast after five seconds while preserving live announcements/errors. My designs shows only the saved workspace card; Return to workbench reveals results without changing session data (D-33). Timer cleanup and state-preservation tests pass.

  - [x] 41.7 UI-07 Fix hidden import chooser page overflow (2026-10-16)
    - Failed run 38935876295 identified an sr-only file input extending to 2431 px at a 1280 px viewport. Position its label and scope a 1×1 px file-input rule to override the template width:100% rule. Accessible native import and the unchanged responsive assertions pass in the verified run above.

- [x] 42. Verify CI preview-gating test repair
  - Runs 38965356799 and 38965945029 exceeded the default five-second timeout in the aggregate PlatformShell preview/Freeform coverage test; browser steps were skipped.
  - Parameterize the five preview entries and separate Freeform, retaining assertions without changing timeouts, retries or coverage thresholds. Verified by passing CI run 38966388585 on a76b8ad215720b0691ba566520d94ad995ade087: 884 tests, full coverage/core gates, 2 focused responsive cases and all 20 E2E cases. Depends on 41.7.

- [x] 43. Expand repository and developer README documentation
  - Explain the product purpose, current learning loop/features, planned accounts/progress, dormant second challenge, model/local-storage limits, setup and documentation entry points. Keep the root README product-focused and the app README developer-focused. Documentation only; relative links and capability statements checked against source/handoff. Next software task remains 34.1.

### Post-MVP roadmap: scope and execution

Added at the user's request after Milestone 3 passed. Tasks 1–28 and their completion evidence remain unchanged. Requirements 1–35 and the existing design describe the completed M0–M3 baseline; their statements that M4+ is outside MVP implementation scope remain historical boundaries, not specifications for these new features. New feature requirements and acceptance criteria must be written as scoped extensions before implementation, without regenerating the completed MVP specifications or inventing requirement IDs.

Tasks 29.1, 31.1 and configuration-development tasks 33.1–33.2 are complete; tasks 29 and 31 remain in progress for human evidence. Task 34.1 is the next software task. Human QA is deferred until before customer deployment, not checked complete (D-34). The roadmap schedules future work; it does not start development, recruit participants, publish the app, or enable network services. No new testing task is optional. Update supporting documentation after each completed task and push verified batches. Preserve the existing architecture, solver-backed results, D-26/D-27 and the complete MVP regression suite. Feature-specific backend, model, provider and challenge choices remain decisions to make in the tasks below.

Owner sequencing update (2026-10-16, D-34): develop software before human QA. Nikhil is the nominated owner engineering reviewer; 29.2 is owner-conducted review, not external independent review. Tasks 29.2, 30, 31.2 and 32 remain required before customer deployment. Scoped configuration/specification work may proceed from 29.1 without completed pilot evidence; feature release checkpoints still require 32.2. No deployment is authorized or performed by this sequencing change.

### Milestone 4: Engineer review and student pilot

- [-] 29. Prepare educational and engineering review
  - [x] 29.1 Create the Milestone 4 review plan
    - Record intended learners, learning objectives, review checklist, roles, pilot access method and measurable success criteria in `MILESTONE4.md`; identify the engineer/reviewer and participant availability with the project owner.
    - Define severity levels and what blocks a pilot or milestone closeout before gathering results. Depends on checkpoint 28.
    - Completed 2026-10-16: MILESTONE4.md records learners/objectives, checklist, roles, access/recovery, measures and severity/launch/closeout gates. Owner chose a local-only pilot first and confirmed reviewer/participants are not arranged; scheduling blocks launch, not the authored plan. Accounts, saved user information and challenge completion are required future scope under 38.1–38.2. No review or pilot is claimed.
  - [ ] 29.2 Obtain and record owner engineering QA before customer deployment
    - Review challenge constants, units, fixtures, formulas, applicability thresholds, boundary behavior, explanation wording and limitations against independent calculations/references.
    - Nikhil is the nominated owner reviewer; record qualifications, date, reviewed release commit, independent calculations/references, discrepancies and disposition. Include each new challenge/model before release. Do not describe owner review as external independence or substitute agent self-review/passing tests for human findings. Deferred until pre-deployment QA, not complete.

- [ ] 30. Verify pilot readiness manually
  - [ ] 30.1 Run manual usability and accessibility checks
    - Exercise Guided/Parametric modes, keyboard-only navigation, screen reader labels/announcements, zoom, contrast, reduced motion, touch, 320 px layout and WebGL fallback on representative devices; document actual browser/device versions and results.
    - Keep automated axe results separate from manual accessibility evidence; log reproducible issues with acceptance criteria.
  - [ ] 30.2 Verify pilot delivery and recovery
    - Test the agreed access method, offline/local-storage limitations, reset/reload, import/export, update compatibility and recovery instructions using the actual pilot build. Record the tested commit and access instructions; deployment/access decisions precede publishing.

- [-] 31. Conduct and analyze the student pilot
  - [x] 31.1 Prepare the pilot protocol and materials
    - Define recruitment/consent appropriate to the setting, session script, facilitator prompts, pre/post questions, observation rubric and minimal feedback collection/retention. Use de-identified notes; do not add analytics or accounts for the pilot.
    - Define how to measure completion, interpretation of constraints, prediction/reflection quality and confusion about idealized model limits.
    - Completed 2026-10-16: PILOT_PROTOCOL.md supplies introduction/consent discussion, pre/post questions, neutral prompts, rubric, blank observation/finding sheets and retention/session-cleanup instructions. Owner must confirm the actual setting/retention/access before sessions. No consent, recruitment or outcomes are claimed.
  - [ ] 31.2 Run sessions with actual students and summarize findings
    - Record participant count, sessions completed, observations and results against the predefined criteria; distinguish reported feedback from inference. Do not fabricate participants, approvals or outcomes.
    - Produce prioritized findings and limitations, including sample-size limitations, in `MILESTONE4.md`.

- [ ] 32. Resolve pilot findings and close Milestone 4
  - [ ] 32.1 Fix blocking findings and verify them
    - Turn findings into reproducible tasks; resolve pilot-blocking correctness/accessibility/usability issues in the existing architecture. Add meaningful regression coverage and repeat affected manual checks; record deferred issues and rationale.
  - [ ] 32.2 Milestone 4 checkpoint
    - Confirm recorded owner engineering QA and actual pilot evidence exist, agreed success criteria are met, no blocking finding remains, and lint/typecheck/unit/property/component/build/browser gates pass for the release candidate. Record reviewer/project-owner disposition and any deferred limitations before customer deployment; isolated M5 development may proceed earlier under D-34.

### Milestone 5: Second runnable challenge through configuration

- [x] 33. Define the second challenge
  - [x] 33.1 Select a challenge and document its scoped requirements
    - Choose the learning objective, initial flawed design, constraints, reference solution, prediction/reflection prompts and success criteria. No pilot evidence exists yet; record provisional choices and revisit them during pre-release QA. Use a challenge supported by the existing validated beam model; do not activate a preview whose physics differs.
    - Completed 2026-10-16: .kiro/specs/cantilever-beam-2/ defines the rectangle-orientation challenge and separately derived arithmetic fixtures (not human review). Write a challenge-specific requirements/design extension and reference calculations. Challenges requiring a new model are deferred to task 37.2 rather than introducing an M5/M6 dependency cycle. Development depends on 29.1 under D-34; customer release still requires checkpoint 32.2.
  - [x] 33.2 Validate the second challenge configuration for development
    - Add versioned configuration, explicit locked fields and section defaults; verify initial failure, reference acceptance, solvability, applicability, boundary cases and grounded explanation facts. Owner engineering review of constants/wording is tracked in 29.2 and required before checkpoint 35.2, not claimed by configuration tests.
    - Completed 2026-10-16: Cantilever Beam II version-1 JSON, additive scoped requirements/design and 14 domain regression cases cover numeric fixtures, orientation ratios, solvability, boundaries, geometry/applicability, student redaction and cross-challenge import rejection. Configuration is not registered as available; task 34 performs integration.

- [ ] 34. Integrate multiple runnable challenges
  - [ ] 34.1 Generalize selection and isolate challenge sessions
    - Route the selected available catalog entry to its validated configuration through the existing loader/store; replace single-challenge assumptions without duplicating solver or workbench components.
    - Isolate draft/history/reflection/submission and versioned persistence by challenge; define and test switch/reload/reset behavior. Preserve existing Cantilever Beam I saves.
  - [ ] 34.2 Connect the second challenge to the existing learning loop
    - Reuse prediction, evaluation/results, compare/restore, reflection/submission, fallback and import/export. Reject cross-challenge imports and corrupt sessions; keep unavailable modes/challenges gated and My designs results correctly attributed.

- [ ] 35. Verify and release Milestone 5
  - [ ] 35.1 Add multi-challenge regression coverage
    - Test configuration fixtures, challenge switching, storage/import isolation and migration behavior; complete both learning loops on desktop and Pixel 7, with keyboard/fallback and serious/critical axe gates. Retain all original challenge tests.
  - [ ] 35.2 Milestone 5 checkpoint
    - Confirm both challenges meet their reviewed criteria, no fabricated results or cross-session leakage exist, all relevant coverage/core/browser gates pass, and documentation explains supported models and limits. Record the verified commit and review evidence in `MILESTONE5.md`.

### Milestone 6: Scoped platform extensions

This milestone groups the previously named future areas: Freeform, advanced physics, accounts and AI. Their implementation scope is not yet specified. Task 36 defines feature boundaries and delivery order; each track requires its own requirements/design/test plan before implementation. A decision to defer a track must remain visible in the roadmap rather than being checked off as implemented.

- [ ] 36. Define Milestone 6 scope and architecture
  - [ ] 36.1 Prioritize the extension tracks and define acceptance criteria
    - Use M4/M5 evidence to define concrete user stories, included/excluded capabilities, dependencies, measurable gates and delivery order in `MILESTONE6.md` and scoped specification extensions. Resolve the current browser-only/no-network boundary explicitly for any online capability. Development planning depends on 33.1 under D-34; customer release retains the M4/M5 gates.
  - [ ] 36.2 Record shared technical and data decisions
    - Specify model dispatch/versioning, geometry validation, save/import compatibility, local/offline behavior and any backend/auth/provider choices. Define data minimization, deletion/export, failure behavior, cost limits and rollback where applicable; keep pure domain modules independent of React and services.

- [ ] 37. Extend geometry and analysis
  - [ ] 37.1 Implement and verify the scoped Freeform capability
    - Specify supported sketch/extrusion/edit operations, invalid or unsupported geometry, section-property computation and model compatibility before coding. Provide numeric/keyboard equivalents and truthful fallback behavior; validate properties against independent fixtures.
    - Integrate valid geometry with the existing prediction/results/history/persistence loop. Keep Freeform marked Planned until its complete reviewed flow and accessibility/browser gates pass.
  - [ ] 37.2 Implement and validate the selected advanced physics model
    - Choose a bounded model from the scoped requirements; document equations, assumptions, applicability and independent benchmarks before implementation. Dispatch by explicit model identity/version and keep recorded results reproducible.
    - Verify accuracy/tolerances, units, boundaries, failure states and runtime on target devices. Unsupported analyses must be rejected or clearly identified; preserve the validated Euler–Bernoulli path.

- [ ] 38. Add accounts and saved-project synchronization
  - [ ] 38.1 Specify account, storage and offline behavior
    - Define provider/backend, identity, ownership/access rules, session lifecycle, data retention/export/deletion and sync/conflict handling. Document the migration from local-only use and necessary CSP/network changes before implementation.
    - Owner-confirmed scope (2026-10-16): accounts with minimal profile information, cloud-saved owned challenge sessions and cross-device progress/completion, after the local-only pilot. MILESTONE4.md records planning inputs: explicit completion rules distinct from unsuccessful submissions, versioned provenance, guest migration, deletion/reset semantics and server-side ownership enforcement. Resolve these in a scoped specification before coding; no account feature is implemented by task 29.1.
  - [ ] 38.2 Implement and verify the scoped account/sync flow
    - Implement the reviewed user profile, challenge session and completion-history flows; verify cross-device resume, challenge/version attribution and completion evidence. Test authentication lifecycle, authorization isolation, project ownership, offline editing, conflicts, interrupted saves and recovery. Preserve local-only operation according to the agreed requirements; do not expose credentials or other users' projects in client state or logs.

- [ ] 39. Add optional AI learning assistance
  - [ ] 39.1 Specify the assistant's educational and data boundaries
    - Define a bounded coaching use case, provider, consent/data flow, cost/rate limits and evaluation criteria. Keep deterministic solver results authoritative and reflection ungraded unless an explicit later requirement changes that policy.
  - [ ] 39.2 Implement and evaluate the scoped coaching flow
    - Test grounded explanations against stored design/results, unsupported claims, prompt injection, unavailable/rate-limited services and offline use. Keep secrets server-side; assess assistance quality with engineer/educator review and representative learners before release.

- [ ] 40. Milestone 6 integration and release gate
  - [ ] 40.1 Verify compatibility and cross-feature regressions
    - Exercise the scoped Freeform/model/account/AI combinations, legacy saves/imports, model-result identity and failure recovery. Run core, independent numerical, authorization, accessibility, desktop/mobile and performance checks required by the new specifications.
  - [ ] 40.2 Milestone 6 checkpoint
    - Record each track's implemented/deferred status, acceptance evidence, known limitations, documentation and verified commit in `MILESTONE6.md`. Declare a track complete only when its own requirements and gates pass; future work outside the chosen release stays open or explicitly deferred.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; Requirement 33 gates still expect them before a milestone is declared complete.
- Task 1.3 (architecture test, E6) is not optional because Requirement 1.5 names it as an enforcement mechanism.
- `REL_TOL`/`withinLimit` live in `physics/tolerance.ts` and `TestResult`/`Prediction` types live in `evaluation/types.ts` so the import boundaries in Requirements 1.5 and 1.7 hold; `evaluation/` and `state/` re-export them.
- Task 13.1 implements edit actions of the reducer early because the M2 UI needs typed state; task 19 completes the reducer.
- `cancelPrediction` is in the design's Action union and satisfies Requirement 14.5.
- Template files are refactored, not rewritten from scratch: `Workspace.tsx` → 13.3 (layout), 15.1, 17.1, 21.1, 22.2, 23.1, 24.1, 25.1; `App.tsx` → 13.5; `BeamScene.tsx` → 14.4; `physics.ts` / `physics.test.ts` deleted in 1.9. Each refactor keeps the template class names so `index.css`, `platform.css`, and `platform-base.css` apply unchanged.
- Between 1.9 and 13.2 the template UI shows no numbers (prototype analysis removed, Run test disabled), so no fabricated result is ever displayed.
- Requirement 2.7 and Requirements 10.4–10.7 have no design property and are covered by unit tests 3.2 and 9.11.
- Each property test lives in its own file (`<module>/<name>.p<N>.test.ts`) and each fixture example (E1–E5) in its own file under `test/fixtures/`, so parallel tasks in one wave never write the same file.
- Properties 14, 17, and 26 are split: function-level halves in M1 (5.4, 6.4, 4.4) and reducer-level halves in 19.13.

Numeric task 41 groups the historical UI-01–UI-07 maintenance work without renumbering roadmap tasks 29–40. Its subtasks were verified together in run 38936927907.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "1.6", "1.7", "1.9", "3.1"] },
    { "id": 2, "tasks": ["1.3", "1.8", "1.10", "3.2", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "8.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.3", "6.1", "7.1", "8.2"] },
    { "id": 5, "tasks": ["5.4", "5.5", "5.6", "6.2", "6.3", "6.4", "6.5", "7.2", "8.3", "8.4", "8.5", "8.6", "8.7", "9.1"] },
    { "id": 6, "tasks": ["6.6", "6.7", "9.2", "11.6"] },
    { "id": 7, "tasks": ["9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9", "9.10", "9.11", "10.1", "11.1", "11.7", "11.8"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.9", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 9, "tasks": ["10.8", "10.10", "13.1"] },
    { "id": 10, "tasks": ["13.2", "14.1"] },
    { "id": 11, "tasks": ["13.3", "14.2"] },
    { "id": 12, "tasks": ["13.4", "13.5", "14.3", "17.1"] },
    { "id": 13, "tasks": ["13.6", "14.4", "15.1", "17.2"] },
    { "id": 14, "tasks": ["14.5", "15.2", "16.1"] },
    { "id": 15, "tasks": ["16.2", "19.1"] },
    { "id": 16, "tasks": ["19.2", "22.1"] },
    { "id": 17, "tasks": ["19.3", "19.14", "20.1", "21.1", "22.2", "23.1"] },
    { "id": 18, "tasks": ["19.4", "19.5", "19.6", "19.7", "19.8", "19.9", "19.10", "19.11", "19.12", "19.13", "19.15", "20.2", "20.3", "21.2", "23.2", "24.1", "25.1"] },
    { "id": 19, "tasks": ["20.4", "22.3", "24.2", "25.2"] },
    { "id": 20, "tasks": ["22.4", "27.1"] },
    { "id": 21, "tasks": ["27.2", "27.3", "27.4", "27.5", "27.6", "27.7"] }
  ],
  "postMvpDependencies": {
    "29.1": [
      "28"
    ],
    "29.2": [
      "29.1"
    ],
    "30.1": [
      "29.1"
    ],
    "30.2": [
      "29.2",
      "30.1"
    ],
    "31.1": [
      "29.1"
    ],
    "31.2": [
      "29.2",
      "30.2",
      "31.1"
    ],
    "32.1": [
      "31.2"
    ],
    "32.2": [
      "32.1"
    ],
    "33.1": [
      "29.1"
    ],
    "33.2": [
      "33.1"
    ],
    "34.1": [
      "33.2"
    ],
    "34.2": [
      "34.1"
    ],
    "35.1": [
      "34.2"
    ],
    "35.2": [
      "35.1",
      "32.2"
    ],
    "36.1": [
      "33.1"
    ],
    "36.2": [
      "36.1"
    ],
    "37.1": [
      "36.2"
    ],
    "37.2": [
      "36.2"
    ],
    "38.1": [
      "36.2"
    ],
    "38.2": [
      "38.1"
    ],
    "39.1": [
      "36.2"
    ],
    "39.2": [
      "39.1"
    ],
    "40.1": [
      "37.1",
      "37.2",
      "38.2",
      "39.2"
    ],
    "40.2": [
      "40.1"
    ],
    "41.1": ["28"],
    "41.2": ["41.1"],
    "41.3": ["41.2"],
    "41.4": ["41.3"],
    "41.5": ["41.4"],
    "41.6": ["41.5"],
    "41.7": ["41.6"],
    "42": ["41.7"]
  }
}
```
