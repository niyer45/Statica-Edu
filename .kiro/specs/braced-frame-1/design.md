# Braced Frame I — model design and benchmark worksheet (task 49.1)

Companion to requirements.md, 2026-10-17. The worksheet and every check below were produced by standalone scripts written from the equations in this document, outside the repository and without application code. They used Python 3.13 with the standard library for the primary solver and NumPy only for cross-checks and the exhaustive search. They are a separate numeric fixture source, not human engineering review. Values are unrounded at the printed 15 significant digits.

## Model `pinJointedBracedFrame` v1

A 2D linear-elastic pin-jointed frame (truss idealization) with straight prismatic axial members, loads at the joints and small displacements: equilibrium is written on the undeformed geometry. Solved by the direct stiffness method.

**Template `oneBayTwoStorey`** (b = 4.0 m, h = 3.0 m, L_d = √(b² + h²) = 5.0 m, c = b/L_d = 0.8, s = h/L_d = 0.6):

| Joint | j1 | j2 | j3 | j4 | j5 | j6 |
| --- | --- | --- | --- | --- | --- | --- |
| (x, y) m | (0, 0) pin | (4, 0) pin | (0, 3) | (4, 3) | (0, 6) | (4, 6) |

| Member | col1L | col1R | col2L | col2R | beam1 | beam2 | diag1a | diag1b | diag2a | diag2b |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Joints | j1–j3 | j2–j4 | j3–j5 | j4–j6 | j3–j4 | j5–j6 | j1–j4 | j2–j3 | j3–j6 | j4–j5 |
| L (m) | 3 | 3 | 3 | 3 | 4 | 4 | 5 | 5 | 5 | 5 |
| Presence | fixed | fixed | fixed | fixed | fixed | fixed | toggle | toggle | toggle | toggle |

Loads: P_j3 = (+20 kN, 0), P_j5 = (+40 kN, −40 kN), P_j6 = (0, −40 kN). Only the six fixed members plus the present diagonals are assembled.

**Equations** (unit vector e = (c_m, s_m) from end i to end j, tension positive):

- k_m = E A_m/L_m. The element matrix in global coordinates is k_m v vᵀ with v = (−c_m, −s_m, c_m, s_m) on the DOFs (u_ix, u_iy, u_jx, u_jy). Assemble the 12 × 12 matrix K, delete the four support DOFs and solve K_ff u_f = P_f (8 × 8).
- Solver and mechanism detection: Cholesky factorization of K_ff with diagonal pivoting (at each step, pivot on the largest remaining diagonal entry). This is rank-revealing for the symmetric positive semidefinite K_ff. If any pivot is ≤ τ_p · max_i (K_ff)_ii with τ_p = 1e-9, the frame is a mechanism. After the solve, the residual ‖K_ff u_f − P_f‖₂/‖P_f‖₂ must be ≤ τ_r = 1e-9, and every u must be finite, or the frame is reported as a mechanism. A mechanism analysis stores mass but no u, N, R, drift or utilization. 49.2 may use an equivalent LDLᵀ with diagonal pivoting only if it keeps the same tolerance semantics and passes every mechanism and stable fixture.
- N_m = k_m [c_m (u_jx − u_ix) + s_m (u_jy − u_iy)]. Reactions: R = K u − P at the support DOFs.
- Drift: δ_1 = (u_j3x + u_j4x)/2 and δ_roof = (u_j5x + u_j6x)/2. Storey drift ratios are θ_1 = δ_1/h and θ_2 = (δ_roof − δ_1)/h. The primary metric is |δ_roof|; the constraint also uses |δ_roof|. δ_roof is positive in every stable design of the exhaustive search, ranging from 2.81880446108180 to 19.5029799037977 mm.
- Section (CHS, outer diameter D, wall t, d = D − 2t): A = π(D² − d²)/4, I = π(D⁴ − d⁴)/64, r = √(I/A), λ = L/r.
- Capacity: tension P_t = A f_y. Compression P_c = min(A f_y, P_E) with P_E = π² E I/L² (pinned ends, K = 1, full length, because crossing diagonals are not connected). Utilization u = |N|/P (P_t if N > 0 or the member is classified ≈ 0; otherwise P_c). Governing mode: tension yield, compression yield or Euler. In this catalog every compression member has λ ≥ 100.96 > λ_y = π√(E/f_y) = 88.8576587631673, so Euler always governs compression.
- Zero-force classification: |N| ≤ 1e-9 · max|N| ⇒ ≈ 0 (BFR-14).
- Mass: m = ρ Σ A_m L_m over present members only.
- `INELASTIC_BUCKLING` screen: λ_c = π√(2E/f_y) = 125.663706143592. For compression members with λ < λ_c, N_J = A f_y [1 − f_y λ²/(4π²E)] and u_J = |N|/N_J. The metric is max u_J; warning above 0.8, not applicable above 1.0. The Johnson parabola is a screen only. Design-code column curves, which also account for imperfections, are generally lower still, so the warning is deliberately conservative in message and not in acceptance.
- `LARGE_DRIFT` screen: the metric is max(|θ_1|, |θ_2|); warning above 0.01, not applicable above 0.02.

**Material and constants:** E = 200 GPa, f_y = 250 MPa, ρ = 7850 kg/m³. Limits: |δ_roof| ≤ 0.012 m, max u ≤ 1.0, m ≤ 200 kg.

**References** (exact edition, chapter and equation numbers are to be transcribed and checked against the source in 49.2; no page citation is claimed here): Hibbeler, *Structural Analysis* (method of joints; determinacy and stability of trusses; virtual work/unit-load method; force method of analysis). McGuire, Gallagher & Ziemian, *Matrix Structural Analysis* (direct stiffness method; truss element; treatment of supports; singularity/mechanisms). Timoshenko & Gere, *Theory of Elastic Stability* (Euler load of a pin-ended column; inelastic buckling discussion, used only as context for the screen). The Johnson parabola is a standard inelastic-column approximation; 49.2 must cite a source for its exact form or the owner may replace the screen.

## Section catalog (computed from D and t; ideal annulus, not transcribed from a standard's table)

| id | D × t (mm) | A (m²) | I (m⁴) | r (m) | kg/m | A f_y (N) | P_E 3 m (N) | P_E 4 m (N) | P_E 5 m (N) | λ 3/4/5 m | D/t |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CHS48.3x3.2` | 48.3 × 3.2 | 4.53394651766079e-4 | 1.15856502109101e-7 | 0.0159853448508313 | 3.55914801636372 | 113348.66294152 | 25410.1742913511 | 14293.223038885 | 9147.66274488641 | 187.671897478269 / 250.229196637692 / 312.786495797116 | 15.09 |
| `CHS60.3x4.0` | 60.3 × 4.0 | 7.07486665588421e-4 | 2.81729149462297e-7 | 0.0199552311437377 | 5.55377032486911 | 176871.666397105 | 61790.1167432945 | 34756.9406681031 | 22244.442027586 | 150.336519702076 / 200.448692936101 / 250.560866170126 | 15.08 |
| `CHS76.1x4.0` | 76.1 × 4.0 | 9.06035321295297e-4 | 5.90554954964426e-7 | 0.0255303985476138 | 7.11237727216808 | 226508.830323824 | 129523.195168934 | 72856.7972825253 | 46628.3502608162 | 117.506978765139 / 156.675971686853 / 195.844964608566 | 19.03 |
| `CHS88.9x5.0` | 88.9 × 5.0 | 1.31789811818092e-3 | 1.16373863317935e-6 | 0.0297157576043418 | 10.3455002277202 | 329474.529545229 | 255236.443016548 | 143570.499196808 | 91885.1194859573 | 100.956537603526 / 134.608716804701 / 168.260896005877 | 17.78 |

The dimensions resemble common hot-finished CHS sizes, but the properties come from the formulas above and are labeled educational nominal. Only the two larger sections at 3 m fall below λ_c, so they are the only members the `INELASTIC_BUCKLING` screen can affect.

## Proposed configuration sketch

```json
{
  "id": "braced-frame-1", "version": 1, "title": "Braced Frame I",
  "model": { "id": "pinJointedBracedFrame", "version": 1 },
  "difficulty": "advanced", "allowedModes": ["guided", "parametric"],
  "statement": "… This frame is modeled as pin-jointed: every joint is a hinge, so members carry only tension or compression. …",
  "material": { "id": "steel-educational", "name": "Steel (educational nominal)",
    "elasticModulusPa": 200e9, "yieldStressPa": 250e6, "densityKgM3": 7850 },
  "frame": { "template": "oneBayTwoStorey", "bayWidthM": 4.0, "storeyHeightM": 3.0 },
  "loads": [ { "jointId": "j3", "fxN": 20000, "fyN": 0 },
             { "jointId": "j5", "fxN": 40000, "fyN": -40000 },
             { "jointId": "j6", "fxN": 0, "fyN": -40000 } ],
  "sections": [
    { "id": "CHS48.3x3.2", "label": "CHS 48.3 × 3.2", "outerDiameterM": 0.0483, "wallM": 0.0032 },
    { "id": "CHS60.3x4.0", "label": "CHS 60.3 × 4.0", "outerDiameterM": 0.0603, "wallM": 0.004 },
    { "id": "CHS76.1x4.0", "label": "CHS 76.1 × 4.0", "outerDiameterM": 0.0761, "wallM": 0.004 },
    { "id": "CHS88.9x5.0", "label": "CHS 88.9 × 5.0", "outerDiameterM": 0.0889, "wallM": 0.005 } ],
  "initialDesign": { "id": "baseline", "materialId": "steel-educational",
    "members": { "col1L": { "sectionId": "CHS60.3x4.0" }, "…": "every fixed member CHS60.3x4.0",
      "diag1a": { "present": false, "sectionId": "CHS60.3x4.0" }, "diag1b": { "present": true, "sectionId": "CHS60.3x4.0" },
      "diag2a": { "present": false, "sectionId": "CHS60.3x4.0" }, "diag2b": { "present": true, "sectionId": "CHS60.3x4.0" } } },
  "referenceDesign": { "id": "reference", "…": "see requirements BFR-05" },
  "lockedFields": ["frame", "supports", "loads", "materialId", "fixedMembers"],
  "constraints": { "maxRoofDriftM": 0.012, "maxUtilization": 1.0, "maxMassKg": 200 },
  "solver": { "pivotRelTol": 1e-9, "residualRelTol": 1e-9, "zeroForceRelTol": 1e-9 },
  "predictionPolicy": { "requiredOnIterations": [1, 3] },
  "visualization": { "displacementExaggeration": 50, "maxVisualDisplacementM": 0.6 }
}
```

Field names are indicative; 49.2 fixes them in the zod schema. The joint and member topology belongs to the model's template, not to the config, so v1 accepts exactly one template. Config validation rejects non-positive dimensions, t ≥ D/2, duplicate or unknown section ids, loads on unknown or support joints, and non-finite numbers. Design validation rejects unknown or missing member ids, unknown section ids, a non-boolean `present`, a `present` key on a fixed member, and locked-field changes. Every diagonal combination is valid.

Analysis result sketch: `{ modelId, modelVersion, status: 'solved' | 'mechanism', massKg, applicable, warnings, notApplicableReasons, assumptions, unsupportedEffects }`. When the status is `solved`, add `{ displacementsM: {j3..j6: {x, y}}, members: {id: {forceN, sense, capacityN, mode, utilization, slenderness}}, reactionsN: {j1, j2}, floorDriftM, roofDriftM, storeyDriftRatios: [θ1, θ2], maxUtilization, governingMemberId, maxInelasticRatio }`. Keys for a mechanism are absent, not null (MM-10).

## Worksheet (SI, unrounded; E = 200e9 Pa, f_y = 250e6 Pa, ρ = 7850 kg/m³, loads as above)

Designs (section id shorthand 48 = CHS48.3x3.2, 60 = CHS60.3x4.0, 76 = CHS76.1x4.0, 89 = CHS88.9x5.0; an absent diagonal is not listed). Members are given in the order col1L, col1R, col2L, col2R, beam1, beam2, then the present diagonals:

- `baseline`: all 60, with diag1b and diag2b.
- `reference`: 48, 89, 60, 76, 76, 76, diag1a 76, diag2a 48.
- `uniformS3Tension`: all 76, with diag1a and diag2a.
- `bucklingBeam`: the reference with beam2 = 60.
- `lightLowerDiagonal`: the reference with diag1a = 48.
- `xBracedLight`: 48, 76, 48, 60, 48, 48, diag1a 60, diag1b 76, diag2a 48, diag2b 76. This is the lightest strength-feasible design with X bracing in both storeys.
- `lowerXUpperSingle`: the reference plus diag1b 76.
- `mixedLight`: 48, 76, 48, 60, 60, 48, diag1a 48, diag2b 89. This is the lightest accepted design in the exhaustive search.
- `bruteForce`: all 89, with all four diagonals.
- Mechanisms use the reference sections: `upperUnbraced` (diag1a only), `unbraced` (none), `lowerXOnly` (diag1a + diag1b) and `upperXOnly` (diag2a + diag2b).

| Fixture | Status | Mass (kg) | Roof drift (m) | Floor-1 drift (m) | Max storey drift ratio | Max u (member) | Max u_J | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | solved | 166.613109746073 | 0.00871924560566722 | 0.00443471255728971 | 0.00147823751909657 | 3.37162873795576 (diag1b) | none (no compression member has λ < λ_c) | Not accepted: utilization only (Euler buckling of diag1b, diag2b; col1R 1.13) |
| `reference` | solved | 189.969032143367 | 0.0103833770829032 | 0.0042307223126149 | 0.00205088492342945 | 0.823533317932313 (beam1) | 0.549106807468971 | Accepted, no warning |
| `uniformS3Tension` | solved | 213.371318165042 | 0.00967815469651219 | 0.00467696998163597 | 0.00166706157162541 | 0.887871858395775 (col1R) | 0.902104040841882 | Not accepted: mass only; INELASTIC_BUCKLING warning |
| `bucklingBeam` | solved | 183.734604354171 | 0.010507274871442 | 0.00423072231261489 | 0.00209218418627571 | 1.1508492758889 (beam2, Euler) | 0.549106807468971 | Not accepted: utilization only |
| `lightLowerDiagonal` | solved | 172.202885864345 | 0.0129658949564483 | 0.00681324018615991 | 0.0022710800620533 | 0.823533317932313 (beam1) | 0.549106807468972 | Not accepted: roofDrift only |
| `xBracedLight` | solved | 204.514879448049 | 0.00488079468697318 | 0.00219573515244064 | 0.000895019844844177 | 0.967234281408341 (diag1b) | 0.689832501636244 | Not accepted: mass only |
| `lowerXUpperSingle` | solved | 225.530918504207 | 0.00809335099266114 | 0.00189556580467987 | 0.00206592839599376 | 1.03380898377513 (diag1b) | 0.549106807468971 | Not accepted: utilization, mass |
| `mixedLight` | solved | 165.328245474645 | 0.00871453006857754 | 0.00687995285737854 | 0.00229331761912618 | 0.887871858395774 (col1R) | 0.90210404084188 | Accepted; INELASTIC_BUCKLING warning |
| `bruteForce` | solved | 413.820009108808 | 0.00295451518314216 | 0.00133735679236932 | 0.000539052796924279 | 0.514701278012485 (diag1b) | 0.388190384584055 | Not accepted: mass only |
| `upperUnbraced` | mechanism | 172.173292061548 | absent | absent | absent | absent | absent | Model not applicable (MECHANISM); never Accepted |
| `unbraced` | mechanism | 136.611405700708 | absent | absent | absent | absent | absent | Model not applicable (MECHANISM) |
| `lowerXOnly` | mechanism | 207.735178422389 | absent | absent | absent | absent | absent | Model not applicable (MECHANISM); `mass` also fails |
| `upperXOnly` | mechanism | 172.202885864345 | absent | absent | absent | absent | absent | Model not applicable (MECHANISM) |

Joint displacements (m):

| Fixture | j3 ux | j3 uy | j4 ux | j4 uy | j5 ux | j5 uy | j6 ux | j6 uy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 0.00386933087667907 | 0.000742063455801465 | 0.00500009423790035 | -0.00148412691160293 | 0.00871924560566722 | 0.000530045325572474 | 0.00871924560566722 | -0.00233219943251889 |
| `reference` | 0.00489294815072264 | -0.000330837603433816 | 0.00356849647450715 | -0.00130890239253168 | 0.0108248609749751 | -0.00117891012434978 | 0.0099418931908314 | -0.00246779760922024 |
| `uniformS3Tension` | 0.00533919581974372 | -0.000165556459526936 | 0.00401474414352822 | -0.00190389928455978 | 0.010119638588584 | -0.000827782297634684 | 0.00923667080444036 | -0.00306279450124833 |
| `bucklingBeam` | 0.00489294815072264 | -0.000330837603433818 | 0.00356849647450715 | -0.00130890239253168 | 0.0110726565520527 | -0.00117891012434978 | 0.00994189319083139 | -0.00246779760922024 |
| `lightLowerDiagonal` | 0.00747546602426766 | -0.000330837603433815 | 0.00615101434805217 | -0.00130890239253168 | 0.0134073788485201 | -0.00117891012434978 | 0.0125244110643764 | -0.00246779760922024 |
| `xBracedLight` | 0.00197887422261948 | 0.000564419647923024 | 0.00241259608226181 | -0.00145589815239674 | 0.00501860117600189 | 7.8549744331901e-05 | 0.00474298819794446 | -0.0024033235221524 |
| `lowerXUpperSingle` | 0.00213215872305261 | 0.000626040173783641 | 0.00165897288630713 | -0.000979709065218155 | 0.00853483488473298 | -0.00022203234713232 | 0.00765186710058931 | -0.00213860428190671 |
| `mixedLight` | 0.00716264369768387 | -0.00033083760343382 | 0.00659726201707322 | -0.00190389928455977 | 0.00871453006857754 | -0.00066167520686764 | 0.00871453006857754 | -0.00275197180547573 |
| `bruteForce` | 0.00127828451766506 | 0.000209151596823154 | 0.00139642906707359 | -0.000985933196357944 | 0.00303076983923599 | 9.54750936701193e-06 | 0.00287826052704833 | -0.00152699008186583 |

Member axial forces (N, tension positive; — means the member is absent). Determinate rows show the exact statics values; the stiffness solution matches them within 1.3e-15 × max|N| (check (a)):

| Fixture | col1L | col1R | col2L | col2R | beam1 | beam2 | diag1a | diag1b | diag2a | diag2b |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 35000 | -70000 | -10000 | -40000 | 40000 | 0 | — | -75000 | — | -50000 |
| `reference`, `uniformS3Tension`, `bucklingBeam`, `lightLowerDiagonal` | -10000 | -115000 | -40000 | -70000 | -60000 | -40000 | 75000 | — | 50000 | — |
| `mixedLight` | -10000 | -115000 | -10000 | -40000 | -20000 | 0 | 75000 | — | — | -50000 |
| `xBracedLight` | 17060.3233146662 | -87939.6766853337 | -14686.054382821 | -44686.054382821 | 9832.35857579365 | -6248.07251042798 | 29899.4611422229 | -45100.538857777 | 7810.09063803497 | -42189.9093619649 |
| `lowerXUpperSingle` | 18922.8844389473 | -86077.1155610528 | -40000 | -70000 | -21436.1540814037 | -40000 | 26795.1926017546 | -48204.8073982455 | 50000.0000000001 | — |
| `bruteForce` | 18376.0330578513 | -86623.9669421488 | -17537.1900826446 | -47537.1900826446 | 7785.12396694214 | -10049.5867768595 | 27706.6115702479 | -47293.3884297521 | 12561.9834710744 | -37438.0165289256 |

Utilizations (computed from the stiffness forces; compare at 1e-9 absolute):

| Fixture | col1L | col1R | col2L | col2R | beam1 | beam2 | diag1a | diag1b | diag2a | diag2b |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 0.197883588213724 | 1.13286725595314 | 0.161838179421877 | 0.647352717687507 | 0.226152672244256 | 0 | — | 3.37162873795576 | — | 2.24775249197051 |
| `reference` | 0.393543148714396 | 0.450562618099737 | 0.647352717687507 | 0.540443739893081 | 0.823533317932313 | 0.549022211954875 | 0.331112919053874 | — | 0.441116804578425 | — |
| `uniformS3Tension` | 0.0772062485561539 | 0.887871858395775 | 0.308824994224617 | 0.54044373989308 | 0.823533317932313 | 0.549022211954876 | 0.331112919053874 | — | 0.220741946035916 | — |
| `bucklingBeam` | 0.3935431487144 | 0.450562618099736 | 0.647352717687507 | 0.54044373989308 | 0.823533317932313 | 1.1508492758889 | 0.331112919053874 | — | 0.441116804578423 | — |
| `lightLowerDiagonal` | 0.393543148714396 | 0.450562618099737 | 0.647352717687507 | 0.540443739893081 | 0.823533317932313 | 0.549022211954875 | 0.661675206867636 | — | 0.441116804578425 | — |
| `xBracedLight` | 0.150511906112806 | 0.678949253611572 | 0.57795960840063 | 0.723190968686273 | 0.0867443719284671 | 0.437135311848837 | 0.169046075899425 | 0.967234281408341 | 0.068903244514357 | 0.904812396878191 |
| `lowerXUpperSingle` | 0.166944046342304 | 0.337244613440535 | 0.647352717687507 | 0.54044373989308 | 0.294223118239444 | 0.549022211954875 | 0.11829645918637 | 1.03380898377513 | 0.441116804578424 | — |
| `mixedLight` | 0.393543148714402 | 0.887871858395774 | 0.393543148714402 | 0.647352717687507 | 0.575424637944451 | 0 | 0.661675206867635 | — | — | 0.544157751328183 |
| `bruteForce` | 0.0557737591528411 | 0.33938714204904 | 0.0687095850239051 | 0.186247659310793 | 0.0236289098817073 | 0.0699975749410985 | 0.0840933337350572 | 0.514701278012485 | 0.0381273280469163 | 0.407443737771351 |

Reactions (N): in every solved fixture R_j1y = −35000 (uplift) and R_j2y = 115000. Global moment equilibrium fixes both: R_j2y = (20·3 + 40·6 + 40·4)/4 kN, and R_j1y = 80 kN − R_j2y. The horizontal split depends on topology: (R_j1x, R_j2x) = (0, −60000) for `baseline`; (−60000, 0) for the four tension-diagonal rows and `mixedLight`; (−23919.5689137783, −36080.4310862216) for `xBracedLight`; (−21436.1540814037, −38563.8459185964) for `lowerXUpperSingle`; (−22165.2892561983, −37834.7107438017) for `bruteForce`.

Test-only screen fixtures (constructed configs; never bundled):

- `mixedLight` with every load × 1.12: max u 0.994416481403267 (col1R), u_J 1.01035652574291, roof drift 0.00976027367680685 m, mass unchanged. Every constraint would pass, but the result is **modelNotApplicable (INELASTIC_BUCKLING)**: the screen dominates acceptance.
- `uniformS3Tension` with loads × 1.12: u_J 1.01035652574291, so modelNotApplicable (mass also fails).
- `baseline` with E = 20 GPa: max drift ratio 0.0147823751909657, LARGE_DRIFT warning. With E = 10 GPa: 0.0295647503819314, modelNotApplicable (LARGE_DRIFT). Utilization also changes because P_E ∝ E.

Prediction fixtures (|roof drift| ratio, band 0.98/1.02): baseline → reference r = 1.19085727739501, an **increase**: the accepted design is less stiff than the failing baseline. reference → bucklingBeam r = 1.01193232101171 (**same**). reference → lightLowerDiagonal r = 1.24871656426668 (increase). reference → bruteForce r = 0.284542799471949 (decrease). reference → upperUnbraced and upperUnbraced → reference are **not scorable** (`noFiniteMetric`).

## Design-space findings (exhaustive, per-member)

Every combination of the 16 diagonal sets and 4 sections per present member was enumerated: 2,359,296 designs in the 9 braced topologies, solved by batched dense NumPy LU, and 200,704 designs in the 7 topologies with an unbraced storey.

- **Stability:** all 200,704 unbraced-storey designs are mechanisms. Their pivoted-Cholesky smallest pivot ratio satisfies |ratio| ≤ 8.4e-16 (round-off, sometimes negative). All 2,359,296 braced designs are stable, with smallest pivot ratio ≥ 1.52423315467957e-2. τ_p = 1e-9 sits about 6 decades above the noise and 7 decades below the weakest genuine pivot. cond₂(K_ff) is 93.2 (reference), 78.4 (baseline) and 52.5 (xBracedLight).
- **Solvability:** 618 designs are Accepted: diag1a+diag2a 114, diag1a+diag2b 354, diag1b+diag2a 25, diag1b+diag2b 6, diag1a+diag2a+diag2b 115, diag1b+diag2a+diag2b 4, and 0 for both X-in-storey-1 topologies and for full X bracing. The lightest is `mixedLight` (165.328245474645 kg), which is lighter than the all-tension reference. Guidance must therefore not claim that tension diagonals are always lightest: what matters is following the forces. 434 of the 618 carry the INELASTIC_BUCKLING warning (col1R sized 76.1 × 4.0). No design is pushed from Accepted to not applicable by the screen.
- **Brute force fails:** heaviest everywhere with X bracing (`bruteForce`, 413.82 kg) and uniform 76.1 × 4.0 (`uniformS3Tension`, 213.37 kg) both fail mass only. Full X bracing cannot pass: its lightest strength-feasible design is `xBracedLight` at 204.514879448049 kg > 200 (owner question 2).
- **Drift matters:** for all-tension single diagonals, the strength-only lightest design (162.50 kg) drifts 13.86 mm > 12 mm, and 146 designs in that topology fail roof drift only. An inter-storey limit of 1/400 never fails alone (0 designs), so it is not a constraint (BFR-07). The largest storey drift ratio of any stable design is 0.00338560586893078, so LARGE_DRIFT is defense in depth.
- **P-Δ bound:** with gravity P = 80 kN above each storey and shears V₁ = 60 kN and V₂ = 40 kN, θ_i = P Δ_i/(V_i h) ≤ 2 × 0.00338560586893078 = 0.00677 for every design.

## Independent checks (actually run; measured agreement)

**(a) Method of joints, hand-derived statics, general joint loads (P_jx, P_jy).** Tension topology diag1a + diag2a (joints j5, j6, j3, j4 in that order): N_beam2 = −P5x, N_col2L = P5y, N_diag2a = (P6x + P5x)/c, N_col2R = P6y − s N_diag2a, N_beam1 = −P3x − c N_diag2a, N_col1L = N_col2L + s N_diag2a + P3y, N_diag1a = (P4x − N_beam1)/c, N_col1R = N_col2R − s N_diag1a + P4y. Reactions: R_j1 = (−c N_diag1a, −N_col1L − s N_diag1a), R_j2 = (0, −N_col1R). Under the configured loads this gives diag1a = 1.25(H1 + H2), diag2a = 1.25 H2, beam1 = −(H1 + H2), beam2 = −H2, col1R = −G − 0.75 H1 − 1.5 H2, and so on.

Compression topology diag1b + diag2b (j6, j5, j4, j3): N_beam2 = P6x, N_col2R = P6y, N_diag2b = −(P5x + N_beam2)/c, N_col2L = P5y − s N_diag2b, N_beam1 = P4x − c N_diag2b, N_col1R = N_col2R + s N_diag2b + P4y, N_diag1b = −(P3x + N_beam1)/c, N_col1L = N_col2L − s N_diag1b + P3y. Reactions: R_j1 = (0, −N_col1L), R_j2 = (c N_diag1b, −N_col1R − s N_diag1b).

Mixed diag1a + diag2b (j6, j5, j3, j4): the upper storey as in the compression topology, then N_beam1 = −P3x, N_col1L = N_col2L + P3y, N_diag1a = (P4x − N_beam1 − c N_diag2b)/c, N_col1R = N_col2R + s N_diag2b − s N_diag1a + P4y.

Measured max |N_statics − N_stiffness|/max|N|: baseline 7.76e-16, reference 8.22e-16, bucklingBeam 5.06e-16, lightLowerDiagonal 1.14e-15, uniformS3Tension 1.27e-15, mixedLight 1.14e-15. Reactions agree within 1.27e-15 relative. These rows also show that determinate forces do not depend on sections.

**(b) Unit-load (virtual work) displacements, Δ = Σ N n L/(E A),** using the hand statics above for n. The unit systems are ½ at j5 and ½ at j6 (roof drift), ½ at j3 and ½ at j4 (floor-1 drift), and 1 downward at j6. Relative agreement with the stiffness solution, roof / floor-1 / j6 vertical: reference 1.17e-15 / 4.10e-16 / 7.03e-16; baseline 7.96e-16 / 9.78e-16 / 1.86e-16; bucklingBeam 4.95e-16 / 4.10e-16 / 1.76e-16; lightLowerDiagonal 1.34e-15 / 7.64e-16 / 1.23e-15; uniformS3Tension 1.08e-15 / 1.11e-15 / 5.66e-16; mixedLight 1.79e-15 / 1.26e-15 / 6.30e-16. For example, the reference roof drift by virtual work is 0.0103833770829032 m.

**(c) Force method.** The primary structure is diag1a + diag2a. The redundants are X₁ = N_diag1b and X₂ = N_diag2b (one per X-braced storey). For a unit tension in diag1b, n₁ is the statics response to the load (c, −s) at j3, plus 1 in diag1b. For a unit tension in diag2b, n₂ is the response to (−c, s) at j4 and (c, −s) at j5, plus 1 in diag2b. The flexibility coefficients are f_ij = Σ n_i n_j L/(EA) and δ_i0 = Σ N₀ n_i L/(EA), with f X = −δ₀. The storeys couple only through beam1, which appears in both n₁ and n₂ with force −c, so f₁₂ = c² L_beam1/(EA)_beam1.

- `xBracedLight`: f = [[1.09030760052261e-7, 2.82314754930191e-8], [2.82314754930191e-8, 1.58738101224692e-7]] m/N and δ₀ = [0.00610842942263497, 0.00797040086044546] m, giving X = [−45100.5388577771, −42189.909361965] N against stiffness −45100.538857777 and −42189.9093619649. Max force deviation is 8.27e-16 × max|N|.
- `bruteForce`: f = [[5.58465020813516e-8, 9.7124351445829e-9], [9.7124351445829e-9, 6.55589372259345e-8]] and δ₀ = [0.00300478462285533, 0.00291373054337487], giving X = [−47293.3884297521, −37438.0165289256]. Deviation is 3.36e-16.
- `lowerXUpperSingle` (one redundant): f₁₁ = 8.53205583555159e-8 and δ₁₀ = 0.0041128610826384, giving X₁ = −48204.8073982454 against stiffness −48204.8073982455. Deviation is 7.61e-16.
- The roof drift of these indeterminate cases, recomputed by virtual work using the primary structure's unit-load system, agrees within 1.78e-15, 0 and 8.57e-16 relative respectively.

**(d) Equilibrium.** Global equilibrium holds for every solved fixture: |ΣF_x| and |ΣF_y| ≤ 7.3e-16 × 140 kN (the total applied load magnitude), and |ΣM_j1| ≤ 6.3e-16 × (140 kN × 6 m). Joint equilibrium recomputed from member forces at j3–j6 leaves a residual of at most 1.09e-10 N. The solve residual ‖K_ff u − P‖/‖P‖ is ≤ 1.8e-15.

**Further cross-checks.** A NumPy dense solve agrees with the pivoted Cholesky within 1.12e-15 relative. Doubling every load doubles u and N with zero measured difference. Doubling E halves u within 1.9e-15 and leaves N unchanged within 1.5e-15. Lateral and gravity loads superpose within 3.8e-16 (reference) and 2.1e-16 (xBracedLight). Under gravity only, the determinate reference has diagonals and beams at ≈ 0 (|N| ≤ 4e-12 N) and every column at −40 kN, while the X-braced design develops diagonal compression from column shortening (−9226.37973977006 N in diag1a/diag1b). The mirrored reference (diag1b + diag2b, mirrored sections, loads at j4/j6 in −x) reproduces the mirrored forces exactly and the roof drift with the opposite sign.

## Limiting, scaling and invalid cases for 49.2

- All 16 diagonal sets with arbitrary sections: a mechanism if and only if a storey has no diagonal (property test with random sections; the topology rule is the test oracle only). Mechanism results have no numeric keys besides mass and are never Accepted. Predictions involving them are not scorable.
- Determinate topologies: member forces are independent of the section choice and equal the statics formulas for random sections (all four single-diagonal combinations; the general-load formulas for diag1b + diag2a follow by mirroring those of the mixed case).
- Linearity in loads, u ∝ 1/E with N unchanged, superposition, mirror symmetry, and global/joint equilibrium within 1e-9 for random stable designs.
- Boundaries: roof drift, maximum utilization and mass equal to their limits within REL_TOL pass, and one step beyond fails (construct with configured limits in tests). INELASTIC_BUCKLING at exactly 0.8 and 1.0 and LARGE_DRIFT at exactly 0.01 and 0.02 produce no warning or not-applicable issue respectively (inclusive safe side).
- Zero-force members (beam2 in `baseline` and `mixedLight`) are classified ≈ 0 and have utilization within 1e-9 of 0, whatever the round-off sign.
- Invalid configs and designs listed under the configuration sketch are rejected before analysis. A mechanism is not an invalid design.

## Integration notes for 49.2/49.3

- Pure modules: `challenge/frame/` (types, schema), `geometry/frame/` (template, design, validation, edits `toggleDiagonal` and `setMemberSection`), `physics/frame/` (sections, stiffness, pivoted factorization, analyze, applicability, constants), and `evaluation/frame/` (constraints, evaluate, explanations, primary metric), registered in the state registry (MM-05). Fixtures go in `test/fixtures/frame.ts`, which must transcribe the tables above, not generate them from application code.
- New-model persistence uses envelope v2 and import `ei-design` v2 (MM-18/MM-19). Re-analysis on load must reproduce the mechanism status, not only the numbers.
- Explanation facts, from stored values only: the governing member and its mode and utilization; the change in the governing member between tests; the roof drift ratio; the mass delta; the storeys without a diagonal (topological fact) when the status is mechanism; and, for determinate designs, the fact that forces were unchanged by resizing.
- UI: the 2D SVG view is in the main bundle and serves as both the primary visualization and the fallback, so no lazy 3D chunk is required. The deformed shape uses the stored displacements × 50, capped so that the largest drawn displacement is ≤ 0.6 m (10% of frame height), and the factor is stated in text. Line patterns: tension solid, compression double or dashed, ≈ 0 dotted, each with a T/C/0 text label. Stroke width maps to the section index. No formulas live in UI or state.
- Copy and owner questions for 29.2 and OC-15:
  1. Only one load direction is analyzed (no reversal). Keep it, or add the mirrored load case, which would make compression-capable bracing essential?
  2. The 200 kg limit excludes full X bracing (lightest 204.51 kg). Keep it, or raise the limit? Note that 210 kg would still exclude uniform 76.1 × 4.0 (213.37 kg), by a small margin.
  3. The INELASTIC_BUCKLING screen uses the Johnson parabola at 0.8/1.0 and warns on 434 of the 618 accepted designs. Keep it, change the thresholds, or put a column curve in the capacity (a v2 model change)?
  4. Per-member sizing (10 selects) or grouped sizing?
  5. The "Stability" concept label: keep it with the idealization statement, or rename it (for example "Bracing and stability")?
  6. The roof drift limit is H/500, and inter-storey drift is display-only.
  7. Nominal capacities are used without resistance factors.
  8. Should a self-weight option be added in a later version?
