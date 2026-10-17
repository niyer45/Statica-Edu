# Vibration Isolation I — model design and benchmark worksheet (task 50.1)

Companion to requirements.md, 2026-10-17. A standalone Python script (`python3 -I`, run in a temporary directory outside the repository) produced the worksheet from the equations below, without application code. It is a separate source of numeric fixtures, not human engineering review. Status: specification only. No code was written, owner engineering review (29.2) is pending, and the card stays unavailable until 50.3.

## Model `sdofBaseIsolation` v1

A rigid mass m sits on a linear spring k and a viscous damper c in parallel, connected to a base that moves vertically as y(t) = Y sin ωt. The model covers one degree of freedom (vertical translation) and the steady-state harmonic response only. Absolute motion x and relative motion z = x − y satisfy m ẍ + c ẋ + k x = c ẏ + k y, or equivalently m z̈ + c ż + k z = −m ÿ. The model never integrates either equation; RK4 integration appears only in test code as an alternative-method check.

- ω_n = √(k/m), f_n = ω_n/2π, ζ = c/(2√(k m)) (so c = 2ζ√(k m)), r = f/f_n
- Absolute transmissibility: TR(r, ζ) = √[(1 + (2ζr)²)/((1 − r²)² + (2ζr)²)] = X/Y, which also equals the transmitted-force ratio for base excitation.
- Relative displacement: Z/Y = r²/√[(1 − r²)² + (2ζr)²], so Z = Y·Z/Y [m].
- Static deflection: δ_st = m g/k with g = 9.80665 m/s², so f_n = (1/2π)√(g/δ_st).
- Band ratios: r_min = f_min/f_n and r_max = f_max/f_n.
- Peak location r_p = √[(√(1 + 8ζ²) − 1)/(4ζ²)].
  - Derivation (checked by hand): with x = r², d(TR²)/dx has the sign of 2 − 2x − 4ζ²x². This has one positive root, 2ζ²x² + x − 1 = 0, which gives the r_p formula.
  - The derivative is positive below the root and negative above it, so TR is unimodal on r > 0.
  - Numerical confirmation is under Alternative-method checks.
- Worst in-band TR = TR(clamp(r_p, r_min, r_max), ζ). This is exact, not sampled. Report the frequency where it occurs, f_n·clamp(…).
- Peak TR over 0–f_max = TR(clamp(r_p, 0, r_max), ζ), with its frequency.
- Peak relative displacement over 0–f_max = Y·Z/Y at clamp(r_z, 0, r_max).
  - For ζ² < 1/2, r_z = 1/√(1 − 2ζ²) and Z/Y at r_z = 1/(2ζ√(1 − ζ²)). Derivation: with u = 1/r², (Z/Y)⁻² = (u − 1)² + 4ζ²u, which is minimal at u = 1 − 2ζ².
  - For ζ² ≥ 1/2, Z/Y increases monotonically, so the maximum is at r_max. This branch is unreachable with the configured materials but is defined for totality.
- Isolation threshold: TR(r, ζ) = T for r > √2 at r_iso = √x, where x is the larger root of T²x² + (4ζ²T² − 4ζ² − 2T²)x + (T² − 1) = 0. Derived target only; the analyzer does not use it.
- Stroke ratio for the applicability screen: (δ_st + Z_peak)/s_lin.

All quantities are finite for every valid design: ζ > 0, k > 0 and m > 0, and every denominator is ≥ (2ζr)² > 0 for r > 0. At r = 0 the formulas give TR = 1 and Z/Y = 0. Undamped behavior (ζ = 0) is a limiting check on the pure formula only. Configs reject ζ ≤ 0.

References, to be transcribed with exact edition, chapter/section and equation numbers and checked against the source during 50.2 (no page or equation numbers are claimed here):
- Rao, *Mechanical Vibrations*: harmonically excited single-degree-of-freedom systems, base excitation, displacement and force transmissibility, and vibration isolation.
- Thomson & Dahleh, *Theory of Vibration with Applications*: harmonically excited vibration, support motion and vibration isolation.
- *Harris' Shock and Vibration Handbook*: vibration isolation theory and the equivalent viscous representation of isolator damping.

## Proposed configuration sketch

```json
{
  "id": "vibration-isolation-1", "version": 1, "title": "Vibration Isolation I",
  "model": { "id": "sdofBaseIsolation", "version": 1 },
  "difficulty": "advanced", "allowedModes": ["guided", "parametric"],
  "component": { "massKg": 50 },
  "excitation": { "kind": "baseDisplacement", "amplitudeM": 0.0002, "operatingBandHz": { "minHz": 25, "maxHz": 50 }, "runUpFromHz": 0 },
  "mount": { "linearStrokeM": 0.02 },
  "materials": [
    { "id": "steelSpring",     "name": "Steel coil spring",        "dampingRatio": 0.02 },
    { "id": "naturalRubber",   "name": "Natural rubber",           "dampingRatio": 0.05 },
    { "id": "neoprene",        "name": "Neoprene",                 "dampingRatio": 0.10 },
    { "id": "butylRubber",     "name": "Butyl rubber",             "dampingRatio": 0.20 },
    { "id": "highDampingElastomer", "name": "Highly damped elastomer", "dampingRatio": 0.30 }
  ],
  "stiffnessLimits": { "minNPerM": 20000, "maxNPerM": 2000000, "stepNPerM": 500 },
  "initialDesign":   { "id": "baseline",  "stiffnessNPerM": 1800000, "materialId": "naturalRubber" },
  "referenceDesign": { "id": "reference", "stiffnessNPerM": 85000,   "materialId": "neoprene" },
  "lockedFields": ["massKg", "operatingBandHz", "amplitudeM", "linearStrokeM"],
  "constraints": { "maxWorstInBandTransmissibility": 0.12, "maxStaticDeflectionM": 0.008,
                   "maxPeakTransmissibility": 6, "maxRelativeDisplacementM": 0.0015 },
  "predictionPolicy": { "requiredOnIterations": [1, 3] },
  "visualization": { "chartMaxHz": 60, "chartSamples": 241, "maxVisualSagPx": 24 }
}
```

The field names are indicative; 50.2 fixes them in the zod schema. Schema rules:
- 0 < ζ ≤ 1 for every material, with unique material ids.
- 0 < minHz < maxHz; runUpFromHz = 0 for v1.
- amplitudeM > 0, massKg > 0 and linearStrokeM > 0.
- 0 < minNPerM < maxNPerM.

Applicability thresholds live in `physics/vibration/constants.ts`:
- `SPRING_STROKE`: warning 0.8, not applicable 1.0.
- `DAMPING_RATIO`: warning 0.35, not applicable 0.5.

The design type is `{ id, stiffnessNPerM, materialId }`. `g` is a physics constant.

## Worksheet (SI, unrounded; m = 50 kg, g = 9.80665 m/s², band 25–50 Hz, Y = 2e-4 m, stroke 0.02 m)

Primary outputs. The TR_worst column gives the value with its frequency in Hz after `@`. TR_peak and Z_peak cover 0–50 Hz.

| Fixture | k (N/m), ζ | f_n (Hz) | TR_worst @ f (Hz) | TR_peak | δ_st (m) | Z_peak (m) | Stroke ratio | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 1800000, 0.05 | 30.1975272626922 | 10.0622137253413 @ 30.1226863340461 | 10.0622137253413 | 0.000272406944444444 | 0.00200250469728704 | 0.113745582086574 | Not accepted: worstInBand, peakTR, relativeDisplacement (resonance in band) |
| `reference` | 85000, 0.10 | 6.56212641207052 | 0.0928814700836484 @ 25 | 5.12277357963917 | 0.00576861764705882 | 0.00100503781525921 | 0.338682773115902 | Accepted |
| `lightSpring` | 85000, 0.02 | 6.56212641207052 | 0.0748461642949341 @ 25 | 25.0249815288429 | 0.00576861764705882 | 0.00500100030010004 | 0.538480897357943 | Not accepted: peakTR, relativeDisplacement |
| `lightRubber` | 85000, 0.05 | 6.56212641207052 | 0.0791533174164501 @ 25 | 10.0622137253413 | 0.00576861764705882 | 0.00200250469728704 | 0.388556117217293 | Not accepted: peakTR, relativeDisplacement |
| `dampedReference` | 85000, 0.20 | 6.56212641207052 | 0.134024796888312 @ 25 | 2.73392111072598 | 0.00576861764705882 | 0.000510310363079829 | 0.313946400506933 | Not accepted: worstInBand only |
| `heavyAtSag` | 61500, 0.30 | 5.58177964183636 | 0.148963126967583 @ 25 | 1.99460800359476 | 0.00797288617886179 | 0.000349428278907306 | 0.416115722888455 | Not accepted: worstInBand only |
| `heavySoft` | 40000, 0.30 | 4.50158158078553 | 0.115857999858954 @ 25 | 1.99460800359476 | 0.0122583125 | 0.000349428278907306 | 0.630387038945365 | Not accepted: staticDeflection only |
| `stiffHeavy` | 2000000, 0.30 | 31.8309886183791 | 1.99460800359476 @ 29.6086994284952 | 1.99460800359476 | 0.00024516625 | 0.000349428278907306 | 0.0297297264453653 | Not accepted: worstInBand only (damping alone cannot isolate) |
| `sagBoundary` | 61291.5625 (= m g/δ_lim), 0.20 | 5.57231265265523 | 0.106930788872695 @ 25 | 2.73392111072598 | 0.008 | 0.000510310363079829 | 0.425515518153991 | Accepted (inclusive) |
| `sagOnGridFail` | 61000, 0.20 | 5.5590431740465 | 0.106591952520594 @ 25 | 2.73392111072598 | 0.00803823770491803 | 0.000510310363079829 | 0.427427403399893 | Not accepted: staticDeflection only |
| `isoBoundary` | 72649.1928025733 (= m(2π·25/r_iso)²), 0.20 | 6.06667215424451 | 0.12 @ 25 | 2.73392111072598 | 0.00674931793574769 | 0.000510310363079829 | 0.362981414941376 | Accepted (inclusive) |
| `isoOnGridFail` | 73000, 0.20 | 6.08130183673309 | 0.120400420753212 @ 25 | 2.73392111072598 | 0.00671688356164384 | 0.000510310363079829 | 0.361359696236183 | Not accepted: worstInBand only |
| `softWarning` | 28000, 0.10 | 3.76629336482533 | 0.0385796127287654 @ 25 | 5.12277357963917 | 0.017511875 | 0.00100503781525921 | 0.92584564076296 | Not accepted: staticDeflection; `SPRING_STROKE` warning |
| `tooSoftLight` | 20000, 0.02 | 3.18309886183791 | 0.01727234912448 @ 25 | 25.0249815288429 | 0.024516625 | 0.00500100030010004 | 1.475881265005 | Model not applicable (`SPRING_STROKE`); never Accepted |
| `tooSoftHeavy` | 20000, 0.30 | 3.18309886183791 | 0.0791441513302915 @ 25 | 1.99460800359476 | 0.024516625 | 0.000349428278907306 | 1.24330266394537 | Model not applicable (`SPRING_STROKE`); never Accepted |

Secondary outputs. f_peak is the frequency of TR_peak and f_Zpeak the frequency of Z_peak; both are in Hz.

| Fixture | c (N·s/m) | r_min | r_max | f_peak (Hz) | f_Zpeak (Hz) |
| --- | --- | --- | --- | --- | --- |
| `baseline` | 948.683298050514 | 0.827882355483008 | 1.65576471096602 | 30.1226863340461 | 30.273305367442 |
| `reference` | 412.310562561766 | 3.80974068923976 | 7.61948137847952 | 6.49869915762107 | 6.62874869282631 |
| `lightSpring` | 82.4621125123532 | 3.80974068923976 | 7.61948137847952 | 6.55950522938173 | 6.56475283859637 |
| `lightRubber` | 206.155281280883 | 3.80974068923976 | 7.61948137847952 | 6.54586297333594 | 6.5785935054954 |
| `dampedReference` | 824.621125123532 | 3.80974068923976 | 7.61948137847952 | 6.33067795276693 | 6.8414897189067 |
| `heavyAtSag` | 1052.14067500501 | 4.47885828609587 | 8.95771657219173 | 5.19208616711956 | 6.164044440615 |
| `stiffHeavy` | 6000 | 0.785398163397448 | 1.5707963267949 | 29.6086994284952 | 35.1514464959867 |
| `sagBoundary` | 700.237459723486 | 4.48646756891636 | 8.97293513783272 | 5.37577526565174 | 5.80953753855615 |

Per-material values and feasible windows. The resonance values are independent of k for every configured design because f_n·r_p < 50 Hz throughout the range.

| ζ (material) | r_p | TR_peak | r_z | Z_peak/Y | r_iso (TR = 0.12) | f_n,max (Hz) | k_max (N/m) | Feasible window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.02 steel spring | 0.999600558946264 | 25.0249815288429 | 1.00040024016011 | 25.0050015005002 | 3.0650997885581 | 8.15634130194521 | 131316.86986337 | None. Isolation and sag alone would pass 61.5–131.0 kN/m, but peak TR > 6 and Z_peak 5.00 mm > 1.5 mm |
| 0.05 natural rubber | 0.997521620628236 | 10.0622137253413 | 1.00250941423417 | 10.0125234864352 | 3.11825451183061 | 8.01730580526714 | 126878.092151129 | None. Isolation and sag alone would pass 61.5–126.5 kN/m, but peak TR > 6 and Z_peak 2.00 mm > 1.5 mm |
| 0.10 neoprene | 0.990334344316687 | 5.12277357963917 | 1.01015254455221 | 5.02518907629606 | 3.31277422487744 | 7.54654507157817 | 112415.470230578 | f_n 5.57231265265523–7.54654507157817 Hz; k 61291.5625–112415.470230578 N/m; on grid 61.5–112.0 kN/m (102 values) |
| 0.20 butyl rubber | 0.96472965548517 | 2.73392111072598 | 1.04257207028537 | 2.55155181539914 | 4.1208753933586 | 6.06667215424451 | 72649.1928025733 | f_n 5.57231265265523–6.06667215424451 Hz; k 61291.5625–72649.1928025733 N/m; on grid 61.5–72.5 kN/m (23 values) |
| 0.30 highly damped | 0.930184726069087 | 1.99460800359476 | 1.10431526074847 | 1.74714139453653 | 5.38517796574222 | 4.64237211082667 | 42541.1903821775 | None. f_n,max is below the sag floor 5.5723 Hz |

A brute-force scan over every 0.5 kN/m grid value of every material found exactly 125 accepted designs (102 neoprene and 23 butyl) and none for the other three materials.

Derived targets:
- δ_st ≤ 8 mm requires k ≥ m g/δ_lim = 61291.5625 N/m, that is f_n ≥ (1/2π)√(g/δ_lim) = 5.57231265265523 Hz.
- For isolating designs, r_min > r_p, so the worst in-band TR occurs at 25 Hz. TR ≤ 0.12 then requires f_n ≤ 25/r_iso(ζ) (table).
- The stiffness range spans f_n = 3.18309886183791–31.8309886183791 Hz.
- `SPRING_STROKE` boundaries per material:
  - The warning boundary (stroke ratio 0.8) lies at k = 44579.7357376471 N/m for ζ = 0.02 and at lower k for the other materials (31330.0056214027 N/m for ζ = 0.30). It is always below the sag floor, so a warning never reaches an otherwise acceptable design.
  - The not-applicable boundary (1.0) lies between k = 24952.5818871561 N/m (ζ = 0.30) and 32691.0133882642 N/m (ζ = 0.02).
- Base acceleration amplitude Y(2πf)² is 4.9348 m/s² (0.503 g) at 25 Hz and 19.739 m/s² (2.013 g) at 50 Hz. This is context for owner review, not a model output.

Prediction fixtures:
- baseline → reference: r = 0.00923071926505895, a decrease.
- reference → dampedReference: r = 1.44296593031538, an increase. More damping transmits more vibration in the band.
- reference → lightSpring: r = 0.805824501135999, a decrease, even though that design fails the resonance limits.

Changes from the 45.1 provisional constants: m, the band, the three original limits and the baseline (ζ = 0.05 with f_n ≈ 30 Hz) are kept. The baseline is expressed as k = 1800 kN/m on the stiffness grid, which gives f_n = 30.20 Hz rather than exactly 30 Hz. Its worst-band TR is unchanged at 10.0622 because the resonance lies inside the band. This task adds Y = 0.2 mm, the 1.5 mm clearance, the 20 mm stroke and the five-material ζ list. The 45.1 feasibility statements, ζ = 0.1 → 5.57–7.55 Hz, ζ = 0.2 → 5.57–6.07 Hz and no window at ζ = 0.3, are reproduced.

## Alternative-method and limiting checks

- **Peak formula against numerical maximization.** Golden-section maximization of TR(r) on r ∈ [0.01, 3] for ζ ∈ {0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0}. The script measured the location within 3.6e-8 relative, a limit set by the flat peak, and the peak value within 3.3e-16. A 1e-3-step scan of r ∈ (0, 20) for every configured ζ found 0 monotonicity violations on either side of r_p. Assert the value within 1e-12 and the location within 1e-6.
- **Dense grid against the closed-form worst in-band TR.** Sample at least 20001 uniformly spaced frequencies across 25–50 Hz. Assert that the closed form is ≥ the grid maximum, never exceeded by more than 1e-15 relative, and within 1e-7 relative of it. Measured on the fixtures plus extra in-band resonance cases: ≤ 7.6e-9 at 20001 points and ≤ 8.2e-10 at 200001 points, never negative. Apply the same check to Z_peak and TR_peak over 0–50 Hz.
- **Isolation threshold.** The closed-form r_iso agreed with a 200-iteration bisection of TR(r, ζ) = 0.12 on r > √2 within 1.5e-16 relative for every configured ζ.
- **RK4 steady state (test code only).** Integrate m ẍ + c ẋ + k x = c ẏ + k y from rest with classical RK4 at 200 steps per excitation period. Integrate for 30/(ζω_n) seconds, rounded up to whole periods, so the transient decays by about e⁻³⁰. Then project x and z = x − y onto sin ωt and cos ωt over 10 whole periods using the rectangle rule. Assert that X/Y matches TR and Z/Y matches the closed form within 1e-6 relative. Measured agreement:

  | Case | f (Hz) | 200 steps/period X/Y, Z/Y rel. error | 2000 steps/period X/Y, Z/Y rel. error |
  | --- | --- | --- | --- |
  | `baseline` at worst in-band frequency | 30.1226863340461 | 2.11e-8, 3.74e-8 | 6.2e-12, 1.6e-11 |
  | `reference` at band minimum | 25 | 1.49e-9, 1.06e-10 | 1.5e-11, 7.5e-12 |
  | `reference` at its TR peak | 6.49869915762107 | 2.32e-8, 3.97e-8 | 6.0e-13, 7.3e-12 |
  | `heavyAtSag` at band minimum | 25 | 1.19e-9, 7.5e-11 | 7.8e-12, 6.9e-12 |

  The error falls by roughly 10⁴ for a 10× smaller step, consistent with fourth-order convergence. This was the absolute-motion form; integrating the relative form m z̈ + c ż + k z = −m ÿ (the form named in 45.1) is an acceptable equivalent. At 200 steps per period, each case needs about 10k–40k RK4 steps.
- **Identities and limits.**
  - TR(√2, ζ) = 1 for ζ ∈ {0, 0.01, …, 1.0} (measured 4.4e-16).
  - With ζ = 0 in the pure formula, TR = 1/|1 − r²| for r ≠ 1 (measured 1.7e-16).
  - The f_n = (1/2π)√(g/δ_st) identity holds (measured 0).
  - At high frequency, Z/Y → 1 and TR → 2ζ/r (r = 1e4: 1.00000001 and 1.0000001 times the asymptote).
  - At r = 0, TR = 1 and Z = 0. For ζ² ≥ 1/2, Z_peak is taken at r_max.
- **Damping crossover.** For r > √2, TR increases strictly with ζ; for r < √2 it decreases. Property test over random r and ζ pairs, excluding a 1e-6 neighborhood of √2.
- **Scaling.**
  - Scaling m and k by the same λ leaves f_n, every TR, Z and δ_st unchanged.
  - Z is linear in Y; TR, f_n and δ_st are independent of Y.
  - δ_st ∝ m/k and f_n ∝ √(k/m).
- **Boundaries.** Designs whose worst-band TR, δ_st, peak TR or Z_peak equals its limit within REL_TOL pass, and an ulp-scale step beyond fails.
  - Tests construct these directly: k = m g/δ_lim, k = m(2π·25/r_iso)², and configured peak/clearance limits set equal to the computed values.
  - Screens at exactly 0.8/1.0 (stroke) and 0.35/0.5 (ζ) raise no issue, because the inclusive side is the safe side.
- **Invalid input** is rejected before analysis with typed errors in the shared validator order:
  - k below 20000 or above 2000000 N/m (19500 and 2000500 as fixtures)
  - non-finite or non-positive k
  - an unknown material id
  - changes to a locked field (mass, band, amplitude, stroke)
  - Config-level: ζ ≤ 0 or > 1, minHz ≥ maxHz, and a non-positive Y, m or stroke fail schema loading.

## Integration notes for 50.2/50.3

- **Pure modules:** `challenge/vibration/` (types, schema), `geometry/vibration/` (design, validation, edits), `physics/vibration/` (constants, analyze, applicability, response curve) and `evaluation/vibration/` (constraints, evaluate, explanations, primary metric). They are registered in the state registry (MM-05). Tests sit next to the modules; worksheet fixtures go in `test/fixtures/vibration.ts`. The RK4 integrator lives only in test code.
- **Analysis fields (indicative):** `modelId`, `modelVersion`, `naturalFrequencyHz`, `dampingRatio`, `dampingCoefficientNsPerM`, `frequencyRatioAtBandMin`, `worstInBandTransmissibility`, `worstInBandFrequencyHz`, `peakTransmissibility`, `peakTransmissibilityFrequencyHz`, `staticDeflectionM`, `peakRelativeDisplacementM`, `peakRelativeDisplacementFrequencyHz`, `strokeRatio`, plus the shared applicability lists.
- **Persistence:** new-model sessions use envelope v2 and import/export `ei-design` v2 (MM-18/MM-19).
- **Explanation facts:** compare the f_n ratio (= √ of the stiffness ratio), the δ_st ratio (inverse stiffness ratio) and the worst-band TR ratio between tested designs, using stored values only. Name the material change when ζ differs.
- **Chart:**
  - Curve samples come from a pure `physics/vibration` response function evaluated on the stored design snapshot with the same registered model version. Saved results are re-analyzed on load anyway (MM-18).
  - Samples are not persisted, which keeps envelopes small. Every labeled number and the table equivalent come from the stored analysis.
  - No formulas in UI. The chart and schematic are SVG in the main bundle, so no WebGL path is required. Any decorative 3D is out of scope for v1.
- **Units:** stiffness displays in kN/m, deflection and displacement in mm, frequency in Hz with two decimals, and TR with three significant figures. Formatting is implemented once per unit (MM-12).

## Open questions for owner review (29.2)

1. Peak TR and clearance reject the same materials (ζ ≤ 0.05) because resonance is always inside 0–50 Hz. Keep both, as specified, or drop one?
2. Material names and ζ values are educational nominal values. Approve the labels, or use neutral names such as "Mount A–E".
3. Is a constant-displacement base amplitude of 0.2 mm across 0–50 Hz (up to about 2 g at 50 Hz) acceptable as an educational scenario?
4. The butyl window is narrow (23 grid values) and only two materials are feasible. Is that suitable for advanced difficulty?
5. Is the wording that labels the run-up resonance checks as a conservative steady-state screen acceptable?
