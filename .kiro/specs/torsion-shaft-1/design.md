# Torsion Shaft I — model design and benchmark worksheet (task 47.1)

Companion to requirements.md, 2026-10-17. The worksheet was produced by a standalone script written from the equations below, without application code. It is a separate numeric fixture source, not human engineering review.

## Model `circularShaftTorsion` v1

Linear-elastic Saint-Venant torsion of a straight prismatic circular shaft. Plane cross-sections remain plane and circular, so J equals the polar second moment. Shear stress is linear in radius.

- A = π(D² − d²)/4, J = π(D⁴ − d⁴)/32 (d = 0 for solid)
- φ = T L/(G J) [rad], τ_max = T (D/2)/J [Pa], m = ρ A L [kg], k_t = G J/L [N·m/rad]

References to transcribe with edition/equation numbers during 47.2: Gere & Goodno, *Mechanics of Materials* (torsion of circular bars and tubes); Budynas & Nisbett, *Shigley's Mechanical Engineering Design* (torsion). E is not needed by the model. If a material record must carry E for schema reuse, E = 200 GPa implies ν = E/(2G) − 1 = 0.2658, which is physically plausible for steel.

## Proposed configuration sketch

```json
{
  "id": "torsion-shaft-1", "version": 1, "title": "Torsion Shaft I",
  "model": { "id": "circularShaftTorsion", "version": 1 },
  "difficulty": "intermediate", "allowedModes": ["guided", "parametric"],
  "material": { "id": "steel-educational", "name": "Steel (educational nominal)",
    "shearModulusPa": 79e9, "densityKgM3": 7850, "allowableShearStressPa": 80e6, "yieldShearStressPa": 145e6 },
  "lengthM": 0.8, "torqueNm": 400, "support": "fixedEnd",
  "initialDesign": { "id": "baseline", "section": { "kind": "circle", "diameterM": 0.03 }, "lengthM": 0.8, "materialId": "steel-educational" },
  "referenceDesign": { "id": "reference", "section": { "kind": "tube", "outerDiameterM": 0.05, "innerDiameterM": 0.044 }, "lengthM": 0.8, "materialId": "steel-educational" },
  "lockedFields": ["lengthM", "materialId", "torqueNm", "support"],
  "constraints": { "maxTwistRad": 0.017453292519943295, "maxShearStressPa": 80e6, "maxMassKg": 4.5, "maxOuterDiameterM": 0.05 },
  "sectionLimits": { "circle": { "diameterM": { "minM": 0.01, "maxM": 0.06, "stepM": 0.0005 } },
                     "tube": { "outerDiameterM": { "minM": 0.015, "maxM": 0.06, "stepM": 0.0005 }, "minWallM": 0.002 } },
  "sectionDefaults": { "tubeWallM": 0.004 },
  "allowedSections": ["circle", "tube"],
  "predictionPolicy": { "requiredOnIterations": [1, 3] },
  "visualization": { "twistExaggerationFactor": 10, "maxVisualTwistRad": 1.5707963267948966 }
}
```

Field names are indicative; 47.2 fixes them in the zod schema. Circle/tube section shapes and `validateSection` semantics may be reused from `geometry/`, provided torsion-specific limits are typed separately and the beam schema is unchanged.

## Worksheet (SI, unrounded; G = 79e9 Pa, ρ = 7850 kg/m³, T = 400 N·m, L = 0.8 m)

| Fixture | D, d (m) | J (m⁴) | φ (rad) | φ (°) | τ_max (Pa) | m (kg) | τ/τ_y | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` solid | 0.030, 0 | 7.95215640439916e-8 | 0.0509375407801534 | 2.91850610547831 | 75451232.2806022 | 4.43907041952238 | 0.520353326073119 | Not accepted: twist only |
| `reference` tube | 0.050, 0.044 | 2.45623850824591e-7 | 0.0164912035121748 | 0.944876360338937 | 40712658.6706816 | 2.78181746290069 | 0.280776956349528 | Accepted; D/t 16.67 |
| `tubeEqualMass` | 0.050, 0.040 | 3.62264902867073e-7 | 0.0111814113907654 | 0.64064768169036 | 27604109.370952 | 4.43907041952238 | 0.190373168075531 | Accepted at baseline mass |
| `heavySolid` | 0.0395, 0 | 2.38994703762358e-7 | 0.0169486304408658 | 0.971084992788562 | 33055125.8067011 | 7.69562180228866 | 0.2279663848738 | Not accepted: mass only |
| `oversizeSolid` | 0.060, 0 | 1.27234502470387e-6 | 0.00318359629875959 | 0.182406631592394 | 9431404.03507528 | 17.7562816780895 | 0.0650441657591399 | Not accepted: mass, outerDiameter |
| `oversizeTube` | 0.060, 0.056 | 3.06845637661422e-7 | 0.0132008815320423 | 0.756354797638215 | 39107611.5386753 | 2.28858741628709 | 0.269707665783967 | Not accepted: outerDiameter only; D/t 30 |
| `warningSolid` | 0.025, 0 | 3.8349519697141e-8 | 0.105624084561726 | 6.05181426031982 | 130379729.380881 | 3.08268779133499 | 0.899170547454349 | Not accepted: twist, stress; PLASTICITY_SHEAR warning |
| `tinySolid` | 0.010, 0 | 9.8174770424681e-10 | 4.12594080319243 | 236.398994543743 | 2037183271.57626 | 0.493230046613597 | 14.0495398039742 | Model not applicable (plasticity); never Accepted |

Derived targets: the twist limit requires J ≥ T L/(G φ_lim) = 2.32084170179574e-7 m⁴. A solid shaft therefore needs d ≥ 39.2113 mm, which gives m ≥ 7.58 kg > 4.5 kg, so **no solid design passes**. Prediction fixture: baseline → reference gives r = 0.3237534293881777, which is a decrease.

## Alternative-method and limiting checks

- Numerical quadrature: J = ∫ 2π r³ dr from d/2 to D/2 (composite Simpson, test code only) agrees with the closed form within 1e-12 relative for every worksheet row. The standalone script measured ≤ 4.5e-16.
- Circular identity: J = Ixx + Iyy from the existing beam `sectionProperties` for circles/tubes, within 1e-12 relative. This is a transcription cross-check only; it is never used for noncircular sections.
- Thin-wall limit: for D = 50 mm, 2π r_m³ t / J − 1 = −7.50e-3, −1.73e-3, −4.16e-4 and −1.02e-4 at t = 4, 2, 1 and 0.5 mm. The error falls about 4× per halving of t (O(t²)). Assert the sign, the monotonic decrease and |error| < 2e-3 at t ≤ 2 mm.
- Zero bore: a tube with d = 0 equals the solid of the same D for every output.
- Scaling: φ linear in T and L; φ ∝ 1/G; τ independent of L and G; m linear in L.
- Boundaries: designs whose twist, stress, mass or OD equal their limits within REL_TOL pass, and one ulp-scale step beyond fails (construct via configured limits in tests). Plasticity at exactly 0.8 and 1.0 produces no warning or not-applicable issue respectively (inclusive safe side).
- Invalid input: d ≥ D, wall < 2 mm, out-of-range diameters, non-finite values, a section kind outside {circle, tube} and locked-field changes are rejected before analysis.

## Integration notes for 47.2/47.3

- Pure modules: `challenge/torsion/` (types, schema), `geometry/torsion/` (design, validation, edits), `physics/torsion/` (constants, analyze, applicability), `evaluation/torsion/` (constraints, evaluate, explanations, primary metric), registered in the state registry (MM-05). Tests go next to the modules; the worksheet fixtures go in `test/fixtures/torsion.ts`.
- New-model persistence uses envelope v2 and import `ei-design` v2 (MM-18/MM-19).
- Explanation facts: compare twist ratio with the J ratio (inverse) and mass ratio between tested designs, using stored values only.
- Viewport: reuse the lazy viewport chunk pattern with a shaft mesh from `geometry.sectionOutline` for circle/tube. Twist is display-only (`ui/mesh` may read the stored φ; no formulas in UI).
