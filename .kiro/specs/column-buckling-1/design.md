# Column Buckling I: model design and benchmark worksheet (task 68)

Companion to requirements.md, 2026-10-19. The worksheet numbers come from `worksheet.py`, a standalone Python script written from the equations below without reading or importing application code (`python3 -I .kiro/specs/column-buckling-1/worksheet.py`). It is a separate numeric source, not human engineering review.

## Why this scope

The brief suggested a slender column with a hollow tube and a fixed length. Choices made, and why:

- **Pinned–pinned, K = 1.** The fundamental Euler case; no end-condition factor to explain beyond "the length between the pins".
- **Aluminium, 2 m, 10 kN, required safety factor 2.** With steel at this scale (E 200 GPa, σ_y 250 MPa, λ_c ≈ 126) the efficient tubes sit in the intermediate range, so most good designs would be "model not applicable". Aluminium (λ_c ≈ 75) keeps a wide band of slender, efficient tubes: 117 Accepted grid designs, 54 of them without any caution. The material record matches Mounting Bracket I's educational aluminium.
- **Solid bar or tube, two dimensions at most.** The solid/tube choice makes "a tube beats a solid bar of equal mass" a direct experiment. Wall thickness (not inner diameter) is the tube's second dimension because students reason about walls more easily.
- **Length fixed.** The building sets the length; making it editable would turn the challenge into "shorten the column". The length-squared lesson is taught in the reference dialog formula and key points, the statement wording and the model tests (doubling the length quarters P_cr), not as an experiment. Owner question Q1 asks whether a later edition should add a mid-height brace.

## Model `eulerColumnBuckling` v1

Straight, prismatic, homogeneous, linear-elastic column; concentric axial load; ideal pins at both ends; small-deflection bifurcation buckling. A circle has the same I about every axis, so there is no weak-axis choice.

- Section (d = D − 2t for the tube, d = 0 for the solid bar): A = π(D² − d²)/4, I = π(D⁴ − d⁴)/64, r = √(I/A).
- Effective length KL with K = 1 (pinned–pinned; theoretical values for other end conditions are not offered). Slenderness λ = KL/r.
- Euler critical load P_cr = π²EI/(KL)². Safety factor n = P_cr/P. Euler stress σ_E = P_cr/A = π²E/λ².
- Axial stress σ = P/A. Mass m = ρAL. Specific critical load P_cr/m (comparison only).
- Johnson transition slenderness λ_c = √(2π²E/σ_y): the Euler and Johnson curves meet at σ_E = σ_y/2. Below λ_c the Johnson parabola governs and the Euler load is unconservative.

Sources (names only; edition and equation numbers pending engineering review): Budynas & Nisbett, *Shigley's Mechanical Engineering Design*, columns with central loading (Euler column formula, end-condition constants, the Euler–Johnson transition slenderness); Gere & Goodno, *Mechanics of Materials*, and Timoshenko & Gere, *Theory of Elastic Stability*, buckling of pinned-end columns and of thin cylindrical shells; Hibbeler, *Mechanics of Materials*, buckling of columns. The D/t screen follows the convention of the existing beam and torsion tube screens; Young & Budynas, *Roark's Formulas for Stress and Strain*, discusses the large scatter of thin-cylinder buckling under axial load.

### Checks and units

| Id | Value | Limit | Sense | Unit |
|---|---|---|---|---|
| buckling | P_cr | n_req · P = 2.0 × 10 kN = 20 kN | at least | N |
| axialStress | P/A | 120 MPa | at most | Pa |
| mass | ρAL | 2.5 kg | at most | kg |
| applicability | 1/0 | 1 | | bool |

Utilization is demand over capacity for every numeric check: value/limit for maxima and limit/value for the minimum, so > 1 always means failing. Margins: massUsage = m/m_max, bucklingMargin = 1 − n_req·P/P_cr, stressMargin = 1 − σ/σ_allow.

### Applicability

| Code | Metric | Caution above | Not applicable above |
|---|---|---|---|
| EULER_RANGE | σ_E/σ_y | 0.4 | 0.5 (λ < λ_c ≈ 75.3) |
| WALL_SLENDERNESS | D/t (solid: 2) | 40 | 100 |

Inclusive on the safe side: a metric equal to a threshold (within REL_TOL) raises nothing. Local buckling note: the classical elastic stress of a thin cylinder under axial load is about 1.21 E t/D (ν = 0.3); at D/t = 100 that is about 835 MPa for this aluminium, still above the largest Euler stress the model accepts (σ_y/2 = 120 MPa) even with a knockdown of 0.2 for imperfection sensitivity. The 40/100 levels are therefore a conservative educational screen, not a local-buckling calculation (owner question Q3).

### Why no plasticity screen on P/A

Inside the Euler range σ_E ≤ σ_y/2. If P/A > σ_y then P > σ_y A > σ_E A = P_cr, so buckling fails too; the axial stress is checked directly against the allowable. In the other direction, a design that is applicable and passes buckling has A ≥ n_req P / σ_E ≥ 2 n_req P / σ_y, so P/A ≤ σ_y/(2 n_req) = 60 MPa, half the allowable. **The axial-stress check can only fail together with buckling**: strength never governs a slender column. That is the lesson, and a property test checks it.

## Configuration sketch

```json
{
  "id": "column-buckling-1", "version": 1, "title": "Column Buckling I",
  "model": { "id": "eulerColumnBuckling", "version": 1 },
  "difficulty": "introductory", "allowedModes": ["guided", "parametric"],
  "material": { "id": "al-educational", "name": "Aluminum (educational nominal)",
    "elasticModulusPa": 69e9, "densityKgM3": 2700, "allowableStressPa": 120e6, "yieldStressPa": 240e6 },
  "lengthM": 2.0, "support": "pinnedPinned",
  "load": { "forceN": 10000, "direction": "down", "location": "centroid" },
  "initialDesign": { "id": "baseline", "section": { "kind": "solid", "diameterM": 0.0245 }, "lengthM": 2.0, "materialId": "al-educational" },
  "referenceDesign": { "id": "reference", "section": { "kind": "tube", "outerDiameterM": 0.06, "wallThicknessM": 0.002 }, "lengthM": 2.0, "materialId": "al-educational" },
  "lockedFields": ["lengthM", "materialId", "forceN", "support"],
  "constraints": { "minBucklingSafetyFactor": 2, "maxAxialStressPa": 120e6, "maxMassKg": 2.5 },
  "sectionLimits": { "solid": { "diameterM": { "minM": 0.01, "maxM": 0.06, "stepM": 0.0005 } },
                     "tube": { "outerDiameterM": { "minM": 0.015, "maxM": 0.08, "stepM": 0.0005 },
                               "wallThicknessM": { "minM": 0.001, "maxM": 0.006, "stepM": 0.0005 } } },
  "sectionDefaults": { "tubeWallM": 0.003 },
  "allowedSections": ["solid", "tube"],
  "predictionPolicy": { "requiredOnIterations": [1, 3] }
}
```

## Worksheet (SI; E 69e9 Pa, ρ 2700 kg/m³, L = KL = 2 m, P = 10 kN, n_req 2, m_max 2.5 kg)

| Fixture | Section (mm) | I (m⁴) | P_cr (N) | σ_E/σ_y | P/A (Pa) | m (kg) | D/t | Expected |
|---|---|---|---|---|---|---|---|---|
| `baseline` | solid 24.5 | 1.7686187959967867e-08 | 3011.08545461132 | 0.026612752140691292 | 21211820.820244275 | 2.5457503369283194 | 2 | Not accepted: buckling, mass |
| `reference` | tube 60 × 2 | 1.5342281883071122e-07 | 26120.338607294863 | 0.2986480606742131 | 27440507.4296371 | 1.9678936382086483 | 30 | Accepted, no caution |
| `solid30` | solid 30 | 3.9760782021995816e-08 | 6769.300014304517 | 0.03990250216846673 | 14147106.05261292 | 3.8170350741115984 | 2 | Not accepted: buckling, mass |
| `tubeEqualMass` | tube 54.5 × 4.5 | 2.2268246864652213e-07 | 37911.84080233547 | 0.22347618020017404 | 14147106.052612921 | 3.817035074111598 | 12.11 | Not accepted: mass only (same mass as solid30, ×5.6006 P_cr) |
| `solid40` | solid 40 | 1.2566370614359172e-07 | 21394.33090940687 | 0.07093778163282975 | 7957747.154594767 | 6.785840131753953 | 2 | Not accepted: mass only |
| `thinSmallTube` | tube 15 × 1 | 1.083064067325081e-09 | 184.39238952545045 | 0.01746842872708432 | 227364204.4169933 | 0.23750440461138841 | 15 | Not accepted: buckling, axialStress |
| `eulerWarning` | tube 70 × 2 | 2.4716794361383076e-07 | 42080.509465712414 | 0.41037506674592034 | 23405138.6899846 | 2.307185644796345 | 35 | Accepted with EULER_RANGE caution |
| `eulerNotApplicable` | tube 80 × 2 | 3.72957313463566e-07 | 63496.23470602868 | 0.5398365182258342 | 20404479.88357631 | 2.6464776513840436 | 40 | Model not applicable (EULER_RANGE); also over mass |
| `wallWarning` | tube 60 × 1 | 8.067531394602256e-08 | 13735.02672927104 | 0.30875669455689103 | 53950828.16674406 | 1.0009114194337103 | 60 | Not accepted: buckling; WALL_SLENDERNESS caution |

Further worksheet values (all in `test/fixtures/column.ts`): areas, radii of gyration, slenderness, safety factors and specific loads per fixture as printed by the script; λ_c = 75.33274540746793.

Derived targets:

- Required I = n_req P (KL)²/(π²E) = 1.174738361070583e-07 m⁴. A solid bar needs d ≥ 39.3317 mm and m ≥ 6.561 kg, 2.6 × the mass limit, so **no solid bar can pass**.
- Stress fails only below A = 8.333e-05 m²; mass fails only above A = 4.630e-04 m². They can never fail together, so at most two design checks can fail.
- Prediction fixture baseline → reference: P_cr ratio 8.674725111933615 (increase).

## Baseline difficulty (D-47)

Exhaustive search over the configured grid (101 solid diameters, 131 × 11 tubes; 1542 designs): 1257 are applicable without a caution; the most design checks any of them fails is **2** (160 ties). Ties are of two kinds: buckling + axial stress (37: the 10 mm rod and 36 small tubes) and buckling + mass (123: 30 solid bars from 24.5 to 39 mm and 93 thick-walled tubes). Tie-break: the plausible column a student would try first, a solid bar, furthest from passing buckling among those failing buckling and mass: **solid Ø24.5 mm** (P_cr 3.01 kN against 20 kN required, mass 2.546 kg against 2.5 kg). Its axial stress is 21 MPa, 18 % of the allowable, which states the lesson at the start: strong enough, not stiff enough. A 10 mm rod as a 2 m column is a wire, so the buckling + stress ties are not used.

## Alternative-method and limiting checks (test code only)

- Quadrature: I = ∫ π r³ dr from d/2 to D/2 (composite Simpson) matches the closed form within 1e-12 for every row (script: ≤ 6.7e-16).
- Finite-difference eigenvalue: EI w'' + P w = 0, w(0) = w(L) = 0 on N interior points; the smallest eigenvalue of tridiag(−1, 2, −1)/h², found by inverse iteration, times EI converges to P_cr at O(h²) (script: 5.1e-6 at N = 400; the error ratio for N vs 2N is about 4).
- Rayleigh quotient with w = x(L − x): 12EI/L², an upper bound 1.2158542 × P_cr.
- Thin wall: π R_m³ t / I − 1 = −5.08e-3, −1.19e-3, −2.87e-4, −7.06e-5 at D 60 mm, t = 4, 2, 1, 0.5 mm (O(t²), always negative).
- Identities: a solid bar equals a tube with t = D/2 in A, I and r; for a solid bar r = D/4.
- Scaling: P_cr ∝ E and ∝ 1/L² (doubling the length gives exactly 0.25); σ independent of L and E; m linear in L.
- Boundaries: designs at a check limit or screen threshold (within REL_TOL) pass / raise nothing; a step beyond fails. Built through configured limits in tests.
- Invalid input: out-of-range, non-finite or non-positive dimensions, unknown section kinds and locked-field changes are rejected before analysis.

## Integration notes

- Pure modules per CBK-15; registration in `state/models.ts`, `state/runtimes.ts`, `ui/models/registry.ts`; bundled JSON; catalog card 007.
- UI `src/ui/models/column/`: tools (Solid bar / Hollow tube tiles, Diameter or Outer diameter and Wall thickness), challenge panel, results/compare, reference dialog, a lazy 3D view (`ColumnScene3D`) and a main-bundle SVG elevation (`ColumnElevation`) used when WebGL2 is missing, the chunk fails or the context is lost.
- Display only: the diameter is drawn exaggerated (×4) because a to-scale 60 mm × 2 m column is a line; the summary discloses it. The dashed half-sine is the buckling mode shape of the latest tested design; Euler theory gives the shape, not an amplitude, so the amplitude is fixed and disclosed as not to scale.

## Owner questions (OWNER_REVIEW_CHECKLIST.md §8)

- Q1: Length is fixed; should a later edition add a mid-height brace (K·L halved) to make the length-squared lesson an experiment?
- Q2: Constants: aluminium E 69 GPa, ρ 2700, allowable 120 MPa, yield 240 MPa; load 10 kN; length 2 m; required safety factor 2.0; mass limit 2.5 kg.
- Q3: Screens: EULER_RANGE caution 0.4 / limit 0.5 of yield; WALL_SLENDERNESS 40 / 100 (the beam/torsion convention, conservative for local buckling).
- Q4: Showing the minimum check as "value / ≥ limit" in the VALUE / LIMIT list.
- Q5: The tie-break for the baseline (solid Ø24.5 mm rather than a 10 mm rod failing stress).
- Q6: Sources: confirm the cited textbooks and add edition/equation numbers.
