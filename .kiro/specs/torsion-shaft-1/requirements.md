# Torsion Shaft I — scoped model requirements (task 47.1)

Additive specification, 2026-10-17. Refines `../original-catalog/` TS-01–TS-07 under the shared contracts in `../multi-model-architecture/`. First track in D-38 delivery order. Status: specification and independently computed worksheet only. The model is not implemented, the card stays unavailable, and owner engineering review (29.2) of constants, equations, thresholds and wording is pending.

## Identity and learning objective

- TSH-01: Challenge `torsion-shaft-1`, version 1, title Torsion Shaft I, intermediate difficulty, Guided/Parametric modes. Model `circularShaftTorsion` version 1. Catalog copy (002 "Balance torsional stiffness, weight, and packaging in a rotating shaft", concepts Torsion and Section properties) is supported as written; no copy change is required.
- TSH-02: Learners discover that torsional stiffness scales with the polar moment J ∝ D⁴ − d⁴. A solid shaft cannot meet the twist limit within the mass limit, while a hollow tube near the packaging diameter can. The lesson mirrors Cantilever Beam I (material away from the axis) for a different load type, and the guidance must say that the parallel is about material placement, not identical formulas.

## Fixed values and adjustable design

- TSH-03 Fixed (locked): length 0.8 m; educational nominal steel (shear modulus G 79 GPa, density 7850 kg/m³, allowable shear stress 80 MPa, yield shear stress 145 MPa for the plasticity screen only); steady torque 400 N·m applied at the free end; opposite end fixed against rotation. Locked fields: length, material, torque, support.
- TSH-04 Adjustable: section kind solid circle or circular tube; diameter for solid; outer and inner diameter for tube. Ranges: solid diameter 10–60 mm and tube outer diameter 15–60 mm, both in 0.5 mm steps; tube minimum wall 2 mm; inner diameter from 0 up to outer − 4 mm. The ranges deliberately exceed the 50 mm packaging limit so the limit is a real constraint, following the beam's D-07 practice. Tube default wall when switching: 4 mm. No orientation control (axisymmetric).
- TSH-05 Initial design: solid Ø30 mm. Internal reference (never exposed to students): tube 50/44 mm. The reference is one feasible design, not the only one.

## Metrics and constraints

- TSH-06 Displayed metrics: angle of twist (degrees, two decimals), maximum shear stress (MPa), mass (kg), outer diameter (mm), torsional stiffness GJ/L (N·m/rad) and polar moment J (display).
- TSH-07 Constraints, in order: `twist` ≤ 1.0° (stored as 0.017453292519943295 rad), `shearStress` ≤ 80 MPa, `mass` ≤ 4.5 kg, `outerDiameter` ≤ 50 mm, `applicability` (bool). Inclusive comparisons use `withinLimit` with REL_TOL. Margins: massUsage, twistMargin, stressMargin.
- TSH-08 Prediction: checkpoints on iterations 1 and 3. Primary metric is the angle of twist, named "twist angle" in the dialog. Ratio band 0.98/1.02, as for the beam.
- TSH-09 Reflection prompt: "Using your tested designs, explain how moving material away from the shaft's center changed its twist, shear stress and mass."

## Applicability and exclusions

- TSH-10 Screens (inclusive, REL_TOL): `PLASTICITY_SHEAR` τ_max/τ_yield, warning above 0.8 and not applicable above 1.0. `TUBE_SLENDERNESS` D/t for tubes, warning above 40 and not applicable above 100, mirroring the beam screen; a refined τ/τ_cr torsional-buckling screen is an owner-review option. The configured ranges cap D/t at 30, so this screen is defense in depth.
- TSH-11 The 45.1 surface-strain screen (TS-05) is subsumed by `PLASTICITY_SHEAR`: in the elastic range γ = τ/G ≤ τ_yield/G ≈ 0.18%. A separate threshold would never trigger first, so none is added. Length is locked at L/D ≥ 13.3, so Saint-Venant end effects need no screen.
- TSH-12 Always-listed unsupported effects: rotating dynamics and critical speed, fatigue, combined bending or axial load, stress concentrations at keyways/shoulders/fixtures, end-fitting compliance, torsional buckling of thin tubes (screened only), plasticity (screened only), and self-weight bending.

## Verification and integration

- TSH-13 Benchmarks: implement every worksheet row in design.md at 1e-9 relative, plus the alternative-method and limiting cases listed there. Invalid geometry is rejected before analysis.
- TSH-14 Presentation: reuse the shared workbench. Controls are the solid/tube palette subset plus numeric diameters. The 3D shaft shows a display-only twist line rotated by the stored angle × an exaggeration factor capped at the configured maximum, with no static text overlays (D-26). The SVG fallback shows the cross-section and the twist summary. The prediction dialog and history name the twist angle, never deflection.
- TSH-15 Guided content (MM-21): Inspect: find which limit the solid baseline misses. Experiment: change one diameter at a time and predict the twist. Compare: compare twist per kilogram across solid and hollow designs. Explain: connect J, twist and mass using tested values and name one unmodeled effect. Hints must not state the reference dimensions.
- TSH-16 Gating: the card remains unavailable until 47.3 verifies the integrated learning loop on desktop and Pixel 7, with keyboard, fallback and axe gates. Customer release additionally requires owner engineering review and manual/student QA.
