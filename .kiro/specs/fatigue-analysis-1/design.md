# Fatigue Analysis I — model design and calculation worksheet (task 70)

Companion to requirements.md, 2026-10-19. The worksheet below was produced by the standalone Python script in this folder (`fatigue_model.py`, `worksheet.py`; standard library only, run with `python3 -I worksheet.py`), written from the equations in this document without importing or reading application code. It is a separate numeric fixture source, not human engineering review.

## Why this scope

The brief suggested a rotating stepped shaft in fully reversed bending, possibly with a mean component. A rotating shaft only gets a mean stress from torque or axial load, which would need a second stress-concentration fit (torsion) and a second notch-sensitivity fit, doubling the correlations awaiting owner review. A **non-rotating stub-axle spindle under a fluctuating wheel load** gives a mean and an alternating bending stress at the same shoulder fillet, so one Kt fit, one notch-sensitivity fit and the modified Goodman line cover the whole lesson (fillet, surface finish, size, mean stress, finite life). The spindle is a real component that fails this way: the vehicle weight is the mean load and road bumps the alternating part. The non-rotating case also exercises a detail students miss: the size factor uses the equivalent diameter 0.370 d of a non-rotating round in bending.

## Model `steppedShaftFatigue` v1

Stress-life (high-cycle) screening of the shoulder fillet of a stepped round bar in bending.

**Geometry and loads**

| Symbol | Meaning |
|---|---|
| d, D | Neck and collar diameters |
| r | Shoulder fillet radius |
| h = (D − d)/2 | Shoulder height |
| L_D = 40 mm, L_d = 60 mm | Collar and neck lengths |
| a = 50 mm | Distance from the shoulder to the wheel load |
| F_m = 3000 N, F_a = 2000 N | Mean and alternating load (1 kN to 5 kN) |

- Bending at the shoulder: M_m = F_m·a, M_a = F_a·a.
- Nominal stresses at the neck: σ_m,0 = 32 M_m/(π d³), σ_a,0 = 32 M_a/(π d³).

**Stress concentration (Roark polynomial fit).** With x = 2h/D and s = √(h/r):

- Kt = C1 + C2·x + C3·x² + C4·x³
- For 0.1 ≤ h/r ≤ 2.0: C1 = 0.947 + 1.206 s − 0.131 h/r, C2 = 0.022 − 3.405 s + 0.915 h/r, C3 = 0.869 + 1.777 s − 0.555 h/r, C4 = −0.810 + 0.422 s − 0.260 h/r.
- For 2.0 < h/r ≤ 20.0: C1 = 1.232 + 0.832 s − 0.008 h/r, C2 = −3.813 + 0.968 s − 0.260 h/r, C3 = 7.423 − 4.868 s + 0.869 h/r, C4 = −3.839 + 3.070 s − 0.600 h/r.
- Nominal stress 32M/(πd³) at the small diameter. The alternative-method checks below show the jump between the two ranges at h/r = 2 stays below 1.2 % for every configured shoulder (2h/D ≤ 2/3).

Source: Young, Budynas & Sadegh, *Roark's Formulas for Stress and Strain*, stress-concentration table, "shoulder fillet in stepped circular shaft", bending (the coefficients above were transcribed from the publisher's stress-concentration chapter, Table 6-1 case 2b; Roark states these fits are taken from the Peterson collection, Pilkey & Pilkey, *Peterson's Stress Concentration Factors*). Owner review items: (1) Rogers & Fleming (ASEE Midwest Section 2025) quote revised coefficients for 0.25 ≤ h/r ≤ 2.0 from a later Roark edition (C1 = 0.927 + 1.149 s − 0.086 h/r, …); the owner must choose the edition. (2) The fit is not a chart reading: for D/d = 50/35 and r/d = 3/35 a Shigley 11th-edition worked solution reads Kt ≈ 1.7 from the bending chart, while the fit gives 1.806 (about 6 % higher, conservative). Edition and equation numbers pending engineering review.

**Notch sensitivity and fatigue notch factor.** Neuber's form with Shigley's fit of the Neuber constant for steels in bending (Sut in MPa, √a in √mm, 340 ≤ Sut ≤ 1700 MPa):

- √a = 1.24 − 2.25·10⁻³ Sut + 1.60·10⁻⁶ Sut² − 4.11·10⁻¹⁰ Sut³
- q = 1/(1 + √a/√r), r in mm
- Kf = 1 + q (Kt − 1), applied to both σ_a,0 and σ_m,0 (Shigley's convention for ductile materials while the notch does not yield, which `LOCAL_YIELD` enforces): σ_a = Kf σ_a,0, σ_m = Kf σ_m,0.

Check: a Shigley 11th-edition worked solution with Sut = 470 MPa and r = 3 mm gives √a = 0.4933 and q = 0.78; the script gives 0.493269 and 0.778338.

**Endurance limit (Marin).** Se = ka·kb·kc·kd·ke·Se′ with

- Se′ = 0.5 Sut (Sut ≤ 1400 MPa, loader rule).
- Surface factor ka = a·Sut^b (Sut in MPa): ground a = 1.38, b = −0.067; machined or cold-drawn a = 3.04, b = −0.217; as-forged a = 54.878 (the published kpsi form 12.7·Sut^−0.758 converted to MPa: 12.7 × 6.894757^0.758 = 54.8783564212633), b = −0.758. These are the coefficients of the current Shigley edition as used in the publisher's 11th-edition chapter 6 worked solutions (earlier editions list different values). Hot-rolled is omitted because its current coefficients were not verified.
- Size factor for a **non-rotating** round in bending: equivalent diameter d_e = 0.370 d, kb = 1.24 d_e^−0.107 for 2.79 ≤ d_e ≤ 51 mm (1.51 d_e^−0.157 above, never reached: d_e ≤ 14.8 mm).
- kc = 1 (bending), kd = 1 (room temperature; temperature not modeled), ke = 0.897 (90 % reliability, Shigley's reliability table: 50 % 1.000, 90 % 0.897, 95 % 0.868, 99 % 0.814, 99.9 % 0.753).

**S-N line (Basquin) and finite life.**

- f = 1.06 − 2.8·10⁻³ S + 6.9·10⁻⁶ S² with S = Sut in kpsi (Shigley's fit of the fraction of Sut at 10³ cycles, 70 ≤ S ≤ 200 kpsi). For Sut = 630 MPa (91.374 kpsi) f = 0.861762675002838. The fit reproduces the f values used in the 11th-edition worked solutions (0.87 at 570 MPa, 0.82 at 120 kpsi, 0.79 at 1100 MPa).
- a_B = (f Sut)²/Se, b_B = −(1/3) log₁₀(f Sut/Se); S_f(N) = a_B N^b_B for 10³ ≤ N ≤ 10⁶, so S_f(10³) = f Sut and S_f(10⁶) = Se.
- Fatigue strength at the target life: S_t = S_f(N_t), N_t = 2×10⁵ cycles.

**Mean stress (modified Goodman) and checks.**

- Fatigue safety factor at the target life: n_f = 1/(σ_a/S_t + σ_m/Sut).
- Equivalent completely reversed stress σ_rev = σ_a/(1 − σ_m/Sut) (σ_m < Sut, always true in range); predicted life N = (σ_rev/a_B)^(1/b_B) when Se < σ_rev ≤ f Sut ("finite"), infinite when σ_rev ≤ Se, and below 10³ cycles (`LOW_CYCLE`, not applicable) otherwise. N ≥ N_t ⇔ n_f ≥ 1, so the required n_f = 1.3 is a margin on stress at the target life.
- First-cycle yield: n_y = Sy/(σ_a + σ_m) with Kf applied (Shigley's shaft convention).
- Shoulder face: s = h − r. Mass: m = ρ (π/4)(D² L_D + d² L_d), fillet volume neglected (< 0.5 %).

Sources for this section: Budynas & Nisbett, *Shigley's Mechanical Engineering Design* (fatigue chapter: endurance limit, Marin factors, notch sensitivity, S-N line, modified Goodman, first-cycle yield; shafts chapter for applying Kf to the yield check); Peterson / Neuber for the notch-sensitivity concept as summarized by Roark. Edition and equation numbers pending engineering review.

## Challenge configuration (implemented)

`src/challenge/challenges/fatigue-analysis-1.json`. Correlation coefficients, the equivalent-diameter factor and the screen limits are model constants (`src/physics/fatigue/constants.ts`); any change is a model version change (MM-04). The config carries the challenge facts: material, load, lengths, reliability (percent and factor, checked against the constant table), target life, allowed finishes, design ranges, limits, baseline and reference.

| Check | Limit | Bound |
|---|---|---|
| Fatigue safety factor at 2×10⁵ cycles | 1.3 | ≥ |
| First-cycle yield safety factor | 1.5 | ≥ |
| Mass | 0.52 kg | ≤ |
| Shoulder face for the wheel hub | 2.5 mm | ≥ |
| Model applicability | Applicable | |

Design grid: d 20–40 mm by 0.5, D 30–60 mm by 0.5, r 0.5–5 mm by 0.25, three finishes (`python3 -I worksheet.py --grid`; valid means r < (D − d)/2): 111 606 valid designs, 106 449 applicable, 270 Accepted (197 ground, 73 machined, none as-forged). The most checks any valid applicable design fails is 3 (fatigue, yield, mass; 14 012 designs); failing the shoulder face as well needs a fillet too large for the screens or the mass to fail at the same time.

## Worksheet (SI and MPa; transcribed to `test/fixtures/fatigue.ts` at 15 significant figures)

Common values: Sut = 630 MPa, Sy = 530 MPa, f = 0.861762675002838, √a = 0.354770683 √mm, Se′ = 315 MPa.

| Row | d, D, r (mm), finish | Kt | q | Kf | σ_a, σ_m (MPa) | Se (MPa) | S_t (MPa) | n_f | n_y | Life | Face (mm) | Mass (kg) | Expected |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 22, 45, 1, as-forged | 2.35563 | 0.738132 | 2.00063 | 191.381, 287.072 | 116.035 | 166.236 | 0.622303 | 1.10774 | 6993.74 | 10.5 | 0.678438 | Not accepted: fatigue, yield, mass |
| reference | 24.5, 34, 2, machined | 1.81742 | 0.799449 | 1.65348 | 114.525, 171.788 | 207.732 | 259.844 | 1.40168 | 1.85112 | infinite | 2.75 | 0.507133 | Accepted |
| filletOnly | 22, 45, 5, as-forged | 1.42869 | 0.863067 | 1.36999 | 131.053, 196.580 | 116.035 | 166.236 | 0.908769 | 1.61766 | 108695.5 | 6.5 | 0.678438 | Not accepted: fatigue, mass |
| finishOnly | 22, 45, 1, ground | 2.35563 | 0.738132 | 2.00063 | 191.381, 287.072 | 250.848 | 300.287 | 0.914915 | 1.10774 | 48772.2 | 10.5 | 0.678438 | Not accepted: fatigue, yield, mass |
| neckOnly | 30, 45, 1, as-forged | 2.48338 | 0.738132 | 2.09493 | 79.033, 118.549 | 112.247 | 162.058 | 1.47961 | 2.68244 | infinite | 6.5 | 0.832326 | Not accepted: mass |
| collarOnly | 22, 34, 1, as-forged | 2.25484 | 0.738132 | 1.92624 | 184.265, 276.397 | 116.035 | 166.236 | 0.646337 | 1.15052 | 9505.57 | 5 | 0.464129 | Not accepted: fatigue, yield |
| referenceGround | 24.5, 34, 2, ground | 1.81742 | 0.799449 | 1.65348 | 114.525, 171.788 | 247.976 | 297.646 | 1.52103 | 1.85112 | infinite | 2.75 | 0.507133 | Accepted |
| referenceForged | 24.5, 34, 2, as-forged | 1.81742 | 0.799449 | 1.65348 | 114.525, 171.788 | 114.706 | 164.774 | 1.03335 | 1.85112 | 244692.5 | 2.75 | 0.507133 | Not accepted: fatigue |
| referenceSharp | 24.5, 34, 0.5, machined | 2.84947 | 0.665902 | 2.23157 | 154.565, 231.848 | 207.732 | 259.844 | 1.03858 | 1.37159 | 309172.2 | 4.25 | 0.507133 | Not accepted: fatigue, yield |
| crowdedShoulder | 24.5, 34, 4, machined | 1.53183 | 0.849340 | 1.45170 | 100.549, 150.824 | 207.732 | 259.844 | 1.59652 | 2.10842 | infinite | 0.75 | 0.507133 | Not accepted: shoulder face |
| allMax | 40, 60, 5, ground | 1.62804 | 0.863067 | 1.54204 | 24.542, 36.813 | 235.304 | 285.909 | 6.93128 | 8.63814 | infinite | 5 | 1.47969 | Not accepted: mass |
| fitRangeNA | 20, 60, 0.5, machined | 3.34903 | 0.665902 | 2.56422 | 326.487, 489.730 | 212.292 | 264.208 | 0.496754 | 0.649337 | — | 19.5 | 1.03578 | Model not applicable: KT_FIT_RANGE (h/r 40), LOCAL_YIELD, LOW_CYCLE |
| localYieldNA | 20, 40, 0.5, machined | 2.94530 | 0.665902 | 2.29538 | 292.257, 438.385 | 212.292 | 264.208 | 0.554935 | 0.725390 | — | 9.5 | 0.542553 | Model not applicable: LOCAL_YIELD, LOW_CYCLE (KT_FIT_RANGE exactly 1, inclusive) |

What the rows teach:

- No single change from the Baseline is Accepted. A generous fillet (filletOnly) or a ground surface (finishOnly) each raise n_f by about half but stay below 1; a 30 mm neck alone (neckOnly) passes fatigue even as-forged with a sharp fillet, but is 60 % over the mass limit.
- At the reference size, the surface finish alone moves n_f from 1.03 (as-forged) through 1.40 (machined) to 1.52 (ground), and a sharp 0.5 mm fillet (referenceSharp) drops it to 1.04 and fails the yield margin: the fillet and the finish matter as much as the size.
- A bigger fillet lowers Kt but eats the shoulder face the hub needs (crowdedShoulder): with D fixed, d + 2r is a shared budget.
- referenceForged survives the target life (2.4×10⁵ ≥ 2×10⁵ cycles, n_f 1.03) but has almost no margin, and the reference itself has infinite predicted life (σ_rev 157.5 MPa < Se 207.7 MPa): endurance limit versus finite life.

Prediction fixture: Baseline → reference gives r = 1.40168491090465/0.622303118562314 = 2.2524, an increase.

## Alternative-method and limiting checks (tests)

- Neuber constant and q against the Shigley worked solution (√a 0.4933, q 0.78 at 470 MPa, 3 mm), and Kt fit against the chart reading quoted above (documented difference, not an equality).
- Range continuity: the two Roark coefficient sets differ by at most 1.19 % at h/r = 2 for 2h/D ≤ 2/3 (script: 0.0118568886605593 at 2h/D = 0.667).
- Basquin end points: S_f(10³) = f Sut and S_f(10⁶) = Se to 1e-12; at the predicted life of the Baseline S_f(N) = σ_rev and the Goodman factor with S_f(N) equals 1.
- Nominal stress by quadrature of the second moment (substitution y = R sin t, composite Simpson): agreement 4.4e-16 relative.
- Monotonic trends on the grid: Kt decreases with r; q increases with r; ka(ground) > ka(machined) > ka(as-forged); Se increases from as-forged to ground; n_f increases with d at fixed D, r and finish.
- Boundaries: designs at a lower/upper limit pass and one step beyond fails (constructed through configured limits); screens at exactly 1 produce no issue (localYieldNA row has KT_FIT_RANGE = 1 exactly and keeps it applicable for that screen).
- Invalid input: r ≥ (D − d)/2, out-of-range values, non-finite values, unknown finish, changed material are rejected before analysis.

## Baseline (D-47) and reference

- Baseline d 22, D 45, r 1 mm, as-forged fails fatigue (n_f 0.62, predicted life 7.0×10³ of 2×10⁵ cycles), yield margin (1.11 < 1.5) and mass (0.678 kg), the maximum of 3; it is applicable without warnings. Tie-break among the 14 012 three-failure designs: keep clear of the `LOCAL_YIELD` screen (metric 0.90, not the 1.00 of the most extreme designs) so small edits do not flip the model to not applicable, while still far from passing fatigue, with plausible proportions (a thin neck under a bulky collar, a sharp forged fillet).
- Reference d 24.5, D 34, r 2 mm, machined: every check passes with margin (n_f 1.40, n_y 1.85, 0.507 kg, face 2.75 mm). Never shown to students.

## Integration

- Pure modules `src/{challenge,geometry,physics,evaluation}/fatigue/`, guided plan `src/evaluation/guided/fatigue.ts`, engine definition `src/state/fatigueModel.ts`, runtime and registry entries, UI `src/ui/models/fatigue/`, technical art kind `fatigue`.
- v2 persistence and `ei-design` v2. The analysis omits `predictedLifeCycles` (no key) outside the finite-life regime so saved results re-analyze key-for-key (MM-18).
