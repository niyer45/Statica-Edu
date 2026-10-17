# Heat Sink I — model design and benchmark worksheet (task 48.1)

Companion to requirements.md, 2026-10-17. The worksheet and checks come from a standalone Python script (`python3 -I`, run outside the repository) written from the equations below, without application code. It is a separate numeric fixture source, not human engineering review. HS-08 is resolved by the owner decision of 2026-10-17: a specified uniform effective coefficient, a minimum-gap constraint and an applicability screen.

## Model `plateFinHeatSink` v1

The model is steady, one-dimensional conduction and convection for a plate-fin heat sink.

**Geometry.** Fins are straight and rectangular, with thickness t and height H measured from the top of the base. Each fin spans the full base depth D. There are N fins, evenly spaced, with the outer fins flush with the base edges, so the exposed base strip between fins is (N − 1) s D.

**Heat path and boundary conditions.**
- Heat Q enters uniformly over the bottom (mounting) face of the base.
- It conducts through the base thickness t_b and leaves by convection, with one coefficient h to air at T∞, from both faces of every fin (including the outer faces of the end fins), the fin tips (through the corrected length) and the exposed base strips.
- Base side faces, fin end edges and the mounting face do not convect.

**Equations.** The fin perimeter is approximated as 2D, because D ≫ t.

| Quantity | Equation |
| --- | --- |
| Fin parameter | m = √(2h/(k t)) |
| Corrected fin length | L_c = H + t/2 |
| Fin efficiency | η_f = tanh(m L_c)/(m L_c) |
| Area of one fin | A_f = 2 D L_c |
| Exposed base area | A_b = W D − N t D |
| Total exposed area | A_t = N A_f + A_b |
| Overall surface efficiency | η_o = 1 − (N A_f/A_t)(1 − η_f) |
| Convection resistance | R_conv = 1/(η_o h A_t) |
| Base conduction resistance | R_base = t_b/(k W D) |
| Total resistance | R_total = R_base + R_conv |
| Mounting-face temperature | T_base = T∞ + Q R_total; rise ΔT = Q R_total |
| Finned-surface temperature | T_s = T∞ + Q R_conv |
| Fin root excess | θ_b = T_s − T∞ |
| Mass | mass = ρ (W D t_b + N t H D) |
| Fin gap | s = (W − N t)/(N − 1) |
| Fin heat share | N η_f h A_f θ_b / Q |

**Fin profile (stored for display):** θ(x)/θ_b = cosh(m(L_c − x))/cosh(m L_c) for 0 ≤ x ≤ H. This is the adiabatic-tip profile of the corrected-length fin, evaluated over the physical height. Samples are stored at x/H = 0, 0.25, 0.5, 0.75 and 1, with T(x) = T∞ + θ_b θ(x)/θ_b.

**Which temperature is constrained.** "Base temperature" is the mounting face, where heat enters (T_base). It differs from T_s by Q R_base = 0.13889 K, and the analysis stores both.

**Model form.** The model uses the corrected-length (adiabatic-tip) fin, as HS-02 requires. The exact convective-tip solution is used only as a benchmark (see the checks).

References to transcribe with edition and equation numbers during 48.2: Bergman, Lavine, Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer*, extended-surfaces chapter: the fin equation; straight rectangular fins with convective, adiabatic and corrected-length tips; fin efficiency; and fin arrays with overall surface efficiency. No page or equation numbers are claimed here. The 48.2 task should also transcribe that chapter's stated accuracy criterion for the corrected-length approximation, if present, rather than rely on memory.

**Second edition (not in v1):** a natural-convection spacing correlation, for example Bar-Cohen & Rohsenow (1984) on vertical parallel plates, with temperature-dependent iteration. It is recorded as a candidate only.

### Plausibility of the fixed coefficient and gap thresholds (engineering judgment, pending owner review)

**The coefficient h = 25 W/m²·K.** This value represents low-speed fan-assisted airflow, and it sits above typical natural-convection values. As a rough order-of-magnitude check, fully developed laminar flow between isothermal parallel plates has Nu ≈ 7.54 on the hydraulic diameter 2s. With k_air ≈ 0.026 W/m·K, that gives h ≈ 25 W/m²·K at s = 4 mm. This approximate figure is a plausibility argument only, not part of the model, and 48.2 must confirm it from the source or drop it.

**What fails for narrow gaps is not h itself.** Relative to the local air temperature, h may even rise as s shrinks. What fails is the assumption that the air is at T∞ everywhere. At a fixed fan pressure, laminar channel velocity scales as s² (plane Poiseuille flow), so halving the gap from 4 to 2 mm cuts the channel velocity about 4× and the flow per channel about 8×. The air then heats along the channel and bypasses the fin bank.

**The chosen thresholds.**
- The 4 mm gap is a design rule for manufacturability and airflow access.
- `FIN_GAP` raises a warning below 3 mm and makes the model not applicable below 2 mm.
- `CHANNEL_ASPECT` raises a warning above H/s = 8 and makes the model not applicable above 12.

These are judgment values chosen so that model trust ends below the design rule. They are not correlation outputs.

## Proposed configuration sketch

```json
{
  "id": "heat-sink-1", "version": 1, "title": "Heat Sink I",
  "model": { "id": "plateFinHeatSink", "version": 1 },
  "difficulty": "intermediate", "allowedModes": ["guided", "parametric"],
  "material": { "id": "aluminum-educational", "name": "Aluminum (educational nominal)",
    "thermalConductivityWPerMK": 200, "densityKgM3": 2700 },
  "base": { "widthM": 0.06, "depthM": 0.06, "thicknessM": 0.004 },
  "heatLoadW": 25, "ambientTemperatureK": 298.15,
  "convection": { "coefficientWPerM2K": 25, "kind": "specifiedEffective", "description": "low-speed fan-assisted airflow, assumed uniform" },
  "initialDesign": { "id": "baseline", "finCount": 4, "finThicknessM": 0.003, "finHeightM": 0.015, "materialId": "aluminum-educational" },
  "referenceDesign": { "id": "reference", "finCount": 10, "finThicknessM": 0.0015, "finHeightM": 0.035, "materialId": "aluminum-educational" },
  "lockedFields": ["base", "materialId", "heatLoadW", "ambientTemperatureK", "convection"],
  "constraints": { "maxBaseTemperatureK": 328.15, "maxMassKg": 0.13, "maxFinHeightM": 0.035, "minFinGapM": 0.004 },
  "designLimits": { "finCount": { "min": 2, "max": 20, "step": 1 },
                    "finThicknessM": { "minM": 0.001, "maxM": 0.005, "stepM": 0.0005 },
                    "finHeightM": { "minM": 0.005, "maxM": 0.045, "stepM": 0.001 },
                    "minGeometricGapM": 0.001 },
  "predictionPolicy": { "requiredOnIterations": [1, 3] },
  "visualization": { "profileSamplesXOverH": [0, 0.25, 0.5, 0.75, 1] }
}
```

Field names are indicative; 48.2 fixes them in the zod schema. As with the beam, the applicability thresholds live in `physics/heatSink/constants.ts`, not in the configuration.

| Code | Metric | Warning | Not applicable |
| --- | --- | --- | --- |
| `FIN_GAP` | s (lower bound) | below 0.003 m | below 0.002 m |
| `CHANNEL_ASPECT` | H/s | above 8 | above 12 |
| `FIN_BIOT` | h t/(2k) | above 0.01 | above 0.1 |

## Worksheet (SI, unrounded)

Inputs: k = 200 W/m·K, ρ = 2700 kg/m³, W = D = 0.06 m, t_b = 0.004 m, Q = 25 W, T∞ = 298.15 K, h = 25 W/m²·K. R_base = 0.00555555555555556 K/W in every row.

### Geometry

| Fixture | N, t, H (m) | s (m) | H/s | A_f (m²) | A_b (m²) | A_t (m²) | m L_c | Bi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 4, 0.003, 0.015 | 0.016 | 0.9375 | 0.00198 | 0.00288 | 0.0108 | 0.150623703313921 | 1.875e-4 |
| `reference` | 10, 0.0015, 0.035 | 0.005 | 7 | 0.00429 | 0.0027 | 0.0456 | 0.461530515423051 | 9.375e-5 |
| `eightFins` | 8, 0.002, 0.030 | 0.00628571428571429 | 4.77272727272727 | 0.00372 | 0.00264 | 0.0324 | 0.346590536512467 | 1.25e-4 |
| `thickerFins` | 10, 0.002, 0.035 | 0.00444444444444444 | 7.875 | 0.00432 | 0.0024 | 0.0456 | 0.402492235949962 | 1.25e-4 |
| `thickFins` | 8, 0.004, 0.035 | 0.004 | 8.75 | 0.00444 | 0.00168 | 0.0372 | 0.292510683565575 | 2.5e-4 |
| `acceptedWarning` | 12, 0.001, 0.035 | 0.00436363636363636 | 8.02083333333333 | 0.00426 | 0.00288 | 0.054 | 0.561304284679887 | 6.25e-5 |
| `tallFins` | 8, 0.0015, 0.045 | 0.00685714285714286 | 6.5625 | 0.00549 | 0.00288 | 0.0468 | 0.590629960296631 | 9.375e-5 |
| `denseFins` | 14, 0.001, 0.035 | 0.00353846153846154 | 9.89130434782609 | 0.00426 | 0.00276 | 0.0624 | 0.561304284679887 | 6.25e-5 |
| `gapWarning` | 16, 0.001, 0.030 | 0.00293333333333333 | 10.2272727272727 | 0.00366 | 0.00264 | 0.0612 | 0.482247343175678 | 6.25e-5 |
| `tooDense` | 19, 0.0015, 0.010 | 0.00175 | 5.71428571428571 | 0.00129 | 0.00189 | 0.0264 | 0.138781903239099 | 9.375e-5 |
| `deepChannels` | 14, 0.001, 0.045 | 0.00353846153846154 | 12.7173913043478 | 0.00546 | 0.00276 | 0.0792 | 0.719418167688306 | 6.25e-5 |

### Thermal results and expected outcomes

| Fixture | η_f | η_o | R_conv (K/W) | T_base (K) | T_base (°C) | ΔT (K) | mass (kg) | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 0.992505505199928 | 0.994504037146614 | 3.72417161254589 | 391.393179202536 | 118.243179202536 | 93.2431792025361 | 0.06804 | Not accepted: baseTemperature only |
| `reference` | 0.934566161312288 | 0.938440533339849 | 0.934734755471683 | 321.657257775681 | 48.507257775681 | 23.507257775681 | 0.12393 | Accepted, no issues |
| `eightFins` | 0.96179312891893 | 0.964906281377388 | 1.27946923453772 | 330.275619752332 | 57.125619752332 | 32.125619752332 | 0.11664 | Not accepted: baseTemperature only |
| `thickerFins` | 0.949283887008468 | 0.951953156113286 | 0.921466541523553 | 321.325552426978 | 48.1755524269777 | 23.1755524269777 | 0.15228 | Not accepted: mass only |
| `thickFins` | 0.972422619416602 | 0.973668049507465 | 1.10434846634665 | 325.897600547555 | 52.7476005475551 | 27.7476005475551 | 0.22032 | Not accepted: mass only; gap exactly at the limit passes; CHANNEL_ASPECT warning |
| `acceptedWarning` | 0.906717677316845 | 0.911692734526613 | 0.812489463487238 | 318.60112547607 | 45.4511254760698 | 20.4511254760698 | 0.10692 | Accepted with CHANNEL_ASPECT warning |
| `tallFins` | 0.897937060559815 | 0.904217856833057 | 0.945237752431 | 321.919832699664 | 48.7698326996639 | 23.7698326996639 | 0.12636 | Not accepted: finHeight only |
| `denseFins` | 0.906717677316845 | 0.910843626204753 | 0.703771341845611 | 315.883172435029 | 42.7331724350291 | 17.7331724350292 | 0.11826 | Not accepted: finGap only; CHANNEL_ASPECT warning |
| `gapWarning` | 0.929070180640558 | 0.932129898338416 | 0.70118421521175 | 315.818494269183 | 42.6684942691826 | 17.6684942691826 | 0.11664 | Not accepted: finGap; FIN_GAP and CHANNEL_ASPECT warnings |
| `tooDense` | 0.993628940318814 | 0.994085050273262 | 1.52416688565532 | 336.393061030272 | 63.243061030272 | 38.243061030272 | 0.08505 | Model not applicable (FIN_GAP); also fails baseTemperature, finGap |
| `deepChannels` | 0.857010291005542 | 0.861993265712924 | 0.58591003565764 | 312.93663978033 | 39.7866397803299 | 14.7866397803299 | 0.14094 | Model not applicable (CHANNEL_ASPECT only); also fails mass, finHeight, finGap |

`denseFins` and `deepChannels` are the lowest-temperature rows, yet neither can be Accepted. This is intended: the lowest temperature is not the goal once the gap rule and the model boundary apply.

### Rejected before analysis

| Input | Reason |
| --- | --- |
| N = 1 (any t, H) | Fin count below 2; the gap formula divides by zero |
| N = 20, t = 0.003 | s = 0 (fins merge) |
| N = 20, t = 0.0025 | s = 0.000526315789473684 m, below the 0.001 m geometric floor |

N = 20, t = 0.002 (s = 0.00105263157894737 m) is valid and analyzable, and is not applicable by FIN_GAP.

### Derived targets and solvability

- **Prediction fixture:** baseline → reference gives r = 0.252106995672254, a decrease.
- **Reference profile** (m = 12.9099444873581 m⁻¹, L_c = 0.03575 m, θ_b = 23.3683688867921 K):

  | x/H | θ/θ_b | T (K) |
  | --- | --- | --- |
  | 0 | 1 | 321.518368886792 |
  | 0.25 | 0.95755931029089 | 320.52659919386 |
  | 0.5 | 0.927350475032907 | 319.820667987911 |
  | 0.75 | 0.908987606822482 | 319.39155770975 |
  | 1 | 0.902236138537931 | 319.233786908349 |

  Tip ratios for the other rows: baseline 0.98885520147097, acceptedWarning 0.860826225361443, deepChannels 0.787341319087578.
- **Grid enumeration** (N 2–20, t 1.0–5.0 mm by 0.5, H 5–45 mm by 1):
  - 5289 valid designs: 80 Accepted, 3894 Not accepted and 1315 Model not applicable.
  - Every Accepted design has 8 ≤ N ≤ 12, t ≤ 2.0 mm and H ≥ 22 mm.
  - No design with s ≥ 4 mm is not applicable.
- **More short fins are not enough:** with N ≤ 7, no thickness reaches 55 °C at H = 35 mm. N = 7 reaches at best 56.115991901609 °C.
- **Thick fins waste mass:** the 27 designs with t ≥ 2.5 mm that meet temperature, height and the inclusive gap rule all weigh at least 144.585 g, so they fail mass. *(Corrected 2026-10-17: the original worksheet count of 23 compared the gap strictly. It omitted the four N = 8, t = 4 mm designs at exactly s = 4 mm, heights 32–35 mm, which pass the inclusive rule. The 48.2 implementation and an independent coordinator recount both give 27; the minimum mass is unchanged.)*
- **Thicker is a poor trade:** going from 1.5 to 2.0 mm (reference → `thickerFins`) lowers T_base by 0.33170535 K but adds 28.35 g.
- **Fin heat share:** 0.731859643896696 at the baseline and 0.936905404005661 at the reference.

## Independent checks (standalone script, measured)

**(a) Energy balance.** Q_fins + Q_base = N η_f h A_f θ_b + h A_b θ_b, with θ_b = Q R_conv. Its relative closure to Q was measured at ≤ 3.3e-16 over all 11 rows. The parallel-network form 1/R_conv = N η_f h A_f + h A_b agrees to ≤ 2.3e-16. Test tolerance: 1e-12 relative.

**(b) Finite-difference fin and corrected-length error.** The script solves θ'' = m²θ on [0, H] with θ(0) = 1 and the exact convective tip −k θ'(H) = h θ(H). It uses second-order central differences, a ghost-node tip and a Thomas solve. Fin heat is taken in energy form, m²∫θ dx + (h/k) θ(H), using the trapezoid rule; it is compared per k A_c θ_b.
- **Against the exact convective-tip solution** q = M (sinh mH + (h/mk) cosh mH)/(cosh mH + (h/mk) sinh mH), with M = √(h P k A_c) θ_b, P = 2D and A_c = D t.
  - At n = 200 intervals the relative error is ≤ 1.19e-6.
  - At n = 400 it is ≤ 2.98e-7. The 200 → 400 error ratio is 4.00, confirming second order.
  - At n = 4000 it is ≤ 3.9e-9, limited by round-off. A second-order one-sided derivative at the base is less accurate, at 4.8e-8 to 1.3e-6 at n = 400.
  - Test tolerance: 1e-6 relative at n ≥ 400, energy form.
- **Corrected-length (model) against the exact convective tip:** M tanh(m L_c) / q_exact − 1 ranges from −1.66e-7 (`deepChannels`) to −5.60e-6 (`baseline`). The corrected-length form always under-predicts slightly, and its error is largest for short, thick fins. Values per row: reference −5.71e-7, eightFins −1.24e-6, thickerFins −1.04e-6, thickFins −4.26e-6, acceptedWarning and denseFins −2.40e-7, tallFins −4.10e-7, gapWarning −2.94e-7, tooDense −2.15e-6. Tests assert this with a stated tolerance of |error| < 1e-5, never 1e-9, because it compares two different formulations.
- **FD on the model's own corrected-length fin** (adiabatic tip at L_c, n = 4000) matches tanh(m L_c) to ≤ 3.7e-9 relative. Its nodal profile matches cosh(m(L_c − x))/cosh(m L_c) to ≤ 1.3e-9 absolute. Test tolerance: 1e-6.

**(c) Limits, reference geometry.** As h → 0 and as k → ∞, η_f → 1 and η_o → 1. The deficit 1 − η_f approaches (m L_c)²/3:
- At h = 1e-2 the measured 1 − η_f is 2.840042e-5, against an asymptote of 2.840139e-5.
- At h = 1e-8 the two agree to all printed digits (2.840139e-11).
- At k = 2e9 W/m·K, 1 − η_f is 7.100347e-9, equal to the asymptote.

Tests assert 1 − η_f ≤ (m L_c)²/3 and a relative difference from it below 1e-3 for m L_c ≤ 0.01.

**Scaling and identities** (assert at 1e-12 relative):
- ΔT and T_s − T∞ are linear in Q.
- R_base does not depend on fin variables.
- Mass is linear in N for fixed t and H.
- η_f depends on t and H only, not on N; the `acceptedWarning` and `denseFins` rows share η_f exactly.
- T_base − T_s = Q R_base.
- °C = K − 273.15 is a display conversion only (25 °C ↔ 298.15 K, 55 °C ↔ 328.15 K).

**Boundaries:**
- `thickFins` sits at s = 4 mm and passes `finGap` inclusively.
- Designs at each limit within REL_TOL pass, and one ulp-scale step beyond fails. Tests construct these through configured limits, including `withinLowerLimit` for the gap.
- Screen values exactly at 3 mm, 2 mm, 8, 12, 0.01 and 0.1 produce no warning or not-applicable issue at that level (inclusive safe side).

**Invalid input rejected before analysis:**
- N non-integer, N < 2 or N > 20.
- t or H off range or off step.
- Non-finite values.
- s < 1 mm.
- Locked-field changes.

## Integration notes for 48.2/48.3

- **Pure modules:**
  - `challenge/heatSink/`: types and schema.
  - `geometry/heatSink/`: design, validation and edits.
  - `physics/heatSink/`: constants, analyze, applicability and fin profile.
  - `evaluation/heatSink/`: constraints, evaluate, explanations and primary metric.

  These are registered in the state registry (MM-05). Tests go next to the modules, and worksheet fixtures go in `test/fixtures/heatSink.ts`.
- **Shared code:** the shared `withinLowerLimit` helper and the `K` constraint unit (MM-12) are added with tests and leave beam behavior unchanged.
- **Persistence and import:** envelope v2 and import `ei-design` v2 (MM-18/MM-19). The stored profile samples are re-analyzed and compared at 1e-9 like every other number.
- **Explanation facts:** compare the ΔT ratio with the ratio of η_o A_t and with the mass change between tested designs, using stored values only.
- **Viewport:** a lazy fin-array mesh built from stored geometry, plus an SVG elevation fallback in the main bundle. Coloring comes only from stored profile samples, with a legend and a table equivalent. No flow animation. No formulas in UI or state.
