# Stress and Strain I and the Stress and strain Learn module — requirements (task 72)

Additive specification, 2026-10-19. Owner requests the same day: "Develop the Stress & Strain module" and "Stress & Strain Challenge (Introductory)" (decision D-62). The challenge follows the shared contracts in `../multi-model-architecture/` (MM-01–MM-27). The Learn module extends `../learn-modules/` (LRN-01–LRN-10) with a second available module. The completed MVP requirements and other challenge specifications are unchanged.

Status: specification and an independently computed worksheet (`design.md`, from `worksheet.py`, which imports no application code). Owner engineering review (29.2) of the constants, material values, equations, thresholds and wording is pending. Material values are typical textbook values, not certified data.

Requirement ids: `SSR-nn` for the challenge, `SSL-nn` for the Learn module.

## Challenge identity and learning objective

- SSR-01: Challenge `stress-strain-1`, version 1, title **Stress and Strain I**, difficulty introductory, discipline Mechanics, modes Guided and Parametric. Catalog card `010`, available (owner-requested activation, D-62). Technical-art kind `rod`. Model `axialTieRod` version 1, a new model id (MM-01).
- SSR-02: One clear idea with three levers' worth of consequences: axial stress depends on the cross-sectional area (σ = P/A, independent of the material); stretch depends on the area **and** the material's stiffness E (δ = PL/(AE)); strength (yield) and stiffness are different material properties; and the lightest rod that is both strong and stiff enough depends on the material. With the given values, a steel rod thick enough to be strong is too heavy, while an aluminium or titanium rod sized for stiffness passes every check.

## Fixed values and adjustable design

- SSR-03 Fixed (locked): a vertical hanger rod of length L = 2.0 m, pinned to a rigid roof beam at the top, carrying a static tensile load P = 20 kN applied through the centroid at the bottom; design factor on yield n = 2. Locked fields: `lengthM`, `forceN`, `designFactor`, `support`. Length, load, factor and support are challenge constants, not design fields.
- SSR-04 Adjustable: the rod diameter d (solid circular section), 6–30 mm in 0.5 mm steps (the range deliberately reaches designs that fail every way and designs outside the model's validity), and the material, one of a three-item list: structural steel, aluminium alloy 6061-T6 and titanium alloy Ti-6Al-4V (annealed). Each material carries a Young's modulus E, a yield strength σ_y and a density ρ, all typical textbook values stated as such in the workbench.
- SSR-05 Initial design (baseline): steel, d = 13 mm. Internal reference (never exposed to students): aluminium, d = 20 mm. The reference is one feasible design, not the only one (the worksheet lists every Accepted grid design).

## Metrics and checks

- SSR-06 Displayed metrics (from the stored analysis only): axial stress σ (MPa), elongation δ (mm), strain ε (shown as a percentage), mass (kg), diameter (mm), cross-sectional area (mm²), axial stiffness EA/L (kN/mm), and the material's allowable stress σ_y/n (MPa).
- SSR-07 Checks, in this fixed order: `stress` σ ≤ σ_y/n of the chosen material (Pa; the limit changes with the material), `elongation` δ ≤ 2.0 mm (m), `mass` ≤ 2.0 kg (kg), `applicability` (bool). Inclusive comparisons use `withinLimit` with REL_TOL; non-finite values never pass. Accepted if and only if applicable and every check passes (MM-11). Margins: massUsage, stressMargin, elongationMargin.
- SSR-08 Prediction: checkpoints on iterations 1 and 3. The primary metric is the elongation, named "elongation" (it responds to both levers). Ratio band 0.98/1.02 as for the other models; a side without a finite positive elongation is not scorable (MM-13).
- SSR-09 Reflection prompt: "Using your tested designs, explain how the rod's diameter changed its stress and stretch, and why the choice of material decided whether a rod could pass every check within the mass limit."

## Applicability and exclusions

- SSR-10 Screen `PLASTICITY` (inclusive, REL_TOL): σ/σ_y, warning above 0.8 and not applicable above 1.0. A design at or beyond yield is flagged clearly in the challenge panel, history and Test details: "the model does not include yielding, necking or plastic flow". Plasticity and necking are not modeled.
- SSR-11 No end-effect screen: the loader requires L/d_max ≥ 10 (`ROD_TOO_SHORT`), so Saint-Venant end effects near the pins are confined to a short length for every design in range (L/d ≥ 66.7 with the bundled values). No buckling screen: the load is tension only.
- SSR-12 Always-listed unsupported effects: yielding, necking and plastic flow (screened only); stress concentrations at threads, holes and end fittings; bending from an off-centre (eccentric) load or a bent rod; compression and buckling; fatigue and dynamic or impact loads; creep and temperature changes; self-weight of the rod; compliance of the end fittings and supports; corrosion.

## Verification and integration

- SSR-13 Benchmarks: every worksheet row in design.md is implemented as a fixture and asserted at 1e-9 relative, plus the alternative-method and limiting cases listed there (Castigliano and strain-energy routes, polygon-area convergence, Hooke consistency, scaling laws, boundaries). Invalid designs (non-finite or out-of-range diameter, unlisted material, a changed locked field) are rejected before analysis.
- SSR-14 Baseline difficulty (D-47): the baseline fails the most design checks any valid, applicable grid design without warnings can fail (two of three: no design fails both elongation and mass, because E/ρ exceeds PL²/(δ_max m_max) for all three materials). The baseline is applicable without warnings and the reference is Accepted. Exhaustive search over the 147 grid designs in `test/challenges/baselineDifficulty.test.ts`.
- SSR-15 Presentation: the shared workbench with the Cantilever-style challenge panel (visible statement paragraph, VALUE / LIMIT list with text Pass/Fail, applicability reasons, Test details, reference link, Run Test; D-48 amendment); tools with a diameter field and slider and a material radio group showing E, σ_y, ρ and the allowable stress; history and compare with stored values only; a main-bundle 2D elevation (roof beam, rod to scale in width, clevis, load, the latest tested elongation drawn exaggerated and capped) and a lazy 3D view with the same content, falling back to the 2D view without WebGL2, on chunk failure or context loss (D-45). No text on the models (D-26); a text summary states every drawn value. The light-bulb reference dialog uses typeset formulas with fractions (D-56).
- SSR-16 Guided content (D-49): three single-variable experiments, then an open step. 1 "Thicken the rod": increase only the diameter (observe stress, elongation, mass). 2 "Change the material": change only the material (observe elongation, stress, mass). 3 "Meet every check": everything unlocked, met by an Accepted test. Hints never state the reference design or invent numbers. Parametric: everything editable, no steps.
- SSR-17 Persistence and files: v2 session envelope and `ei-design` v2 files naming `axialTieRod` v1 (MM-18, MM-19); key `ei:session:stress-strain-1:v1`. Reset to baseline restarts the challenge (D-51).
- SSR-18 Technical art `rod`: a vertical hanger rod pinned between a clevis on a roof beam and a load block, drawn with the shared projection and lighting, depicting the component as modeled (straight solid round bar in tension, load through its axis).

## Learn module: Stress and strain

- SSL-01 The Planned `stress-strain` entry under Solid mechanics → Mechanics of materials becomes an available module (id `stress-strain`, version 1, title "Stress and strain", art `rod`). Its position in the catalog is unchanged.
- SSL-02 Five predict-then-check steps, then Apply it: (1) stress is force over area: doubling the diameter quarters the stress; (2) strain is elongation over original length: of two rods stretched 1 mm, the 1 m rod has twice the strain of the 2 m rod; (3) Hooke's law and E: the same rod and load in aluminium stretches about 2.9 times as much as in steel, with the same stress; (4) yield: strength and stiffness are different properties; the aluminium alloy is about a third as stiff as structural steel yet yields at about the same stress (slightly higher, with these typical values); (5) elongation is proportional to length: twice the length, twice the stretch, same stress and strain. Each step has at most three concept points, a four-option prediction, a demonstration with a text readout of every value it draws, a one-line takeaway, and KaTeX equations with fractions using CSP-safe commands only (LRN-02, D-56).
- SSL-03 Model-backed numbers (LRN-04): the demos call only `src/physics/axial/` functions through `src/learn/axialDemo.ts`; every correct option is checked against that physics in `src/learn/stressStrain.test.ts`. Demo values are generic teaching values (a 2 m rod, 10 mm diameter, 10 kN), not challenge constants; material values are the same typical textbook values, shared from `physics/axial/materials.ts`.
- SSL-04 Idealisation (as LRN-05): a straight prismatic round bar in uniaxial tension, linear elastic up to yield. Any demo state beyond yield is labelled in text "beyond yield: not modeled" and its numbers are shown as the linear model's, not as real behaviour. Elongations are drawn exaggerated and labelled as such.
- SSL-05 Apply it opens Stress and Strain I in Guided mode through the shell's `openChallenge` (LRN-06).
- SSL-06 New demo kinds are namespaced (`axial-area`, `axial-strain`, `axial-hooke`, `axial-yield`, `axial-length`) and registered in `ui/learn/demos/index.tsx`; progress uses `ei:learn:stress-strain:v1` (LRN-07).

## Gating

- SSR-19 The card is available in this repository only after the integrated learning loop is verified on desktop and Pixel 7 (Guided keyboard entry and Parametric with the 2D fallback, prediction to Accepted, axe, 320 px, reload persistence and isolation from Cantilever Beam I). This is repository/local availability, not customer deployment; owner engineering review (29.2) and manual/student QA remain required before release.
