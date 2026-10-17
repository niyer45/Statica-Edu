# Mounting Bracket I — model design and benchmark worksheet (task 46.1)

Companion to requirements.md, 2026-10-17. The worksheet came from a standalone Python script (`python3 -I`, run in a temporary directory outside the repository). The script was written from the equations below, without application code. It is a separate numeric fixture source, not human engineering review.

## Model `steppedBarBracket` v1

The model is a planar linear-elastic Euler–Bernoulli cantilever with a rectangular section. Thickness b is out of plane. Depth is D over 0 ≤ x < a and d over a ≤ x ≤ L. The wall clamp is at x = 0, and the tip force F acts at x = L. The step is symmetric, with opposite shoulder fillets of radius r at x = a.

- Moment M(x) = F(L − x). Second moments I_D = bD³/12 and I_d = bd³/12.
- σ_root = 6FL/(bD²). The wall-clamp concentration is excluded and disclosed.
- σ_step,nom = 6F(L − a)/(bd²), using the moment at the shoulder plane (conservative; MBR-11).
- σ_step = Kt · σ_step,nom, and σ_peak = max(σ_root, σ_step). The location follows MBR-11.
- δ_tip = (F/(3E)) [(L³ − (L − a)³)/I_D + (L − a)³/I_d]. Unit-load derivation: δ = ∫₀ᴸ F(L − x)²/(E I(x)) dx, split at x = a.
- m = ρ b [D a + d (L − a)].
- Fillets: their material and stiffness are neglected. Both fillets together add at most 2 b ρ r²(1 − π/4) = 1.15884991765378 g at r = 10 mm, which is 0.54% of the mass limit. This bound holds for r > h too, because the fillet area is then a subset of the quarter-corner region. Neglecting the fillet stiffness makes δ slightly conservative.
- Uniform bar (D = d): the step terms are absent (MBR-12).

Deflection references to transcribe with edition and equation numbers in 46.2: Gere & Goodno, *Mechanics of Materials* (cantilever deflection; unit-load or moment-area method for nonprismatic beams). Budynas & Nisbett, *Shigley's Mechanical Engineering Design* (Castigliano and unit-load deflection). No page numbers are claimed here.

## Stress-concentration factor: transcription record

**Status: found and cross-checked. It still requires owner verification against the printed Peterson/Roark edition before 46.2 (open item K-1).** Neither printed book was available. Everything below was read from the copies listed here.

**Fit (stepped flat bar, opposite shoulder fillets, in-plane bending).**

- σ_nom = 6M/(t d²), where t is the bar thickness (b here).
- Kt = C1 + C2(2h/D) + C3(2h/D)² + C4(2h/D)³.
- Each Ci = αi + βi√(h/r) + γi(h/r).
- D is the larger depth, d the smaller depth, h = (D − d)/2 the shoulder height on each side, and r the fillet radius.

| Ci | 0.1 ≤ h/r ≤ 2.0 | 2.0 ≤ h/r ≤ 20.0 |
| --- | --- | --- |
| C1 | 1.006 + 0.967√(h/r) + 0.013(h/r) | 1.058 + 1.002√(h/r) − 0.038(h/r) |
| C2 | −0.270 − 2.372√(h/r) + 0.708(h/r) | −3.652 + 1.639√(h/r) − 0.436(h/r) |
| C3 | 0.662 + 1.157√(h/r) − 0.908(h/r) | 6.170 − 5.687√(h/r) + 1.175(h/r) |
| C4 | −0.405 + 0.249√(h/r) − 0.200(h/r) | −2.558 + 3.046√(h/r) − 0.701(h/r) |

**Validity condition printed with the fit:** L/D ≥ −2.05(r/d − 0.025) + 2.0, where L is the length of the larger section. The relation glyph did not extract as text; AmesWeb prints it as ">". The model applies it inclusively (safe side; REL_TOL).

**Branch rule (model choice):** both printed ranges include h/r = 2. The model uses the lower branch for h/r ≤ 2 within REL_TOL, so rounding such as 1.9999999999999996 cannot flip the branch. In the configured space (D/d ≤ 1.6), the two branches differ at h/r = 2 by at most 2.60%, in the direction that keeps Kt non-increasing as r grows.

**Sources actually consulted**

1. Roark chapter copy. URL: https://s1b0d3d77136c1679.jimcontent.com/download/version/1531108625/module/14143373530/name/Roark-Ch06.pdf
   - Content: *Roark's Formulas for Stress and Strain*, Chapter 6 "Stress Concentration", Table 6-1 "Stress concentration factors: Fillets", case III.1 "Opposite shoulder fillets in stepped flat bar", b "In-plane bending".
   - Edition: not printed in the extracted text. The chapter's Ref. 6.1 is Pilkey, *Peterson's Stress Concentration Factors*, Wiley, 1997.
   - Extraction: the PDF text was extracted with a standalone parser. All coefficient digits and the validity condition were read directly. The plus/minus signs are symbol-font glyphs, reconstructed from their consistent glyph codes, and they agree with source 2.
2. AmesWeb calculator. URL: https://amesweb.info/stress-concentration-factor-calculator/shoulder-fillets-in-flat-bar.aspx
   - Content: "Opposite shoulder fillets in a stepped bar", bending formulas. It cites Pilkey, *Formulas for Stress, Strain, and Structural Matrices*, 2nd ed., Wiley, 2005.
   - Agreement: every coefficient, sign, range and validity condition is identical to source 1. It does not define h.
3. EES (F-Chart) function page. URL: https://fchartsoftware.com/ees/mechanical_design/stress_concentration_factors/hs202.htm
   - Content: "plate with shouldered fillets … bending in the plane", citing Leven & Hartman (1951, *Proc. SESA* 19(1)) as reproduced in Pilkey, *Peterson's Stress Concentration Factors*, 2nd ed. (1997).
   - Check: its worked example H = 0.24 m, shoulder depth t = 0.025 m, r = 0.075 m gives 1.318. The fit gives 1.31786431300713 (−1.03e-4) with h = t. The alternative reading h = t/2 gives 1.2965, so the example also pins h = (D − d)/2.
4. Mechsimulator. URL: https://mechsimulator.com/tools/stress-concentration/
   - Content: it lists a "typical" Kt of 2.90 for plate shoulder fillets in in-plane bending at r/h = 0.1, D/d = 1.5. It attributes its fits to Roark (8th ed., Table 6-1, Pilkey's fits to Peterson's charts).
   - Check: the fit gives 2.89887763615108 (−3.87e-4). The reading h = D − d would give 1.951.
5. MechaniCalc, "Rectangular Bar With Fillet, Bending" tab. URL: https://mechanicalc.com/calculators/stress-concentration/
   - **Disagrees.** It is labelled as coefficients from Roark's 8th ed. Its lower branch reads C1 = 1.007 + 1.000√ − 0.031, C2 = −0.270 − 2.404√ + 0.749, C3 = 0.677 + 1.133√ − 0.904, C4 = −0.414 + 0.271√ + 0.186. Its upper branch reads C1 = 1.042 + 0.982√ − 0.036, C2 = −3.599 + 1.619√ − 0.431, C3 = 6.084 − 5.607√ + 1.158, C4 = −2.527 + 3.006√ − 0.691.
   - Its bending C1 is identical to its own axial-tension C1, which suggests either a copy error or a different source edition.
   - Effect: over the configured space (D/d ≤ 1.6, fit range) it differs from the adopted set by at most 1.72%. It changes no worksheet status, governing location or warning: baseline Kt 2.30021 vs 2.33927, still failing; filletOnly 1.70030, still passing. Only `shoulderNA`, which is not applicable either way, would no longer also fail peakStress (Kt 2.49445, giving 119.7 MPa).
6. Shigley chart copy. URL: https://lim.ii.udc.es/docencia/iin-g-tecmaq/figuras3-4-5.pdf
   - Content: *Shigley's Mechanical Engineering Design*, Table A–15, Figure A–15–6 "Rectangular filleted bar in bending", σ0 = Mc/I. The curves are D/d = 1.02, 1.05, 1.1, 1.3 and 3. The footnote reads "Factors from R. E. Peterson, 'Design Factors for Stress Concentration,' *Machine Design*, vol. 23, 1951".
   - Edition: not identified.
   - Digitizing: the chart is vector artwork. The readings below were taken from the decompressed curve paths, mapped to the plot frame and gridlines. They are independent of the fit's data source. Digitizing uncertainty is about ±0.01 in Kt (the curve stroke is 1 pt, about 0.014 Kt).

Course notes and other calculators found by search either covered round shafts or did not show coefficients. Search-result abstracts from Noda and co-workers (Kyushu Institute of Technology repository; not read in full) state that Peterson's photoelastic flat-bar charts underestimate Kt by roughly 10–13% compared with body-force-method results. Owner review should consider this (K-4).

**Kt fit vs digitized chart readings (Peterson 1951 data via Shigley Fig. A–15–6)**

| D/d | r/d | h/r | Chart | Fit | Fit/chart − 1 |
| --- | --- | --- | --- | --- | --- |
| 1.3 | 0.03 | 5.000 | 2.507 | 2.5819 | +2.99% |
| 1.3 | 0.05 | 3.000 | 2.170 | 2.1893 | +0.89% |
| 1.3 | 0.10 | 1.500 | 1.742 | 1.7555 | +0.77% |
| 1.3 | 0.15 | 1.000 | 1.564 | 1.5838 | +1.27% |
| 1.3 | 0.20 | 0.750 | 1.463 | 1.4876 | +1.68% |
| 1.3 | 0.25 | 0.600 | 1.404 | 1.4244 | +1.46% |
| 1.1 | 0.05 | 1.000 | 1.909 | 1.8174 | −4.80% |
| 1.1 | 0.10 | 0.500 | 1.599 | 1.5597 | −2.46% |
| 1.1 | 0.20 | 0.250 | 1.409 | 1.3846 | −1.73% |
| 3.0 | 0.05 | 20.00 | 2.430 | 2.4249 | −0.21% |
| 3.0 | 0.10 | 10.00 | 1.904 | 1.9512 | +2.48% |
| 3.0 | 0.20 | 5.000 | 1.517 | 1.5870 | +4.62% |
| 1.05 | 0.05 | 0.500 | 1.790 | 1.6227 | −9.35% |
| 1.05 | 0.10 | 0.250 | 1.535 | 1.4341 | −6.57% |
| 1.02 | 0.05 | 0.200 | 1.642 | 1.4181 | −13.63% |
| 1.02 | 0.10 | 0.100 | 1.424 | 1.2948 | −9.07% |

For 1.1 ≤ D/d ≤ 3, which brackets the configured D/d ≤ 1.6, the fit lies within −4.8% to +4.6% of the 1951 chart. For very small steps (D/d ≤ 1.05) the fit is 6.6–13.6% below the 1951 chart. The fit draws on later data than the 1951 chart (Pilkey 1997), so the gap may come from the source data rather than from transcription. It is recorded as open item K-4 and is not hidden by a tolerance.

**Fit behaviour on the configured grid**, for every 0.5 mm (D, d) pair with D/d ≤ 1.6 and every configured r inside the fit range:
- Kt never increases as r increases.
- Kt spans 1.1573–3.3443.
- The branch gap at h/r = 2 is at most 2.60%.

Above D/d = 1.6 the gap grows (3.6% at 1.7, 7.3% at 2.0, 23.4% at 3.0). The lower branch also becomes implausibly low (Kt 1.007 at D/d = 3, h/r = 2) and the spread between transcriptions grows (5.5% at 2.0). This is the basis for the developer-proposed `KT_STEP_RATIO` limit.

**Shoulder-length condition.** The source's L is the length of the enlarged section of a bar with fillets at both ends of that section. In the bracket, the enlarged segment runs from the wall clamp to the single shoulder. The model requires a/D ≥ 2.0 − 2.05(r/d − 0.025), using the full a in place of L. This is conservative: the deep segment must itself be as long as the source's whole enlarged section. A metric above 1.0 is not applicable, because the clamp may interact with the fillet field. Within the configured ranges r/d ≤ 1, so the right-hand side stays positive.

## Proposed configuration sketch

```json
{
  "id": "mounting-bracket-1", "version": 1, "title": "Mounting Bracket I",
  "model": { "id": "steppedBarBracket", "version": 1 },
  "difficulty": "intermediate", "allowedModes": ["guided", "parametric"],
  "material": { "id": "al-educational", "name": "Aluminum (educational nominal)",
    "elasticModulusPa": 69e9, "densityKgM3": 2700, "allowableStressPa": 120e6, "yieldStressPa": 240e6 },
  "lengthM": 0.3, "thicknessM": 0.01, "support": "wallClamp",
  "load": { "forceN": 300, "location": "freeEnd", "direction": "down" },
  "initialDesign": { "id": "baseline", "rootDepthM": 0.03, "armDepthM": 0.02, "stepLocationM": 0.15, "filletRadiusM": 0.001, "materialId": "al-educational" },
  "referenceDesign": { "id": "reference", "rootDepthM": 0.03, "armDepthM": 0.02, "stepLocationM": 0.175, "filletRadiusM": 0.003, "materialId": "al-educational" },
  "lockedFields": ["lengthM", "thicknessM", "materialId", "forceN", "support"],
  "constraints": { "maxPeakStressPa": 120e6, "maxTipDeflectionM": 0.0024, "maxMassKg": 0.215, "maxEnvelopeDepthM": 0.04 },
  "designLimits": {
    "rootDepthM": { "minM": 0.015, "maxM": 0.05, "stepM": 0.0005 },
    "armDepthM": { "minM": 0.01, "maxM": 0.05, "stepM": 0.0005 },
    "stepLocationM": { "minM": 0.06, "maxM": 0.24, "stepM": 0.005 },
    "filletRadiusM": { "minM": 0.0005, "maxM": 0.01, "stepM": 0.0005 }
  },
  "predictionPolicy": { "requiredOnIterations": [1, 3] }
}
```

Field names are indicative; 46.2 fixes them in the zod schema. The Kt coefficient table, validity condition, branch rule and screen thresholds live in `physics/bracket/constants`, never in the configuration (MBR-13). Validation errors: `rootDepthOutOfRange`, `armDepthOutOfRange`, `armDeeperThanRoot`, `stepLocationOutOfRange`, `filletRadiusOutOfRange`, `nonFinite`, `lockedField`. Edits keep the existing clamp/strict semantics. An edit that would make d > D is rejected, and the draft stays unchanged.

## Worksheet (SI, unrounded; E = 69e9 Pa, ρ = 2700 kg/m³, σ_y = 240e6 Pa, F = 300 N, L = 0.3 m, b = 0.01 m)

Stresses (D, d, a, r in mm; stresses in Pa). "—" means absent: there is no step, or the fit is undefined.

| Fixture | D, d, a, r | σ_root | σ_step,nom | Kt | σ_step | σ_peak (location) | σ_peak/σ_y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 30, 20, 150, 1 | 60000000 | 67500000 | 2.33927144795256 | 157900822.736798 | 157900822.736798 (step) | 0.657920094736658 |
| `reference` | 30, 20, 175, 3 | 60000000 | 56250000 | 1.61457742912574 | 90819980.3883229 | 90819980.3883229 (step) | 0.378416584951346 |
| `filletOnly` | 30, 20, 150, 2.5 | 60000000 | 67500000 | 1.70018315638838 | 114762363.056215 | 114762363.056215 (step) | 0.478176512734231 |
| `stepOnly` | 30, 20, 190, 1 | 60000000 | 49500000 | 2.33927144795256 | 115793936.673652 | 115793936.673652 (step) | 0.482474736140216 |
| `thickAll` | 34, 24, 150, 1 | 46712802.7681661 | 46875000 | 2.43210519738864 | 114004931.127592 | 114004931.127592 (step) | 0.475020546364969 |
| `uniformDeep` | 30, 30, 150, 1 | 60000000 | — | — | — | 60000000 (root) | 0.25 |
| `uniformLimit` | 27, 27, 150, 1 | 74074074.0740741 | — | — | — | 74074074.0740741 (root) | 0.308641975308642 |
| `rootGoverned` | 28, 24, 170, 4 | 68877551.0204082 | 40625000 | 1.48864636949367 | 60476258.7606805 | 68877551.0204082 (root) | 0.286989795918367 |
| `rootToStep` | 28, 24, 170, 1 | 68877551.0204082 | 40625000 | 2.09256387601359 | 85010407.463052 | 85010407.463052 (step) | 0.35421003109605 |
| `ratioWarning` | 32, 20, 150, 3 | 52734375 | 67500000 | 1.61528593463814 | 109031800.588074 | 109031800.588074 (step) | 0.454299169116976 |
| `ratioNA` | 34, 20, 150, 3 | 46712802.7681661 | 67500000 | 1.67829015445689 | 113284585.42584 | 113284585.42584 (step) | 0.472019105941 |
| `fitShallowNA` | 30, 29.5, 150, 5 | 60000000 | 31025567.3656995 | — | — | — | — |
| `shoulderNA` | 40, 30, 60, 1 | 33750000 | 48000000 | 2.53648754078688 | 121751401.95777 | 121751401.95777 (step) | 0.507297508157376 |
| `plasticWarning` | 30, 20, 150, 0.5 | 60000000 | 67500000 | 2.89887763615108 | 195674240.440198 | 195674240.440198 (step) | 0.815309335167492 |
| `plasticNA` | 24, 16, 150, 0.5 | 93750000 | 105468750 | 2.71274036284062 | 286109335.143346 | 286109335.143346 (step) | 1.19212222976394 |
| `oversize` | 45, 30, 150, 3 | 26666666.6666667 | 30000000 | 1.86203141066813 | 55860942.320044 | 55860942.320044 (step) | 0.232753926333517 |

Deflection, mass and outcome:

| Fixture | δ_tip (m) | m (kg) | h/r; D/d; shoulder metric | Expected |
| --- | --- | --- | --- | --- |
| `baseline` | 0.0022554347826087 | 0.2025 | 5; 1.5; 0.38975 | Not accepted: peakStress only (step governs) |
| `reference` | 0.00203791767310789 | 0.20925 | 1.66666666666667; 1.5; 0.298928571428571 | Accepted |
| `filletOnly` | 0.0022554347826087 | 0.2025 | 2 (lower branch; computed 1.9999999999999996); 1.5; 0.359 | Accepted: fillet change alone fixes baseline |
| `stepOnly` | 0.00194274557165862 | 0.2133 | 5; 1.5; 0.307697368421053 | Accepted: step move alone fixes baseline |
| `thickAll` | 0.0014699556246073 | 0.2349 | 5; 1.41666666666667; 0.445588888888889 | Not accepted: mass only; DEPTH_SPAN warning (0.113) |
| `uniformDeep` | 0.00173913043478261 | 0.243 | absent | Not accepted: mass only; no step |
| `uniformLimit` | 0.00238563845649192 | 0.2187 | absent | Not accepted: mass only; uniform-limit fixture |
| `rootGoverned` | 0.00224139265350723 | 0.21276 | 0.5; 1.16666666666667; 0.281578431372549 | Accepted; root governs |
| `rootToStep` | 0.00224139265350723 | 0.21276 | 2 (exact; lower branch); 1.16666666666667; 0.32378431372549 | Accepted; same geometry with sharp fillet, so the step governs (switch) |
| `ratioWarning` | 0.00198757005774456 | 0.2106 | 2 (lower branch); 1.6; 0.372 | Accepted with KT_STEP_RATIO warning (D/d = 1.6, inclusive) and DEPTH_SPAN warning |
| `ratioNA` | 0.00177905888547686 | 0.2187 | 2.33333333333333; 1.7; 0.39525 | Model not applicable (KT_STEP_RATIO); also fails mass; DEPTH_SPAN warning |
| `fitShallowNA` | 0.00175037264086735 | 0.240975 | 0.05 (computed 0.0499999999999997); 1.01694915254237; 0.340758474576271 | Model not applicable (KT_FIT_SHALLOW); no Kt/peak; peakStress unevaluated; prediction not scorable |
| `shoulderNA` | 0.00124847826086957 | 0.2592 | 5; 1.33333333333333; 1.32194444444444 | Model not applicable (KT_SHOULDER_LENGTH); DEPTH_SPAN warning |
| `plasticWarning` | 0.0022554347826087 | 0.2025 | 10; 1.5; 0.4 | Not accepted: peakStress; PLASTICITY warning |
| `plasticNA` | 0.00440514605978261 | 0.162 | 8; 1.5; 0.31795 | Model not applicable (PLASTICITY); never Accepted |
| `oversize` | 0.000668276972624799 | 0.30375 | 2.5; 1.5; 0.553875 | Not accepted: mass, envelopeDepth; DEPTH_SPAN warning |

Branch-boundary references:
- `filletOnly` would give Kt 1.72959240364253 with the upper branch.
- `rootToStep` would give 2.09464015921861 with the upper branch.
- `ratioWarning` would give 1.65721825357834 with the upper branch.

Tests assert the lower-branch values.

**Derived targets.**
- The deflection limit needs a uniform depth h ≥ (4FL³/(E b δ_lim))^(1/3) = 26.9460364293674 mm. That costs m = 0.218262895077876 kg, above 0.215 kg, so **no uniform bar passes**.
- The mass limit allows a uniform depth of at most 26.5432098765432 mm.
- The stress limit alone needs 21.2132034355964 mm.
- From the baseline: the smallest passing radius at a = 150 mm is r = 2.5 mm, and the smallest passing step location at r = 1 mm is a = 190 mm.
- Prediction fixture: baseline → reference gives r = 0.575171039733651, a decrease.

**Solvability scan** (script only; tests need not reproduce the counts). It covered all 2,416,840 configured-step designs with d ≤ D:
- 30,963 accepted, the lightest 0.19737 kg (D 29.5, d 18.5, a 160, r 3 mm).
- 0 accepted uniform bars.
- 698 accepted designs that keep r = 1 mm, by moving the step and resizing.
- 8,212 accepted root-governed designs.
- 1,292,350 not applicable, mostly D/d > 1.6 combinations.

## Alternative-method and limiting checks

- **(a) Stepped deflection, numerically.**
  - Method: integrate the curvature M/(EI) twice from the clamp (θ(0) = v(0) = 0) by cumulative trapezoid, with a node exactly at x = a and the one-sided I on each segment.
  - Result: agreement with the closed form within 4.49e-10 relative for all 16 rows at n = 20,000 intervals per segment.
  - Convergence on the baseline is O(n⁻²): −4.217e-7, −1.054e-7, −2.636e-8 and −6.589e-9 at n = 500, 1000, 2000 and 4000.
  - A second method, the unit-load integral by 5-point Gauss–Legendre per segment, agrees within 7.8e-16.
  - Test assertions: trapezoid at a stated 1e-6 relative with n ≥ 1000 per segment; Gauss at 1e-12.
- **(b) Uniform limit.** For D = d ∈ {15, 27, 30, 50} mm and a ∈ {60, 150, 240} mm, δ equals FL³/(3EI) and σ_peak equals 6FL/(bh²) within 3.3e-16. The location is root and no Kt is reported. Assert at 1e-12, and assert that a and r have no effect.
- **(c) Kt fit.**
  - Spot values against the transcribed polynomial: 1e-9, as identical closed forms. Rows: the baseline, reference, filletOnly, rootGoverned and plasticWarning Kt values above.
  - External values: the EES example (1.318, fit −1.03e-4) and Mechsim (2.90, fit −3.87e-4), at 1e-3 relative.
  - Digitized chart: the D/d = 1.1 and 1.3 rows above at ±5% relative. The D/d = 3 and ≤ 1.05 rows are recorded for review, not asserted.
  - The adopted set is checked against the MechaniCalc set within 2% over the configured space, as documentation of transcription spread only.
- **Fit properties.**
  - Kt is non-increasing in r for every configured (D, d) with D/d ≤ 1.6.
  - The branch gap at h/r = 2 is ≤ 2.6%.
  - Kt does not depend on a or F.
- **Critical-section switching.**
  - `rootGoverned` → `rootToStep`: only r changes, and the location flips from root to step.
  - Moving the step outboard lowers σ_step linearly in (L − a), while σ_root is unchanged.
  - Test the tie rule by constructing equal σ_root and σ_step through configured constants: the location must be root.
- **Scaling.**
  - Stresses are linear in F.
  - δ is linear in F and proportional to 1/E.
  - Mass is independent of F and E.
  - Kt and the location are independent of F, E and b.
  - σ ∝ 1/b and δ ∝ 1/b.
- **Boundaries.**
  - Designs whose stress, deflection, mass or envelope equal their limits within REL_TOL pass, and one step beyond fails (construct the cases through configured limits).
  - At h/r = 20, r/h = 10, D/d = 1.6, the shoulder metric = 1.0 and plasticity = 0.8/1.0, the inclusive safe side raises no issue.
  - h/r = 2 uses the lower branch.
- **Invalid input** is rejected before analysis: d > D, out-of-range or off-grid values per the existing clamp/strict rules, non-finite values and locked-field changes.

## Integration notes for 46.2/46.3

- Pure modules: `challenge/bracket/` (types, schema), `geometry/bracket/` (design, validation, edits, `bracketOutline` with fillet arcs for display), `physics/bracket/` (constants including the Kt table, `kt`, analyze, applicability) and `evaluation/bracket/` (constraints, evaluate, explanations, primary metric). They are registered in the state registry (MM-05). Fixtures go in `test/fixtures/bracket.ts`.
- New-model persistence uses envelope v2 and import `ei-design` v2 (MM-18/MM-19). Absent quantities are omitted keys, never null or NaN, so key-for-key re-analysis on load stays exact.
- Explanation facts compare stored values only: the location change, the Kt ratio, the step nominal ratio (from a and d), the peak ratio and the mass delta. Guided wording ties the moment path to "why moving the step helps".
- Visualization: the elevation and moment strip read the stored analysis and the geometry outline only, with no formulas in UI or state. Fillets with r > h are drawn as arcs tangent to the arm face and meeting the deep face.

## Open items for owner review

- **K-1 (blocks 46.2 Kt code).** Verify the coefficient table, signs, ranges, the validity condition and its relation symbol against the printed *Peterson's Stress Concentration Factors* (Pilkey & Pilkey). Record the chart number and edition. Verify the same against the Roark table (record the edition) and decide whether the MechaniCalc variant reflects a different edition.
- **K-2.** Approve the conservative use of a for the source's L, and the strict-moment-at-shoulder convention.
- **K-3.** Approve the developer-proposed `KT_STEP_RATIO` thresholds (warning 1.5, not applicable 1.6) and the inclusive lower-branch rule at h/r = 2.
- **K-4.** Decide how to treat the fit being 6.6–13.6% below the 1951 chart for D/d ≤ 1.05, and the reported general underestimation by Peterson's photoelastic charts: accept and disclose, add a small-step warning, or require D/d ≥ 1.1 when a step exists.
- **K-5.** Approve the constants (F, L, b, aluminum record) and limits (120 MPa, 2.4 mm, 0.215 kg, 40 mm). Approve the peak-elastic-stress rule wording (MBR-16), and whether the a and r controls stay editable when D = d (recommended: editable, with "no step" shown).
