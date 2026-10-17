# Mounting Bracket I — scoped model requirements (task 46.1)

Additive specification, 2026-10-17. Refines `../original-catalog/` MB-01–MB-07 under the shared contracts in `../multi-model-architecture/`. Fourth track in the D-38 delivery order. Status: specification and independently computed worksheet only. The model is not implemented, the card stays unavailable until 46.3, and owner engineering review (29.2) of constants, equations, thresholds and wording is pending. **The stress-concentration coefficients in design.md were transcribed from secondary copies. The owner must verify them against the printed Peterson/Roark edition before 46.2.**

## Identity, owner decisions and learning objective

- MBR-01: Challenge `mounting-bracket-1`, version 1, title Mounting Bracket I, intermediate difficulty, Guided/Parametric modes. Model `steppedBarBracket` version 1.
- MBR-02 Owner decisions (recorded 2026-10-17, closing MB-07):
  - (a) Use the stepped flat-bar cantilever. Nominal Euler–Bernoulli bending stress is multiplied by the published shoulder-fillet stress-concentration curve fit (Peterson's charts for a stepped flat bar with shoulder fillets in bending, as reproduced in Roark), and only inside the fit's validity range.
  - (b) Keep the catalog copy "Rethink a mounting bracket that carries more stress than it should." with the concepts Load paths and Stress concentrations. No copy change is required (OC-15).
  - "Load paths" is taught as the internal bending-moment path. M(x) = F(L − x) falls linearly from the wall to the tip, so the critical section can switch between the root and the step.
- MBR-03 Objective: learners find where the stress actually peaks: at the root, or at the shoulder, where a sharp fillet multiplies the local nominal stress by Kt. They reduce the peak by softening the fillet or moving the step outboard to where the moment is lower. Adding material everywhere is the wrong fix, because it breaks the mass limit. Guidance must say that Kt is a local elastic peak at the fillet. It does not change the moment, the deflection or the root stress.

## Fixed values and adjustable design

- MBR-04 Fixed (locked):
  - Length L 0.30 m and thickness b 10 mm, measured out of plane.
  - Educational nominal aluminum, the same record as Cantilever Beam I: E 69 GPa, ρ 2700 kg/m³, allowable stress 120 MPa, and yield 240 MPa for the plasticity screen only.
  - Static tip force 300 N, applied at the free end in the plane of the depth.
  - Rigid wall clamp at x = 0.
  - Locked fields: length, thickness, material, force, support.
- MBR-05 Adjustable:
  - Root depth D: 15–50 mm in 0.5 mm steps. The D range deliberately exceeds the 40 mm envelope (D-07 practice).
  - Arm depth d: 10–50 mm in 0.5 mm steps, with d ≤ D. d = D is a uniform bar; d > D is rejected before analysis.
  - Step location a: the distance from the wall to the shoulder, 60–240 mm in 5 mm steps, so the arm is always at least 60 mm long.
  - Fillet radius r: 0.5–10 mm in 0.5 mm steps.
  - Geometry: the step is symmetric, with opposite shoulder fillets and the arm centred on the root centreline. This is the geometry of the fit. One-sided (flush) steps are excluded.
- MBR-06 Initial design: D 30 mm, d 20 mm, a 150 mm, r 1 mm. Internal reference, never exposed to students: D 30 mm, d 20 mm, a 175 mm, r 3 mm. The reference is one feasible design, not the only one.

## Metrics and constraints

- MBR-07 Displayed metrics:
  - Peak stress in MPa, with its location (root or step).
  - Kt at the step, to two decimals, or "no step" for a uniform bar.
  - Nominal root stress, nominal step stress and step peak stress, in MPa.
  - Tip deflection in mm, to two decimals.
  - Mass in g.
  - Envelope (root) depth in mm.
  - h/r and D/d in the details view.
- MBR-08 Constraints, in order:
  - `peakStress` ≤ 120 MPa
  - `tipDeflection` ≤ 2.4 mm (stored as 0.0024 m)
  - `mass` ≤ 0.215 kg
  - `envelopeDepth` ≤ 40 mm (stored as 0.040 m)
  - `applicability` (bool)

  Units are Pa, m, kg, m and bool (existing MM-12 units). Inclusive comparisons use `withinLimit` with REL_TOL. Margins: massUsage, stressMargin, deflectionMargin. When the peak stress is undefined (MBR-13), `peakStress` is reported without a value and does not pass, and the status is `modelNotApplicable`.
- MBR-09 Prediction:
  - Checkpoints on iterations 1 and 3.
  - The primary metric is peak stress, named "peak stress" in the dialog.
  - Ratio band 0.98/1.02.
  - If either result has no peak stress, the outcome is not scorable (MM-13).
- MBR-10 Reflection prompt: "Using your tested designs, explain where the peak stress occurred, how the fillet radius and the step location changed it, and why adding material everywhere was not the answer."

## Model rules

- MBR-11 Peak and location:
  - σ_peak = max(σ_root, σ_step).
  - The location is `step` only if σ_step > σ_root (strict comparison of the computed values). Otherwise it is `root`, so ties go to root.
  - Kt applies only to the nominal stress at the step, never to the root stress or the deflection.
  - The step nominal stress uses the moment at the shoulder plane, x = a. This is conservative, because the fillet's peak lies slightly outboard, where the moment is lower.
- MBR-12 Uniform bar (D = d as stored values):
  - There is no step. Kt, the step nominal stress, step peak, h/r, D/d and the step-related screens are absent, never NaN.
  - The peak equals the root stress, and the location is `root`.
  - a and r stay in the design but have no effect on any output. The summary states "no step: stress concentration not applied".
  - All outputs equal the cantilever rectangle formulas FL³/(3EI) and 6FL/(bh²).
- MBR-13 Kt fit (design.md):
  - Kt = C1 + C2(2h/D) + C3(2h/D)² + C4(2h/D)³, with h = (D − d)/2 and coefficients Ci(h/r) from two published branches.
  - h/r = 2 (inclusive within REL_TOL) uses the lower branch.
  - Outside 0.1 ≤ h/r ≤ 20 the fit is undefined. The analysis then reports `modelNotApplicable` with no Kt, step peak or peak stress, and keeps the root stress, step nominal stress, deflection and mass.
  - The coefficients are model constants of `steppedBarBracket` v1. They are not challenge configuration. Any change after release requires a model version change (MM-04).

## Applicability and exclusions

- MBR-14 Screens (inclusive, REL_TOL). For screens with no warning band, the warning threshold equals the not-applicable threshold, so only the not-applicable level can fire.

  | Code | Metric | Warning | Not applicable | Why |
  | --- | --- | --- | --- | --- |
  | `KT_FIT_SHARP` | h/r | — | above 20 | Upper limit of the fit's range |
  | `KT_FIT_SHALLOW` | r/h | — | above 10 (h/r below 0.1) | Lower limit of the fit's range |
  | `KT_SHOULDER_LENGTH` | [2.0 − 2.05(r/d − 0.025)] / (a/D) | — | above 1.0 | The source's L/D validity condition, with L taken conservatively as a (design.md) |
  | `KT_STEP_RATIO` | D/d | above 1.5 | above 1.6 | Developer-proposed fit-reliability limit, not stated by the source; owner review |
  | `PLASTICITY` | σ_peak/σ_yield | above 0.8 | above 1.0 | Plasticity |
  | `DEPTH_SPAN` | D/L | above 0.1 | above 0.2 | Shear deformation (beam convention) |
  | `RECT_ASPECT` | D/b | above 8 | above 20 | Lateral-torsional buckling (beam convention). The ranges cap D/b at 5, so this is defense in depth |
  | `LARGE_DEFLECTION` | δ/L | above 0.02 | above 0.1 | Large deflection (beam convention) |

  Step-related screens are skipped for a uniform bar. `PLASTICITY` is skipped when no peak stress exists, because the design is already not applicable.
- MBR-15 Always-listed unsupported effects:
  - wall-clamp and bolt-hole stress concentrations
  - fastener and joint compliance
  - fatigue and notch sensitivity (Kt is the theoretical elastic factor; no Kf)
  - local yielding and stress redistribution (screened only)
  - 3D and out-of-plane loading, and torsion
  - lateral-torsional buckling (screened only)
  - shear deformation (screened only)
  - fillet–wall interaction (screened only)
  - the fillet's stiffness and mass (neglected; bounded in design.md)
  - one-sided steps
  - contact, self-weight, residual and manufacturing stresses
- MBR-16 Wording: Accepted means "meets this challenge's educational limits". Limiting the peak elastic stress to the allowable is the challenge's stated design rule. It is conservative for a ductile part under a single static load, and it is the basis normally used when fatigue matters. Guidance must not claim it is real-world approval.

## Verification and integration

- MBR-17 Benchmarks:
  - Implement every worksheet row in design.md at 1e-9 relative, plus the alternative-method, limiting, boundary and Kt spot checks listed there, at their stated tolerances.
  - Kt spot values against the transcribed polynomial are identical closed forms (1e-9). Comparisons with digitized chart readings use the looser stated tolerance.
  - Invalid geometry is rejected before analysis.
- MBR-18 Presentation:
  - The primary visualization is a main-bundle 2D SVG elevation, independent of Three.js. It shows the wall, the stepped outline with fillets from a geometry outline function, the load arrow, and the root and step sections.
  - A moment-diagram strip shows M(x) with both checked sections marked. The governing section is identified by text and shape, never by color alone.
  - A table gives the text equivalent.
  - An optional 3D extrusion is deferred to a 46.3 decision. If added, it follows D-26.
  - The prediction dialog and history name peak stress, never deflection.
- MBR-19 Guided content (MM-21):
  - Inspect: find which limit the baseline misses and where the peak occurs.
  - Experiment: change only the fillet radius, or only the step location, and predict the peak stress.
  - Compare: compare the peak location and mass across designs, including one where the root governs.
  - Explain: connect the moment path, Kt and mass using tested values, and name one unmodeled effect.

  Hints must not state reference dimensions or invent numbers.
- MBR-20 Gating:
  - 46.2 must not start implementing Kt until the owner records verification of the coefficient table, its validity conditions and branch rule against the printed source (design.md, open item K-1).
  - The card stays unavailable until 46.3 verifies the integrated learning loop on desktop and Pixel 7, with keyboard, fallback and axe gates.
  - Customer release also requires owner engineering review and manual/student QA.
