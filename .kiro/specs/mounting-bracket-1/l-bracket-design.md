# Mounting Bracket I: bolted L-bracket (task 55)

Additive design note. It supersedes the stepped flat-bar model in `design.md` (`steppedBarBracket` v1, MB-07, K-1 to K-5) for the runnable challenge. The owner said the stepped arm was "not even a bracket". `design.md` and `requirements.md` stay as the history of 46.1/46.2.

## Identity and versioning

- Model `boltedLBracket` v1. This is a new id, because MM-01 says ids are never reused for a different formulation.
- Challenge `mounting-bracket-1` is now version 2. Under MM-04 the storage key becomes `ei:session:mounting-bracket-1:v2`.
  - Stepped-bracket saves under `…:v1` are never read or re-scored. They stay in local storage untouched.
  - If one is passed to the v2 restorer, it is rejected with "Saved session belongs to a different model".
  - Old v2 design files that name `steppedBarBracket` are rejected as "a different analysis model".

## Geometry

| Symbol | Meaning |
|---|---|
| t | Plate thickness |
| w | Width across the wall |
| H | Outer flange height, measured from the underside of the arm |
| r_i | Inner bend radius |
| r_o | Outer bend radius, r_i + t |

- The flange lies flat on the wall at x = 0, and the arm runs along y = 0 … t.
- The bend is a quarter annulus centred at (r_o, r_o).
- One row of n = 2 bolts sits at the edge distance e = 15 mm below the top of the flange.
- The load P = 200 N hangs at a = 120 mm from the wall face, from a pin that spans the arm width.
- The arm continues 15 mm beyond the load line.

## Design parameters

| Parameter | Range | Grid |
|---|---|---|
| Thickness | 3–10 mm | 0.5 mm |
| Width | 40–120 mm | 1 mm |
| Flange height | 50–150 mm | 5 mm |
| Inner bend radius | 1–12 mm | 0.5 mm |

The loader also checks two conditions:

- **BOLT_ROW_IN_BEND:** H_min − e − (r_i,max + t_max) > 0. The bolt row stays above the bend for every design in range.
- **WIDTH_BELOW_THICKNESS:** w_min ≥ t_max. Bending is about the thin axis.

## Model

**Bend stress**

- Statics gives M = P·a at the bend. This is an upper bound on the moment anywhere in the arm or the flange, conservative by at most r_o/a.
- Bend stress uses the Winkler–Bach curved-beam formula at the inner fibre, which is in tension because a hanging load opens the bend:
  - r_n = t / ln(r_o/r_i)
  - r_c = r_i + t/2
  - e = r_c − r_n
  - σ = M (r_n − r_i) / (w t e r_i)
- The curved-beam factor is k_i = σ / (6M / (w t²)).
- **Sources:**
  - Budynas & Nisbett, *Shigley's Mechanical Engineering Design*, "Curved Beams in Bending".
  - Young & Budynas, *Roark's Formulas for Stress and Strain*, ch. 9, Table 9.1 case 1, the solid rectangle.
- **Validity:** the formula is used only for R/c ≥ 1.2 (r_i ≥ 0.1 t), the sharpest ratio the table lists. The configured ranges guarantee this. The CURVED_BEAM_RANGE screen is defense in depth.
- The application's k_i matches the widely reproduced table values to three decimals at R/c = 1.2, 1.4, 1.6, 2, 3, 4, 6, 8 and 10: 2.888, 2.103, 1.798, 1.523, 1.288, 1.200, 1.124, 1.090 and 1.071.
- Edition, equation and table numbers still need checking against a printed copy in owner review (29.2).

**Bolt tension (heel rotation)**

- The bracket pivots about the heel, the point where the flange leaves the wall at y = r_o.
- Lever arm: h_b = H − e − r_o.
- Moments about the heel give T = P·a / (n·h_b) per bolt. The heel reaction equals the total bolt pull, and the bolts carry the vertical shear.
- This is the conventional rigid-bracket method. See Shigley on bolted joints, and the AISC Manual's conservative approach to bolts in tension from eccentric loads.
- Not modeled: preload, joint compliance, T-stub prying amplification, bolt shear and bearing, and the wall fixing.

**Deflection at the load line**

- δ = P a³/(3EI) + P a² h_b/(3EI), with I = w t³/12.
  - The first term treats the arm as a cantilever from the wall face; the bend is counted as straight arm.
  - The second term is the arm turning with the flange span between the heel and the bolt row. That span is simply supported and loaded by the end moment P·a: θ = M h_b/(3EI). This is from the Gere & Goodno deflection tables.
- Plate stiffening of wide brackets is neglected, which is conservative.

**Mass**

- m = ρ w [t(L_arm − r_o) + t(H − r_o) + (π/4)(r_o² − r_i²)]
- Bolt holes are neglected.

**Material**

Aluminum (educational nominal): E = 69 GPa, ρ = 2700 kg/m³, allowable stress 120 MPa, σ_y = 240 MPa.

## Screens

Thresholds are inclusive (REL_TOL).

| Code | Metric | Warning | Not applicable | Note |
|---|---|---|---|---|
| CURVED_BEAM_RANGE | 1.2/(R/c) | — | above 1 | |
| PLASTICITY | σ/σ_y | 0.8 | 1.0 | |
| LARGE_DEFLECTION | δ/a | 0.02 | 0.1 | |
| LEG_SPAN | t/h_b | 0.2 | 0.5 | See below |

- **LEG_SPAN:** Timoshenko shear deformation adds E/(4κG)·(t/h_b)² ≈ 0.8 (t/h_b)² to the flange end rotation, which is about 3 % at the warning level and 20 % at the not-applicable level.
- **Arm shear:** t/a ≤ 0.084, so arm shear deformation is below 0.6 % and has no screen.

## Checks and acceptance

| Check | Limit |
|---|---|
| Bend stress | ≤ 120 MPa |
| Deflection at the load | ≤ 2.4 mm |
| Bolt tension | ≤ 300 N per bolt |
| Mass | ≤ 175 g |
| Model applicability | Applicable |

- A design is Accepted only if it is applicable and passes every check.
- The prediction metric is bend stress.

## Baseline and reference

**Baseline** (t 3, w 120, H 55, r_i 1 mm): wide thin sheet, a sharp bend and a short flange.

| Check | Value | Limit | Result |
|---|---|---|---|
| Bend stress | 231.0 MPa | 120 MPa | Fail |
| Deflection | 8.04 mm | 2.4 mm | Fail |
| Bolt tension | 333 N | 300 N | Fail |
| Mass | 180.7 g | 175 g | Fail |
| Applicability | Applicable | | Pass |

- The baseline carries warnings for plasticity (0.962) and large deflection (0.067).
- Applicability is deliberately left passing. A not-applicable baseline would make all of its results untrustworthy.

**Reference** (t 7, w 40, H 80, r_i 6 mm) passes every check:

| Check | Value | Limit |
|---|---|---|
| Bend stress | 97.7 MPa | 120 MPa |
| Deflection | 2.09 mm | 2.4 mm |
| Bolt tension | 231 N | 300 N |
| Mass | 154.2 g | 175 g |

**Trade-offs**

- No single-parameter change from the baseline is Accepted.
- Making everything maximal fails only the mass limit.
- A taller flange cuts the bolt tension but adds deflection and mass.
- A larger r_i lowers k_i but raises the heel, which shortens h_b.
- A thicker plate cuts the stress and deflection, but raises k_i and the mass.

## Verification

- `test/fixtures/bracket.ts` holds twelve worksheet rows from a standalone script, at 1e-9.
- `test/fixtures/bracket.alternative.test.ts` checks the model by independent routes:
  - Winkler's hypothesis solved by quadrature and bisection.
  - Roark k_i spot values.
  - Curvature double integration by shooting, and virtual work.
  - Full rigid-body equilibrium.
  - Shoelace mass from the outline.
