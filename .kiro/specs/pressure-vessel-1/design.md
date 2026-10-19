# Pressure Vessel I — model design and benchmark worksheet (task 69)

Companion to requirements.md, 2026-10-19, written before implementation. The worksheet values were produced by `worksheet.py` in this folder, a standalone script written from the equations below without reading or importing application code. It is an independent numeric fixture source, not human engineering review.

## Model `thinWallPressureVessel` v1

A closed thin-walled steel vessel under internal (gauge) pressure p: a cylindrical shell of inner radius r = D_i/2, length L (heads excluded) and wall t_s, closed by two hemispherical heads of the same inner radius and wall t_h. Linear-elastic membrane theory: stresses are uniform through the wall, the radial stress is neglected, and each section is in static equilibrium with the pressure on the projected area.

| Quantity | Formula | Notes |
| --- | --- | --- |
| Hoop stress (shell) | σ_h = p r / t_s | Free body of a half ring: p·2r·L = 2 σ_h t_s L |
| Longitudinal stress (shell) | σ_l = p r / (2 t_s) | Closed ends: p π r² = σ_l · 2π r t_s; so σ_h = 2 σ_l exactly |
| Head membrane stress | σ_hd = p r / (2 t_h) | Hemisphere free body: p π r² = σ_hd · 2π r t_h |
| Allowable stress | σ_a = σ_y / n | n = design factor, fixed |
| Internal volume | V = π r² L + (4/3) π r³ | Cylinder plus two hemispheres |
| Overall length | L_o = L + 2 (r + t_h) | Outside of head to outside of head |
| Mass | m = ρ [π((r + t_s)² − r²) L + (4/3) π((r + t_h)³ − r³)] | Exact solids; welds, nozzles and supports excluded |

Radius convention: the stress formulas use the inner radius, as the textbook thin-wall results are commonly stated. The alternative checks below quantify the error against the thick-wall (Lamé) solutions; the thin-wall screens keep it below about 5 %.

Sources to transcribe in owner review (edition and equation numbers pending engineering review): Hibbeler, *Mechanics of Materials* (thin-walled pressure vessels, r/t ≥ 10 rule); Gere & Goodno, *Mechanics of Materials* (spherical and cylindrical pressure vessels); Budynas & Nisbett, *Shigley's Mechanical Engineering Design* (thick-walled cylinders, used for the Lamé comparison); Timoshenko & Woinowsky-Krieger, *Theory of Plates and Shells* (membrane theory and the discontinuity at a head-shell junction, which this model does not include).

Stress check convention: each membrane stress is compared with the allowable separately. With the radial stress neglected, the Tresca equivalent stress of the shell (σ_h, σ_l, 0) is σ_h, so the hoop check equals a Tresca check of the shell; for the head (σ_hd, σ_hd, 0) it is σ_hd. The von Mises equivalent of the shell, √(σ_h² − σ_h σ_l + σ_l²) = (√3/2) σ_h, is lower, so the checks are conservative relative to it.

## Configuration

```json
{
  "id": "pressure-vessel-1", "version": 1,
  "model": { "id": "thinWallPressureVessel", "version": 1 },
  "title": "Pressure Vessel I", "difficulty": "intermediate", "allowedModes": ["guided", "parametric"],
  "material": { "id": "steel-educational", "name": "Steel (educational nominal)", "densityKgM3": 7850, "yieldStressPa": 250e6 },
  "designFactor": 2, "pressurePa": 4e6, "heads": "hemispherical",
  "initialDesign": { "id": "baseline", "innerDiameterM": 0.24, "shellLengthM": 1.2, "shellThicknessM": 0.0025, "headThicknessM": 0.0015, "materialId": "steel-educational" },
  "referenceDesign": { "id": "reference", "innerDiameterM": 0.4, "shellLengthM": 0.53, "shellThicknessM": 0.0065, "headThicknessM": 0.0035, "materialId": "steel-educational" },
  "lockedFields": ["materialId", "pressurePa", "designFactor", "heads"],
  "constraints": { "minVolumeM3": 0.1, "maxOverallLengthM": 1.0, "maxMassKg": 55 },
  "designLimits": {
    "innerDiameterM": { "minM": 0.2, "maxM": 0.5, "stepM": 0.01 },
    "shellLengthM": { "minM": 0.1, "maxM": 1.2, "stepM": 0.01 },
    "shellThicknessM": { "minM": 0.001, "maxM": 0.012, "stepM": 0.0005 },
    "headThicknessM": { "minM": 0.001, "maxM": 0.012, "stepM": 0.0005 }
  },
  "predictionPolicy": { "requiredOnIterations": [1, 3] }
}
```

The stress limit is not a configuration field: it is σ_y / n from the material and the design factor, so the two can never disagree. Loader cross-field rules: ranges ordered, design factor ≥ 1, design material equals the challenge material, designs in range, locked fields present.

Applicability screens (model constants, inclusive on the safe side):

| Code | Metric | Warning above | Not applicable above | Basis |
| --- | --- | --- | --- | --- |
| THIN_WALL_SHELL | t_s / r | 0.05 (r/t < 20) | 0.1 (r/t < 10) | Lamé hoop exceeds p r/t by 2.6 % at 0.05 and 5.2 % at 0.1 |
| THIN_WALL_HEAD | t_h / r | 0.05 | 0.1 | Same rule for the head (the sphere error is smaller, 0.16 % and 0.63 %) |
| PLASTICITY | max(σ_h, σ_hd) / σ_y | 0.8 | 1.0 | Shared convention of the other models |

Since σ_l = σ_h/2 and σ_a = σ_y/2, the longitudinal check can only fail when σ_h > σ_y, which is not applicable. Students therefore see the longitudinal stress pass while the hoop stress fails, which is the lesson of PVS-02(a).

## Worksheet (SI, unrounded; p = 4.0e6 Pa, σ_y = 250e6 Pa, n = 2, σ_a = 125e6 Pa, ρ = 7850 kg/m³)

Designs are (D_i, L, t_s, t_h) in metres. "Fails" lists failed checks in the fixed order.

| Fixture | Design | σ_h (Pa) | σ_l (Pa) | σ_hd (Pa) | V (m³) | L_o (m) | m (kg) | Status, fails, screens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | 0.24, 1.2, 0.0025, 0.0015 | 192000000 | 96000000 | 160000000 | 0.0615249505279025 | 1.443 | 20.098742146217955 | Not accepted: hoop, head, volume, overall length; no screens (σ/σ_y 0.768) |
| `reference` | 0.4, 0.53, 0.0065, 0.0035 | 123076923.07692309 | 61538461.53846154 | 114285714.28571428 | 0.10011208589439474 | 0.937 | 48.589316746521234 | Accepted |
| `equalHeads` | 0.4, 0.53, 0.0065, 0.0065 | 123076923.07692309 | 61538461.53846154 | 61538461.53846154 | 0.10011208589439474 | 0.943 | 61.02633432540411 | Not accepted: mass only |
| `thinHeads` | 0.4, 0.53, 0.0065, 0.003 | 123076923.07692309 | 61538461.53846154 | 133333333.33333333 | 0.10011208589439474 | 0.936 | 46.551754652207734 | Not accepted: head only |
| `wide` | 0.5, 0.18, 0.008, 0.004 | 125000000 | 62500000 | 125000000 | 0.10079276430267253 | 0.688 | 43.09857300110856 | Accepted with hoop and head exactly at the limit (inclusive) |
| `narrowAtAllowable` | 0.3, 1.2, 0.005, 0.0025 | 120000000 | 60000000 | 120000000 | 0.09896016858807848 | 1.505 | 50.77238170458582 | Not accepted: volume, overall length |
| `thickShellWarning` | 0.2, 1.2, 0.006, 0.003 | 66666666.666666664 | 33333333.333333332 | 66666666.666666664 | 0.04188790204786391 | 1.406 | 39.62698975902036 | Not accepted: volume, overall length; THIN_WALL_SHELL warning (0.06) |
| `thickWallNotApplicable` | 0.2, 0.6, 0.012, 0.012 | 33333333.333333332 | 16666666.666666666 | 16666666.666666666 | 0.02303834612632515 | 0.824 | 50.95816091189314 | Model not applicable: THIN_WALL_SHELL, THIN_WALL_HEAD (0.12); fails volume, applicability |
| `plasticityWarning` | 0.24, 1.2, 0.002, 0.0015 | 240000000 | 120000000 | 160000000 | 0.0615249505279025 | 1.443 | 16.48089975430724 | Not accepted: hoop, head, volume, overall length; PLASTICITY warning (0.96) |
| `plasticityNotApplicable` | 0.3, 0.8, 0.001, 0.001 | 600000000 | 300000000 | 300000000 | 0.07068583470577035 | 1.102 | 8.172854754390407 | Model not applicable: PLASTICITY (2.4); every stress, volume and length fail |
| `oversize` | 0.5, 1.2, 0.012, 0.012 | 83333333.33333333 | 41666666.666666664 | 41666666.666666664 | 0.3010692959690218 | 1.724 | 259.41690781266436 | Not accepted: overall length, mass |

Mass split (shell, heads) in kg: baseline 17.941242945569584, 2.15749920064837; reference 34.5357829026166, 14.053533843904628; equalHeads heads 26.4905514227875; wide 18.040382184938935, 25.05819081616963. Thin-wall ratios: baseline t_s/r 0.020833333333333336, t_h/r 0.0125; reference 0.032499999999999994, 0.017499999999999998.

Derived targets (inner radius from D_i): the minimum shell wall at the allowable is t_s = p r/σ_a and the minimum head wall t_h = p r/(2σ_a), half of it: 3.84/1.92 mm at D_i 240 mm, 4.8/2.4 at 300, 6.4/3.2 at 400 and 8/4 at 500. The shell length for exactly 100 L is 2.05 m at 240 mm (out of range), 1.215 m at 300 mm (out of range), 0.529 m at 400 mm and 0.176 m at 500 mm. With the 1000 mm overall length limit, no vessel narrower than 390 mm passes on the grid.

Prediction fixture: baseline → reference hoop stress ratio r = 0.6410256410256411 (a decrease).

Grid search (D-47), the configured step grid of 1,820,289 designs (31 × 111 × 23 × 23): the most design checks that a valid, applicable, warning-free design fails is 4, reached by four sets (hoop/head/overall length/mass 10460 designs, hoop/head/volume/overall length 3664, head/volume/overall length/mass 914, hoop/volume/overall length/mass 675). 514 designs are Accepted. The baseline is in the second set: the tie-break (D-47: far from passing on strength with plausible geometry) prefers a slender, thin-walled tank whose hoop utilization (1.536) is as high as the plasticity screen allows without a warning, and whose story ("a long, narrow tank that is overstressed, too long and still too small") leads straight into widening it, which is where the stress-grows-with-radius lesson starts. Equal-thickness heads never pass: no Accepted design has t_h ≥ t_s.

## Alternative-method and limiting checks

- Lamé thick-wall cylinder: σ_θ,max / (p r/t) = ((r+t)² + r²)/((r+t)² − r²) · t/r = 1.0050248756218902, 1.012654320987656, 1.0256097560975606 and 1.0523809523809515 at t/r = 0.01, 0.025, 0.05 and 0.1. The thin-wall hoop is unconservative by about t/(2r); the screens cap it near 2.6 % (warning) and 5.2 % (not applicable).
- Lamé thick-wall sphere: σ_t,max / (p r/(2t)) = ((r+t)³ + 2r³)/(2((r+t)³ − r³)) · 2t/r = 1.0000663344444034, 1.0004115017272956, 1.0016256938937345 and 1.006344410876132 at the same ratios.
- Exact axial equilibrium on the annulus, p π r² = σ π((r+t)² − r²): the thin-wall σ_l exceeds it by the factor 1 + t/(2r) (baseline 1.0104166666666652, reference 1.0162499999999994), so σ_l is conservative.
- Numerical quadrature (test code only): V and the shell and head material volumes by composite Simpson integration of the solid of revolution agree with the closed forms within 1e-12 relative.
- Identities: σ_h = 2 σ_l for every design; σ_hd = σ_l when t_h = t_s; σ_hd = σ_h when t_h = t_s/2.
- Scaling: every stress is linear in p and r and inversely proportional to its wall; V and L_o are independent of p, ρ and the walls (L_o depends on t_h only); m is linear in ρ.
- Monotonicity: mass increases with each of D_i, L, t_s and t_h; volume increases with D_i and L.
- Boundaries: a check whose value equals its limit within REL_TOL passes (the `wide` row), one step beyond fails (tests construct this through configured limits). A screen metric exactly at 0.05, 0.1, 0.8 or 1.0 produces no issue.
- Invalid input: non-finite, non-positive or out-of-range parameters, unknown parameters and a changed material are rejected before analysis.

## Integration

- Pure modules: `challenge/vessel/` (types, schema, loader, allowable stress), `geometry/vessel/` (design, validation, edits, display profile), `physics/vessel/` (constants, formulas, applicability, analyze), `evaluation/vessel/` (constraints, evaluate, metrics, explanations) and `evaluation/guided/vessel.ts`. Registered in `state/models.ts`, `state/runtimes.ts` (`state/vesselModel.ts`), `ui/models/registry.ts` (`ui/models/vessel/`). Fixtures in `test/fixtures/vessel.ts`.
- Views: 3D cutaway (lazy chunk, `LatheGeometry` of the pure display profile plus flat section faces) and the 2D half-section fallback in the main bundle (D-45 pattern, `viewport/webgl.ts`). The 2D drawing is to scale lengthwise and exaggerates the wall thicknesses by a disclosed factor so both walls stay visible; the 3D cutaway is to scale.
- Explanation facts: per-check utilization, the stored hoop/longitudinal ratio (always 2), and change facts as ratios of stored values only.
