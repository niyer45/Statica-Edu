# Heat Sink I — scoped model requirements (task 48.1)

Additive specification, 2026-10-17. Refines `../original-catalog/` HS-01–HS-08 under the shared contracts in `../multi-model-architecture/`. Third track in D-38 delivery order. Status: specification and independently computed worksheet only. The model is not implemented, the card stays unavailable until 48.3, and owner engineering review (29.2) of constants, equations, thresholds and wording is pending.

**HS-08 resolved (owner decision recorded 2026-10-17):** Heat Sink I uses a specified uniform effective convection coefficient (fan-assisted, 25 W/m²·K) plus a minimum fin-gap constraint and a separate gap applicability screen. A natural-convection spacing correlation is not used. It is recorded only as a possible second edition.

## Identity and learning objective

- HSK-01: Challenge `heat-sink-1`, version 1, title Heat Sink I, intermediate difficulty, Guided/Parametric modes. Model `plateFinHeatSink` version 1. Catalog copy (004 "Explore how geometry helps a compact heat sink move heat away.", concepts Heat transfer and Surface area) is supported as written, and no copy change is required. Geometry (fin count, thickness and height) is the only thing the learner changes. Heat transfer is modeled as steady conduction through the base and fins plus convection with a given coefficient, and the guidance must say the coefficient is given, not computed. Surface area is a displayed metric: total exposed area A_t, and its efficiency-weighted value η_o A_t.
- HSK-02: Learners discover that added fin surface area lowers the base temperature, with diminishing returns. Fin efficiency falls as fins get taller and thinner, thick fins add mass for little extra area, and dense fins run into a minimum gap. The baseline (few short, thick fins) runs too hot. More, thinner and taller fins within the height envelope pass. The guidance must say that the gap limit stands in for spacing-dependent airflow, which the model does not compute.

## Fixed values and adjustable design

- HSK-03 Fixed (locked):
  - Base footprint W = 60 mm (across the fins) × D = 60 mm (along the fins and the airflow), base thickness t_b = 4 mm.
  - Educational nominal aluminum: thermal conductivity k 200 W/m·K, density 2700 kg/m³.
  - Heat load Q = 25 W, uniform over the whole base mounting face. Ambient T∞ = 25 °C (stored 298.15 K).
  - Effective convection coefficient h = 25 W/m²·K, uniform on every exposed fin and base surface. It is described as low-speed fan-assisted airflow, assumed uniform and not computed.
  - Locked fields: base footprint, base thickness, material, heat load, ambient temperature, convection coefficient.
  - Fin layout: straight rectangular fins that span the full depth D, are evenly spaced, and have the outer fins flush with the base edges.
  - Base thickness stays fixed, as the 45.1 design recommended: R_base = 0.00556 K/W is only 0.59% of R_total at the reference, so an adjustable base would add a control with almost no effect.
- HSK-04 Adjustable:
  - Fin count N: integer 2–20, step 1.
  - Fin thickness t: 1.0–5.0 mm, 0.5 mm steps.
  - Fin height H (above the base surface): 5–45 mm, 1 mm steps.
  - The height range deliberately exceeds the 35 mm envelope, and the count range deliberately reaches gaps below both the 4 mm constraint and the 2 mm applicability limit, so each limit is a real constraint (D-07 practice).
  - Geometric validity: N must be an integer ≥ 2, and the gap s = (W − N t)/(N − 1) must be ≥ 1.0 mm (`minGeometricGapM`) so that fins never touch or merge. Anything else, including N = 1 (gap undefined), zero or negative gaps, off-range or non-finite values, is rejected with a typed error before analysis.
  - No orientation control: fins always run parallel to the configured airflow.
- HSK-05 Initial design: N = 4, t = 3 mm, H = 15 mm. Internal reference (never exposed to students): N = 10, t = 1.5 mm, H = 35 mm. The reference is one feasible design, not the only one. The full grid has 5289 valid designs, and 80 of them are Accepted. Every Accepted design has 8 ≤ N ≤ 12, t ≤ 2.0 mm and H ≥ 22 mm (design.md).

## Metrics and constraints

- HSK-06 Displayed metrics:
  - Base temperature (°C, one decimal; stored in K) and base temperature rise (K, two decimals).
  - Total thermal resistance R_total (K/W, display only).
  - Fin efficiency η_f and overall surface efficiency η_o (percent, one decimal).
  - Total exposed area A_t and effective area η_o A_t (cm²).
  - Mass (g), fin gap (mm, two decimals), fin height (mm), and the share of heat leaving through the fins (percent).
- HSK-07 Constraints, in order:
  - `baseTemperature` ≤ 55 °C (stored 328.15 K, unit K).
  - `mass` ≤ 130 g (stored 0.13 kg).
  - `finHeight` ≤ 35 mm (stored 0.035 m).
  - `finGap` ≥ 4 mm (stored 0.004 m), a lower bound.
  - `applicability` (bool).

  Upper bounds use `withinLimit` with REL_TOL. `finGap` uses a mirrored inclusive comparison, `value ≥ limit − |limit|·REL_TOL`, with the same non-finite rule; it is added in 48.2 as a shared helper `withinLowerLimit` with its own tests, and its utilization is limit/value. Margins: temperatureMarginK (T_max − T_base), massUsage (m/m_max) and gapMarginM (s − s_min). The 4 mm gap is a manufacturability and airflow-access design rule, an engineering-judgment value pending owner review.
- HSK-08 Prediction: checkpoints on iterations 1 and 3. The primary metric is the base temperature rise ΔT = T_base − T∞ (K, always > 0), named "base temperature rise" in the dialog. Using the rise rather than the absolute temperature keeps the ratio independent of the °C/K offset. Ratio band 0.98/1.02, as for the beam.
- HSK-09 Reflection prompt: "Using your tested designs, explain how changing the number, thickness and height of the fins changed the base temperature, the fin efficiency and the mass."

## Applicability and exclusions

- HSK-10 Screens: thresholds live in the model's constants module. They are evaluated inclusively with REL_TOL on the safe side (a value equal to a threshold raises no issue). All are engineering-judgment values pending owner review.
  - `FIN_GAP`, the gap s (a lower-bound screen): warning below 3.0 mm, not applicable below 2.0 mm. Fan-driven air through narrow channels slows sharply. At a fixed fan pressure, laminar channel velocity scales with s², so the air heats along the channel and bypasses the fins. The model's assumption that air sits at T∞ everywhere, with one h, is then unsupported. This screen is separate from the 4 mm constraint: the constraint is a design rule (Not accepted), while the screen is a model-trust boundary (Model not applicable). Both screen thresholds sit below the constraint, so every warned or not-applicable gap design already fails `finGap`.
  - `CHANNEL_ASPECT`, H/s: warning above 8, not applicable above 12. Deep, narrow channels starve the fin roots of airflow, so a single h over the whole fin height becomes questionable. Within the constraints (H ≤ 35 mm, s ≥ 4 mm) the maximum is 8.75. A few feasible designs are therefore Accepted with a warning, and none is not applicable.
  - `FIN_BIOT`, Bi = h t/(2k): warning above 0.01, not applicable above 0.1. This screens the 1D-fin assumption (temperature uniform across the thickness). The configured ranges cap Bi at 3.125e-4, so the screen is defense in depth for future configurations.

  Grid enumeration confirms that no design with s ≥ 4 mm is not applicable.
- HSK-11 Deliberately not screened:
  - Fin aspect H/t: with Bi ≤ 3.1e-4 the fin is isothermal across its thickness at any H/t, so the 1D fin equation holds for stubby fins (η_f → 1) and slender fins alike. HS-05's "fin aspect ratio" is therefore implemented as the channel aspect H/s, which bounds the convection assumption (owner question).
  - Fin depth/thickness: D/t ≥ 12 is guaranteed by the ranges (perimeter ≈ 2D; fin-end edges neglected).
  - Corrected-length tip: its error against the exact convective-tip fin is ≤ 5.6e-6 relative across the worksheet.
  - Spreading: heat input covers the full footprint by construction.
- HSK-12 Always-listed unsupported effects:
  - Radiation.
  - Spreading/constriction resistance from a source smaller than the base.
  - Spacing- and flow-dependent convection (h is specified, not computed; screened only).
  - Air temperature rise along the channels, and flow bypass.
  - Natural convection and orientation.
  - Fan curve and pressure drop.
  - Interface (contact or thermal-interface-material) resistance.
  - Transient warm-up.
  - Temperature-dependent properties.
  - Non-uniform heating and hot spots.
  - Two-dimensional conduction in fins (screened only).
  - Convection from fin end edges.

  Assumptions listed on every analysis: steady state; uniform heat flux over the base footprint; 1D conduction through the base; 1D fin conduction; constant properties; uniform specified h; air at T∞ everywhere; corrected-length adiabatic-tip fins; perfect fin–base contact.

## Verification and integration

- HSK-13 Benchmarks: implement every worksheet row in design.md at 1e-9 relative, plus the energy-balance, finite-difference, corrected-length, limiting, scaling and boundary checks listed there at their stated tolerances. Invalid geometry is rejected before analysis.
- HSK-14 Presentation: reuse the shared workbench.
  - Controls: an integer fin-count stepper plus numeric thickness and height inputs, all keyboard operable.
  - 3D view: a lazily loaded fin array with no static text overlays (D-26).
  - SVG fallback: a front elevation across the fins, with gap and height given in text.
  - Optional temperature coloring may use only the stored fin profile. The analysis stores θ/θ_b = cosh(m(L_c − x))/cosh(m L_c) and the absolute temperature (K) at x/H = 0, 0.25, 0.5, 0.75 and 1. The same values appear in a text/table equivalent, and the coloring has a legend so state is never shown by color alone. The UI computes no formula.
  - No flow animation.
  - The prediction dialog and history name the base temperature rise, never deflection or stress.
- HSK-15 Guided content (MM-21):
  - Inspect: find which limit the baseline misses and how much of its heat leaves through the fins.
  - Experiment: change one fin variable at a time and predict whether the base temperature rise goes up or down.
  - Compare: compare the temperature drop per gram added between thicker fins and more or taller fins.
  - Explain: connect surface area, fin efficiency and mass using tested values, and name one unmodeled effect, for example that real airflow depends on the gap.

  Hints must not state the reference values or say that a particular fin count works. The Parametric context text states that h is a given fan-assisted coefficient.
- HSK-16 Gating: the card remains unavailable until 48.3 verifies the integrated learning loop on desktop and Pixel 7, with keyboard, fallback and axe gates. Customer release additionally requires owner engineering review and manual/student QA. This specification adds no code.
