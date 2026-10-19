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
| D-27 | `setPrediction` receives required `now: string` from the caller and assigns it to `Prediction.createdAt`. The design declares `createdAt` but omits time from that action payload; injecting it closes this gap without reading a clock or borrowing an unrelated prior result timestamp. The future prediction dialog dispatches `{ type: 'setPrediction', direction, explanation, now: store.clock() }` and then calls `store.runTest()`. Original specification text is retained; action typing and callers follow this extension. | Task 19.1, Requirement 15.8 (deterministic injected time) |

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

## D-28 — Compact challenge panel (user-directed, 2026-10-16)

Keep the original challenge statement visible, followed by draft/test status and a compact stored value/limit list with readable, correctly colored text/icon pass/fail badges. Move the duplicate full constraint table, fixed-load/material/span text, generated explanation paragraphs and college formulas into a collapsed Test details disclosure. Keep model applicability reasons, warnings and errors visible. Full details remain available with keyboard-accessible native disclosures; numerical values and scoring are unchanged. This user instruction supersedes the original default-expanded presentation in Requirement 29.6; do not regenerate the completed MVP specification. The detailed table uses natural word wrapping and can scroll inside its disclosure instead of splitting words into arbitrary fragments.

## D-29 — Status ownership and compact history (user-directed, 2026-10-16)

Remove draft and overall acceptance banners from The challenge: draft status is already displayed in the viewport, and recorded acceptance belongs to design history. The history sidebar uses compact template-sized iteration rows (section icon/name, acceptance badge, compare checkbox and Restore), while the selected result keeps its three numerical metrics and acceptance badge. Prediction details, per-constraint results and explanation facts remain available in a collapsed Test details disclosure. Compare uses styled cards and metric/delta tables; repeated section/constraint transition lists move behind Constraint changes. Preserve stored evaluations, compare selection semantics, restore behavior and keyboard navigation. The import chooser uses a compact label styled as a template control with a visually hidden accessible native file input. This presentation instruction supersedes the original default-visible acceptance banner in Requirement 29.6 and verbose default history/compare presentation; no domain calculations or completed specifications are regenerated.

D-29 follow-up: the user explicitly requested no exclamation mark before Not accepted. All history/result/comparison badges therefore use the text alone for that state; this overrides the earlier icon-plus-text presentation for notAccepted.

## D-30 — Selectable comparison and table-only challenge details (2026-10-16)

Per user direction, Compare results uses the same iteration-list/detail layout as Design history. The comparison list contains Baseline and the selected comparison iterations; clicking a design shows only its stored values and baseline/previous deltas. Comparison focus is local UI state, independent of history selection and persisted comparison membership; removing a focused member falls back to the last remaining compared design. Existing comparison limits and restore behavior remain unchanged. The challenge Test details disclosure contains only the evaluation table: remove its contextual paragraph, explanation prose and college/formula disclosure. Model applicability reasons/warnings remain outside that disclosure; explanations remain available for the selected test in history. This supersedes D-28's inclusion of prose/formulas in challenge Test details and D-29's simultaneous comparison cards, plus the corresponding original presentation requirements. Do not regenerate the MVP specification.

## D-31 — Delete an iteration from history (2026-10-16)

User-requested deletion removes a non-Baseline result from student-visible history, comparison choices and My designs, and prevents restore/submission of that result. A confirmation explains that the current draft and last analysis stay unchanged; deleting the submitted result also clears its submission while preserving reflection text. Baseline cannot be deleted. The reducer adds an optional persisted `deletedIterationIds` list; it retains immutable archived TestResults to preserve original prediction provenance, stable iteration numbers and the append-only numerical record. This is history-entry deletion, not data erasure. All archived result analysis/predictions are still validated on load. Existing version-1 saves without the optional list remain valid; duplicate, unknown/Baseline deletion ids or deleted comparison/submission references reject. New runs use the last recorded iteration + 1, not the number of visible rows. The new `selectVisibleHistory` selector supplies history/compare/submission/My designs; latest tested readouts and original previous-test deltas retain their recorded meaning even if a row is deleted. D-31 overrides the former inability to remove student-visible history entries without rewriting the completed MVP specification.

## D-32 — Center actions and disclose fixed fields (2026-10-16)

Per user direction, center the delete-confirmation Cancel action across the dialog width and center the Run Test play-icon/text group by overriding the template's obsolete auto-left icon margin. Fixed challenge values live in a native details disclosure, collapsed by default, with the lock icon and Some things are fixed. summary always visible. Remove the explanatory sentence under that title. Values retain their labels, read-only semantics, lock labels and domain sources when expanded. Keyboard focus has an explicit visible indicator. This replaces the old default-expanded fixed-fields presentation without changing which properties are locked or regenerating specifications.

## D-33 — Temporary feedback and workspace-only My designs (2026-10-16)

Per user direction, informational notices are shown through the existing live-region/toast channel rather than permanent paragraphs below history. Visual toasts dismiss automatically after five seconds, with manual dismissal still available; persistent error displays and the live region remain available. My designs shows only the local workspace card and Return to workbench action, not a results table. Session persistence, draft/history and recorded values remain unchanged and become visible in the workbench. Persisted untested drafts, deleted-history metadata or reflections also identify an existing workspace after reload. This supersedes the original My designs results-list presentation in Requirement 34.7; do not regenerate completed specifications.

## Open questions

- Final challenge constants and applicability thresholds are pending engineering review.
- A narrow CSP exception may be needed if React Three Fiber requires `blob:` URLs.
- Storage keys and the export `format` keep the `ei` prefix despite the Statica brand.
- `.figma/make/install` uses `--no-frozen-lockfile`; local development and CI use `pnpm install --frozen-lockfile`.

## D-34: Develop before owner QA; retain pre-deployment release gates (2026-10-16)

The owner nominated themself as engineering reviewer and directed human QA to occur before customer deployment so software work can proceed now. Task 29.2 records owner-conducted engineering QA, not an external independent review; reviewer conclusions must still be based on independent calculations/references and recorded evidence. Manual readiness/student sessions and their findings remain open. They no longer block isolated configuration/specification development, but checkpoint 32.2 and release checkpoints remain required before customer release. Do not mark human work complete, publish, or activate an unfinished challenge based on development tests. The pilot stays local-only; accounts/saved user information/challenge progress remain required future scope. Preserve existing task IDs and record revised dependencies explicitly.

## D-35: Original six catalog challenges before second editions (2026-10-16)

Owner prioritized the existing library: Cantilever Beam I, Mounting Bracket I, Torsion Shaft I, Heat Sink I, Braced Frame I and Vibration Isolation I. Defer further Cantilever Beam II integration until original-catalog task 51; retain its completed configuration/specification/tests as historical work. Tasks 45–50 scope model-specific requirements/benchmarks and implement the five currently unavailable entries; shared infrastructure task 34 serves that catalog. Non-beam previews require their own supported models and truthful metrics, not reused cantilever outputs. Scope/architecture task 45.1 is next. Preserve pre-deployment mode distinction 44 and owner/manual/student QA gates; reprioritization does not complete any of them or authorize deployment.

## D-36: Guided scaffolding and direct Parametric editing share one workspace (2026-10-16)

Task 44 now has additive specifications under .kiro/specs/interaction-modes/. Guided adds compact Inspect/Experiment/Compare/Explain instructions and collapsed hints outside the challenge and Canvas; recommendations derive from actual session state and browsing never earns progress. Parametric omits guidance/stepper while retaining all editor/test/history tools. Native workbench mode selection calls the existing persisted store.selectMode and announces through the shared live region; editor/viewport are not remounted. Both modes retain the same solver, prediction policy, stored results, reflection/submission and save schema. Mode-specific UI browsing resets to the derived focus on re-entry/reload. Freeform and dormant Beam II stay unavailable. Full local tests pass; task 44.3 remains open for pushed browser evidence and owner manual release QA.

## D-37: Choose mode before entry; no in-workbench switching (2026-10-16)

User corrected D-36: once inside Guided or Parametric, users must not switch to the other mode. Remove the native workbench selector and its callback/CSS. Mode remains selectable on the existing library/challenge-entry screen, before opening, and persists on reload/resume. Returning to the library permits a new entry choice; this does not create a permanent account/project lock, reset work or require separate saves. Preserve the distinct scaffolding/direct-edit experiences, shared solver, prediction rules and existing session persistence. Update task/spec/browser assertions to verify pre-entry selection and absence of in-workbench mode controls instead of live switching.

## D-38: Bounded original-catalog models and delivery order (2026-10-17)

Task 45.1 scopes the five preview challenges in additive `.kiro/specs/original-catalog/`. These are proposed developer choices, pending owner engineering review under 29.2.

- **Models:** circular-shaft Saint-Venant torsion (Torsion Shaft I); single-DOF base-excited viscous isolation in steady-state frequency response (Vibration Isolation I); steady plate-fin conduction/convection with fin efficiency and a specified effective coefficient (Heat Sink I); stepped flat-bar nominal bending with a published shoulder-fillet stress-concentration fit (Mounting Bracket I); 2D pin-jointed braced frame by direct stiffness with mechanism detection and Euler/yield member checks (Braced Frame I).
- **Delivery order:** Torsion (47) → Vibration (50) → Heat Sink (48) → Bracket (46) → Frame (49). Torsion goes first because it is closest to the validated beam and lowest risk. Vibration goes second to prove that the shared contracts are not beam-shaped. Bracket waits on owner decision MB-07. Frame carries the largest solver/UI effort.
- **Open owner decisions:** HS-08 (effective coefficient with minimum-gap rule, versus a natural-convection spacing correlation) and MB-07 (stress-concentration approach and card concept copy). Each must be resolved before the corresponding 4x.1 closes.

Task IDs and dependency edges are unchanged; the order is a default sequence, not a hard dependency, and the owner may reorder it. No model is implemented, no card is activated, and the beam solver is never used for these disciplines. Provisional constants were checked for solvability with a standalone calculation, not application code or human review.

## D-39: Multi-model contracts preserve the frozen beam save format (2026-10-17)

Task 45.2 specifies the shared contracts in additive `.kiro/specs/multi-model-architecture/`:

- **Identity:** explicit model identity and version on each challenge config; a config without `model` is the beam, version 1.
- **Dispatch:** a pure state-layer registry of model definitions. Per-model code goes in subfolders of the existing pure layers.
- **Evaluation:** a shared evaluation envelope with extended SI units, a per-model primary prediction metric and a not-scorable outcome.
- **Isolation:** a store/persistence host per challenge.

Persistence validation compares stored beam results key-for-key against recomputation, so the beam Analysis/Evaluation/PredictionOutcome/TestResult shapes are frozen. Beam sessions keep reading and writing v1 envelopes; non-beam sessions use v2 with model identity. There is deliberately no v1 → v2 migration, so the current production release can still read beam saves after a rollback. Any model-output change requires a challenge version change (new key) rather than silent re-scoring. Implementation proceeds in 34.1 step 1 (registry with beam only, no visible change), 34.1 step 2 (per-challenge hosts/isolation using test-only registrations) and 34.2 (model UI slots/content, test-only model). Beam II stays unregistered until 52.

## D-40: Owner decisions for Heat Sink I and Mounting Bracket I scope (2026-10-17)

Owner selections, resolving the open 45.1 items. Each was the recommended option.

- **HS-08:** Heat Sink I uses a specified uniform effective convection coefficient (fan-assisted, proposed 25 W/m²·K) with a minimum fin-gap constraint and applicability screen. A natural-convection spacing correlation is at most a later edition.
- **MB-07(a):** Mounting Bracket I uses a stepped flat-bar cantilever: nominal bending stress multiplied by a published shoulder-fillet stress-concentration curve fit (Peterson), used only inside the fit's validity range. The fit's coefficients must be transcribed from cited sources and verified against the printed edition before 46.2.
- **MB-07(b):** The card copy stays as written ("Load paths, Stress concentrations"). Load paths are taught as the internal bending-moment path, with the critical section switching between root and step.

These decisions scope specifications 48.1/46.1 only. They do not implement or activate either challenge, and they do not constitute engineering review of constants (29.2).

## D-41: Mounting Bracket I open items K-1–K-5 resolved (2026-10-17)

Owner selections, each the recommended option, recorded in `.kiro/specs/mounting-bracket-1/`.

- **K-1:** Development proceeds on the stepped-flat-bar shoulder-fillet Kt table (Peterson via Roark Table 6-1, case III.1b, in-plane bending). The basis:
  - two independent online copies that match exactly
  - the coordinator's digit-by-digit re-check against the downloaded Roark text
  - the EES worked example reproduced to 0.01%

  The model limits must disclose that the coefficients come from secondary copies. Verification against a printed edition is required in owner QA (29.2) before customer release. A discrepancy found then would increase the model and challenge versions (MM-04).
- **K-2:** The step location stands in conservatively for the source's shoulder length, and the step moment is taken at the shoulder.
- **K-3:** `KT_STEP_RATIO` warns above 1.5 and is not applicable above 1.6.
- **K-4:** Because the fit under-predicts stress for small steps (6.6–13.6% below the 1951 chart), a stepped bar needs D/d ≥ 1.1 (`KT_SMALL_STEP`, not applicable below; inclusive). This removed 620 of 30,963 accepted grid designs and changed no fixture outcome.
- **K-5:** Constants, limits and "peak elastic stress ≤ allowable" wording approved; step and fillet controls stay editable for a uniform bar.

46.2 is unblocked. This is not engineering sign-off of constants (29.2) and activates nothing.

## D-42: Torsion Shaft I activated in the library (2026-10-17)

The owner explicitly approved activation after the permission system flagged it. Torsion Shaft I (catalog card 003, `torsion-shaft-1`, model `circularShaftTorsion` v1) is bundled and openable from the library through its own runtime and UI registry entry. This supersedes D-20's "only Cantilever Beam I is runnable" for this card. The completed MVP design text of D-20 is left unchanged as history.

Activation followed the integrated gates: component tests through the production registry, and desktop/Pixel 7 browser cases for Guided keyboard entry and Parametric, covering prediction-to-Accepted, axe, 320 px, reload persistence and challenge isolation. The primary view is a main-bundle SVG shaft elevation rather than the 3D shaft TSH-14 suggested. This is repository/local availability, not customer deployment. Owner engineering review of the torsion constants, wording and references (29.2) and manual/student QA remain required before release. The other four preview cards stay unavailable until their own 4x.3.

## D-43: Vibration Isolation I, Heat Sink I and Mounting Bracket I activated (2026-10-17)

The owner explicitly approved activating catalog cards 006, 004 and 002. They were activated one at a time (8fbb61f, 049147a, 766e1c7): bundle the challenge, make the card available, then run its browser spec for the first time. Each spec passed on desktop and Pixel 7 at first run (Guided keyboard entry and Parametric: prediction to Accepted, axe, 320 px, reload persistence, isolation from Cantilever Beam I). After the third activation the full gate passed: 2415 tests, 40/40 E2E. This supersedes D-20's single-challenge rule for these cards.

Mounting Bracket I ships the D-41 disclosure that its Kt coefficients come from cross-checked secondary copies. Braced Frame I's workbench is merged (a4878d2, owner-approved merge of an agent's blocked work), but card 005 stays unavailable until activation is requested. As with D-42, this is repository/local availability, not customer deployment. Owner engineering review of each model's constants, wording and references (29.2), and manual/student QA, remain required before release.

## D-44: Braced Frame I activated, so all six original challenges are runnable (2026-10-17)

The owner approved activating catalog card 005 before going offline overnight (6853d94). Its browser spec passed on its first unskipped run on desktop and Pixel 7, after one test-selector fix: the Parametric label is a prefix of the context sentence, so the match is now exact. The full gate passed with 44/44 E2E and none skipped. The platform spec now asserts that no catalog card remains a concept preview, while Freeform stays unavailable. As with D-42 and D-43, this is repository/local availability, not customer deployment.

The owner also requested better visualizations (task 54: 3D views with 2D fallbacks for Mounting Bracket I, Torsion Shaft I and Braced Frame I) and one checklist of open spec questions (task 55, `OWNER_REVIEW_CHECKLIST.md`). Open-question defaults stay as implemented until reviewed.

## D-45: 3D views for Mounting Bracket I, Torsion Shaft I and Braced Frame I (2026-10-17)

Task 54, from the owner's feedback that the bracket's 2D view did not show what the component is. The owner chose 3D models with clear 2D fallbacks for the bracket, and 3D views for the torsion shaft and braced frame. Each design view now loads a lazy 3D chunk. The 2D view stays in the main bundle (OC-12) and replaces the canvas, with a one-time notice, when WebGL2 is missing (checked in the main bundle, so the chunk is not downloaded), the chunk or canvas fails, or the context is lost. Results come only from stored analyses, and nothing is written on the models (D-26).

- **Bracket:** wall, mounting plate and bolts, the draft outline (fillets included) extruded to the challenge thickness, the hanging tip load and a band at the tested governing section. The redrawn 2D side view carries the same context.
- **Torsion:** a to-scale shaft with a wall clamp, a torque arrow and the tested twist line. The twist exaggeration rule (×10, capped) is shared with the SVG.
- **Frame:** tube diameters ×4, proportional and disclosed as not to scale. Force states differ by shape: solid tension, striped compression, beaded ≈ 0, open wire-mesh untested, dashed absent.

Heat Sink I and Vibration Isolation I keep their SVG views. Owner visual review is listed in OWNER_REVIEW_CHECKLIST.md §7; automated checks are not that review.

## D-46: Mounting Bracket I is a bolted L-bracket (2026-10-18)

Owner feedback (task 57): the stepped flat bar was "not even a bracket". The runnable challenge is now an L (angle) bracket: a vertical flange bolted flat to the wall, a horizontal arm leaving the bend, a load hanging near the tip. New model id `boltedLBracket` v1 (MM-01 forbids reusing `steppedBarBracket`); challenge version 2, so stepped saves under `:v1` are never read or re-scored and old design files are refused (MM-04, MM-19). Model: statics M = P·a; Winkler–Bach inner-fibre bend stress used only for R/c ≥ 1.2 (Roark Table 9.1 range, guaranteed by the parameter bounds); bolt tension by rigid rotation about the heel, h_b = H − e − r_o; deflection = arm cantilever + flange-span rotation; no Kt, no prying amplification, no preload. Baseline (t 3, w 120, H 55, r_i 1 mm) fails bend stress, deflection, bolt tension and mass while applicable; reference (7/40/80/6 mm) is Accepted. Supersedes MB-07(a) and D-41 K-1–K-5 for the runnable challenge; `design.md` stays as history. Owner engineering review of constants, sources and wording remains required (29.2).

## D-47: Every baseline fails as many checks as a valid design can (2026-10-18)

Owner requirement (task 59). Each challenge's baseline fails the maximum number of design checks of any valid, in-range design that passes model applicability without warnings (applicability is a validity gate, not a countable failure), verified by exhaustive grid search in `test/challenges/baselineDifficulty.test.ts`. Ties prefer designs far from passing on strength/stiffness with plausible geometry; the reference design stays Accepted and reachable. Beam, torsion, heat sink and frame content moved to version 2 (new storage keys; version-1 saves left in place, never re-scored, per D-39/MM-04; the beam still writes the frozen v1 envelope). Vibration was already at its maximum. This supersedes MVP Requirement 3.6/3.7 and design fixture E1 for the beam baseline; the Ø30 circle remains a physics fixture (`solid30`). The MVP specifications are not regenerated.

## D-48: Goal card and progressive disclosure for dense workbenches (2026-10-18)

Owner feedback (task 56) on Braced Frame I and Vibration Isolation I. A model workbench may place a compact goal card at the top of the design view (goal, what to change, stored checks with text Pass/Fail/N/A and an "N of 4 pass" count, one key explanatory line, applicability reasons). Long statements, drawing keys and secondary tables live behind native disclosures; information needed for correctness or honesty about model limits is moved, never deleted. Extends the D-28 compact-panel intent; other models are unchanged for now.

## D-49: Guided means structured experiments; Parametric means open design (2026-10-18)

Owner feedback (task 58): the modes were indistinguishable. Guided runs a per-model sequence of single-variable experiments from pure, data-driven plans (`src/evaluation/guided/`). Each step unlocks only its parameters; the rest are read-only with a visible reason, and the runtime reducer rejects locked edits in Guided with an announced notice. Shared actions (restore, reset, import, tests) are never blocked. Steps are met by tested results compared with earlier tested results from stored snapshots, so progress is derived from history and nothing new is persisted (D-39 envelopes unchanged). The final step opens every parameter and is met by an Accepted test. Parametric keeps everything editable with no steps. Supersedes the D-36 Inspect/Experiment/Compare/Explain prompts and the workflow stepper; D-37 (mode chosen before entry, fixed inside the workbench) still holds.

## D-50: Local-first accounts and a Home page (2026-10-18)

The owner asked for accounts and saved progress before any backend decision (task 38.0). Accounts are browser-local behind an `AccountProvider` interface that a backend can replace: PBKDF2-SHA-256 (600k iterations, per-account salt, constant-time compare), never plain-text credentials. Guest keys are unchanged; per-user progress uses `ei:user:<id>:session:<challengeId>:v<n>` with the frozen envelopes. Guest work moves into a new account only via an opt-in on sign-up. Sign-out and deletion unmount every per-account store. The app starts on Home (`/`) with hash routes for shell pages. Completed = recorded Accepted submission (MILESTONE4 proposal, not server-verified). The UI must keep stating that data lives on this device only; local accounts separate people sharing a browser and are not a security boundary. Cross-device sync (38.1/38.2) awaits the owner's backend choice; `src/account` stays framework-free (ESLint).

### D-47 amendment: Cantilever Beam I starts as a solid circle (2026-10-18)

Owner follow-up: the beam starts as a circle; the I-section is the good target and remains the reference. Among the 191 grid circles, the most checks failed without an applicability warning is 2 (deflection + mass, Ø31–35.5 mm); circles failing more need a warning (≤ 24.5 mm: deflection + stress with LARGE_DEFLECTION; ≥ 80.5 mm: mass + envelope with DEPTH_SPAN). Tie-break (furthest from passing stiffness) gives Ø31 mm: δ 6.91 mm vs 4, m 1.223 kg vs 1.2. The maximum over all section kinds remains 4 (the version-2 sideways I-section, kept as fixture `sidewaysI`). Content version 3 (`ei:session:cantilever-beam-1:v3`, frozen v1 envelope); version-1 and -2 saves are left in place and never re-scored.

## D-51: Reset to baseline restarts the challenge (2026-10-18)

Owner: "the reset should clear test history". `resetDraft` rebuilds the session with the engine's fresh-session constructor in the current mode (injected time and Baseline id): history returns to a single new Baseline record (archived entries included), and comparison, pending prediction, reflection and submission are cleared, so Guided restarts at step 1 and no submission can reference a removed test. The confirmation says it cannot be undone. Supersedes the initial task 60 behaviour (kept history and submission). Append-only history (Req 18.1) still holds for every other action.

### D-48 amendment: goal card withdrawn; Cantilever-style challenge panels (2026-10-18)

The owner prefers Cantilever Beam I's presentation, where the visible challenge paragraph makes clear what to do. Braced Frame I and Vibration Isolation I drop the goal card; their challenge panels follow the beam's RequirementsPanel structure (statement as a visible paragraph, VALUE / LIMIT list with text Pass/Fail or N/A, one key explanatory line, applicability reasons, Test details, reference link, Run Test). Statements were tightened without changing meaning, keeping the BFR-01 and VIB-02 mandated sentences verbatim, so no challenge version change is needed (MM-04). The rest of D-48 stays: drawing keys, member forces/reactions and the full response table are collapsed, and controls stay short and grouped. The Cantilever layout is the reference presentation for every challenge.

## D-52: Mounting Bracket I cautions live in Test details (2026-10-18)

Owner: the bracket's bend-stress summary line and caution paragraphs under the checks "do not need to be there". The summary line is removed from the challenge panel (its values remain in the view summary and in Test details). Applicability warnings for the latest test are still produced and still shown, but inside the Test details disclosure rather than as always-visible paragraphs; not-applicable reasons stay visible because they change the Status. This narrows MVP Requirement 30.6's always-visible warning list for Mounting Bracket I only; the other challenges are unchanged unless the owner asks.

## D-53: Home is a product outlook; device progress lives in My designs (2026-10-18)

Owner: Home should show students, teachers and investors what the platform can do, based on the owner's product vision (interactive simulations, guided learning modules, design challenges, curriculum and progression across eight disciplines, structural mechanics first, complementing courses). Per-challenge progress moves from Home to My designs, which now lists every runnable challenge (started workspaces as cards with their own drawing, the rest to start). Honesty rule: each capability on Home is labelled in text as Available now, Early or Planned; teacher class tools, concept lessons, learning paths and non-structural disciplines beyond heat transfer and vibration are Planned, and no market or usage figures are shown. Amends D-50's Home progress overview; the account and storage behavior of D-50 is unchanged.

## D-54: Home is a standalone landing page outside the workspace (2026-10-18)

Owner: Home should not be part of the main UI but a front webpage with the D-53 content. The landing page renders at `/` without the workspace sidebar, top bar or page select, with its own header (section links, Open Statica, My designs when work exists) and footer, and Home is removed from the workspace navigation; the workspace brand links back to it. It stays inside the same static single-page app rather than a second HTML entry, so the CSP, bundling, accounts context and the always-mounted Workbench (Req 34.6) are unchanged. A separate marketing site or domain remains an owner decision for deployment.

## D-55: Home follows the owner's Figma homepage design (2026-10-18)

Owner supplied Figma output (Next.js components `site/*`, `challenges.ts`, `TechnicalArt.tsx`) for a better homepage; it is kept verbatim in `design/figma-homepage/` as reference, not compiled. The export has no page file or theme, so the layout was composed from its components (header actions, hero actions, audience tabs, light/dark logo, roadmap anchor) and its Tailwind tokens became CSS custom properties in `home.css`, darkened where text needs 4.5:1. Deviations: the guest h1 is the product headline ("Learn engineering by designing, testing and explaining.") and signed-in users still see "Welcome back"; the header keeps Open Statica beside Sign in rather than a second Create account; content comes from the app catalog (all six challenges available, D-42–D-44) instead of the export's `challenges.ts` (beam only), and the Investors "Today" copy says six challenges; the export's server-API account forms are not used because accounts are local-first (D-50); the repository `TechnicalArt` (identical drawing, memoized) is kept. D-53 readiness labels and D-54 standalone layout are unchanged.

## D-56: Reference dialogs use typeset formulas and key points (2026-10-18)

Owner: the light-bulb sections had too much text; give key pointers, and format equations in LaTeX with fractions instead of slashes. Formulas are written in LaTeX and rendered with KaTeX (exact pin 0.18.11) loaded on demand as a separate chunk, so the main bundle is unchanged; `katex.render` builds DOM and applies styles through the CSSOM, which `default-src 'self'` permits, and its fonts are bundled locally (`assetsInlineLimit: 0`, no data: URLs). Commands that write style attributes (`\fcolorbox`, `\boldsymbol`-style shadows) are avoided. Each dialog keeps its formulas (no new physics), three to five key points, and moves unsupported effects, assumptions and sources into a collapsed disclosure; those effects are still listed with every test result. New class names (`reference-formula`, `tex`) keep the template `.formula span` rule away from KaTeX output.

## D-57: Learn modules predict before they show (2026-10-19)

Owner asked to create the Learn pillar. The first module is Beam bending, matching the vision's example path (Solid Mechanics → Mechanics of Materials → Beam Bending → Cantilever Beam Design). Each step shows at most three concept points and a prediction question; the demonstration, takeaway and equations appear only after the learner commits a prediction, which is final and never scored (a different answer is explained, not marked wrong). Demo numbers come from the existing physics through the new pure `src/learn` layer, and unit tests check every correct option against that physics, so content cannot drift from the model. Demo values are generic teaching values (1 m aluminium cantilever, 20 × 40 mm bar, 200 N), not challenge constants. Progress is the committed predictions per module and content version (`ei:learn:<id>:v<n>`), in the same guest/account scope as challenges. The workspace page "Learning paths" is renamed Learn; its three preview paths are replaced by the subject/topic/module catalog with Planned entries. Spec: `.kiro/specs/learn-modules/`.

## D-60: Fatigue Analysis I, an owner-requested challenge (2026-10-19)

Owner request on 2026-10-19: "Fatigue Analysis Challenge (Advanced)". Task 70 adds challenge `fatigue-analysis-1` (catalog card 009, Mechanics, Advanced, technical-art kind `fatigue`) and registers it as **available**: an owner-requested activation, not a preview. New model `steppedShaftFatigue` v1 (MM-01), v2 saves under `ei:session:fatigue-analysis-1:v1`, `ei-design` v2 files. Spec, design and an independent Python worksheet in `.kiro/specs/fatigue-analysis-1/` (FAT-01–FAT-19).

- **Scope change from the brief:** a non-rotating stub-axle spindle under a fluctuating wheel load (1–5 kN at 50 mm from the shoulder), not a rotating shaft. A rotating shaft only gets a mean stress from torque, which would need a second stress-concentration fit (torsion) and a second notch-sensitivity fit; the spindle gives a mean and an alternating bending stress at the same fillet, so one fit covers the lesson.
- **Model (stress-life screening):** Roark's polynomial fit for Kt of a shoulder fillet in bending; Shigley's Neuber-constant fit, q and Kf = 1 + q(Kt − 1), applied to the mean and alternating stress; Se = ka kb kc kd ke · 0.5 Sut with the current-edition surface factors (ground, machined, as-forged; hot-rolled omitted because unverified) and the non-rotating equivalent diameter 0.370 d; Basquin line from f·Sut at 10³ to Se at 10⁶ cycles; modified Goodman safety factor at the 2×10⁵-cycle target life; first-cycle yield with Kf.
- **Checks:** n_f ≥ 1.3, n_y ≥ 1.5, mass ≤ 520 g, flat shoulder face (D − d)/2 − r ≥ 2.5 mm for the wheel hub; a fillet that does not fit inside the step is an invalid design. Screens (not applicable above 1): `KT_FIT_RANGE` (h/r 0.1–20, r/d ≤ 0.3, D/d ≤ 3), `LOCAL_YIELD`, `LOW_CYCLE` (life below 10³ cycles). Loader rules keep every configured value inside each correlation's range.
- **Baseline and reference (D-47):** Baseline d 22, D 45, r 1 mm, as-forged fails fatigue (n_f 0.62, predicted life 7.0×10³ cycles), yield and mass: 3 checks, the maximum of any valid applicable design on the grid (shoulder face cannot fail together with them inside the screens). Reference d 24.5, D 34, r 2 mm, machined is Accepted. No single change from the Baseline is Accepted; as-forged is never Accepted.
- **Honesty:** sources are cited by book and topic with "edition and equation numbers pending engineering review"; the Kt fit reads about 6 % above a Shigley chart value and a later Roark edition revised part of it, both listed for owner review (OWNER_REVIEW_CHECKLIST.md §8). Accepted means meeting the challenge's educational limits, never a fatigue certification. Surface finish has no modeled cost.
- Count-based copy and tests ("six challenges") were updated only where verification needed it; Home's "Six models today" copy is unchanged for the coordinator to reconcile across branches.
