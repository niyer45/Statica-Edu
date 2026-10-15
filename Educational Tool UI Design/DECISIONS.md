# Decisions

Recorded decisions for the Statica MVP (Cantilever Beam I). IDs are stable; supersede an entry with a new ID rather than editing its meaning.

## Decisions

| ID | Decision | Source |
|----|----------|--------|
| D-01 | Stack: TypeScript 5.7 (strict), React 19 + Vite 8 (from the template, see D-18), Three.js via React Three Fiber (+ drei helpers), Vitest, fast-check, Testing Library, Playwright. | Spec §6, template |
| D-02 | No live numeric previews before Run Test. Geometry (shape, outline, dimensions in mm, envelope box) previews live; area/I/mass/deflection/stress appear only in tested results. | Open decision default |
| D-03 | Orientation limited to 0° / 90°. | Open decision default |
| D-04 | Persistence: `localStorage` with `schemaVersion` and a migration table; corrupt or unknown data is discarded with a notice and never partially applied. | Open decision default |
| D-05 | The baseline design is auto-analyzed and stored as iteration 0 ("Baseline"), so the student can see the starting problem quantitatively and compare against it. | Interpretation of §3/§4 |
| D-06 | Handle drags clamp to the permissible range. Numeric inputs reject out-of-range or non-finite input with a reason and leave the draft unchanged. | §4, §7 |
| D-07 | Parameter ranges go up to 100 mm, so the 80 × 80 mm envelope is a real, failable constraint. Minimum feature sizes are lower bounds of the ranges and are re-checked at test time (covers imported JSON). | §4 |
| D-08 | Invalid geometry blocks Run Test (no iteration recorded). Out-of-assumption geometry is analyzed but gets status `modelNotApplicable`, never Accepted. | §5 |
| D-09 | Hard-limit comparison is inclusive with relative tolerance `REL_TOL = 1e-9`: pass iff `value ≤ limit·(1 + REL_TOL)`. | §4 |
| D-10 | Prediction is required before iterations 1 and 3 (config `predictionPolicy.requiredOnIterations`) and optional otherwise. It is compared against the previous tested iteration, and "same" means a relative change of 2% or less. | §4 |
| D-11 | Deformation exaggeration is a fixed factor per challenge (`k = 0.1·L / δ_allow` = 15×), clamped to 0.3·L, so visual comparisons across iterations are consistent. The label reads "Exaggerated visualization (×15)". | §4 |
| D-12 | Switching section type preserves the current outer bounding box (clamped to the new type's ranges). Thicknesses start at the challenge defaults. | Design choice |
| D-13 | Validation: zod schemas are the source of truth, and a committed `challenge.schema.json` is generated from them. | §6, §9 M0 |
| D-14 | Submission targets a student-selected tested iteration (default: latest). It requires at least one non-baseline test and a non-empty reflection answer. Reflection text is recorded, not graded. | §4 |
| D-15 | Branding: product name "Statica" (user-selected, from the template's DECISIONS.md). "Engineering Intuition" remains the internal working title; storage keys and the export `format` keep the `ei` prefix. | Template DECISIONS.md |
| D-16 | Dependencies are pinned to exact versions at M0 (template caret ranges converted). No backend and no network calls at runtime, so the app works offline after install/build. | §6, §9 |
| D-17 | Project root is the template folder `Educational Tool UI Design/`. All source, config, CI, and docs live there; no new scaffold is generated. | User plan |
| D-18 | Keep the template stack: React 19, Vite 8, Tailwind CSS v4 via `@tailwindcss/vite`, TypeScript 5.7 strict, pnpm 10 / Node 22 (per `.mise.toml`), oxfmt, the `@` alias, and the four Figma Make Vite plugins. pnpm replaces npm everywhere (`pnpm install --frozen-lockfile`, `pnpm-lock.yaml`). | User plan |
| D-19 | Keep the template's visual design and platform shell (sidebar, library with filters/search/saved, detail drawer, learning paths, my designs, notebook, mode cards, workflow stepper, `Icon`, `SectionIcon`, `TechnicalArt`, and the three stylesheets). Workspace regions map onto spec components. | User plan |
| D-20 | Only Cantilever Beam I is runnable. Other challenges, learning-path steps, and Freeform mode stay labeled previews/"Planned" and never run or display fabricated analysis. Guided and Parametric are both runnable (`allowedModes: ['guided','parametric']`), share one `BeamDesign` and solver, and differ only in presentation. Difficulty is independent of mode. | Template DECISIONS.md, user plan |
| D-21 | Fonts: DM Sans and Manrope are self-hosted via exactly pinned `@fontsource/dm-sans` and `@fontsource/manrope` imports in `index.css` (weights used by the CSS only), replacing the Google Fonts `@import`, so the app makes zero third-party requests. | Requirement 1.11, 1.13 |
| D-22 | Main viewport is React Three Fiber/WebGL, styled to the template palette. The template's SVG `BeamScene.tsx` projection is kept as the WebGL fallback (`Fallback2D`), adapted to read the typed `Section`, orientation, and `deflectionShape` instead of its hard-coded curve. | User plan, Requirement 31 |
| D-23 | The template's `src/physics.ts` and `node:test` suite are deleted, not adapted. Its divergences from this spec are removed: shared web/flange thickness (spec: independent tf and tw), applicability thresholds span/depth ≥ 10 and δ/L ≤ 1/20 (spec: the 14 thresholds below), no REL_TOL, the 40×50×3 reference design (spec: h60/b40/tf4/tw3), the 80 mm max folded into geometry validation (spec: 100 mm ranges, 80 mm is an envelope constraint), and always-true envelope/min-feature checks (spec: evaluated constraints). | User plan |
| D-24 | CSP `default-src 'self'` is injected by a production-only Vite plugin ordered after the Figma plugins. To stay compatible: `site.json` keeps no analytics ID, no custom scripts, and `addBypassLinks` false (it injects an inline `<style>`); `build.assetsInlineLimit = 0` (no `data:` URLs); the dev-only Figma plugins (`apply: 'serve'`) never reach production output; drei helpers that fetch remote assets (`Environment` presets, remote `Text` fonts) are not used. | Requirement 23.8, 23.9 |
| D-25 | Section defaults live in the challenge config as a required `sectionDefaults: { tubeWallM, iSectionFlangeThicknessM, iSectionWebThicknessM }` (strict schema). The loader's section cross-field rules (Req 3.9) apply to the configured limits: range min ≤ max; I-section `minFlangeThicknessM`, `minWebThicknessM`, `minClearWebHeightM` ≥ 0.003; `heightM.minM` ≥ 2·minTf + minClearWeb; `minWebThicknessM` ≤ `widthM.minM`; tube `minWallM` ≥ 0.002 and < `outerDiameterM.minM`/2. Each default must sit in its permissible range at the largest outer dimension (tube wall ∈ [minWall, Dmax/2), tf ∈ [minTf, (hmax − minClearWeb)/2], tw ∈ [minTw, bmax]). Comparisons use a 1e-9 m tolerance. Cross-field rules run only after the zod structure passes. | Requirement 3.9, task 4.1 |
| D-26 | Keep the 3D model view uncluttered: remove its visible envelope wireframe, static text annotations, dimension/span/bending-axis/axis guides, and fixed-support text overlay. Move transient dimension-handle values and limit feedback into a reserved bar below the Canvas. Keep the beam, wall/support geometry, grid, force arrow, deformation outline, drag handles, view controls, material strip and accessible summary. The envelope constraint remains active in geometry/evaluation; the dedicated 2D section diagram retains its envelope/dimensions. This user direction supersedes the visible-annotation parts of Requirements 7.5, 25.1, 25.12, 25.15 and the placement in 27.3–27.4, plus the corresponding design/task 14.3 presentation. The original specification is retained for history; future agents must not restore those 3D overlays. | Explicit user request, 2026-10-15, during Milestone 2 closeout |

## Applicability thresholds

Defined in `src/physics/constants.ts` and tunable. Seven metrics, each with a warning and a not-applicable threshold (14 values). Thresholds are inclusive on the safe side: a metric equal to its threshold produces no issue (compared with `withinLimit` and `REL_TOL`).

| Code | Metric | Warning if > | Not applicable if > | Rationale |
|------|--------|-------------|---------------------|-----------|
| `DEPTH_SPAN` | depthY / L | 0.10 (L/h < 10) | 0.20 (L/h < 5) | Euler-Bernoulli neglects shear. The shear/bending deflection ratio is about 0.8(h/L)² for a solid rectangle in Al, and larger for thin webs. |
| `LARGE_DEFLECTION` | δ_tip / L | 0.02 | 0.10 | Small-deflection linear theory. |
| `PLASTICITY` | σ_nom / σ_yield | 0.80 | 1.00 | Linear-elastic assumption. |
| `TUBE_SLENDERNESS` | D / t_wall | 40 | 100 | Local shell buckling not modeled. |
| `FLANGE_OUTSTAND` | (b − tw) / (2 tf) | 10 | 20 | Flange local buckling not modeled. |
| `WEB_SLENDERNESS` | (h − 2tf) / tw | 60 | 120 | Web local buckling/crippling not modeled. |
| `RECT_ASPECT` | max(h,b)/min(h,b) when the long side is vertical | 8 | 20 | Lateral-torsional buckling not modeled. |

Always listed as unsupported effects: torsion, shear deformation, local buckling, lateral-torsional buckling, plasticity, large deflection, stress concentrations at the root, joint/fastener compliance, self-weight. Self-weight (about 11 N distributed, roughly 1.4% of the tip-load deflection) is neglected. No safety certification is implied.

## Template decisions

Entries from the Figma Make template's original `DECISIONS.md`, with their disposition.

| Template decision | Disposition |
|-------------------|-------------|
| Platform shell separated from the active workspace; workbench stays mounted across navigation | Retained (D-19, Requirement 34.6) |
| Challenge metadata: discipline, difficulty, concepts, availability, visual family; difficulty independent of mode | Retained (D-19, D-20) |
| Guided and Parametric use the same beam representation; neither unlocks fixed parameters; Freeform and other solvers are labeled previews | Retained (D-20) |
| Learning paths are previews; library saving and notebook are session-local | Retained (Requirement 34.5, 34.8) |
| "Reload persistence and durable storage remain outstanding" | Superseded by D-04 (`localStorage` session persistence) |
| Statica is the product name | Retained (D-15) |
| Deterministic SI analysis, mm display | Retained (D-02, Requirement 2) |
| Dependency-free SVG projection, not WebGL | Superseded by D-22 (R3F main view; SVG kept as fallback) |
| Applicability: span/depth ≥ 10, δ/span ≤ 1/20 | Superseded by D-23 and the threshold table |
| Shared I-section web/flange thickness; no drag handles | Superseded by D-23 (independent tf/tw) and Requirement 27 (handles) |
| In-memory history, JSON export of runs, no reload persistence | Superseded by D-04 and Requirement 22 (`ei-design` export format) |
| Unmodeled effects listed; no certification implied | Retained, extended by `unsupportedEffects` (Requirement 10.9) |
| Tests use Node's built-in runner against the physics module | Superseded by D-01 (Vitest, fast-check, Playwright) |

## Font weights

DM Sans and Manrope are self-hosted via `@fontsource` static weights (D-21). Non-hundred CSS weights used by the template (450, 550, 650, 750) render at the nearest installed weight.

## Contrast token changes

- Task 1.5 darkened failing text colors in `src/index.css`, `src/platform-base.css`, and `src/platform.css` to reach ≥ 4.5:1 for text and ≥ 3:1 for icon-only UI (WCAG 1.4.11), keeping hue and saturation and lowering only HSL lightness. 178 rules were checked; about 140 colors changed; 0 fail afterward. Decorative borders, dividers, TechnicalArt illustration colors, and SVG strokes were left unchanged.
- Token/opacity changes: `--muted` #8a9288 → #6b7369 (3.01 → 4.60 on #f7f8f4); `.step` #949d8c → #656e5d (2.64 → 4.62); `.run-test>span` opacity .5 → .8 (3.27 → 5.66); `.featured-caption>span` opacity .65 → 1 (2.46 → 4.59).
- Focus ring: `#67815b` → `#345640` (≥ 6.5:1 on every workbench background; previously 3.44 on #e1e8d8); `.toast :focus-visible` uses #f3f6ec (8.47 on #344d39).
- Accepted exception: `.selected-check` white on #67805c is 4.36:1; it is an icon whose state is also conveyed by visible text, so 3:1 applies.
- Ratios were computed per rule against mapped backgrounds; rendered-DOM verification is deferred to the axe E2E checks (task 27).

## Open questions

- Final challenge constants and applicability thresholds are pending engineering review.
- A narrow CSP exception may be needed if React Three Fiber requires `blob:` URLs.
- Storage keys and the export `format` keep the `ei` prefix despite the Statica brand.
- `.figma/make/install` uses `--no-frozen-lockfile`; local development and CI use `pnpm install --frozen-lockfile`.
