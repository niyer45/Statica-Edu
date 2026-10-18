# Owner review checklist: open questions across the challenge specifications

Task 55, compiled 2026-10-17 for the owner's pre-release engineering review ([task 29.2][tasks]).

**What this is.** One list of every open owner question in the challenge specifications, plus the developer-written UI copy that still needs owner wording review. Under the owner policy of 2026-10-17, **every default stays live as implemented**. This document decides nothing and changes nothing.

**How to read an item.** Each item gives the current default, its spec id and where it lives (a challenge JSON in `src/challenge/challenges/`, a constants module in `src/physics/<model>/constants.ts`, or a UI file in `src/ui/models/<model>/index.tsx`, with line numbers as of 586e496). Checking a box means the owner reviewed the item. Write the date and decision on the same line, for example `— 2026-11-02: keep` or `— 2026-11-02: change to 1.5 mm (see note)`.

Every challenge has these open items in common (OC-14, [D-34][dec]):

- Its constants, equations, thresholds, benchmarks and wording need recorded owner engineering review (29.2).
- It needs manual/student QA ([30, 31.2, 32][tasks]).
- Passing tests is development evidence only.

---

## 1. Cantilever Beam I (runnable since the MVP)

- [ ] **29.2 beam checklist.** Run the seven checks in [MILESTONE4.md § Owner engineering review checklist][m4]: SI conversions, section properties, deflection, stress and mass equations, baseline failure and reference pass, warnings, wording, and snapshot provenance. Record reviewer, date, build, evidence and disposition for each.
- [ ] **Constants and thresholds.** [DECISIONS.md § Open questions][dec] still lists "Final challenge constants and applicability thresholds are pending engineering review." (`cantilever-beam-1.json`).
- [ ] **Beam copy.** `BEAM_LIMITS_NOTICE` "Idealized beam approximation, not a structural certification", tagline "Reduce deflection within mass and stress limits.", solver label "Euler–Bernoulli · Beam solver" (`src/ui/models/beam.tsx:20–29`).
- [ ] **44.3 manual mode checks.** Owner manual Guided/Parametric checks on the release candidate, including screen-reader and touch checks under 30.1 ([tasks 44.3][tasks]).

## 2. Torsion Shaft I (`torsion-shaft-1`, card 003, available since D-42)

Sources: [requirements][ts-r] and [design][ts-d]; `torsion-shaft-1.json`; [`src/ui/models/torsion/index.tsx`][ts-ui].

**Constants & limits**
- [ ] Material, educational nominal steel: G 79 GPa, ρ 7850 kg/m³, allowable shear 80 MPa, yield shear 145 MPa (screen only). Load case: torque 400 N·m, length 0.8 m, one end fixed (TSH-03).
- [ ] Constraints: twist ≤ 1.0°, shear ≤ 80 MPa, mass ≤ 4.5 kg, OD ≤ 50 mm (TSH-07).
- [ ] Ranges: solid Ø 10–60 mm and tube OD 15–60 mm, both in 0.5 mm steps; minimum wall 2 mm; default wall 4 mm (TSH-04).
- [ ] Baseline is solid Ø30. The hidden reference is tube 50/44 (TSH-05).
- [ ] Display twist exaggeration ×10, capped at 90° (`visualization` in the JSON; TSH-14).

**Applicability screens/thresholds** (`TORSION_THRESHOLDS`)
- [ ] `PLASTICITY_SHEAR` τ/τ_y: warning 0.8, not applicable 1.0 (TSH-10).
- [ ] `TUBE_SLENDERNESS` D/t: warning 40, not applicable 100, mirroring the beam. The spec names a refined τ/τ_cr torsional-buckling screen as an **owner-review option** (TSH-10).
- [ ] The surface-strain screen (45.1 TS-05) was dropped because plasticity subsumes it, and there is no L/D screen because L/D ≥ 13.3 (TSH-11). Confirm both.

**Wording & copy** (index.tsx)
- [ ] Limits notice (l.11): "Idealized circular-shaft torsion, not a structural certification"
- [ ] Tagline (l.15): "Limit twist within shear stress, mass and packaging limits." Solver label (l.19): "Saint-Venant · Circular shaft torsion"
- [ ] Drawer (l.21): "Available with an idealized circular-shaft torsion model. Length, torque, material, and support remain fixed by the challenge."
- [ ] Mode copy (l.16–18). Guided: "Solid and hollow shaft presets, diameter controls, and step-by-step prompts." Parametric: "Precise diameter editing with the same validated torsion model." Parametric label: "Direct shaft diameter editing".
- [ ] Prediction (l.23–25). Title: "Predict twist". Question: "Compared with ${previous}, how will your new shaft change its twist angle?" Legend: "Predicted change in twist angle". Margin labels "Mass usage / Twist margin / Stress margin" (l.30–32).
- [ ] Guided steps (l.43–46). The Compare hint draws the beam parallel ("…torsion uses the polar moment rather than bending stiffness"). TSH-02 requires the guidance to say the parallel is about material placement, not identical formulas.
- [ ] Challenge statement and reflection prompt (TSH-09) in `torsion-shaft-1.json`.

**References to transcribe**
- [ ] Gere & Goodno, *Mechanics of Materials*, and Budynas & Nisbett, *Shigley's*: the torsion sections still need edition and equation numbers ([design][ts-d] §Model; `src/physics/torsion/shaft.ts:8–10`).

**Verification items**
- [ ] The primary view is a main-bundle SVG shaft elevation, not the 3D shaft TSH-14 specified (D-42). The replacement 3D view is task 54.2 (see §7).

## 3. Vibration Isolation I (`vibration-isolation-1`, card 006, available since D-43)

Sources: [requirements][vi-r] and [design][vi-d] (§Open questions Q1–Q5); `vibration-isolation-1.json`; [`src/ui/models/vibration/index.tsx`][vi-ui].

**Constants & limits**
- [ ] Mass 50 kg; band 25–50 Hz; base amplitude 0.2 mm at every frequency from 0 to 50 Hz; stroke 20 mm; g = 9.80665 m/s² (VIB-03). **Q3:** is a constant 0.2 mm amplitude acceptable as an educational scenario? It means about 2 g at 50 Hz ([design][vi-d] §Derived targets).
- [ ] Stiffness 20–2000 kN/m in 0.5 kN/m steps (VIB-04). Baseline 1800 kN/m natural rubber; hidden reference 85 kN/m neoprene (VIB-05).
- [ ] **Q2:** material names and ζ (steel coil spring 0.02, natural rubber 0.05, neoprene 0.10, butyl rubber 0.20, highly damped elastomer 0.30) are educational nominal values, not supplier data. Keep the labels, or switch to neutral names such as "Mount A–E" (VIB-04)?
- [ ] Constraints: worst in-band TR ≤ 0.12, static deflection ≤ 8 mm, peak TR ≤ 6, relative displacement ≤ 1.5 mm (VIB-07).
- [ ] **Q1:** peak TR and clearance reject the same materials (ζ ≤ 0.05). Keep both, or drop one (VIB-11)?
- [ ] **Q4:** only two materials are feasible, and the butyl window is narrow (23 grid values; 125 accepted designs in total). Is that suitable for advanced difficulty?

**Applicability screens/thresholds** (`VIBRATION_THRESHOLDS`)
- [ ] `SPRING_STROKE` (δ_st + Z_peak)/stroke: warning 0.8, not applicable 1.0 (VIB-10).
- [ ] `DAMPING_RATIO` ζ: warning 0.35, not applicable 0.5 (defense in depth; VIB-10).
- [ ] Not screened, disclosed as assumptions instead: lift-off when Z_peak > δ_st, and run-up transients (VIB-11).

**Wording & copy** (index.tsx)
- [ ] **Q5:** is it acceptable to label the run-up resonance checks a "conservative steady-state screen" (VIB-11, VIB-02)?
- [ ] Limits notice (l.12): "Idealized steady-state vibration isolation, not an engineering certification"
- [ ] Tagline (l.16): "Keep vibration out of the operating band within sag, resonance and rattle-space limits." Solver label (l.20): "Single degree of freedom · Steady-state base isolation"
- [ ] Drawer (l.22–23): "Available with an idealized steady-state vibration isolation model. Component mass, operating band, base vibration and mount stroke remain fixed by the challenge."
- [ ] Mode copy (l.17–19). Guided: "Mount stiffness and material controls, a frequency-response chart, and step-by-step prompts." Parametric: "Precise stiffness and material editing with the same validated vibration model." Parametric label: "Direct mount stiffness and material editing".
- [ ] Prediction (l.25–27). Title: "Predict transmitted vibration". Question: "Compared with ${previous}, how will your new mount change the worst vibration transmitted in the operating band?" Legend: "Predicted change in the worst vibration transmitted in the operating band". Margin labels "Isolation margin / Sag usage / Clearance usage" (l.32–34).
- [ ] Guided steps (l.44–69), including "The chart is steady-state response at each frequency, not motion over time." Also the challenge statement and reflection prompt (VIB-09) in the JSON.

**References to transcribe**
- [ ] Rao, *Mechanical Vibrations*; Thomson & Dahleh, *Theory of Vibration with Applications*; *Harris' Shock and Vibration Handbook*. Each needs edition, section and equation numbers ([design][vi-d] §Model; `src/physics/vibration/response.ts:12–15`).

**Verification items**
- [ ] None beyond 29.2 and the references. The numeric cross-checks (golden-section, dense grid, RK4) are development evidence ([design][vi-d]).

## 4. Heat Sink I (`heat-sink-1`, card 004, available since D-43)

Sources: [requirements][hs-r] and [design][hs-d]; `heat-sink-1.json`; [`src/ui/models/heatSink/index.tsx`][hs-ui]. The owner settled HS-08 on 2026-10-17 (D-40): a specified effective h with a minimum-gap rule. Tasks 48.1 and HANDOFF mention "seven open owner questions", but the spec does not number them. The items below are every point the spec marks as pending owner review.

**Constants & limits**
- [ ] Convection coefficient h = 25 W/m²·K: fixed, uniform, "low-speed fan-assisted airflow" (HSK-03, D-40). Its plausibility check is under Verification items.
- [ ] Al k 200 W/m·K, ρ 2700 kg/m³; base 60 × 60 × 4 mm; Q 25 W; T∞ 25 °C (HSK-03).
- [ ] Base thickness is fixed, not adjustable. HS-03 allowed an "owner-approved adjustable base"; HSK-03 explains R_base is 0.59% of R_total (HSK-03).
- [ ] Ranges: N 2–20, t 1.0–5.0 mm (0.5 mm steps), H 5–45 mm (1 mm steps); geometric gap ≥ 1 mm (HSK-04). Baseline 4 × 3 mm × 15 mm; hidden reference 10 × 1.5 mm × 35 mm (HSK-05).
- [ ] Constraints: base temperature ≤ 55 °C, mass ≤ 130 g, fin height ≤ 35 mm, fin gap ≥ 4 mm. HSK-07 calls the 4 mm gap "an engineering-judgment value pending owner review".

**Applicability screens/thresholds** (`HEAT_SINK_THRESHOLDS`). HSK-10: "All are engineering-judgment values pending owner review."
- [ ] `FIN_GAP` s: warning below 3 mm, not applicable below 2 mm.
- [ ] `CHANNEL_ASPECT` H/s: warning 8, not applicable 12. A few Accepted designs carry this warning (`acceptedWarning` row).
- [ ] `FIN_BIOT` h t/(2k): warning 0.01, not applicable 0.1 (defense in depth).
- [ ] The HS-05 "fin aspect ratio" screen is implemented as the channel aspect H/s; fin H/t is not screened. HSK-11 marks this as an owner question.

**Wording & copy** (index.tsx)
- [ ] Limits notice (l.13): "Idealized plate-fin heat sink model, not a thermal certification"
- [ ] Tagline (l.17): "Keep the base temperature down within mass, fin height and fin gap limits." Solver label (l.21): "1D conduction and convection · Plate-fin heat sink"
- [ ] Drawer (l.23–24): "Available with an idealized plate-fin heat sink model. The base, material, heat load, air temperature and the given convection coefficient remain fixed by the challenge."
- [ ] Mode copy (l.18–20). Guided: "Fin count, thickness and height controls, and step-by-step prompts." Parametric: "Precise fin editing with the same validated heat sink model. The convection coefficient is a given fan-assisted value, not computed." Parametric label: "Direct fin array editing".
- [ ] Prediction (l.26–28). Title: "Predict base temperature rise". Question: "Compared with ${previous}, how will your new fin array change the base temperature rise?" Legend: "Predicted change in base temperature rise". Margin labels "Temperature margin (K) / Mass usage / Fin gap margin (mm)" (l.34–36).
- [ ] Guided steps (l.47–70) and the challenge statement ("…the convection coefficient is a given value for low-speed fan-assisted airflow, not computed by the model."). HSK-01 and HSK-02 require saying h is given, and that the gap limit stands in for spacing-dependent airflow.

**References to transcribe**
- [ ] Bergman, Lavine, Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer*, extended-surfaces chapter: edition and equation numbers. Also transcribe the chapter's accuracy criterion for the corrected-length tip ([design][hs-d] §Model; `src/physics/heatSink/fin.ts:6–11`).

**Verification items**
- [ ] **h ≈ 25 plausibility.** The laminar parallel-plate estimate (Nu ≈ 7.54, k_air ≈ 0.026 W/m·K, s = 4 mm) is "a plausibility argument only"; the design says to confirm it from the source or drop it ([design][hs-d] §Plausibility).
- [ ] **Gap helper.** HSK-07 specified a shared `withinLowerLimit` helper. The implementation is local, in `src/evaluation/heatSink/tolerance.ts` ([tasks 48.2][tasks]). Acknowledge the deviation.
- [ ] **Thick-fin count.** The worksheet count was corrected from 23 to 27 (inclusive gap rule; [design][hs-d] §Derived targets). Confirm.
- [ ] **View.** HSK-14 specified a lazily loaded 3D fin array; a fin-array SVG with a profile table shipped ([tasks 48.3][tasks]). Task 54 does not cover the heat sink (see §7).

## 5. Mounting Bracket I (`mounting-bracket-1`, card 002, available since D-43)

Sources: [requirements][mb-r] and [design][mb-d]; `mounting-bracket-1.json`; [`src/ui/models/bracket/index.tsx`][mb-ui]. The owner decided MB-07 (D-40) and K-1 to K-5 (D-41) for development. Those decisions are not 29.2 sign-off.

**Constants & limits**
- [ ] Load case: L 0.30 m, b 10 mm. Al E 69 GPa, ρ 2700 kg/m³, allowable 120 MPa, yield 240 MPa (screen only). Tip force 300 N; rigid wall clamp (MBR-04). K-5 approved these "as specified".
- [ ] Constraints: peak stress ≤ 120 MPa, tip deflection ≤ 2.4 mm, mass ≤ 0.215 kg, envelope ≤ 40 mm (MBR-08, K-5).
- [ ] Ranges: D 15–50 mm, d 10–50 mm (d ≤ D), a 60–240 mm (5 mm steps), r 0.5–10 mm (MBR-05). Baseline 30/20/150/1 mm; hidden reference 30/20/175/3 mm (MBR-06).
- [ ] Kt coefficient table, two branches (`KT_LOWER_BRANCH`/`KT_UPPER_BRANCH`). At h/r = 2 the lower branch applies (MBR-13, K-3).

**Applicability screens/thresholds** (`BRACKET_THRESHOLDS`, MBR-14)
- [ ] `KT_FIT_SHARP`: h/r > 20 is not applicable. `KT_FIT_SHALLOW`: r/h > 10 is not applicable.
- [ ] `KT_SHOULDER_LENGTH` metric > 1.0 is not applicable. The step location a stands in for the source's L (K-2).
- [ ] `KT_STEP_RATIO` D/d: warning 1.5, not applicable 1.6. The source does not state this limit; it is developer-proposed and owner-approved (K-3).
- [ ] `KT_SMALL_STEP`: a stepped bar needs D/d ≥ 1.1 (K-4).
- [ ] `PLASTICITY` 0.8/1.0, `DEPTH_SPAN` 0.1/0.2, `RECT_ASPECT` 8/20 and `LARGE_DEFLECTION` 0.02/0.1, all following beam convention.

**Wording & copy** (index.tsx)
- [ ] Limits notice (l.15–16): "Idealized stepped-bar bending; fillet Kt coefficients from secondary copies, pending printed-edition verification. Not a structural certification". The full disclosure is `BRACKET_KT_SOURCE_NOTE` in `src/physics/bracket/constants.ts:72–73`.
- [ ] Tagline (l.20): "Find where the stress peaks and bring it within the limit without adding material everywhere." Solver label (l.24): "Stepped flat bar · Peterson shoulder-fillet Kt"
- [ ] Drawer (l.26–27): "Available with an idealized stepped-bar bending model and a published shoulder-fillet stress-concentration fit. Length, thickness, force, material, and wall clamp remain fixed by the challenge."
- [ ] Mode copy (l.21–23). Guided: "Depth, step and fillet controls, a bending-moment strip, and step-by-step prompts." Parametric: "Precise depth, step location and fillet editing with the same validated stepped-bar model." Parametric label: "Direct depth, step and fillet editing".
- [ ] Prediction (l.29–31). Title: "Predict peak stress". Question: "Compared with ${previous}, how will your new bracket change its peak stress?" Legend: "Predicted change in peak stress". Margin labels "Mass usage / Stress margin / Deflection margin" (l.36–39).
- [ ] Guided steps (l.49–74) and the three latest-test experiment messages (l.79–81). One example: "Your latest test is outside the fillet curve fit. Read its applicability reasons, then bring the step back inside the fit before comparing peak stress."
- [ ] The rule wording "peak elastic stress ≤ allowable" (K-5, MBR-16). "Load paths" is taught as the internal bending-moment path (MBR-02(b)).

**References to transcribe**
- [ ] Pilkey & Pilkey, *Peterson's Stress Concentration Factors*, and Young & Budynas, *Roark's*, Table 6-1 case III.1b. Edition and page are not printed in the copy used ([design][mb-d] §Sources 1).
- [ ] Gere & Goodno and Shigley, the deflection sections: edition and equation numbers ([design][mb-d] §Model; `src/physics/bracket/bar.ts:5–8`).

**Verification items**
- [ ] **K-1, still owed before release.** Verify every Kt coefficient, both h/r ranges, the nominal stress 6M/(t·d²) and the L/D validity condition against a printed edition (MBR-20, [D-41][dec]). Two details depend on this check. The signs could not be recovered from the extracted text and follow AmesWeb. The relation glyph in the validity condition did not extract either; AmesWeb prints ">", and the model applies it inclusively ([design][mb-d] §Transcription record). A discrepancy would raise the model and challenge versions (MM-04).
- [ ] **MechaniCalc variant.** It is labelled Roark 8th ed. and differs by up to 1.72%. Its bending C1 equals its own axial C1. It is not used ([design][mb-d] §Sources 5, K-1). The design says it "may be a later revision"; confirm during the printed check that it stays unused.
- [ ] **Body-force results.** Noda et al. (abstracts only) report that Peterson's photoelastic flat-bar charts may under-predict Kt by about 10–13%. The design says "Owner review should consider this (K-4)".
- [ ] **Chart rows recorded, not asserted.** The digitized-chart rows at D/d = 3 and ≤ 1.05 are recorded for review only ([design][mb-d] §Alternative-method (c)).
- [ ] **View.** MBR-18 deferred an optional 3D extrusion to a 46.3 decision. That is now task 54.1 (see §7).

## 6. Braced Frame I (`braced-frame-1`, card 005, workbench merged but card NOT activated)

Sources: [requirements][bf-r] and [design][bf-d] (§Integration notes, owner questions 1–8); `braced-frame-1.json`; [`src/ui/models/bracedFrame/index.tsx`][bf-ui].

**Constants & limits**
- [ ] Geometry: one bay × two storeys, 4.0 m × 3.0 m, pinned bases that resist uplift. Loads: 20 kN at j3 and 40 kN at j5 (+x), plus 40 kN down at j5 and j6. Steel E 200 GPa, f_y 250 MPa, ρ 7850 kg/m³; no self-weight (BFR-03).
- [ ] **Q1:** only one load direction is analyzed (no reversal). Keep it, or add the mirrored load case?
- [ ] Constraints: stable; roof drift ≤ 12 mm; utilization ≤ 1.0; mass ≤ 200 kg (BFR-07). **Q6:** the drift limit is H/500, and inter-storey drift is display-only.
- [ ] **Q2:** 200 kg excludes full X bracing (lightest 204.51 kg). Keep it, or raise it? At 210 kg uniform 76.1 × 4.0 (213.37 kg) is still excluded.
- [ ] **Q7:** nominal capacities, with no resistance factors (BFR-10).
- [ ] **Q4:** per-member sizing (10 selects) or grouped sizing (BFR-04)?
- [ ] **Q8:** add a self-weight option in a later version?
- [ ] Section catalog: CHS 48.3 × 3.2, 60.3 × 4.0, 76.1 × 4.0 and 88.9 × 5.0. Properties are computed for an ideal annulus, not taken from a standard's table ([design][bf-d] §Section catalog).
- [ ] Solver tolerances: pivot, residual and zero-force all 1e-9 (`BRACED_FRAME_SOLVER_TOLERANCES`; BFR-11, BFR-14). Display exaggeration ×50, capped at 0.6 m.

**Applicability screens/thresholds** (`BRACED_FRAME_THRESHOLDS`)
- [ ] **Q3:** `INELASTIC_BUCKLING` uses the Johnson parabola at 0.8/1.0 and warns on 434 of the 618 accepted designs. Keep it, change the thresholds, or put a column curve in the capacity (a v2 change)? The design also requires a cited source for the parabola's form, or owner replacement ([design][bf-d] §References). The code cites Salmon, Johnson & Malhas (`src/physics/bracedFrame/members.ts:11–13`).
- [ ] `LARGE_DRIFT` max storey drift ratio: warning 0.01, not applicable 0.02 (defense in depth; BFR-12).

**Wording & copy** (index.tsx and JSON)
- [ ] **BFR-01 idealization sentence.** It is present verbatim in the `statement` of `braced-frame-1.json`. Confirm it, or approve an equivalent (OC-15).
- [ ] Limits notice (l.14): "Idealized pin-jointed frame, not a structural certification"
- [ ] Tagline (l.18): "Brace a two-storey frame and size its members within drift, capacity and mass limits." Solver label (l.22): "Direct stiffness · Pin-jointed frame"
- [ ] Drawer (l.24–25): "Available with an idealized pin-jointed frame model: every joint is a hinge, so members carry only tension or compression. Geometry, supports, loads, and material remain fixed by the challenge."
- [ ] Mode copy (l.19–21). Guided: "Diagonal toggles, member section choices, and step-by-step prompts." Parametric: "Direct bracing and member section editing with the same validated frame model." Parametric label: "Direct bracing and member section editing".
- [ ] Prediction (l.27–29). Title: "Predict roof drift". Question: "Compared with ${previous}, how will your new frame change its roof drift?" Legend: "Predicted change in roof drift". Margin labels "Mass usage / Roof drift usage / Maximum member utilization" (l.34–36).
- [ ] Guided steps (l.46–73) and the help dialog text (`src/ui/models/bracedFrame/BracedFrameHelp.tsx:14–18`). BFR-17 forbids claiming that one diagonal direction is always best.

**References to transcribe**
- [ ] Hibbeler, *Structural Analysis*; McGuire, Gallagher & Ziemian, *Matrix Structural Analysis*; Timoshenko & Gere, *Theory of Elastic Stability*; Salmon, Johnson & Malhas; Higham, and Golub & Van Loan (pivoted Cholesky). Each needs edition and equation numbers ([design][bf-d] §References; `src/physics/bracedFrame/{directStiffness,members,pivotedCholesky}.ts`).

**Verification items**
- [ ] **Activation.** Card 005 activation has not been requested (`available: false` in `src/challenge/catalog.ts`; [D-43][dec]). The browser spec `e2e/bracedFrame.spec.ts` still skips.
- [ ] **View.** A 3D/oblique frame view is task 54.3 (see §7).

## 7. Cross-cutting

**Catalog card copy (OC-15; `src/challenge/catalog.ts`)**
- [ ] 002 Mounting Bracket I: "Rethink a mounting bracket that carries more stress than it should.", concepts Load paths and Stress concentrations. Kept per MB-07(b) (D-40).
- [ ] 003 Torsion Shaft I: "Balance torsional stiffness, weight, and packaging in a rotating shaft.", concepts Torsion and Section properties. TSH-01 says it is "supported as written", although rotating dynamics are excluded (TSH-12).
- [ ] 004 Heat Sink I: "Explore how geometry helps a compact heat sink move heat away.", concepts Heat transfer and Surface area (HSK-01).
- [ ] 005 Braced Frame I: "Follow the forces through a frame and strengthen what matters.", concepts Frame analysis and Stability. BFR-01 makes this conditional on the idealization statement.
- [ ] 006 Vibration Isolation I: "Tune a component to keep unwanted vibration out of its operating range.", concepts Natural frequency and Vibration (VIB-01).

**"Stability" label for the frame**
- [ ] Keep "Stability" with the idealization statement, or rename it (for example "Bracing and stability")? This is frame Q5 and BFR-01. The current label is `stability: 'Stability'` in `src/evaluation/bracedFrame/constraints.ts:26`. The help text says "Stability here means only whether this pin-jointed idealization is stable or a mechanism".

**Limits notices, read together**
- [ ] The six notices end differently: "not a structural certification" (beam, torsion, bracket, frame), "not an engineering certification" (vibration) and "not a thermal certification" (heat sink). OC-06 says Accepted means "meets this educational model's constraints".

**3D-view decisions (task 54, [tasks][tasks])**
- [ ] 54.1 bracket, 54.2 torsion and 54.3 frame: the owner chose 3D models with 2D fallbacks (D-26, OC-12). None is implemented yet.
- [ ] Heat sink and vibration are outside task 54. Heat sink ships SVG where HSK-14 specified 3D. Vibration is SVG by design (VIB-14). Confirm both.

**Content placement**
- [ ] Guided step content lives in each model's UI registry entry rather than in the challenge config, which deviates from MM-21 ([tasks 34.2][tasks]). Acknowledge it.

**Accounts (task 38)**
- [ ] Not implemented. The pilot is local-only. Accounts, saved user information and challenge completion are required future scope ([MILESTONE4.md § Requested account and saved-progress extension][m4]; D-34).

**Human QA gates (all open; [tasks][tasks], [MILESTONE4.md][m4])**
- [ ] 29.2 owner engineering QA for **every** challenge above. Record qualifications, date, reviewed release commit, independent calculations, discrepancies and disposition.
- [ ] 30.1 manual usability and accessibility checks; 30.2 pilot delivery and recovery on the actual build.
- [ ] 31.2 student sessions and findings (participants not yet arranged).
- [ ] 32.1 fix blocking findings; 32.2 Milestone 4 checkpoint.
- [ ] 44.3 owner manual mode checks on the release candidate.
- [ ] 51 original-catalog gate (depends on 46.3–50.3 and 44.3).

## How to record decisions

1. Answer inline on the item: date, then keep or change, with a short reason.
2. The developer then updates the owning spec (`.kiro/specs/<challenge>/`), adds a DECISIONS.md entry and updates tasks.md.
3. Any change to a constant, a limit or meaning-changing wording also gets a new challenge version and storage key (MM-04). If model outputs change, the model version increases too.
4. Defaults stay live until then.

[tasks]: ../.kiro/specs/engineering-intuition-mvp/tasks.md
[dec]: DECISIONS.md
[m4]: MILESTONE4.md
[ts-r]: ../.kiro/specs/torsion-shaft-1/requirements.md
[ts-d]: ../.kiro/specs/torsion-shaft-1/design.md
[ts-ui]: src/ui/models/torsion/index.tsx
[vi-r]: ../.kiro/specs/vibration-isolation-1/requirements.md
[vi-d]: ../.kiro/specs/vibration-isolation-1/design.md
[vi-ui]: src/ui/models/vibration/index.tsx
[hs-r]: ../.kiro/specs/heat-sink-1/requirements.md
[hs-d]: ../.kiro/specs/heat-sink-1/design.md
[hs-ui]: src/ui/models/heatSink/index.tsx
[mb-r]: ../.kiro/specs/mounting-bracket-1/requirements.md
[mb-d]: ../.kiro/specs/mounting-bracket-1/design.md
[mb-ui]: src/ui/models/bracket/index.tsx
[bf-r]: ../.kiro/specs/braced-frame-1/requirements.md
[bf-d]: ../.kiro/specs/braced-frame-1/design.md
[bf-ui]: src/ui/models/bracedFrame/index.tsx
