# Vibration Isolation I — scoped model requirements (task 50.1)

Additive specification, 2026-10-17. Refines `../original-catalog/` VI-01–VI-07 under the shared contracts in `../multi-model-architecture/`. Second track in D-38 delivery order. Status: specification and independently computed worksheet only. No code was written, the model is not implemented, and the card stays unavailable until 50.3. Owner engineering review (29.2) of constants, equations, thresholds and wording is pending.

## Identity and learning objective

- VIB-01: Challenge `vibration-isolation-1`, version 1, title Vibration Isolation I, advanced difficulty, Guided/Parametric modes. Model `sdofBaseIsolation` version 1. The catalog copy (006 "Tune a component to keep unwanted vibration out of its operating range.", concepts Natural frequency and Vibration, discipline Dynamics) is supported as written; no copy change is required. The learner tunes the natural frequency away from the operating band and checks how much vibration is transmitted inside it.
- VIB-02: Learners discover three things. Isolation needs a natural frequency well below the operating band (frequency ratio above √2). Softer mounts isolate better but sag more, and the sag limit sets a floor on f_n. Damping trades resonance control for high-frequency isolation: lightly damped mounts isolate the band but amplify too much while running up through resonance, and heavily damped mounts cannot isolate enough within the sag limit. The guidance must say that this is steady-state frequency response, not a simulation of motion over time.

## Fixed values and adjustable design

- VIB-03 Fixed (locked): rigid component mass 50 kg, supported only vertically. Operating band 25–50 Hz. Harmonic base displacement amplitude Y = 0.2 mm, the same at every frequency from 0 to 50 Hz. Standard gravity 9.80665 m/s². Mount linear stroke 20 mm, used only by the applicability screen. Locked fields: mass, operating band, base amplitude and mount stroke. Gravity is a model constant, not a design field.
- VIB-04 Adjustable: total isolator stiffness k, 20–2000 kN/m in 0.5 kN/m steps. As in the beam, the step sets input granularity and is not a validity rule. The second control is the isolator material, chosen from a discrete list. Each material sets an equivalent viscous damping ratio ζ: steel coil spring 0.02, natural rubber 0.05, neoprene 0.10, butyl rubber 0.20 and highly damped elastomer 0.30. These ζ values are educational nominal values, not supplier data. Stiffness and material are independent: any material can be sized to any stiffness in the range. The damping coefficient follows from c = 2ζ√(k m) and is display-only. The stiffness range deliberately extends past the sag and stroke limits so those limits are real constraints, following the beam's D-07 practice.
- VIB-05 Initial design: k = 1800 kN/m, natural rubber (f_n = 30.20 Hz, resonance inside the band). Internal reference, never exposed to students: k = 85 kN/m, neoprene. The reference is one feasible design, not the only one. 125 stiffness grid values pass across two materials (design.md).

## Metrics and constraints

- VIB-06 Displayed metrics: natural frequency f_n (Hz, two decimals). Damping ratio ζ and damping coefficient c (N·s/m, display). Worst in-band transmissibility and the frequency where it occurs (Hz). Isolation efficiency (1 − TR)·100 % at that frequency, shown only when TR < 1. Frequency ratio at the band minimum. Peak transmissibility over 0–50 Hz and its frequency. Static deflection (mm). Peak relative displacement amplitude (mm). Stiffness (kN/m).
- VIB-07 Constraints, in order:
  1. `worstInBandTransmissibility` ≤ 0.12 (unit `ratio`).
  2. `staticDeflection` ≤ 8 mm (stored as 0.008 m, unit `m`).
  3. `peakTransmissibility` ≤ 6 over 0–50 Hz (unit `ratio`).
  4. `relativeDisplacement` ≤ 1.5 mm clearance (stored as 0.0015 m, unit `m`), the peak relative displacement amplitude over 0–50 Hz.
  5. `applicability` (bool).

  Inclusive comparisons use `withinLimit` with REL_TOL. Margins: `isolationMargin` (1 − TR_worst/limit), `sagUsage` and `clearanceUsage`. The `Hz` unit appears only in displayed metrics; no constraint is expressed in Hz.
- VIB-08 Prediction: checkpoints on iterations 1 and 3. The primary metric is worst in-band transmissibility, named "worst vibration transmitted in the operating band" in the dialog. Ratio band 0.98/1.02, as for the beam. The metric is always finite and positive for a valid applicable design, so outcomes are scorable. The MM-13 not-scorable path still applies if a stored result ever lacks it.
- VIB-09 Reflection prompt: "Using your tested designs, explain how changing the mount stiffness and damping moved the natural frequency and changed the vibration reaching the component, its sag and its resonance peak."

## Applicability and exclusions

- VIB-10 Screens (inclusive, REL_TOL), in this order:
  - `SPRING_STROKE`: (δ_st + Z_peak)/stroke. Warning above 0.8; not applicable above 1.0. Outside this range the mount is no longer a linear spring (bottoming, buffers).
  - `DAMPING_RATIO`: ζ. Warning above 0.35; not applicable above 0.5. A viscous equivalent stands in for elastomer damping that is really hysteretic. The config schema accepts 0 < ζ ≤ 1 and the configured materials stop at 0.30, so this screen is defense in depth, like the torsion D/t screen.

  Each code appears in at most one list, with not-applicable checked first, as in the beam checker. Within the configured range, `SPRING_STROKE` warns or refuses only designs that already fail `staticDeflection`.
- VIB-11 Not screened, with reasons:
  - The band definition (0 < f_min < f_max), Y > 0 and m > 0 are config-schema rules, not design screens.
  - The excitation-amplitude-versus-linear-range check in VI-05 is covered by `SPRING_STROKE`.
  - Run-up through resonance is screened by the steady-state amplitudes in constraints 3–4 and labeled a conservative screen. The model computes no transient amplitude.
  - The mounts are assumed bonded and linear in both tension and compression. Lift-off when Z_peak > δ_st (stiff designs) is disclosed as an assumption, not screened.
  - Resonance always lies below 50 Hz for configured designs (f_n ≤ 31.83 Hz). Peak transmissibility and peak relative displacement therefore depend only on ζ, and with these limits they reject the same materials (design.md). Both are kept because they mean different things: force amplification versus rattle space. Removing one is an owner-review option.
- VIB-12 Always-listed unsupported effects:
  - multi-degree-of-freedom response, rocking and coupled modes
  - nonlinear, amplitude-dependent or hysteretic mount behavior, and friction
  - frequency-dependent stiffness and damping (elastomer dynamic stiffening)
  - temperature, creep and ageing of elastomers
  - coil-spring surge (internal resonances)
  - shock and transient excitation
  - startup and run-up transient amplitude (screened only by steady-state peaks)
  - support or foundation flexibility
  - acoustic and flanking transmission paths
  - excitation from the component itself (forced, as opposed to base, excitation)
  - lift-off and bottoming contact (screened only through `SPRING_STROKE`)

## Verification and integration

- VIB-13 Benchmarks: implement every worksheet row in design.md at 1e-9 relative, plus the alternative-method and limiting checks listed there at their stated tolerances. These include the dense-grid maximum, the RK4 steady state and the r_p derivation check. Invalid inputs are rejected before analysis.
- VIB-14 Presentation: reuse the shared workbench. Controls are a numeric stiffness input with a slider (the slider scale is a 50.3 choice; logarithmic is recommended) and an accessible material radio group that shows each ζ. The primary visualization has two parts:
  - A static spring–damper–mass schematic. Any display-only sag offset comes from the stored δ_st and is capped. It has no animation and no oscillating motion.
  - A frequency-response chart of TR against frequency (0–60 Hz) from the model's pure response function. It marks the operating band, the 0.12 and 6 limit lines, the f_n, worst in-band and peak points from the stored analysis, and uses pattern plus text, not color alone. A table equivalent gives the same values.

  The main-bundle fallback is the table plus a text summary. The prediction dialog and history name the worst in-band transmissibility, never deflection or twist. No wording or motion may imply time simulation (50.3).
- VIB-15 Guided content (MM-21), by phase:
  - Inspect: find which limits the baseline misses and where its natural frequency sits relative to the band.
  - Experiment: change stiffness alone and predict the worst in-band transmissibility.
  - Compare: compare a lightly and a heavily damped material at the same stiffness.
  - Explain: connect natural frequency, frequency ratio and damping to the tested values and name one unmodeled effect.

  Hints must not state the reference stiffness or material, or the feasible windows.
- VIB-16 Gating: the card remains unavailable until 50.3 verifies the integrated learning loop on desktop and Pixel 7, including keyboard, fallback and axe gates. Customer release also requires owner engineering review and manual/student QA.
