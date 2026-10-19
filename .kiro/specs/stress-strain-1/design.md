# Stress and Strain I — model design and benchmark worksheet (task 72)

Companion to requirements.md, 2026-10-19. The worksheet below was produced by `worksheet.py` in this folder: a standalone Python script written from the equations here, using 40-digit decimal arithmetic and importing no application code. It is a separate numeric fixture source, not human engineering review.

## Model `axialTieRod` v1

Linear-elastic axial tension of a straight, prismatic, solid circular rod. The load passes through the centroid, so the stress is uniform over every cross-section away from the ends (Saint-Venant), and the rod stretches uniformly.

- A = π d²/4
- σ = P/A (independent of the material)
- ε = σ/E (Hooke's law), δ = ε L = P L/(A E)
- m = ρ A L, k = E A/L (axial stiffness, N/m)
- σ_allow = σ_y/n (the stress check's limit for the chosen material), yield ratio σ/σ_y (applicability screen)

References (to be confirmed in owner review, edition and equation numbers pending engineering review): Gere & Goodno, *Mechanics of Materials* (axially loaded members, Hooke's law, changes in length); Hibbeler, *Mechanics of Materials* (stress and strain, axial load); Budynas & Nisbett, *Shigley's Mechanical Engineering Design* (design factor); Callister & Rethwisch, *Materials Science and Engineering: An Introduction* (typical properties of metals).

### Materials (typical textbook values, not certified data)

| id | Name shown | E | σ_y | ρ | σ_allow = σ_y/2 |
| --- | --- | --- | --- | --- | --- |
| `steel` | Structural steel | 200 GPa | 250 MPa | 7850 kg/m³ | 125 MPa |
| `aluminium` | Aluminium alloy 6061-T6 | 69 GPa | 276 MPa | 2700 kg/m³ | 138 MPa |
| `titanium` | Titanium alloy Ti-6Al-4V (annealed) | 114 GPa | 830 MPa | 4430 kg/m³ | 415 MPa |

Steel follows the structural-steel values used in Gere & Goodno and Hibbeler; aluminium and titanium follow the typical values tabulated in Callister. Different textbooks quote slightly different values (for example a lower 6061-T6 yield strength); the owner review should confirm the set. Material names contain no digits that facts would quote: explanation facts name materials only by a digit-free label (see Explanation facts).

## Configuration sketch

```json
{
  "id": "stress-strain-1", "version": 1, "title": "Stress and Strain I",
  "model": { "id": "axialTieRod", "version": 1 },
  "difficulty": "introductory", "allowedModes": ["guided", "parametric"],
  "lengthM": 2, "forceN": 20000, "designFactor": 2, "support": "pinnedTop",
  "materials": [ { "id": "steel", "name": "Structural steel", "shortName": "Steel", "elasticModulusPa": 200e9, "yieldStressPa": 250e6, "densityKgM3": 7850 }, … ],
  "initialDesign": { "id": "baseline", "diameterM": 0.013, "materialId": "steel" },
  "referenceDesign": { "id": "reference", "diameterM": 0.02, "materialId": "aluminium" },
  "lockedFields": ["lengthM", "forceN", "designFactor", "support"],
  "constraints": { "maxElongationM": 0.002, "maxMassKg": 2 },
  "diameterLimits": { "minM": 0.006, "maxM": 0.03, "stepM": 0.0005 },
  "predictionPolicy": { "requiredOnIterations": [1, 3] },
  "visualization": { "elongationExaggerationFactor": 100, "maxVisualElongationFractionOfL": 0.25 }
}
```

The stress limit is not a configured number: it is σ_y/n of the chosen material, computed in the evaluation layer. Loader cross-field rules: range min ≤ max; material ids unique and non-empty; each design's material is listed and its diameter is in range; every locked field is listed; `ROD_TOO_SHORT` (L/d_max ≥ 10).

## Worksheet (SI, unrounded; P = 20000 N, L = 2 m, n = 2)

| Fixture | Material, d (m) | A (m²) | σ (Pa) | ε | δ (m) | m (kg) | EA/L (N/m) | σ_allow (Pa) | σ/σ_y | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | steel, 0.013 | 0.000132732289614169 | 150679236.063333 | 0.000753396180316664 | 0.00150679236063333 | 2.08389694694245 | 13273228.9614169 | 1.25e+8 | 0.602716944253331 | notAccepted: stress, mass |
| `reference` | aluminium, 0.02 | 0.000314159265358979 | 63661977.2367581 | 0.000922637351257364 | 0.00184527470251473 | 1.69646003293849 | 10838494.6548848 | 1.38e+8 | 0.230659337814341 | accepted |
| `titaniumSlim` | titanium, 0.015 | 0.000176714586764426 | 113176848.420903 | 0.000992779372113187 | 0.00198555874422637 | 1.56569123873281 | 10072731.4455723 | 4.15e+8 | 0.136357648699884 | accepted |
| `titaniumMargin` | titanium, 0.0155 | 0.000188691908756237 | 105992886.138203 | 0.000929762159107043 | 0.00185952431821409 | 1.67181031158026 | 10755438.7991055 | 4.15e+8 | 0.127702272455666 | accepted |
| `steelStrong` | steel, 0.0145 | 0.000165129963854314 | 121116722.448054 | 0.000605583612240268 | 0.00121116722448054 | 2.59254043251272 | 16512996.3854314 | 1.25e+8 | 0.484466889792214 | notAccepted: mass |
| `aluminiumSameDiameter` | aluminium, 0.0145 | 0.000165129963854314 | 121116722.448054 | 0.00175531481808773 | 0.00351062963617546 | 0.891701804813293 | 5696983.75297382 | 1.38e+8 | 0.438828704521933 | notAccepted: elongation |
| `titaniumSameDiameter` | titanium, 0.0145 | 0.000165129963854314 | 121116722.448054 | 0.00106242738989521 | 0.00212485477979041 | 1.46305147974922 | 9412407.93969587 | 4.15e+8 | 0.145923761985607 | notAccepted: elongation |
| `aluminiumThin` | aluminium, 0.011 | 0.0000950331777710912 | 210452817.311597 | 0.00305004083060286 | 0.00610008166120571 | 0.513179159963893 | 3278644.63310265 | 1.38e+8 | 0.762510207650714 | notAccepted: stress, elongation |
| `titaniumThin` | titanium, 0.0065 | 0.0000331830724035422 | 602716944.253331 | 0.00528699073906431 | 0.0105739814781286 | 0.294002021495384 | 1891435.12700190 | 4.15e+8 | 0.726164993076303 | notAccepted: stress, elongation |
| `aluminiumHeavy` | aluminium, 0.022 | 0.000380132711084365 | 52613204.3278993 | 0.000762510207650714 | 0.00152502041530143 | 2.05271663985557 | 13114578.5324106 | 1.38e+8 | 0.190627551912679 | notAccepted: mass |
| `steelMax` | steel, 0.03 | 0.000706858347057703 | 28294212.1052258 | 0.000141471060526129 | 0.000282942121052258 | 11.0976760488059 | 70685834.7057703 | 1.25e+8 | 0.113176848420903 | notAccepted: mass |
| `warningAluminium` | aluminium, 0.0105 | 0.0000865901475145687 | 230973160.042660 | 0.00334743710206753 | 0.00669487420413507 | 0.467586796578671 | 2987360.08925262 | 1.38e+8 | 0.836859275516884 | notAccepted: stress, elongation; PLASTICITY warning |
| `tinySteel` | steel, 0.006 | 0.0000282743338823081 | 707355302.630646 | 0.00353677651315323 | 0.00707355302630646 | 0.443907041952238 | 2827433.38823081 | 1.25e+8 | 2.82942121052258 | modelNotApplicable (PLASTICITY 2.83 > 1); stress, elongation also fail; never Accepted |

### Derived limits

| Material | d for stress ≥ | d for stretch ≥ | d for mass ≤ | d without warning ≥ | Lightest rod passing stress and stretch |
| --- | --- | --- | --- | --- | --- |
| Steel | 14.273 mm | 11.284 mm | 12.736 mm | 11.284 mm | 2.512 kg (strength governs) > 2.0 kg |
| Aluminium | 13.584 mm | 19.211 mm | 21.716 mm | 10.739 mm | 1.565 kg (stiffness governs) |
| Titanium | 7.833 mm | 14.946 mm | 16.953 mm | 6.193 mm | 1.554 kg (stiffness governs) |

- **No steel design passes**: the stress check needs d ≥ 14.27 mm, which already weighs 2.51 kg.
- **Stiffness alone gives nearly the same mass for all three metals**: ρPL²/(Eδ_max) = 1.570, 1.565 and 1.554 kg, because E/ρ ≈ 25.5–25.7 MJ/kg for each. Strength is what separates them here. This is also why no design can fail both elongation and mass: that would need E/ρ < PL²/(δ_max m_max) = 20 MJ/kg.
- Accepted grid designs (step 0.5 mm): aluminium 19.5–21.5 mm (5 designs), titanium 15–16.5 mm (4 designs).
- Steel's no-warning bound equals its stretch bound (0.8 σ_y/E = 1.0e-3 = δ_max/L), a coincidence of the chosen numbers.

### Baseline choice (D-47)

The exhaustive search over the 147 grid designs (49 diameters × 3 materials) finds that the most design checks an applicable design without warnings can fail is **2** (12 designs: steel 13–14 mm fail stress and mass; aluminium 11–13.5 mm and titanium 6.5–7.5 mm fail stress and elongation). D-47's tie-break prefers designs far from passing; it is a preference, not a count rule. The baseline is **steel 13 mm** (the smallest steel rod in the tie, so the furthest steel rod from passing stress) because:

- steel is the natural starting material, and its two failures (strength and weight) cannot both be fixed by the diameter, which is the lesson of the challenge: thickening fixes stress and makes the mass worse, so the material must change;
- no single-parameter change from it is Accepted (aluminium 13 mm fails stress; titanium 13 mm fails elongation by 0.64 mm).

An alternative baseline, aluminium 11 mm (σ 1.53× and δ 3.05× their limits), is further from passing; this is listed as an owner question.

Prediction fixture: baseline → reference elongation ratio 1.22463768115942 (an increase: the reference trades stretch margin for lower mass).

## Alternative-method and limiting checks

- Castigliano: δ = ∂U/∂P with U = P²L/(2AE), by central difference, equals the closed form (worksheet: identical to 15 digits for the baseline).
- Strain energy equals external work: Pδ/2 = σ²AL/(2E) (15.0679236063333 J for the baseline).
- Area by quadrature: the inscribed regular N-gon area (N/2)(d/2)² sin(2π/N) converges to πd²/4 from below (N = 4096: relative error 3.9e-7); tests assert monotone convergence.
- Hooke consistency: σ = Eε and δ = εL within 1e-12 for every design.
- Scaling: δ linear in P and L, inversely proportional to E and to d²; σ independent of E and L; m linear in L and ρ; k = P/δ.
- Boundaries: designs whose stress, elongation or mass equal their limits within REL_TOL pass, one relative step beyond fails (constructed via configured limits in tests). A yield ratio exactly 0.8 gives no warning and exactly 1.0 stays applicable (inclusive safe side).
- Invalid input: non-finite, non-positive or out-of-range diameters, an unlisted or non-string material, and a design object carrying a locked field with a different value are rejected before analysis.

## Pure modules and integration

- `challenge/axial/` (types, schema, loader), `geometry/axial/` (design, validate, edit: `setDiameter` clamp/strict, `setMaterial`), `physics/axial/` (`formulas.ts` shared with Learn, `materials.ts` typical values, `constants.ts`, `applicability.ts`, `analyze.ts`, `types.ts`), `evaluation/axial/` (constraints, evaluate, metrics, explain), `evaluation/guided/axial.ts`, `state/axialModel.ts`, registered in `state/models.ts` and `state/runtimes.ts`; UI in `ui/models/axial/`. Worksheet fixtures in `test/fixtures/axial.ts`.
- Explanation facts (grounded rule, Property 27 style): per-constraint utilization facts, one model-limitation fact; change facts: area ratio with stress ratio (inverse), E ratio and elongation ratio, mass ratio, material change (named by digit-free short names), pass/fail changes.
- Views: the 2D elevation scales the rod width by a fixed px/m from the largest allowed diameter and draws the rod length compressed (the 2 m rod is far longer than it is wide); it says so in the summary. The drawn stretch is the latest tested δ × 100, capped at 25 % of L, display only.

## Learn module design (SSL)

- `learn/axialDemo.ts`: `rodResponse({ forceN, lengthM, diameterM, material })` returning area, stress, strain, elongation, axial stiffness, yield ratio and a `beyondYield` flag, all by calls to `physics/axial/formulas.ts`; `strainOf(δ, L)`; demo defaults (2 m, 10 mm, 10 kN) and control ranges; `demoMaxElongationM(kind)` so each drawing keeps one exaggerated scale.
- `learn/modules/stressStrain.ts`: the five steps in SSL-02 plus Apply it → `stress-strain-1`.
- `ui/learn/demos/axial.tsx`: area (diameter slider), strain (elongation slider and a 1 m / 2 m choice), Hooke (material choice), yield (load slider; per-material table and a stress–strain line chart, each line ending at the yield point, beyond-yield rows labelled in text), length (length slider). Each has a text readout of every value it draws.

## Owner questions

1. Material values: confirm structural steel 200 GPa / 250 MPa / 7850 kg/m³, 6061-T6 69 GPa / 276 MPa / 2700 kg/m³, Ti-6Al-4V annealed 114 GPa / 830 MPa / 4430 kg/m³ (typical textbook values; some textbooks quote 6061-T6 yield nearer 255–270 MPa, which would not change any fixture outcome but would change numbers).
2. Design factor n = 2 on yield, and the 2 mm stretch and 2 kg mass limits.
3. Baseline: steel 13 mm (chosen for the lesson) versus aluminium 11 mm (furthest from passing among the tied designs).
4. Whether a cost or availability note for titanium belongs in the reference dialog (cost is not modeled).
