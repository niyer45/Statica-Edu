# Column Buckling I: scoped requirements (task 68)

Additive specification, 2026-10-19. The owner asked for a "Buckling Challenge (Introductory)" on 2026-10-19; D-58 records the request and the owner-requested activation. It follows the shared contracts in `../multi-model-architecture/` (MM-01–MM-27). It does not change the completed MVP requirements or any other challenge. Requirement IDs are `CBK-nn`.

Status: specification, independent worksheet (`worksheet.py`, numbers in `design.md`) and implementation in the same task. Owner engineering review (29.2) of the constants, thresholds, wording and references is pending; nothing here is human QA.

## Identity and learning objectives

- CBK-01 Identity: challenge `column-buckling-1`, version 1, title Column Buckling I, difficulty introductory, discipline Structures, Guided and Parametric modes. Model `eulerColumnBuckling` version 1 (a new id, MM-01). Catalog card `007`, available, art kind `column`, linked to the bundled challenge (MM-06).
- CBK-02 One main idea: buckling of a slender column is a stiffness failure. The critical load depends on the second moment of area I and on the effective length, not on the material's strength. Supporting objectives:
  1. A column can buckle while its axial stress is far below the allowable stress.
  2. I matters more than area: spreading the same material away from the axis raises the critical load much more than it raises the mass.
  3. The critical load falls with the square of the effective length (taught in the reference dialog and the statement; the length is fixed by the structure, see design.md).
  4. A tube beats a solid bar of equal mass.
- CBK-03 Introductory scope: one cross-section choice (solid bar or round tube) and at most two dimensions. Plain wording; every check is named in words.

## Fixed values and adjustable design

- CBK-04 Fixed (locked): column length 2.0 m between ideal pins at both ends (pinned–pinned, effective-length factor K = 1); a concentric axial compressive load of 10 kN at the top; educational nominal aluminium (E 69 GPa, density 2700 kg/m³, allowable axial stress 120 MPa, yield stress 240 MPa used only for the applicability screen). Locked fields: lengthM, materialId, forceN, support.
- CBK-05 Adjustable: section kind solid bar or round tube. Solid diameter 10–60 mm; tube outer diameter 15–80 mm; tube wall thickness 1–6 mm; all in 0.5 mm steps. The loader requires the smallest tube outer diameter to exceed twice the largest wall, so every in-range tube has a bore and no coupled edit rule is needed. Switching keeps the outer diameter (clamped to the target range); a new tube uses the default 3 mm wall.
- CBK-06 Baseline: solid Ø24.5 mm. Internal reference (never shown to students): tube 60 × 2 mm, Accepted. The reference is one feasible design, not the only one.

## Checks

- CBK-07 Checks, in order:
  1. `buckling`: the Euler critical load P_cr must be at least the required safety factor (2.0) times the load, i.e. at least 20 kN. This is a minimum check (value ≥ limit), reported with its sense.
  2. `axialStress`: P/A ≤ 120 MPa.
  3. `mass` ≤ 2.5 kg.
  4. `applicability` (bool).
  Comparisons are inclusive with the shared REL_TOL (`withinLimit`; for the minimum check `withinLimit(limit, value)`). Non-finite values never pass. Accepted iff applicable and every check passes; warnings never affect acceptance.
- CBK-08 Displayed metrics: critical load (kN), safety factor P_cr/P, axial stress (MPa), mass (kg), second moment of area, area, radius of gyration, slenderness KL/r and the transition slenderness, Euler stress P_cr/A.
- CBK-09 Prediction: checkpoints on iterations 1 and 3. Primary metric is the critical buckling load, named "critical buckling load" in the dialog. Shared 0.98/1.02 ratio band; not scorable without a finite positive metric (MM-13).
- CBK-10 Reflection prompt: "Using your tested designs, explain why the column buckled even though its axial stress was low, and how moving material away from its center changed the critical load and the mass."

## Applicability and exclusions

- CBK-11 `EULER_RANGE` (never silently compute an invalid result): metric σ_E/σ_y with σ_E = P_cr/A. Not applicable above 0.5, which is the Johnson transition: slenderness below λ_c = √(2π²E/σ_y) (about 75 for this material) is an intermediate column, where inelastic (Johnson) buckling governs and the Euler load is unconservative. Caution above 0.4 (80 % of the limit, the convention of the shared plasticity screens). The message names inelastic buckling of intermediate columns.
- CBK-12 `WALL_SLENDERNESS`: D/t (a solid bar counts as wall = radius, D/t = 2). Caution above 40 and not applicable above 100, the D/t convention of the beam and torsion tube screens; it names local (shell) buckling of the tube wall. The configured ranges cap D/t at 80, so the not-applicable level is defense in depth.
- CBK-13 No plasticity screen on P/A: inside the Euler range the column buckles elastically at σ_E ≤ σ_y/2, so a design whose P/A exceeds yield also fails buckling, and P/A is checked directly against the allowable. Rationale in design.md.
- CBK-14 Always-listed unsupported effects: initial crookedness, load eccentricity and residual stresses (real columns buckle below the Euler load; the safety factor stands in for them); inelastic (Johnson) buckling (screened only); local buckling of thin walls (screened only); end conditions other than ideal pins and connection details; self-weight, lateral load and combined bending; shear deformation; post-buckling behaviour, dynamic loads, fatigue and temperature.

## Verification and integration

- CBK-15 Purity and placement (MM-08): `challenge/column/`, `geometry/column/`, `physics/column/`, `evaluation/column/`, `evaluation/guided/column.ts`, `state/columnModel.ts`; v2 persistence and v2 design files (MM-18, MM-19); storage key `ei:session:column-buckling-1:v1`. No formulas in `src/ui` or `src/state`.
- CBK-16 Baseline difficulty (D-47): the baseline fails as many design checks as any valid, in-range design that is applicable without warnings, by exhaustive search over the step grid; the reference stays Accepted.
- CBK-17 Benchmarks: every worksheet row in design.md at 1e-9 relative; quadrature, finite-difference eigenvalue, Rayleigh upper bound, thin-wall, scaling (length squared) and boundary checks; invalid geometry rejected before analysis.
- CBK-18 Presentation (MM-20, D-26, D-45, D-48 amendment, D-56): Cantilever-style challenge panel (statement paragraph, VALUE / LIMIT list with text Pass/Fail, Test details, reference link, Run Test); solid/tube tiles with numeric fields and sliders; history/compare with stored values; a lazy 3D column with a main-bundle 2D elevation as fallback; nothing written on the 3D model; a light-bulb reference with typeset formulas, key points and a collapsed "what this model leaves out"; TechnicalArt kind `column` drawing a round column between two pinned ends with an axial load.
- CBK-19 Guided (D-49): single-variable experiments from a pure plan: grow the solid bar; switch to a tube; change only the wall; widen only the tube; then meet every check. Hints never state the reference dimensions or invent numbers. Parametric: everything editable, no steps.
- CBK-20 Gates: unit, property, worksheet, UI component and catalog guard tests; a Playwright spec on desktop and Pixel 7 (Guided keyboard entry with the 3D view, Parametric with the 2D fallback, prediction to the Accepted reference, axe, 320 px, reload persistence and isolation from Cantilever Beam I). Customer release still requires owner engineering review (29.2) and manual/student QA.
