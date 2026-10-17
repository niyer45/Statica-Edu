# Original catalog — model selection, benchmarks and delivery order

Task 45.1 design companion to requirements.md, 2026-10-17. Proposed developer choices; no owner engineering review, implementation or executed application benchmark is claimed. References identify the established method to be transcribed in each 4x.1 specification. Those tasks must record exact edition, chapter/table and equation numbers checked against the source; this document does not claim verified page citations.

## Selection principles

1. **Bounded closed-form or small linear models.** Each challenge uses a standard textbook model that runs deterministically in the browser with no network, matching the existing pure-domain architecture. Large general solvers (FEA, CFD, time integration) are excluded from the first editions.
2. **Truthful scope over advertised breadth.** Where the card copy implies more than the model supports (bracket stress concentrations, heat-sink spacing), the model either covers it with a disclosed empirical method or the scope/copy decision goes to the owner (OC-15).
3. **One clear trade-off per challenge.** Each baseline fails for one teachable reason, at least one feasible design exists, and the obvious brute-force fix is blocked by another constraint (mirroring Cantilever Beam I, where a solid circle cannot pass).
4. **Applicability is first-class.** Each model screens the regimes its assumptions break down in, using the warning/not-applicable pattern already used for the beam.

## Recommended delivery order (D-38)

| Order | Challenge | Track | Rationale |
| --- | --- | --- | --- |
| 1 | Torsion Shaft I | 47 | Closest to the existing beam: circular prismatic member, closed-form, reuses circle/tube geometry conventions and the 3D viewport. Lowest physics risk; the best first consumer of the 45.2 contracts and 34.x multi-challenge integration. |
| 2 | Vibration Isolation I | 50 | Closed-form and numerically simple, but a non-geometric parameter design with a chart instead of a section editor. Delivering it second proves that the shared contracts are not beam-shaped before more models depend on them. |
| 3 | Heat Sink I | 48 | Closed-form fin theory with new geometry (fin array), thermal units and a new visualization. Needs owner decision HS-08 before 48.1 closes. |
| 4 | Mounting Bracket I | 46 | Reuses nominal bending, but its stress-concentration method needs owner decision MB-07 and careful transcription/validation of chart fits. It can move earlier if the owner approves the approach quickly; the risk is scoping, not computation. |
| 5 | Braced Frame I | 49 | Largest new effort: matrix stiffness solver, mechanism/singularity detection, topology editing and a 2D structural view. Benefits most from mature shared contracts. |

The graph keeps 46.1–50.1 dependent only on 45.1, so specifications for later tracks may proceed in parallel. Implementation and integration follow this order by default. Card screen order (002–006) is unchanged.

## Torsion Shaft I

**Model:** linear-elastic torsion of a straight circular shaft (Saint-Venant; plane sections remain plane for circular sections).

- J = π(D⁴ − d⁴)/32 (d = 0 for solid); φ = T L/(G J); τ_max = T (D/2)/J; m = ρ π(D² − d²) L/4.
- Torsional stiffness k_t = G J/L for display.
- References: Gere & Goodno, *Mechanics of Materials* (torsion of circular bars and tubes); Budynas & Nisbett, *Shigley's Mechanical Engineering Design* (torsion); Young & Budynas, *Roark's Formulas for Stress and Strain* (torsion; thin-walled tube torsional buckling under elastic stability).

**Applicability (provisional thresholds set in 47.1):** τ_max/τ_yield (plasticity, warning 0.8 / not applicable 1.0, following the beam convention); D/t for tubes (thin-wall torsional buckling); surface shear strain γ = τ/G (small-twist).

**Provisional constants and feasibility check** (standalone script, not application code): steel educational nominal G = 79 GPa, ρ = 7850 kg/m³, T = 400 N·m, L = 0.8 m. Limits: twist ≤ 1.0°, τ ≤ 80 MPa, mass ≤ 4.5 kg, OD ≤ 50 mm.

| Design | J (m⁴) | Twist (°) | τ (MPa) | Mass (kg) | Outcome |
| --- | --- | --- | --- | --- | --- |
| Baseline solid Ø30 | 7.952e-8 | 2.919 | 75.45 | 4.439 | Not accepted: twist only |
| Solid Ø39.2 (meets twist) | 2.318e-7 | 1.001 | 33.82 | 7.579 | Fails mass (no solid design passes) |
| Tube 50/44 (reference candidate) | 2.456e-7 | 0.945 | 40.71 | 2.782 | Accepted; D/t = 16.7 |
| Tube 50/40 | 3.623e-7 | 0.641 | 27.60 | 4.439 | Accepted at baseline mass |

**Benchmark plan (47.1):** hand worksheet for the rows above at 1e-9 relative; d → 0 equals solid; thin-wall J ≈ 2π r_m³ t convergence as t/r_m → 0 (stated tolerance); J = Ixx + Iyy from existing `sectionProperties` as a cross-check for circles only; φ linear in T and L, ∝ 1/G; τ independent of L; invalid bore (d ≥ D, wall below minimum) rejected before analysis.

## Vibration Isolation I

**Model:** single-DOF mass m on a linear spring k and viscous damper c, harmonic base motion, steady state.

- ω_n = √(k/m), f_n = ω_n/2π, ζ = c/(2√(k m)), r = f/f_n.
- Absolute transmissibility TR(r, ζ) = √[(1 + (2ζr)²)/((1 − r²)² + (2ζr)²)].
- Relative displacement ratio Z/Y = r²/√[(1 − r²)² + (2ζr)²].
- Static deflection δ_st = m g/k, so f_n = (1/2π)√(g/δ_st): a static-deflection limit directly bounds how low f_n can go.
- Peak transmissibility at r_p = √[(√(1 + 8ζ²) − 1)/(4ζ²)].
- Worst in-band TR is evaluated analytically: for fixed ζ, TR rises up to r_p and then falls monotonically, so the band maximum is TR(clamp(r_p, r_min, r_max)). It is not a sampled approximation.
- References: Rao, *Mechanical Vibrations* (harmonically excited single-DOF systems, base excitation, transmissibility); Thomson & Dahleh, *Theory of Vibration with Applications*; *Harris' Shock and Vibration Handbook* (vibration isolation).

**Provisional constants and feasibility check:** m = 50 kg, operating band 25–50 Hz. Limits: worst in-band TR ≤ 0.12, δ_st ≤ 8 mm, peak TR ≤ 6. Baseline: stiff mounts f_n = 30 Hz, ζ = 0.05, which puts resonance inside the band (worst TR 10.06), fails. Lightly damped mounts (ζ ≤ 0.05) can isolate the band but fail the resonance-peak limit (peak 10.06–25.02). ζ = 0.1 gives a feasible f_n window of 5.57–7.55 Hz; ζ = 0.2 gives 5.57–6.07 Hz; ζ = 0.3 cannot meet the in-band limit within the sag limit. Excitation amplitude and clearance limits are set in 50.1.

**Benchmark plan (50.1):** closed-form fixtures; TR(√2, ζ) = 1 for all ζ; ζ = 0 limit 1/|1 − r²|; exact peak formula versus dense evaluation (stated tolerance); δ_st–f_n identity; alternative-method check by integrating m z̈ + c ż + k z = −m ÿ (RK4 or similar in test code only) to steady state and comparing amplitude ratios within a stated tolerance; resonance-in-band baseline detection; out-of-range ζ/k rejected.

## Heat Sink I

**Model:** steady 1D conduction/convection for a plate-fin heat sink with uniform heat input over the base.

- m_f = √(2h/(k t)) (fin depth ≫ t), L_c = H + t/2, η_f = tanh(m_f L_c)/(m_f L_c).
- A_f = 2 D_p L_c per fin; A_b = W D_p − N t D_p; A_t = N A_f + A_b.
- η_o = 1 − (N A_f/A_t)(1 − η_f), R_conv = 1/(η_o h A_t), R_base = t_b/(k W D_p).
- T_base = T_∞ + Q (R_base + R_conv); m = ρ (W D_p t_b + N t H D_p).
- Gap = (W − N t)/(N − 1).
- References: Bergman, Lavine, Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer* (extended surfaces: fin equation, corrected length, fin efficiency, fin arrays/overall surface efficiency). For the HS-08 alternative: Bar-Cohen & Rohsenow (1984), thermally optimum spacing of vertical natural-convection parallel plates, *ASME Journal of Heat Transfer*.

**Recommended HS-08 choice:** a specified effective coefficient (proposed 25 W/m²·K, described as low-speed fan airflow, assumed uniform) plus a minimum-gap constraint and applicability screen. This keeps the model closed-form and honest: the learner is told that real convection depends on spacing/flow and that the model refuses designs below the supported gap. The natural-convection correlation is a candidate second edition.

**Provisional constants and feasibility check:** aluminum k = 200 W/m·K, ρ = 2700 kg/m³, base 60 × 60 × 4 mm, Q = 25 W, T_∞ = 25 °C, h = 25 W/m²·K. Limits: T_base ≤ 55 °C, mass ≤ 130 g, fin height ≤ 35 mm, gap ≥ 4 mm. The standalone energy balance (fin + base convection) closed to 25.000 W in every row.

| Design (N, t, H) | Gap (mm) | η_f | T_base (°C) | Mass (g) | Outcome |
| --- | --- | --- | --- | --- | --- |
| Baseline 4, 3 mm, 15 mm | 16.00 | 0.993 | 118.2 | 68 | Not accepted: temperature only |
| 8, 2 mm, 30 mm | 6.29 | 0.962 | 57.1 | 117 | Not accepted: temperature |
| 10, 1.5 mm, 35 mm (reference candidate) | 5.00 | 0.935 | 48.5 | 124 | Accepted |
| 8, 4 mm, 35 mm | 4.00 | 0.972 | 52.7 | 220 | Not accepted: mass (thick fins waste material) |

**Benchmark plan (48.1):** hand worksheet; energy balance; h → 0 and k → ∞ (η_f → 1); fin profile θ(x)/θ_b = cosh(m(L_c − x))/cosh(m L_c) versus a finite-difference 1D fin solved in test code (stated tolerance); N = 1 and zero-gap edge cases rejected or handled explicitly; °C/K conversions.

## Mounting Bracket I

**Recommended model (MB-07a):** planar stepped flat bar of thickness b, root depth D over length a from the wall, arm depth d to the tip at length L, shoulder fillet radius r, tip force F.

- σ_root = 6 F L/(b D²) (nominal; wall-clamp concentration excluded and disclosed).
- σ_step = K_t(D/d, r/d) · 6 F (L − a)/(b d²).
- σ_peak = max(σ_root, σ_step), with the governing location reported.
- Tip deflection by unit-load integration: δ = (F/(3E)) [ (L³ − (L − a)³)/I_D + (L − a)³/I_d ], with I = b h³/12. The fillet's stiffness contribution is neglected.
- Mass from the stepped outline (fillet area included or explicitly neglected in 46.1).
- References: Pilkey & Pilkey, *Peterson's Stress Concentration Factors* (stepped flat bar with shoulder fillets in bending — chart and curve-fit coefficients with validity ranges); Budynas & Nisbett, *Shigley's* (stress-concentration charts and notch use for static loading); Young & Budynas, *Roark's* (stress concentration factors). 46.1 must transcribe the exact fit, its coefficients and range, and verify fit values against chart readings.

**Why this scope:** it gives the card's "stress concentrations" concept a disclosed, standard engineering basis, and teaches load paths as the bending-moment distribution: the critical section can switch between the root and the step as the learner moves material. It does not claim to resolve local 3D stress fields. Alternatives for the owner: (b) a knee-braced bracket solved by statics (load-path emphasis, no concentration, overlaps Braced Frame); (c) defer pending a more capable solver.

**Feasibility:** not computed in 45.1, because the Kt coefficients must be transcribed and checked from the source first. 46.1 must show baseline failure on peak stress at the step, a feasible reference, and that simply thickening everything fails mass.

**Benchmark plan (46.1):** hand nominal/deflection fixtures; uniform bar (D = d, a arbitrary) reduces to the existing cantilever rectangle formulas; Kt fit spot values versus chart readings (stated tolerance); critical-section switching fixtures; parameters outside the fit range are not applicable.

## Braced Frame I

**Recommended model:** 2D pin-jointed frame, linear-elastic axial members, direct stiffness method.

- Member stiffness EA/L in global coordinates; assembly; supports applied by DOF elimination; solve K u = P.
- Member force N = (EA/L) · (direction cosines · Δu).
- Compression capacity uses the lesser of the yield load and the pinned-end Euler load π²EI/L² (K = 1). Utilization = |N|/capacity.
- Mechanism detection: pivoted factorization with a pivot tolerance relative to the largest diagonal term, plus a post-solve equilibrium residual check. A failure of either reports unstable with no displacements.
- Proposed template for 49.1: one bay × two storeys, pinned bases, four columns and two beams always present, and two candidate diagonals per storey (single or X bracing). Member sizes come from a small catalog of tube sections.
- References: Hibbeler, *Structural Analysis* (method of joints, determinacy and stability); McGuire, Gallagher & Ziemian, *Matrix Structural Analysis* (direct stiffness method); Timoshenko & Gere, *Theory of Elastic Stability* (Euler column buckling).

**Feasibility:** topology-dependent constants are deferred to 49.1. Structural facts to encode as fixtures: an unbraced pin-jointed storey is a mechanism; one diagonal per storey makes the frame determinate (method of joints); X bracing adds one redundant per storey (force method).

**Benchmark plan (49.1):** method-of-joints hand fixtures; force-method fixture for one redundant; reaction equilibrium within tolerance for every stable random topology/size; load linearity and 1/E displacement scaling; mechanism fixtures with no numeric output; compression member exceeding the Euler load fails utilization.

## Inputs to 45.2 (shared contracts)

45.2 must generalize these MVP assumptions without breaking Cantilever Beam I or v1 saves:

- `Challenge` is beam-specific (section limits, `load.forceN`, `support: 'fixedRoot'`, `LockedField` union, `BeamDesign`). Needs a model-discriminated challenge/config/design union with the beam variant unchanged.
- `Analysis.modelId` has one literal value; `evaluate`, constraint ids/units and `efficiency` are beam metrics. Needs per-model analysis/evaluation types with shared acceptance semantics (OC-05/06) and units (`m`, `Pa`, `kg`, plus rad/deg, Hz, K, W/K, dimensionless).
- Prediction scoring (Requirement 14.7) is defined on tip deflection. Needs a per-model primary metric and a not-scorable outcome (OC-07).
- Persistence key/validation re-analyzes with the beam solver. Needs model-dispatched re-analysis and a migration that leaves v1 beam saves valid.
- Viewport/fallback is beam mesh/section specific. Needs a per-model visualization slot with a main-bundle text/SVG fallback (OC-12).
- Explanation facts and Guided content are beam-specific. Needs per-challenge content that stays grounded.
