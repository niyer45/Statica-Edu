# Requirements Document

## About this document

This is the completed MVP requirements baseline for Statica's first challenge, Cantilever Beam I. Requirements 1–35 cover Milestones 0–3. Tasks 1–28 in [tasks.md](tasks.md) implemented them, and checkpoint 28 passed in CI on 2026-10-16. [design.md](design.md) holds the matching architecture and correctness Properties 1–37.

Requirement IDs (1–35) and criterion IDs (for example 9.3) are cited by tasks.md, by design.md properties and by test comments, so they never change. Later work is specified in separate, additive specifications rather than by editing this file.

## Related specifications

Each folder below sits beside this one in `.kiro/specs/`. Status is taken from tasks.md. "Implemented" means the listed tasks are checked; owner engineering review (task 29.2) and manual QA are still required before customer release (D-34).

| Spec folder | Covers | Status |
|---|---|---|
| [`interaction-modes/`](../interaction-modes/requirements.md) | Guided and Parametric behavior (task 44, MODE-01–MODE-08) | Implemented (44.1–44.2); 44.3 open for owner manual checks. Guided behavior since redefined by D-49 (task 58). |
| [`original-catalog/`](../original-catalog/requirements.md) | Scope, bounded models and delivery order for the five original preview challenges (task 45.1, OC-01–OC-16) | Specification; its challenges were implemented in tasks 46–50. Task 51 open for owner QA. |
| [`multi-model-architecture/`](../multi-model-architecture/requirements.md) | Shared model identity, registry, evaluation and save contracts (task 45.2, MM-01–MM-27) | Specification; implemented by task 34. |
| [`torsion-shaft-1/`](../torsion-shaft-1/requirements.md) | Torsion Shaft I (task 47) | Implemented (task 47; made introductory in task 71, D-61). |
| [`heat-sink-1/`](../heat-sink-1/requirements.md) | Heat Sink I (task 48) | Implemented (task 48). |
| [`vibration-isolation-1/`](../vibration-isolation-1/requirements.md) | Vibration Isolation I (task 50) | Implemented (task 50). |
| [`braced-frame-1/`](../braced-frame-1/requirements.md) | Braced Frame I (task 49) | Implemented (task 49). |
| [`mounting-bracket-1/`](../mounting-bracket-1/requirements.md) | Mounting Bracket I (task 46); `l-bracket-design.md` covers the bolted L-bracket | Implemented (task 46; rebuilt as a bolted L-bracket in task 57, D-46). |
| [`column-buckling-1/`](../column-buckling-1/requirements.md) | Column Buckling I (task 68) | Implemented (task 68, D-58). |
| [`pressure-vessel-1/`](../pressure-vessel-1/requirements.md) | Pressure Vessel I (task 69) | Implemented (task 69, D-59). |
| [`fatigue-analysis-1/`](../fatigue-analysis-1/requirements.md) | Fatigue Analysis I (task 70) | Implemented (task 70, D-60). |
| [`stress-strain-1/`](../stress-strain-1/requirements.md) | Stress and Strain I and the Stress and strain Learn module (task 72) | Implemented (task 72, D-62). |
| [`learn-modules/`](../learn-modules/requirements.md) | The Learn pillar and its modules (task 67) | Implemented (task 67, D-57). |
| [`cantilever-beam-2/`](../cantilever-beam-2/requirements.md) | Cantilever Beam II (tasks 33.1–33.2) | Dormant: configuration validated but not registered; integration is task 52 (not started). |

## How amendments are recorded

[DECISIONS.md][decisions] records decisions D-01–D-63, including every later change to these requirements. When a decision amends or supersedes a criterion, the criterion text below stays as written and the requirement carries one italic note under its heading naming the decision. The "Amended by" column of the [Requirement index](#requirement-index) lists the same decisions. Where a note and a criterion disagree, the decision applies.

[decisions]: ../../../Educational%20Tool%20UI%20Design/DECISIONS.md

## Contents

- [About this document](#about-this-document)
- [Related specifications](#related-specifications)
- [How amendments are recorded](#how-amendments-are-recorded)
- [Requirement index](#requirement-index)
- [Introduction](#introduction)
- [Glossary](#glossary)
- [Requirements](#requirements)
  - [Requirement 1: Project Scaffold, CI, and Architecture Boundaries](#requirement-1-project-scaffold-ci-and-architecture-boundaries)
  - [Requirement 2: Units](#requirement-2-units)
  - [Requirement 3: Challenge Definition and Loading](#requirement-3-challenge-definition-and-loading)
  - [Requirement 4: Locked Fields and Immutable Challenge Data](#requirement-4-locked-fields-and-immutable-challenge-data)
  - [Requirement 5: Section Types and Geometry Validation](#requirement-5-section-types-and-geometry-validation)
  - [Requirement 6: Clamp, Strict Set, and Section Conversion](#requirement-6-clamp-strict-set-and-section-conversion)
  - [Requirement 7: Orientation and Envelope](#requirement-7-orientation-and-envelope)
  - [Requirement 8: Section Properties](#requirement-8-section-properties)
  - [Requirement 9: Beam Solver](#requirement-9-beam-solver)
  - [Requirement 10: Model Applicability and Analysis Metadata](#requirement-10-model-applicability-and-analysis-metadata)
  - [Requirement 11: Constraint Evaluation](#requirement-11-constraint-evaluation)
  - [Requirement 12: Acceptance Status and Efficiency](#requirement-12-acceptance-status-and-efficiency)
  - [Requirement 13: Grounded Explanations](#requirement-13-grounded-explanations)
  - [Requirement 14: Prediction Checkpoint and Scoring](#requirement-14-prediction-checkpoint-and-scoring)
  - [Requirement 15: Session Initialization and Reducer Invariants](#requirement-15-session-initialization-and-reducer-invariants)
  - [Requirement 16: Draft and Tested Status](#requirement-16-draft-and-tested-status)
  - [Requirement 17: Run Test](#requirement-17-run-test)
  - [Requirement 18: Append-Only History and Comparison](#requirement-18-append-only-history-and-comparison)
  - [Requirement 19: Restore](#requirement-19-restore)
  - [Requirement 20: Reflection and Submission](#requirement-20-reflection-and-submission)
  - [Requirement 21: Session Persistence](#requirement-21-session-persistence)
  - [Requirement 22: Design Import and Export](#requirement-22-design-import-and-export)
  - [Requirement 23: Security of Imported Data and Rendering](#requirement-23-security-of-imported-data-and-rendering)
  - [Requirement 24: Application Layout](#requirement-24-application-layout)
  - [Requirement 25: 3D Viewport](#requirement-25-3d-viewport)
  - [Requirement 26: Section Palette](#requirement-26-section-palette)
  - [Requirement 27: Dimension Handles](#requirement-27-dimension-handles)
  - [Requirement 28: Numeric Controls](#requirement-28-numeric-controls)
  - [Requirement 29: Requirements and Results Panel](#requirement-29-requirements-and-results-panel)
  - [Requirement 30: Dialogs and Live Announcements](#requirement-30-dialogs-and-live-announcements)
  - [Requirement 31: WebGL Fallback](#requirement-31-webgl-fallback)
  - [Requirement 32: Accessibility](#requirement-32-accessibility)
  - [Requirement 33: Testing and Milestone Gates](#requirement-33-testing-and-milestone-gates)
  - [Requirement 34: Platform Shell and Preview Items](#requirement-34-platform-shell-and-preview-items)
  - [Requirement 35: Interaction Modes and Workflow Stepper](#requirement-35-interaction-modes-and-workflow-stepper)

## Requirement index

Areas: domain (pure modules), state (reducer, persistence, import and export), UI (Workbench), platform (scaffold, security, shell), quality (accessibility, testing).

| # | Title | Area | Summary | Amended by |
|---|---|---|---|---|
| [1](#requirement-1-project-scaffold-ci-and-architecture-boundaries) | Project Scaffold, CI, and Architecture Boundaries | platform | Template stack, exact pins, CI order, import boundaries, schema generation, offline runtime, self-hosted fonts. |  |
| [2](#requirement-2-units) | Units | domain | SI units inside the domain; mm and MPa conversion, parsing and locale-independent formatting at the UI boundary. |  |
| [3](#requirement-3-challenge-definition-and-loading) | Challenge Definition and Loading | domain | zod-validated, deep-frozen challenge JSON; bundled Cantilever Beam I values; cross-field rules. | D-47 |
| [4](#requirement-4-locked-fields-and-immutable-challenge-data) | Locked Fields and Immutable Challenge Data | state | Span, material, load and support fixed by the challenge and shown read-only. | D-32 |
| [5](#requirement-5-section-types-and-geometry-validation) | Section Types and Geometry Validation | domain | Four section kinds and every geometry validation error code. |  |
| [6](#requirement-6-clamp-strict-set-and-section-conversion) | Clamp, Strict Set, and Section Conversion | domain | Clamp mode for drags, strict mode for typed values, section-kind conversion. |  |
| [7](#requirement-7-orientation-and-envelope) | Orientation and Envelope | domain | 0°/90° orientation and the oriented envelope. | D-26 |
| [8](#requirement-8-section-properties) | Section Properties | domain | Area, second moments and extreme fibres per section, with fixture values. |  |
| [9](#requirement-9-beam-solver) | Beam Solver | domain | Deterministic Euler–Bernoulli cantilever analysis and its scaling laws. |  |
| [10](#requirement-10-model-applicability-and-analysis-metadata) | Model Applicability and Analysis Metadata | domain | Fourteen applicability thresholds, warnings, not-applicable reasons and model metadata. |  |
| [11](#requirement-11-constraint-evaluation) | Constraint Evaluation | domain | Seven constraint results with inclusive REL_TOL comparison. |  |
| [12](#requirement-12-acceptance-status-and-efficiency) | Acceptance Status and Efficiency | domain | Accepted, Not accepted or Model not applicable; efficiency margins; fixture outcomes. | D-47 |
| [13](#requirement-13-grounded-explanations) | Grounded Explanations | domain | Explanation facts whose numbers come from stored results. |  |
| [14](#requirement-14-prediction-checkpoint-and-scoring) | Prediction Checkpoint and Scoring | state | Required predictions on iterations 1 and 3 and the ±2% scoring rule. | D-27 (extension) |
| [15](#requirement-15-session-initialization-and-reducer-invariants) | Session Initialization and Reducer Invariants | state | Baseline as iteration 0; pure, deterministic reducer invariants. |  |
| [16](#requirement-16-draft-and-tested-status) | Draft and Tested Status | state | Draft versus Tested status; untested drafts show no computed results. |  |
| [17](#requirement-17-run-test) | Run Test | state | Run Test appends one result, saves it and updates the compare selection. |  |
| [18](#requirement-18-append-only-history-and-comparison) | Append-Only History and Comparison | state | Immutable history; Baseline-anchored comparison of up to three iterations. | D-29, D-30, D-31, D-51 |
| [19](#requirement-19-restore) | Restore | state | Restore an earlier design into the draft without changing history. | D-31 |
| [20](#requirement-20-reflection-and-submission) | Reflection and Submission | state | Reflection text and submission of a chosen tested iteration. | D-31 |
| [21](#requirement-21-session-persistence) | Session Persistence | state | Versioned `localStorage` save with migration and re-analysis on load. | D-50 |
| [22](#requirement-22-design-import-and-export) | Design Import and Export | state | `ei-design` JSON export and validated import. |  |
| [23](#requirement-23-security-of-imported-data-and-rendering) | Security of Imported Data and Rendering | platform | Import size and key limits, escaping, CSP, no tracking, dev-only state snapshot. | D-50 |
| [24](#requirement-24-application-layout) | Application Layout | UI | Template grid at each breakpoint, lazy 3D bundle, loading placeholder. |  |
| [25](#requirement-25-3d-viewport) | 3D Viewport | UI | 3D scene, deformation exaggeration, scene controls and style. | D-26 |
| [26](#requirement-26-section-palette) | Section Palette | UI | Section tiles applied by drag, click and keyboard. |  |
| [27](#requirement-27-dimension-handles) | Dimension Handles | UI | Draggable 3D handles that resize the section through the clamper. | D-26 |
| [28](#requirement-28-numeric-controls) | Numeric Controls | UI | Millimetre inputs with strict validation and the orientation radio group. |  |
| [29](#requirement-29-requirements-and-results-panel) | Requirements and Results Panel | UI | Challenge statement, constraint results, Run Test, footer notice, history and compare tabs. | D-28, D-29, D-30 |
| [30](#requirement-30-dialogs-and-live-announcements) | Dialogs and Live Announcements | UI | Modal dialog focus rules and the single polite live region. |  |
| [31](#requirement-31-webgl-fallback) | WebGL Fallback | UI | SVG fallback when WebGL or the 3D bundle is unavailable. |  |
| [32](#requirement-32-accessibility) | Accessibility | quality | Keyboard and click equivalents, text summary, contrast, focus, reduced motion. | D-29 |
| [33](#requirement-33-testing-and-milestone-gates) | Testing and Milestone Gates | quality | Property tests, model-based reducer tests, coverage, E2E and milestone gates. |  |
| [34](#requirement-34-platform-shell-and-preview-items) | Platform Shell and Preview Items | platform | Sidebar, library, detail drawer, previews, My designs, notebook, product name. | D-33, D-42–D-44, D-50, D-53–D-55, D-57–D-63 |
| [35](#requirement-35-interaction-modes-and-workflow-stepper) | Interaction Modes and Workflow Stepper | UI | Guided and Parametric share one model; workflow stepper and submit button. | D-36, D-37, D-49 |

## Introduction

*Written at MVP closeout. Statements about scope and previews describe the MVP; [Related specifications](#related-specifications) lists what has been added since.*

Statica (working title "Engineering Intuition Platform") MVP is a browser-only single-page application that trains students to diagnose and improve a flawed mechanical component. The MVP ships one challenge, "Cantilever Beam I: Reduce Deflection". A student inspects a cantilever with a downward tip load, predicts the effect of a change, swaps and resizes the cross-section in a 3D viewport, runs a deterministic Euler-Bernoulli analysis, reads per-constraint feedback, compares iterations, restores earlier designs, answers a reflection prompt, and submits.

These requirements are derived from the approved design document and cover Milestones 0–3: scaffold/CI/schema, units, challenge loading and locked fields, geometry, physics, evaluation, session state, persistence and import/export, UI, accessibility, import security, and testing gates. Milestone 4+ (pilot, a second runnable challenge, Freeform mode, advanced physics, accounts, AI) is out of scope.

The MVP is built inside the existing Figma Make UI template at `Educational Tool UI Design/` (the Template_Root). The template's stack, visual design, CSS, and platform shell are retained. Its prototype physics (`src/physics.ts`) is replaced by the Domain_Modules, and every number shown in the UI comes from them. Challenges other than Cantilever Beam I, and the Freeform mode, remain labeled previews that run no analysis. Guided and Parametric modes are both available and share one `BeamDesign` representation and one solver.

## Glossary

Terms are defined as they were for the MVP, in alphabetical order. Where a decision has since changed the behavior a term describes (for example Workflow_Stepper and Preview_Item), the requirement notes say so.

- **Analysis**: The frozen result of `analyze` for one Design.
- **Applicability_Checker**: The `physics/` function `checkApplicability`.
- **Baseline**: The Test_Result at iteration 0, produced from the challenge's initial design.
- **Challenge**: A frozen, schema-validated scenario definition (load case, material, limits, ranges, content).
- **Challenge_Loader**: The `challenge/` function `loadChallenge` that validates unknown JSON into a Challenge.
- **CI_Pipeline**: The GitHub Actions workflow in `.github/workflows/ci.yml`.
- **Constraint_Engine**: The `evaluation/` functions `withinLimit` and `evaluate`.
- **Design**: A `BeamDesign` consisting of a Section, an orientation (0° or 90°), `lengthM`, and `materialId`.
- **Dimension_Handles**: Draggable 3D handles that resize Section parameters.
- **Domain_Modules**: The pure TypeScript modules `units/`, `challenge/`, `geometry/`, `physics/`, and `evaluation/`.
- **Draft**: The editable Design held in session state.
- **Envelope**: The oriented bounding box of a Section in global Z (width) and Y (height).
- **Evaluation**: The frozen result of `evaluate`: constraint results, failures, status, efficiency, facts.
- **Explanation_Generator**: The `evaluation/` functions that produce grounded `ExplanationFact` entries.
- **GEOM_TOL**: Absolute geometry tolerance of 1e-9 m.
- **Geometry_Validator**: The `geometry/` functions `validateSection` and `validateDesign`.
- **History_Compare**: The template `results-panel` region, with "Design history" and "Compare results" tabs, listing Baseline and iterations with compare and restore.
- **I_bend**: The second moment of area resisting vertical load for the current orientation (Ixx at 0°, Iyy at 90°).
- **Import_Export_Module**: The `state/` functions `exportDesign` and `importDesign`.
- **Interaction_Mode**: One of `guided`, `parametric`, or `freeform`. Guided and Parametric are runnable for Cantilever Beam I; Freeform is a Preview_Item.
- **Live_Region**: The `aria-live="polite"` announcer element. The template's visual toast shows the same notices but is not the Live_Region.
- **Locked_Field**: A challenge-fixed field that students cannot change: `lengthM`, `materialId`, `forceN`, `support`.
- **Numeric_Controls**: The labeled millimetre inputs and orientation radio group.
- **Persistence_Module**: The `state/` serialization, migration, and `localStorage` functions.
- **Physics_Engine**: The `physics/` module (`sectionProperties`, `bendingProperties`, `analyze`, `deflectionShape`).
- **Platform**: The Statica single-page application as a whole, including the Platform_Shell and the Workbench.
- **Platform_Shell**: The retained template navigation and pages: sidebar, challenge library (filters, search, Explore/Saved views), challenge detail drawer, learning paths, my designs, notebook, and mode cards.
- **Prediction_Dialog**: The modal that collects a predicted direction of deflection change.
- **Prediction_Scorer**: The `evaluation/` function `scorePrediction`.
- **Preview_Item**: A challenge other than Cantilever Beam I, a learning path, or the Freeform mode, shown in the Platform_Shell as a preview or "Planned" item with no runnable analysis.
- **Reflection_Prompt**: The textarea that collects the reflection answer.
- **REL_TOL**: Relative comparison tolerance of 1e-9.
- **Requirements_Panel**: The template `challenge-panel` region showing the challenge statement, constraints, Run Test, and results.
- **Section**: A typed cross-section: circle, tube, rectangle, or I-section, with dimensions in metres.
- **Section_Clamper**: The `geometry/` function `clampParam`, used for handle drags.
- **Section_Converter**: The `geometry/` function `convertSection`, used when the section kind changes.
- **Section_Palette**: The UI tile list used to choose a section kind.
- **Session_Reducer**: The pure `state/` function `sessionReducer` together with `initSession`.
- **Status**: One of `accepted`, `notAccepted`, `modelNotApplicable`.
- **Strict_Setter**: The `geometry/` function `trySetParam`, used for numeric input.
- **Submit_Dialog**: The dialog that selects a Test_Result and records a submission.
- **SVG_Fallback**: The SVG beam projection adapted from the template's `BeamScene.tsx`, plus a 2D section view, used when WebGL is unavailable.
- **Template_Root**: The project root folder `Educational Tool UI Design/`, which holds the retained Figma Make template and all MVP source.
- **Test_Result**: A frozen history entry containing a design snapshot, Analysis, Evaluation, and optional prediction.
- **Test_Suite**: The Vitest, fast-check, Testing Library, and Playwright tests of the Platform.
- **Units_Module**: The `units/` module that converts between SI values and display units.
- **Viewport**: The React Three Fiber (WebGL) 3D scene component in the Workbench viewport panel.
- **Workbench**: The challenge workspace for Cantilever Beam I, built from the template's `design-panel`, viewport panel, `challenge-panel`, `results-panel`, and `page-footer` regions.
- **Workflow_Stepper**: The four-step indicator in the Workbench: Inspect → Modify & predict → Test & compare → Explain & submit.

## Requirements

### Requirement 1: Project Scaffold, CI, and Architecture Boundaries

**User Story:** As a developer, I want a reproducible scaffold with enforced module boundaries and CI, so that the domain logic stays pure and every change is verified.

#### Acceptance Criteria

1. THE Platform SHALL be implemented in the Template_Root in TypeScript 5.7 with `strict` set to true in `tsconfig.json`, using React 19, Vite 8, Tailwind CSS v4 through `@tailwindcss/vite`, and Three.js through React Three Fiber.
2. THE Platform SHALL declare every entry in `dependencies` and `devDependencies` of `package.json` as an exact version, with no range specifiers (`^`, `~`, `>`, `<`, `*`, `x`, or tag names), including the template's existing entries, and SHALL commit the `pnpm-lock.yaml` generated by pnpm 10.
3. WHEN a push to any branch or a pull request is opened or updated, THE CI_Pipeline SHALL run, in this order, a lockfile-based install (`pnpm install --frozen-lockfile` on Node 22 and the pnpm version pinned in `.mise.toml`), lint, typecheck, unit and property tests, build, and E2E tests, with each step running only after the previous step succeeds.
4. IF any CI step exits with a non-zero status, THEN THE CI_Pipeline SHALL stop executing the remaining steps and mark the run as failed with the failing step identified in the run output.
5. THE Domain_Modules SHALL contain no imports of `react`, `three`, `@react-three/*`, `ui/`, or `state/`, enforced by an ESLint `no-restricted-imports` rule and an architecture unit test.
6. IF a source file in the Domain_Modules contains an import of `react`, `three`, `@react-three/*`, `ui/`, or `state/`, THEN the lint step and the architecture unit test SHALL each fail and identify the offending file and import path.
7. THE `physics/` module SHALL contain no imports of the `evaluation/` module, enforced by the same ESLint rule and architecture unit test, both of which SHALL fail and identify the offending file if such an import exists.
8. WHEN `pnpm run gen:schema` is executed, THE Platform SHALL write `schemas/challenge.schema.json` generated from the zod challenge schema, and running the command again on unchanged sources SHALL produce a byte-identical file.
9. IF the committed `schemas/challenge.schema.json` differs from the output of `pnpm run gen:schema`, THEN THE CI_Pipeline SHALL mark the run as failed.
10. THE Platform repository SHALL include a README that documents the install, dev, lint, typecheck, test, build, E2E, and `gen:schema` pnpm commands, and a `DECISIONS.md` that records each of decisions D-01 through D-24, includes every decision from the template's original `DECISIONS.md` marked as retained or superseded (naming the superseding decision), and lists every applicability threshold defined in `physics/constants.ts` with its warning value, not-applicable value, and rationale.
11. WHILE the built Platform is running in the browser, THE Platform SHALL issue zero network requests to any origin other than the one serving the built static assets (including font, stylesheet, script, and image requests), and SHALL require no backend service to load a challenge, run a test, or submit.
12. THE Platform SHALL keep the template's Vite configuration, including the `@` alias for `src`, the React and Tailwind plugins, and the Figma Make plugins (`figmaSiteConfiguration`, `figmaErrorOverlayReplay`, `figmaReactRefreshBoundaryFallback`, `figmaMakeKitPlugin`), and SHALL keep `pnpm run dev` and `pnpm run build` working with them.
13. THE Platform SHALL serve the DM Sans and Manrope fonts from the Platform's own origin (bundled font files), and the built CSS and HTML SHALL contain no reference to `fonts.googleapis.com`, `fonts.gstatic.com`, or any other external origin.
14. THE Platform SHALL contain no copy of the template's prototype physics module (`src/physics.ts`) or its `node:test` test file, and the architecture unit test SHALL fail if `src/physics.ts` exists or if any file outside the Domain_Modules computes section area, second moment of area, mass, deflection, stress, or constraint pass/fail.

### Requirement 2: Units

**User Story:** As a developer, I want all computation in SI units with conversion only at the UI boundary, so that unit errors cannot leak into physics results.

#### Acceptance Criteria

1. THE Domain_Modules SHALL represent lengths in metres, forces in newtons, stresses in pascals, masses in kilograms, and orientation as the enum 0 | 90 (degrees). They SHALL accept and return values only in these units, and SHALL NOT call any Units_Module conversion or formatting function.
2. THE Units_Module SHALL provide these conversions, each multiplying or dividing its input by an exact power of ten: m→mm (×10³), mm→m (÷10³), Pa→MPa (÷10⁶), m⁴→mm⁴ (×10¹²), and m²→mm² (×10⁶). For finite input x, applying m→mm and then mm→m SHALL return a value within 1×10⁻¹² relative error of x.
3. WHEN text is supplied that, after leading and trailing whitespace is trimmed, consists entirely of a finite decimal number (optional leading sign, digits, optional single decimal point, no thousands separators, no unit suffix), THE Units_Module SHALL interpret the number as millimetres and return it as a number in millimetres.
4. IF the supplied text is empty, whitespace-only, contains any non-numeric characters (including partial numbers such as "12abc", unit suffixes such as "12mm", or thousands separators such as "1,200"), or represents a non-finite value (NaN, Infinity, -Infinity), THEN THE Units_Module SHALL return null and SHALL NOT throw an exception.
5. WHEN a finite length in metres is supplied for display, THE Units_Module SHALL return its millimetre value as a string with exactly D digits after the decimal point. D is the caller-supplied precision (an integer from 0 to 6) or 2 if omitted. The string SHALL use "." as the decimal separator, SHALL contain no grouping or thousands separators, and SHALL be identical regardless of the runtime locale setting.
6. IF a non-finite value (NaN, Infinity, -Infinity) is supplied for display formatting, THEN THE Units_Module SHALL return a placeholder string indicating the value is unavailable and SHALL NOT throw an exception.
7. FOR ALL finite lengths x in metres with |x| ≤ 10⁶ m, and FOR ALL precisions D from 0 to 6, parsing the formatted value of x SHALL return a non-null number within 0.5×10⁻ᴰ mm (plus 1×10⁻⁹ mm floating-point tolerance) of x converted to millimetres (round-trip property).

### Requirement 3: Challenge Definition and Loading

*Amended by D-47 and its amendment (2026-10-18): the beam baseline in 3.6 is now a Ø31 mm solid circle that fails deflection and mass (content version 3); the Ø30 mm circle remains a physics fixture. See [DECISIONS.md][decisions].*

**User Story:** As a content author, I want challenges defined as schema-validated configuration, so that new challenges can be added without code changes and invalid data is caught early.

#### Acceptance Criteria

1. WHEN challenge JSON is supplied, THE Challenge_Loader SHALL validate the JSON against the zod schema and every cross-field rule. If all checks pass, it SHALL return a Challenge whose field values equal the supplied JSON values, with an empty list of schema issues.
2. IF challenge JSON fails schema or cross-field validation, THEN THE Challenge_Loader SHALL return no Challenge and SHALL return a list of schema issues. The list SHALL contain one entry per failure, covering all failures rather than only the first. Each entry SHALL identify the path of the failing field and the rule it violated.
3. IF the bundled challenge fails validation at startup, THEN THE Platform SHALL display a full-page error listing every schema issue returned by the Challenge_Loader. THE Platform SHALL render no challenge content, controls or simulation for that challenge to the student.
4. WHEN a Challenge is loaded, THE Challenge_Loader SHALL deep-freeze the Challenge, so that attempts to assign, add or delete a property at any nesting level leave the Challenge's values unchanged.
5. THE Challenge SHALL define `difficulty` and `allowedModes` as independent fields. `allowedModes` SHALL be a non-empty list of modes, and SHALL equal `['guided', 'parametric']` for the MVP challenge.
6. THE bundled `cantilever-beam-1` Challenge SHALL define:
   - L = 0.60 m
   - F = 300 N downward at the free end
   - E = 69e9 Pa
   - ρ = 2700 kg/m³
   - σ_allow = 120e6 Pa
   - σ_yield = 240e6 Pa
   - a baseline circle of 0.030 m diameter
   - maxDeflectionM = 0.004
   - maxMassKg = 1.20
   - maxStressPa = 120e6
   - maxWidthM = maxHeightM = 0.080
   - the section ranges and defaults from the design data table:
     - Circle d range [0.005, 0.100], step 0.0005
     - Tube D range [0.010, 0.100], minimum wall 0.002, default wall 0.004
     - Rectangle b and h range [0.003, 0.100]
     - I-section b and h range [0.010, 0.100], default tf = tw = 0.004
   - `predictionPolicy.requiredOnIterations` = [1, 3]
   - visualization exaggeration factor 15, with maximum visual deflection 0.3·L
7. THE Platform SHALL exclude the Challenge `referenceDesign` from every student-facing view, and from all challenge data delivered to student-facing views.
8. IF challenge JSON contains keys that the schema does not define, at any nesting level, THEN THE Challenge_Loader SHALL reject the JSON. It SHALL return no Challenge and SHALL return a schema issue that identifies the path of each undefined key.
9. IF challenge JSON violates any section cross-field rule, THEN THE Challenge_Loader SHALL reject the JSON and SHALL return a schema issue for each violated rule. The section cross-field rules are:
   - each range minimum is less than or equal to its maximum
   - each section default lies within its range
   - I-section tf ≥ 0.003, tw ≥ 0.003, h − 2tf ≥ 0.003 and tw ≤ b
   - tube wall ≥ 0.002 and less than half of D
10. IF the supplied challenge input is not parseable JSON, THEN THE Challenge_Loader SHALL return no Challenge and SHALL return a schema issue indicating that the input could not be parsed.

### Requirement 4: Locked Fields and Immutable Challenge Data

*Amended by D-32 (2026-10-16): the fixed values of 4.8 sit in a native disclosure, collapsed by default, with the lock icon and summary always visible; which fields are locked is unchanged. See [DECISIONS.md][decisions].*

**User Story:** As an instructor, I want the load case, span, and material fixed by the challenge, so that students learn by changing only the cross-section.

#### Acceptance Criteria

1. FOR ALL action sequences, including section change, parameter set, orientation change, history restore, design import, and session reset, THE Session_Reducer SHALL keep `draft.lengthM` and `draft.materialId` strictly equal, with no tolerance, to the Challenge `lengthM` and `materialId` values.
2. FOR ALL action sequences, THE Session_Reducer SHALL use the Challenge `forceN` and `support` values, unchanged and with no tolerance, as the load and support for every Draft and every Test_Result.
3. IF a Design given to the Geometry_Validator has a `lengthM` or `materialId` value not strictly equal to the Challenge value, THEN THE Geometry_Validator SHALL return one `LOCKED_FIELD_CHANGED` error for each differing Locked_Field, with the error's `param` set to that Locked_Field's name.
4. IF an action or imported design attempts to change any Locked_Field (`lengthM`, `materialId`, `forceN`, or `support`), THEN THE Session_Reducer SHALL reject the whole change and return a Draft, `draftStatus`, and history deep-equal to the state before the action.
5. IF an imported design is rejected because of a `LOCKED_FIELD_CHANGED` error, THEN THE Platform SHALL show the import error dialog with one reason for each changed Locked_Field, naming that field, and THE Live_Region SHALL announce the rejection.
6. FOR ALL action sequences, THE Session_Reducer SHALL keep the Challenge object, including `constraints` and every nested object and array, frozen at every nesting level and deep-equal to the Challenge returned by the Challenge_Loader.
7. IF code attempts to change any property of the Challenge or its nested objects, THEN THE Platform SHALL leave the Challenge deep-equal to the Challenge returned by the Challenge_Loader.
8. THE Numeric_Controls SHALL display each of the four Locked_Fields (`lengthM`, `materialId`, `forceN`, `support`) with its current Challenge value and unit, as a read-only control that keyboard, pointer, and paste input cannot change, with a lock icon and the visible text "Fixed by challenge".
9. THE Numeric_Controls SHALL mark each Locked_Field control as read-only for assistive technologies, and SHALL give its lock icon an accessible name that says the field is fixed by the challenge.

### Requirement 5: Section Types and Geometry Validation

**User Story:** As a student, I want invalid cross-sections rejected with clear reasons, so that I only analyze physically meaningful shapes.

#### Acceptance Criteria

1. THE Geometry_Validator SHALL accept exactly four section kinds, each with exactly the listed dimension parameters, all expressed in metres: circle (diameter), tube (outer diameter D, inner diameter d), rectangle (width b, height h), and I-section (width b, height h, flange thickness tf, web thickness tw).
2. IF a Section dimension is NaN, +Infinity, or −Infinity, THEN THE Geometry_Validator SHALL return exactly one `NON_FINITE` error naming that parameter, and SHALL NOT return any other error for that parameter.
3. IF a finite Section dimension is less than or equal to 0 (including −0), other than a tube inner diameter exactly equal to 0, THEN THE Geometry_Validator SHALL return exactly one `NON_POSITIVE` error naming that parameter, and SHALL NOT return any other error for that parameter.
4. IF a finite, positive Section dimension that has a Challenge range is less than the range minimum minus GEOM_TOL (1e-9 m) or greater than the range maximum plus GEOM_TOL, THEN THE Geometry_Validator SHALL return a `BELOW_MIN` or `ABOVE_MAX` error respectively naming that parameter, and a value within GEOM_TOL of a range bound SHALL produce no range error.
5. IF a tube inner diameter d is greater than or equal to its outer diameter D, THEN THE Geometry_Validator SHALL return an `INNER_NOT_LESS_THAN_OUTER` error naming the inner diameter parameter.
6. IF a tube satisfies d < D and its wall thickness (D − d)/2 is less than the Challenge minimum wall minus GEOM_TOL, THEN THE Geometry_Validator SHALL return a `WALL_TOO_THIN` error naming the inner diameter parameter.
7. IF an I-section clear web height h − 2·tf is less than the Challenge minimum clear web height minus GEOM_TOL, THEN THE Geometry_Validator SHALL return a `FLANGES_OVERLAP` error naming the flange thickness parameter.
8. IF an I-section web thickness tw is greater than the flange width b plus GEOM_TOL, THEN THE Geometry_Validator SHALL return a `WEB_WIDER_THAN_FLANGE` error naming the web thickness parameter.
9. IF an I-section flange thickness tf is less than the Challenge minimum flange thickness minus GEOM_TOL, THEN THE Geometry_Validator SHALL return a `FLANGE_TOO_THIN` error naming the flange thickness parameter, and IF an I-section web thickness tw is less than the Challenge minimum web thickness minus GEOM_TOL, THEN THE Geometry_Validator SHALL return a `WEB_TOO_THIN` error naming the web thickness parameter.
10. IF a Design uses a section kind not listed in the Challenge `allowedSections`, THEN THE Geometry_Validator SHALL return exactly one `SECTION_NOT_ALLOWED` error and SHALL NOT return dimension errors for that Section.
11. IF a Design orientation is any value other than exactly 0 or exactly 90 (including NaN and non-integer values), THEN THE Geometry_Validator SHALL return a `BAD_ORIENTATION` error.
12. WHEN a Design satisfies every validation rule in criteria 2 through 11, THE Geometry_Validator SHALL return an empty error list.
13. WHEN a Design violates more than one validation rule, THE Geometry_Validator SHALL return one error per violated rule in a single list rather than stopping at the first violation, and SHALL return the same list in the same order for identical inputs.
14. THE Geometry_Validator SHALL include in each returned error an error code from the set defined in criteria 2 through 11, the affected parameter name for every dimension-specific error, and a non-empty human-readable message that names the violated rule.
15. WHEN the Geometry_Validator validates a Design, THE Geometry_Validator SHALL leave the Design input unmodified.

### Requirement 6: Clamp, Strict Set, and Section Conversion

**User Story:** As a student, I want dragging to stay within valid ranges and typed values to be checked, so that my draft is always a valid design.

#### Acceptance Criteria

1. WHEN a finite parameter value is set in clamp mode on a valid Section, THE Section_Clamper SHALL return a Section for which the Geometry_Validator returns an empty error list, with the parameter set to the supplied value if it lies within the parameter's permissible range, or else to the nearest bound of that range. The permissible range is the Challenge range for that parameter, narrowed for dependent parameters as follows: tube inner diameter d ∈ [0, D − 2·(Challenge minimum wall)], I-section flange thickness tf ∈ [Challenge minimum tf, (h − Challenge minimum clear web height)/2], and I-section web thickness tw ∈ [Challenge minimum tw, b].
2. WHEN a parameter value is set in clamp mode, THE Section_Clamper SHALL leave every other parameter equal to its previous value, except for these coupled thicknesses: (a) if a reduced tube outer diameter D would make the wall thinner than the Challenge minimum, the inner diameter d SHALL be reduced to max(0, D − 2·minimum wall); (b) if a reduced I-section height h would make h − 2·tf less than the Challenge minimum clear web height, tf SHALL be reduced to (h − minimum clear web height)/2; (c) if a reduced I-section width b would be smaller than tw, tw SHALL be reduced to b. Coupled thicknesses SHALL never increase.
3. IF a non-finite value (NaN, +Infinity, or −Infinity) is supplied in clamp mode, THEN THE Section_Clamper SHALL return a Section deep-equal to the input Section.
4. FOR ALL valid Sections, parameters of that Section's kind, and numeric values (finite or non-finite), applying the Section_Clamper twice with the same parameter and value SHALL produce a result deep-equal to applying the Section_Clamper once (idempotence).
5. WHEN a parameter value is set in strict mode, THE Strict_Setter SHALL return success containing the Section with only that parameter replaced (no coupled thickness changes) if and only if the Geometry_Validator returns an empty error list for that Section, and SHALL otherwise return failure containing every Geometry_Validator error for that Section.
6. IF a strict-mode value produces an invalid Section, THEN THE Session_Reducer SHALL record the returned errors, each with error code, affected parameter, and message, in `draftErrors` and keep the Draft deep-equal to the previous Draft.
7. IF a non-finite value is supplied in strict mode, THEN THE Strict_Setter SHALL return failure with a `NON_FINITE` error for that parameter, and THE Session_Reducer SHALL keep the Draft deep-equal to the previous Draft.
8. WHEN the Session_Reducer applies a strict-mode value that the Strict_Setter accepts, THE Session_Reducer SHALL replace the Draft Section with the returned Section and set `draftErrors` to an empty list.
9. WHEN a section kind different from the current kind is applied, THE Section_Converter SHALL return a Section of the target kind for which the Geometry_Validator returns an empty error list, with bounding-box width and height each equal, within GEOM_TOL, to the previous bounding-box width b and height h clamped to the target kind's Challenge ranges. Circle diameter and tube outer diameter SHALL equal max(b, h) clamped to the target's diameter range, and a rectangle or I-section converted from a circle or tube SHALL use that diameter for both b and h before clamping.
10. WHEN a section kind different from the current kind is applied, THE Section_Converter SHALL set tube wall thickness, I-section tf, and I-section tw to the Challenge defaults. If a default would make the Section invalid, the Section_Converter SHALL instead use the largest value within the permissible range defined in criterion 1.
11. WHEN the target section kind equals the current kind, THE Section_Converter SHALL return a Section deep-equal to the current Section.

### Requirement 7: Orientation and Envelope

*Amended by D-26 (2026-10-15): the bending-axis label and axis triad of 7.5 are removed from the 3D model. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to rotate a section between 0° and 90° and see how its footprint changes, so that I learn how orientation affects bending stiffness.

#### Acceptance Criteria

1. THE Platform SHALL restrict Design orientation to exactly two values, 0° and 90°, where 90° means the Section is rotated 90° about global X so that the section-local u-axis (width b) maps onto global Y.
2. THE Platform SHALL compute the Envelope as width (Z) = b and height (Y) = h at 0°, and as width (Z) = h and height (Y) = b at 90°, where b and h are the unrotated Section bounding-box width and height (rectangle and I-section: width and height parameters; circle: b = h = diameter; tube: b = h = outer diameter).
3. THE Platform SHALL produce, for every valid Section, an Envelope at 90° whose width equals the 0° Envelope height and whose height equals the 0° Envelope width, each within GEOM_TOL.
4. WHILE the active section kind is circle or tube, THE Numeric_Controls SHALL render the orientation radio group as disabled and non-focusable for input, and THE Platform SHALL retain the Draft orientation value (0 or 90) unchanged.
5. THE Viewport SHALL display the text label "Bending axis (resists vertical load)" and an axis triad labeled X, Y, and Z at all times while a Draft is loaded.
6. WHEN the student selects 0° or 90° in the Numeric_Controls orientation radio group, THE Session_Reducer SHALL set the Draft orientation to the selected value and SHALL keep every Section parameter, `lengthM`, and `materialId` deep-equal to their previous values.
7. WHEN the Draft orientation changes, THE Viewport SHALL render the beam cross-section rotated to the new orientation and display the Envelope width (Z) and height (Y) in millimetres matching criterion 2, within 100 ms and without requiring Run Test.
8. IF a `setOrientation` action or an imported Design carries an orientation outside {0, 90}, THEN THE Session_Reducer SHALL reject the change, keep the Draft deep-equal to the previous Draft, and report a `BAD_ORIENTATION` error to the student.

### Requirement 8: Section Properties

**User Story:** As a student, I want accurate area and second-moment values for each section, so that the analysis reflects how material placement affects stiffness.

#### Acceptance Criteria

1. WHEN section properties are computed for a valid Section, THE Physics_Engine SHALL return area (m²), Ixx (m⁴), Iyy (m⁴), vertical extreme fiber h/2 (m), and horizontal extreme fiber b/2 (m) in SI units. Each value SHALL match the closed-form formulas within relative 1e-12: circle A = πd²/4, Ixx = Iyy = πd⁴/64; tube A = π(D² − d²)/4, Ixx = Iyy = π(D⁴ − d⁴)/64; rectangle A = b·h, Ixx = b·h³/12, Iyy = h·b³/12; I-section A = 2b·tf + tw·(h − 2tf), Ixx = [b·h³ − (b − tw)(h − 2tf)³]/12, Iyy = [2tf·b³ + (h − 2tf)·tw³]/12. For a circle or tube, both h and b equal the outer diameter.
2. WHEN section properties are computed for a valid Section, THE Physics_Engine SHALL return a finite value greater than zero for every returned field. A valid Section is one with all dimensions finite and greater than zero (except a tube inner diameter, which may equal 0), all dimensions within the challenge parameter ranges, tube d < D and (D − d)/2 ≥ minimum wall, and I-section h − 2tf ≥ minimum clear web height, tf ≥ minimum tf, tw ≥ minimum tw, and tw ≤ b.
3. WHEN the Section is a circle or tube, THE Physics_Engine SHALL return Ixx equal to Iyy within relative 1e-12, and SHALL return I_bend, c, deflection, stress, and mass at 0° equal within relative 1e-12 to the values at 90°.
4. WHEN the Section is a rectangle, THE Physics_Engine SHALL return Ixx(b, h) equal to Iyy(h, b) within relative 1e-12, and SHALL return I_bend, c, deflection, stress, and mass for (b, h, 90°) equal within relative 1e-12 to those for (h, b, 0°).
5. WHEN the Section is a rectangle with h > b, THE Physics_Engine SHALL return an I_bend at 0° strictly greater than the I_bend at 90°, with the ratio equal to (h/b)² within relative 1e-12.
6. WHEN a valid rectangle's height is multiplied by a factor k > 0 with b held constant and the scaled rectangle is still valid, THE Physics_Engine SHALL return Ixx multiplied by k³, Iyy multiplied by k, and area and mass each multiplied by k, all within relative 1e-12.
7. WHEN section properties are computed for a valid I-section, THE Physics_Engine SHALL return area ≤ b·h and Ixx ≤ b·h³/12, and SHALL return both strictly less than these bounds when tw < b. WHEN section properties are computed for a valid tube with d > 0, THE Physics_Engine SHALL return area strictly less than πD²/4 and Ixx and Iyy strictly less than πD⁴/64.
8. WHEN section properties are computed for a tube with d = 0, THE Physics_Engine SHALL return area, Ixx, Iyy, h/2, and b/2 equal within relative 1e-12 to those of a circle with diameter D. WHEN section properties are computed for an I-section with tw = b, THE Physics_Engine SHALL return area, Ixx, Iyy, h/2, and b/2 equal within relative 1e-12 to those of a rectangle(b, h).
9. WHEN orientation is 0°, THE Physics_Engine SHALL select I_bend = Ixx and c = h/2. WHEN orientation is 90°, THE Physics_Engine SHALL select I_bend = Iyy and c = b/2.
10. WHEN section properties are computed for the verified fixtures (baseline circle Ø30 mm, reference I-section h = 60, b = 40, tf = 4, tw = 3 mm at 0°, tubeSameMass D = 50, d = 40 mm, rectTall b = 15, h = 45 mm at 0°, rectFlat at 90°, heavySquare 40 × 40 mm, wideI h = 60, b = 90, tf = 4, tw = 3 mm, tinyCircle Ø5 mm), THE Physics_Engine SHALL return area, mass, and I_bend matching the design fixture table within relative 1e-3.
11. WHEN the same Section and orientation are given in repeated calls, THE Physics_Engine SHALL return identical values on every call. Values SHALL be derived only from the typed section parameters, never from mesh or rendering state.

### Requirement 9: Beam Solver

**User Story:** As a student, I want a deterministic cantilever analysis, so that each test result is trustworthy and repeatable.

#### Acceptance Criteria

1. WHEN a valid Design (one for which the Geometry_Validator returns an empty error list) is analyzed with a Challenge force F (N) and a material providing density ρ (kg/m³) and elastic modulus E (Pa), THE Physics_Engine SHALL return an Analysis containing massKg = ρ·A·L, tipDeflectionM = F·L³/(3·E·I_bend), maxMomentNm = F·L, and nominalMaxStressPa = M·c/I_bend, where A and I_bend are the Section properties for the Design orientation and L is `lengthM`, each value matching the closed-form result within relative 1e-12.
2. WHEN a valid Design is analyzed with F > 0, THE Physics_Engine SHALL return finite values for every numeric field of the Analysis, with area, I_bend, massKg, tipDeflectionM, maxMomentNm, and nominalMaxStressPa each strictly greater than zero.
3. IF any computed Analysis value is NaN, +Infinity, or −Infinity, THEN THE Physics_Engine SHALL throw a `PhysicsInvariantError` identifying the offending field and SHALL return no Analysis.
4. IF the Physics_Engine throws a `PhysicsInvariantError` during Run Test, THEN THE Session_Reducer SHALL leave the iteration history and Draft unchanged and THE Requirements_Panel SHALL display an error banner indicating that the analysis could not be computed.
5. THE Physics_Engine SHALL compute the deflection shape as w(x) = F·x²·(3L − x)/(6·E·I_bend) for x in [0, L], with w(0) = 0 exactly, w(L) equal to tipDeflectionM within relative 1e-12, and w(xᵢ) ≤ w(xᵢ₊₁) for every pair of consecutive sample points xᵢ < xᵢ₊₁ returned on [0, L].
6. WHEN the span L of a valid Design is scaled by λ in the range 0.1 to 10 with all other inputs unchanged, THE Physics_Engine SHALL scale tipDeflectionM by λ³, nominalMaxStressPa by λ, and massKg by λ, each within relative 1e-12.
7. WHEN the elastic modulus E is doubled with all other inputs unchanged, THE Physics_Engine SHALL return tipDeflectionM equal to half the original within relative 1e-12, and SHALL return nominalMaxStressPa and massKg bitwise-identical to the original.
8. WHEN the force F is scaled by k in the range 0.1 to 10 with all other inputs unchanged, THE Physics_Engine SHALL scale tipDeflectionM and nominalMaxStressPa by k within relative 1e-12 and SHALL return massKg bitwise-identical to the original.
9. WHEN two Designs differing only in orientation (0° versus 90°) are analyzed, THE Physics_Engine SHALL return bitwise-identical massKg for both.
10. THE Physics_Engine SHALL use an extreme fiber distance c equal to half the Envelope height (Y) for the Design orientation, within absolute GEOM_TOL.
11. WHEN `analyze` is called twice with deep-equal inputs, THE Physics_Engine SHALL return Analysis objects that are deep-equal and frozen (Object.isFrozen returns true), and SHALL leave every input object deep-equal to its state before the call.
12. THE Physics_Engine SHALL compute every Analysis value solely from the Design's typed Section parameters, orientation, `lengthM`, material properties, and force, so that analyzing the same inputs with different meshes, rendering state, or generated text present returns deep-equal Analysis objects.

### Requirement 10: Model Applicability and Analysis Metadata

**User Story:** As a student, I want to know when my design falls outside the idealized model, so that I do not trust numbers the model cannot support.

#### Acceptance Criteria

1. WHEN an Analysis is computed for a valid Design, THE Applicability_Checker SHALL evaluate DEPTH_SPAN (Envelope height / L), LARGE_DEFLECTION (tip deflection δ / L), and PLASTICITY (nominal stress σ / σ_yield) for every section kind.
2. WHEN an Analysis is computed for a valid Design, THE Applicability_Checker SHALL evaluate TUBE_SLENDERNESS (D / t_wall, where t_wall = (D − d)/2) only for tube Sections, FLANGE_OUTSTAND ((b − tw)/(2·tf)) and WEB_SLENDERNESS ((h − 2·tf)/tw) only for I-sections, and RECT_ASPECT (Envelope height / Envelope width) only for rectangle Sections whose Envelope height is greater than their Envelope width.
3. IF a metric is not evaluated for the Design's section kind or orientation per criterion 2, THEN THE Applicability_Checker SHALL record no issue for that metric.
4. IF withinLimit(value, notApplicableThreshold) is false for an evaluated metric, using not-applicable thresholds DEPTH_SPAN 0.20, LARGE_DEFLECTION 0.10, PLASTICITY 1.00, TUBE_SLENDERNESS 100, FLANGE_OUTSTAND 20, WEB_SLENDERNESS 120, and RECT_ASPECT 20, THEN THE Applicability_Checker SHALL add exactly one issue to `notApplicableReasons` containing the metric code, a message naming the unmodeled effect, the computed metric value, and the not-applicable threshold.
5. IF withinLimit(value, warningThreshold) is false and withinLimit(value, notApplicableThreshold) is true for an evaluated metric, using warning thresholds DEPTH_SPAN 0.10, LARGE_DEFLECTION 0.02, PLASTICITY 0.80, TUBE_SLENDERNESS 40, FLANGE_OUTSTAND 10, WEB_SLENDERNESS 60, and RECT_ASPECT 8, THEN THE Applicability_Checker SHALL add exactly one issue to `warnings` containing the metric code, a message naming the unmodeled effect, the computed metric value, and the warning threshold.
6. WHEN withinLimit(value, warningThreshold) is true for an evaluated metric (including values within REL_TOL above the threshold, such as 0.1000000000000001 against 0.10), THE Applicability_Checker SHALL record no issue for that metric.
7. THE Applicability_Checker SHALL record each metric code at most once across `warnings` and `notApplicableReasons` combined.
8. WHEN an Analysis is produced, THE Physics_Engine SHALL set `applicable` to true if `notApplicableReasons` contains zero issues and to false if it contains one or more issues, independent of the contents of `warnings`.
9. WHEN an Analysis is produced, THE Physics_Engine SHALL include the `modelId` "eulerBernoulliCantileverTipForce", the list of model assumptions, and `unsupportedEffects` listing exactly these nine effects: torsion, shear deformation, local buckling, lateral-torsional buckling, plasticity, large deflection, root stress concentrations, joint/fastener compliance, and self-weight, regardless of the value of `applicable`.
10. THE Platform SHALL define all fourteen applicability thresholds (seven warning and seven not-applicable) in `physics/constants.ts`, and THE Applicability_Checker SHALL read thresholds only from that module.

### Requirement 11: Constraint Evaluation

**User Story:** As a student, I want each requirement checked individually with a clear pass or fail, so that I know exactly what to fix.

#### Acceptance Criteria

1. WHEN an Analysis is evaluated, THE Constraint_Engine SHALL return exactly 7 constraint results, one for each of deflection, stress, mass, envelopeWidth, envelopeHeight, featureGeometry, and applicability, in that fixed order, each containing id, label, value, limit, unit, passed flag, and utilization.
2. WHEN an Analysis is evaluated, THE Constraint_Engine SHALL use as numeric values and limits: tip deflection against the Challenge maximum deflection with unit m, nominal maximum stress against the Challenge maximum stress with unit Pa, mass against the Challenge maximum mass with unit kg, oriented Envelope width against the Challenge maximum width with unit m, and oriented Envelope height against the Challenge maximum height with unit m.
3. THE Constraint_Engine SHALL pass a numeric constraint if and only if both value and limit are finite and value ≤ limit·(1 + REL_TOL), so that a value equal to the limit passes and a value of limit·(1 + 1e-6) fails.
4. IF a numeric constraint value or limit is NaN, +Infinity, or −Infinity, THEN THE Constraint_Engine SHALL set that constraint's passed flag to false and SHALL still return all 7 constraint results.
5. THE Constraint_Engine SHALL set the utilization of each numeric constraint to value / limit.
6. THE Constraint_Engine SHALL report the featureGeometry and applicability constraints with unit `bool`, and SHALL set featureGeometry passed to true if and only if the Geometry_Validator returns zero issues for the Design, and applicability passed to true if and only if the Analysis `applicable` flag is true.
7. WHEN a Design is evaluated, THE Constraint_Engine SHALL re-run the Geometry_Validator checks on that Design and Challenge to determine the featureGeometry result, rather than reusing any earlier validation result.
8. THE Constraint_Engine SHALL set `failures` to exactly the ids of the constraints whose passed flag is false, listed in the same fixed order as the constraint results, and SHALL set `failures` to an empty list when all 7 constraints pass.
9. THE Constraint_Engine SHALL keep every failing numeric constraint failing when its positive finite limit is multiplied by a factor f with 0 < f ≤ 1 and the value is unchanged.
10. THE Constraint_Engine SHALL keep every passing numeric constraint passing when its positive finite limit is multiplied by a factor f ≥ 1 and the value is unchanged.

### Requirement 12: Acceptance Status and Efficiency

*Amended by D-47 and its amendment (2026-10-18): the Baseline fixture in 12.7 describes the former Ø30 mm baseline; the current beam baseline (Ø31 mm) fails deflection and mass. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want a single acceptance status plus efficiency indicators, so that I can tell whether my design works and how much margin it has.

#### Acceptance Criteria

1. IF an Analysis has `applicable` equal to false, THEN THE Constraint_Engine SHALL set Status to `modelNotApplicable` and `accepted` to false, regardless of the passed flags of the other constraint results.
2. WHEN an Analysis with `applicable` equal to true is evaluated and all seven constraint results defined in Requirement 11 have passed equal to true, THE Constraint_Engine SHALL set Status to `accepted`.
3. WHEN an Analysis with `applicable` equal to true is evaluated and at least one constraint result has passed equal to false, THE Constraint_Engine SHALL set Status to `notAccepted`.
4. THE Constraint_Engine SHALL set `accepted` to true if and only if Status is `accepted`, and SHALL set exactly one Status value per Evaluation.
5. WHEN an Analysis is evaluated, THE Constraint_Engine SHALL compute efficiency as massUsage = m / maxMassKg, deflectionMargin = 1 − δ / maxDeflectionM, and stressMargin = 1 − σ / maxStressPa, using the Challenge limits with m in kg, δ in m, and σ in Pa, without clamping, so that massUsage > 1 and margins < 0 indicate a limit was exceeded.
6. THE Constraint_Engine SHALL determine Status only from the constraint results and `applicable`, so that entries in Analysis `warnings` do not change Status or `accepted`.
7. WHEN the Baseline is evaluated, THE Constraint_Engine SHALL return Status `notAccepted`, `accepted` false, failures equal to ['deflection'], tip deflection 7.87 mm, mass 1.145 kg, and stress 67.9 MPa, each within relative 1e-3, and deflectionMargin less than 0.
8. WHEN the reference design (I-section h = 60 mm, b = 40 mm, tf = 4 mm, tw = 3 mm, orientation 0°) is evaluated, THE Constraint_Engine SHALL return Status `accepted`, `accepted` true, an empty failures list, an empty `warnings` list, and A = 4.760e-4 m², m = 0.771 kg, I_bend = 2.865e-7 m⁴, δ = 1.09 mm, and σ = 18.9 MPa, each within relative 1e-3.
9. WHEN each remaining design fixture is evaluated, THE Constraint_Engine SHALL return the Status and failures (in the fixed constraint order of Requirement 11) listed in the design fixture table: tubeSameMass (D = 50 mm, d = 40 mm) → `accepted`, []; rectTall (15 × 45 mm, 0°) → `accepted`, []; rectFlat (15 × 45 mm, 90°) → `notAccepted`, ['deflection'], with a LARGE_DEFLECTION warning; heavySquare (40 × 40 mm) → `notAccepted`, ['mass']; wideI (h = 60 mm, b = 90 mm, tf = 4 mm, tw = 3 mm) → `notAccepted`, ['mass', 'envelopeWidth'], with a FLANGE_OUTSTAND warning; tinyCircle (Ø5 mm) → `modelNotApplicable`.
10. IF m, δ, or σ is non-finite, THEN THE Constraint_Engine SHALL set Status to a value other than `accepted` and `accepted` to false.

### Requirement 13: Grounded Explanations

**User Story:** As a student, I want explanations tied to my actual numbers, so that I build correct intuition rather than trusting generic text.

#### Acceptance Criteria

1. THE Explanation_Generator SHALL produce every explanation fact with an `id`, a `text`, and a `basis` map. Each `basis` value SHALL be a finite number that is either copied unchanged from the Analysis or the constraint results of a Test_Result, or computed as a ratio of two such copied values from two compared Test_Results.
2. THE Explanation_Generator SHALL make every numeric value that appears in a fact's `text` equal to a value in that same fact's `basis`, after rounding the `basis` value to the number of decimal places shown in the `text`. A fact's `text` SHALL contain no number that fails this check.
3. WHEN a newer Test_Result is compared against the previous Test_Result, THE Explanation_Generator SHALL produce one fact stating the I_bend ratio (newer I_bend ÷ previous I_bend) and the tip deflection ratio (newer tipDeflectionM ÷ previous tipDeflectionM). Both ratios SHALL be included in that fact's `basis`.
4. WHEN a newer Test_Result is compared against the previous Test_Result, the mass ratio (newer massKg ÷ previous massKg) satisfies |mass ratio − 1| ≤ 0.02, and the tip deflection ratio is less than 0.98, THE Explanation_Generator SHALL produce one fact stating that mass stayed about the same while deflection dropped because material moved farther from the bending axis. The mass ratio and the tip deflection ratio SHALL both be included in that fact's `basis`.
5. IF |mass ratio − 1| > 0.02 or the tip deflection ratio is greater than or equal to 0.98 for two compared Test_Results, THEN THE Explanation_Generator SHALL NOT produce the fact described in criterion 4.
6. WHEN the section kind or the orientation (0° or 90°) differs between the previous and newer compared Test_Results, THE Explanation_Generator SHALL produce one fact naming the previous section kind and orientation and the new section kind and orientation.
7. WHEN a constraint's pass state differs between the previous and newer compared Test_Results, THE Explanation_Generator SHALL produce one fact per changed constraint, naming the constraint, its previous state (pass or fail), and its new state (pass or fail).
8. THE Explanation_Generator SHALL include, in the facts of every Evaluation, exactly one fact stating that results are based on the idealized beam model and that effects such as local buckling are not modeled.
9. WHEN the same pair of Test_Results is compared more than once, THE Explanation_Generator SHALL produce identical facts each time, with the same `id`, `text`, and `basis` values in the same order.

### Requirement 14: Prediction Checkpoint and Scoring

*Extended by D-27: `setPrediction` carries an injected `now` that becomes `Prediction.createdAt`, which keeps 15.8; the criteria text is unchanged. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to predict the effect of my change before testing, so that I practice engineering judgment and see whether my intuition was right.

#### Acceptance Criteria

1. WHEN Run Test is requested with a valid Draft, the next iteration number is in `predictionPolicy.requiredOnIterations`, and no pending prediction exists, THE Session_Reducer SHALL open the Prediction_Dialog, append no Test_Result, and leave the Draft and history unchanged.
2. THE Prediction_Dialog SHALL offer exactly three mutually exclusive directions (increase, decrease, same), with no direction preselected, and an optional explanation field that accepts 0 to 500 characters.
3. WHEN the student confirms the Prediction_Dialog with one direction selected and an explanation of 0 to 500 characters, THE Session_Reducer SHALL store the direction and the explanation as the pending prediction and then run the test for the pending Run Test request.
4. IF the student confirms the Prediction_Dialog with no direction selected or with an explanation longer than 500 characters, THEN THE Prediction_Dialog SHALL remain open, show an error message identifying the invalid field, and THE Session_Reducer SHALL store no pending prediction and append no Test_Result.
5. IF the student cancels the Prediction_Dialog, THEN THE Session_Reducer SHALL close the Prediction_Dialog, store no pending prediction, append no Test_Result, and leave the Draft unchanged.
6. WHEN Run Test is requested with a valid Draft and the next iteration number is not in `predictionPolicy.requiredOnIterations`, THE Session_Reducer SHALL run the test without opening the Prediction_Dialog, whether or not a pending prediction exists.
7. WHEN a prediction is scored, THE Prediction_Scorer SHALL compute r = new tip deflection / tip deflection of the immediately preceding Test_Result in history (the Baseline for iteration 1) and classify the actual direction as increase when r > 1.02, decrease when r < 0.98, and same when 0.98 ≤ r ≤ 1.02.
8. WHEN a prediction is scored, THE Prediction_Scorer SHALL report the predicted direction, the actual direction, the ratio r, and a match flag that is true if and only if the predicted direction equals the actual direction.
9. WHEN a Test_Result is recorded with a pending prediction, THE Session_Reducer SHALL store the prediction (direction and explanation) and its scored outcome from criterion 8 in that Test_Result.
10. WHEN a Test_Result is recorded without a pending prediction, THE Session_Reducer SHALL store no prediction and no scored outcome in that Test_Result.
11. FOR ALL action sequences, THE Session_Reducer SHALL hold a prediction with a scored outcome in every Test_Result whose iteration number is in `predictionPolicy.requiredOnIterations`.

### Requirement 15: Session Initialization and Reducer Invariants

**User Story:** As a student, I want to see the baseline problem quantitatively from the start, so that I understand what needs improving.

#### Acceptance Criteria

1. WHEN `initSession` is called with a Challenge, a timestamp, and an identifier, THE Session_Reducer SHALL analyze and evaluate the Challenge initial design and return a state whose history contains exactly one Test_Result: the Baseline. The Baseline SHALL have iteration 0, the label "Baseline", the supplied timestamp and identifier, no prediction, and a design snapshot deep-equal to the Challenge initial design.
2. WHEN `initSession` returns, THE Session_Reducer SHALL set the Draft deep-equal to the Baseline design snapshot, set `draftStatus` to `tested`, set `draftErrors` to an empty list, and set `reflectionAnswer` to the empty string, with no pending prediction, no submission, and the Prediction_Dialog closed.
3. IF analysis of the Challenge initial design throws a `PhysicsInvariantError` or the initial design fails the Geometry_Validator, THEN `initSession` SHALL return no session state and SHALL report an error identifying the Challenge initial design as the cause.
4. FOR ALL action sequences, including sequences containing `reset`, `restore`, and `importDesign`, THE Session_Reducer SHALL keep the Baseline at history index 0, with iteration 0, and deep-equal to the Baseline produced by `initSession`.
5. FOR ALL deep-equal (state, action, Challenge) inputs, THE Session_Reducer SHALL return deep-equal output states.
6. FOR ALL (state, action, Challenge) inputs, THE Session_Reducer SHALL leave the input state and the Challenge deep-equal to their values before the call.
7. FOR ALL states returned by `initSession` or the Session_Reducer, every Test_Result in history, including its design snapshot, Analysis, Evaluation, and prediction, SHALL be deep-frozen, so that any attempted mutation leaves the Test_Result unchanged.
8. THE Session_Reducer SHALL derive every timestamp and identifier it stores only from `initSession` arguments, action payloads, or values already in the input state, and SHALL NOT read the system clock or a random source. Running the same action sequence twice with the same payloads SHALL produce deep-equal states.
9. FOR ALL action sequences, THE Session_Reducer SHALL keep the Draft valid, meaning the Geometry_Validator returns an empty error list for it. IF an action would produce an invalid Draft, THEN THE Session_Reducer SHALL keep the Draft deep-equal to the previous Draft and record the validation errors in `draftErrors`.

### Requirement 16: Draft and Tested Status

**User Story:** As a student, I want to know whether the numbers shown match my current draft, so that I never confuse untested edits with results.

#### Acceptance Criteria

1. FOR ALL action sequences, THE Session_Reducer SHALL, after processing each action, set `draftStatus` to `tested` if the Draft deep-equals the design snapshot of the latest Test_Result in history (comparison ignores only the design id), and SHALL set `draftStatus` to `draft` otherwise.
2. WHEN a successful edit action changes the Draft so that it no longer deep-equals the latest Test_Result design snapshot (ignoring the design id), THE Session_Reducer SHALL set `draftStatus` to `draft` in the state returned for that action.
3. WHILE `draftStatus` is `draft`, THE Requirements_Panel SHALL display exactly one status badge with the text "Draft".
4. WHILE `draftStatus` is `tested`, THE Requirements_Panel SHALL display exactly one status badge with the text "Tested #n", where n is the iteration number of the latest Test_Result (0 for the Baseline).
5. WHILE `draftStatus` is `draft`, THE Requirements_Panel SHALL display area, inertia, mass, deflection, and stress values equal to those of the latest Test_Result's Analysis, and SHALL display no area, inertia, mass, deflection, or stress value computed from the untested Draft.
6. WHEN a successful edit action changes the Draft, THE Viewport and Numeric_Controls SHALL display the Draft shape, outline, millimetre dimensions, and Envelope box matching the new Draft in the next rendered frame after the state update, without requiring Run Test.
7. WHEN a session is initialized, THE Session_Reducer SHALL set `draftStatus` to `tested` with the Baseline as the latest Test_Result, and THE Requirements_Panel SHALL display the badge "Tested #0".
8. WHEN Run Test appends a Test_Result, THE Session_Reducer SHALL set `draftStatus` to `tested` and THE Requirements_Panel SHALL display "Tested #n" with n equal to the new Test_Result's iteration number.
9. IF an edit action is rejected (strict-mode invalid value or Locked_Field change), THEN THE Session_Reducer SHALL leave both the Draft and `draftStatus` unchanged from the previous state.

### Requirement 17: Run Test

**User Story:** As a student, I want to run a test on my draft and get results, so that I can learn from each iteration.

#### Acceptance Criteria

1. WHEN Run Test is requested with a Draft that passes validation and either the next iteration number is outside `predictionPolicy.requiredOnIterations` or a pending prediction exists, THE Session_Reducer SHALL validate, analyze, and evaluate a frozen copy of the Draft and append exactly one Test_Result whose iteration number equals the latest history entry's iteration number plus 1 (iteration 1 when only the Baseline exists) and whose timestamp and id equal the values supplied in the action payload.
2. IF Run Test is requested with a Draft that fails validation, THEN THE Session_Reducer SHALL set `draftErrors` to the complete list of validation errors, append no Test_Result, leave the Draft, history, `draftStatus`, and pending prediction unchanged, and leave the Prediction_Dialog closed regardless of `predictionPolicy.requiredOnIterations`.
3. WHEN a Test_Result is appended, THE Session_Reducer SHALL set `draftStatus` to `tested`, set `draftErrors` to an empty list, clear the pending prediction, and close the Prediction_Dialog.
4. WHEN a Test_Result is appended, THE Persistence_Module SHALL save the session, including the new Test_Result, before the next action is processed.
5. WHEN a Test_Result with Status `modelNotApplicable` is displayed, THE Requirements_Panel SHALL display a "Model not applicable" banner containing an icon and text that lists every applicability reason recorded in that Test_Result.
6. WHILE `draftErrors` is non-empty, THE Requirements_Panel SHALL list every entry in `draftErrors`, one per error, adjacent to the Run Test action.
7. WHEN a Test_Result is appended, THE Session_Reducer SHALL add the new Test_Result to the compare selection and, if the selection then holds more than three iterations, remove the lowest-numbered iterations until exactly three remain, with the Baseline always remaining comparable and never counted toward the three.
8. WHEN a Test_Result with Status `modelNotApplicable` is displayed, THE Requirements_Panel SHALL label every numeric result of that Test_Result (deflection, stress, and mass) as outside model assumptions.

### Requirement 18: Append-Only History and Comparison

*Amended by D-29, D-30, D-31 (2026-10-16) and D-51 (2026-10-18): compact history rows and a list/detail comparison view; non-Baseline entries can be deleted from the visible history (archived results are kept); reset to baseline restarts history with a new Baseline, and 18.1 still holds for every other action. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want an unchangeable record of my tests that I can compare, so that I can see how each change affected performance.

#### Acceptance Criteria

1. FOR ALL action sequences, THE Session_Reducer SHALL keep every existing history entry reference-equal and at the same index in the next state, SHALL grow history by exactly one entry when an action records a Test_Result, and SHALL grow history by zero entries for every other action, including rejected Run Test requests, restores, and Draft edits.
2. WHEN the Draft is edited after a test, THE Session_Reducer SHALL keep every Test_Result design snapshot, Analysis, Evaluation, and stored prediction deep-equal to its value at record time.
3. THE History_Compare SHALL list the Baseline first, labeled "Baseline", followed by every iteration in ascending iteration-number order, and SHALL show for each entry its iteration number, Status, key results, and prediction outcome, where key results are mass (kg), tip deflection (mm), nominal max stress (MPa), pass/fail for each constraint, and section type.
4. WHEN a Test_Result has no stored prediction, THE History_Compare SHALL show its prediction outcome as "no prediction"; otherwise, THE History_Compare SHALL show the predicted direction, actual direction, and whether the prediction matched.
5. THE History_Compare SHALL allow the Baseline and up to three selected iterations (at most four Test_Results in total) to be compared at the same time, with the Baseline always included in the comparison.
6. IF the student attempts to select a fourth iteration while three iterations are already selected, THEN THE History_Compare SHALL leave the current selection unchanged and indicate that at most three iterations can be compared.
7. WHEN Test_Results are compared, THE History_Compare SHALL display, for each selected iteration, the signed difference versus the Baseline and versus the immediately preceding iteration number in history (whether or not that iteration is selected) for mass (kg), tip deflection (mm), and nominal max stress (MPa), the change in pass/fail state for each constraint, and whether the section type changed.
8. WHEN the Baseline or iteration 1 is shown in a comparison, THE History_Compare SHALL show no delta versus the Baseline for the Baseline itself, and SHALL treat the Baseline as the previous iteration for iteration 1.

### Requirement 19: Restore

*Amended by D-31 (2026-10-16): a result deleted from the visible history can no longer be restored. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to restore an earlier design, so that I can branch from a better iteration without losing history.

#### Acceptance Criteria

1. WHEN a restore action references a Test_Result id present in history (including the Baseline), THE Session_Reducer SHALL set the Draft to a deep copy of that Test_Result's design snapshot whose id differs from the snapshot id and whose Section, orientation, `lengthM`, and `materialId` deep-equal the snapshot.
2. WHEN a restore action references a Test_Result id present in history, THE Session_Reducer SHALL leave history unchanged, with the same length, the same order, and every entry identical by reference to the entries in the input state.
3. WHEN a restore action references a Test_Result id present in history, THE Session_Reducer SHALL set `draftStatus` to `tested` if and only if the restored design deep-equals the latest Test_Result design snapshot ignoring the design id, and SHALL set `draftStatus` to `draft` otherwise.
4. WHEN a restore action references a Test_Result id present in history, THE Session_Reducer SHALL set `draftErrors` to an empty list.
5. WHEN a restored Draft is tested with no intervening edit, THE Physics_Engine SHALL produce an Analysis deep-equal to the restored Test_Result Analysis, and THE Session_Reducer SHALL append the result as a new Test_Result with the next iteration number while leaving the restored Test_Result unchanged.
6. WHEN a restore action is applied, THE Session_Reducer SHALL leave the restored Test_Result's design snapshot unchanged by any later edit to the Draft.
7. IF a restore action references a Test_Result id absent from history, THEN THE Session_Reducer SHALL return a state deep-equal to the input state, with the Draft, `draftStatus`, `draftErrors`, and history unchanged.

### Requirement 20: Reflection and Submission

*Amended by D-31 (2026-10-16): a deleted result cannot be submitted, and deleting the submitted result clears the submission but keeps the reflection text. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to reflect on what I learned and submit a chosen iteration, so that I complete the challenge deliberately.

#### Acceptance Criteria

1. THE Reflection_Prompt SHALL display the Challenge `reflectionPrompt` text verbatim and a labelled textarea that accepts a reflection answer of 0 to 2,000 characters, preventing entry beyond 2,000 characters.
2. WHEN submission is requested for a Test_Result id present in history whose iteration is ≥ 1, and the reflection answer contains at least 1 non-whitespace character, THE Session_Reducer SHALL record exactly one submission containing that Test_Result id, that Test_Result's Status, the reflection text as entered (untrimmed), that Test_Result's efficiency (massUsage, deflectionMargin, stressMargin), and the submission time supplied with the request, replacing any previously recorded submission.
3. IF history contains no Test_Result with iteration ≥ 1, or the reflection answer contains no non-whitespace character, THEN THE Submit_Dialog SHALL render the submit button disabled and display visible text stating which of the two conditions is unmet (no tested iteration, empty reflection, or both).
4. IF submission is requested for a Test_Result id absent from history, for the Baseline (iteration 0), or with a reflection answer containing no non-whitespace character, THEN THE Session_Reducer SHALL return the state unchanged, including any previously recorded submission and the reflection answer.
5. WHEN the Submit_Dialog opens, THE Submit_Dialog SHALL preselect the Test_Result with the highest iteration number as the target and SHALL list every Test_Result with iteration ≥ 1, and only those, as selectable targets.
6. WHEN a submission is recorded, THE Submit_Dialog SHALL display the recorded Status as the text "Accepted", "Not accepted", or "Model not applicable" (not conveyed by color alone), together with the submitted iteration number, and SHALL display the efficiency values (mass usage, deflection margin, stress margin) in a region separate from the Status text.
7. WHEN a submission is recorded, THE Persistence_Module SHALL save the session so that the submission and reflection text are present after a page reload.
8. THE Platform SHALL record the reflection text without assigning any score, grade, or pass/fail judgment to it, and the recorded Status SHALL be identical regardless of the reflection text content.

### Requirement 21: Session Persistence

*Amended by D-50 (2026-10-18): sessions of signed-in local accounts are saved under `ei:user:<id>:session:<challengeId>:v<n>`; guest keys are unchanged. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want my progress saved in the browser, so that a reload does not lose my work.

#### Acceptance Criteria

1. WHEN the session is saved, THE Persistence_Module SHALL write exactly one entry to `localStorage` under the key `ei:session:{challengeId}:v{challengeVersion}`, containing the serialized session, `schemaVersion`, and `savedAt` as an ISO 8601 UTC timestamp, replacing any previous entry under that key.
2. WHEN the Platform loads a challenge and an entry exists under that challenge's key, THE Persistence_Module SHALL, in order, apply each registered migration from the stored `schemaVersion` up to the current `schemaVersion`, re-validate every Test_Result design snapshot, and re-analyze every design snapshot.
3. WHEN persisted data passes migration, snapshot validation, and the analysis comparison, THE Platform SHALL restore the session so that the Draft, `draftStatus`, history including the Baseline, compare selection, and reflection text deep-equal the persisted values, without displaying a restore-failure notice.
4. IF persisted data fails to parse, has a `schemaVersion` with no registered migration path to the current version, contains a design snapshot that fails validation, or contains a stored analysis value differing from the recomputed value by more than a relative tolerance of 1e-9, THEN THE Persistence_Module SHALL remove the entry from `localStorage`, apply no part of the persisted data, start a fresh session containing only the Baseline, and display the notice "Saved session could not be restored".
5. IF no entry exists under the challenge's key at load, THEN THE Platform SHALL start a fresh session containing only the Baseline and display no persistence notice.
6. IF any `localStorage` read or write throws, THEN THE Platform SHALL keep the session in memory, keep all other features working, and display the notice "Progress will not be saved in this browser" at most once per page load.
7. FOR ALL reachable sessions, deserializing the serialized session SHALL produce a session deep-equal to the original (round-trip property).
8. IF a corrupted serialized string (truncated, non-JSON, wrong types, or missing fields) is deserialized, THEN THE Persistence_Module SHALL return an error result without throwing and without modifying the current session.

### Requirement 22: Design Import and Export

**User Story:** As a student, I want to export and import designs as JSON, so that I can save or share a design outside the browser session.

#### Acceptance Criteria

1. WHEN a design is exported, THE Import_Export_Module SHALL produce a JSON string that `JSON.parse` accepts and whose parsed value has exactly four top-level keys: `format` equal to `'ei-design'`, `schemaVersion` equal to the number `1`, `challengeId` equal to the active challenge's id, and `design` equal to the exported Design.
2. WHEN JSON is imported, THE Import_Export_Module SHALL return, for any input value (including `null`, `undefined`, numbers, arrays, empty strings, and malformed text), either a valid Design with an empty error list or a non-empty list of error reasons, and SHALL NOT throw an exception.
3. FOR ALL valid Designs, importing the parsed export of the Design against the same challenge SHALL produce a Design deep-equal to the original, including its id (round-trip property).
4. IF imported JSON fails to parse, has a `format` other than `'ei-design'`, has a `schemaVersion` other than `1`, has a `challengeId` different from the active challenge's id, has locked fields (`lengthM`, `materialId`, load, or support) that differ from the active challenge's values, or contains geometry that fails design validation, THEN THE Import_Export_Module SHALL return one error reason for each failed check that applies.
5. IF an import returns one or more error reasons, THEN THE Platform SHALL display a dialog listing every returned reason, and THE Session_Reducer SHALL leave the Draft, `draftStatus`, `draftErrors`, and history unchanged.
6. WHEN valid JSON is imported, THE Session_Reducer SHALL set the Draft to the imported Design, clear `draftErrors`, and leave history unchanged.
7. WHEN valid JSON is imported, THE Session_Reducer SHALL set `draftStatus` to `tested` if the imported Design deep-equals the latest Test_Result design snapshot (ignoring design id), and to `draft` otherwise.

### Requirement 23: Security of Imported Data and Rendering

*Amended by D-50 (2026-10-18): optional local accounts ask for credentials (23.9), kept on this device only as PBKDF2 hashes; nothing is sent over the network. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want imported files and stored data handled safely, so that a malicious file cannot compromise the app.

#### Acceptance Criteria

1. IF an imported file is larger than 100 KB (102,400 bytes), THEN THE Import_Export_Module SHALL reject the file before parsing its contents, return an error reason indicating the file size limit was exceeded, and leave the Draft unchanged; a file of exactly 102,400 bytes SHALL be accepted for parsing.
2. WHEN imported text is parsed, THE Import_Export_Module SHALL use `JSON.parse` as the only parsing mechanism, with no use of `eval`, `new Function`, or dynamic script or module loading on the imported content.
3. IF imported text fails `JSON.parse`, THEN THE Import_Export_Module SHALL return an error reason indicating the file is not valid JSON, without throwing, and leave the Draft unchanged.
4. IF imported JSON contains, at any nesting depth, a key that the export schema does not define, including `__proto__`, `constructor`, or `prototype`, THEN THE Import_Export_Module SHALL reject the JSON with an error reason naming the unexpected key, leave the Draft unchanged, and leave `Object.prototype` unmodified.
5. WHEN imported JSON passes both schema validation and geometry validation, THE Session_Reducer SHALL replace the Draft with the imported Design.
6. IF imported JSON fails schema validation or geometry validation, THEN THE Session_Reducer SHALL leave the entire session state, including the Draft, unchanged.
7. THE Platform SHALL render all user-supplied and imported text (including reflection text, design names, and import error reasons) through React's default escaping, so that text such as `<script>` or `<img onerror=...>` is displayed as literal characters and not executed, with zero uses of `dangerouslySetInnerHTML` in the source code.
8. WHERE the build is produced by `vite build` (including the Figma Make `deploy` and `deploy-preview` builds), THE Platform SHALL include in the served HTML a `<meta http-equiv="Content-Security-Policy">` tag whose content is `default-src 'self'`, injected by a Vite plugin that runs after the Figma Make plugins, and the built application SHALL load and complete the challenge flow under that policy: no inline `<script>` or `<style>` elements in the built HTML, no `data:` or `blob:` asset URLs (asset inlining disabled), no Web Workers created from `blob:` URLs, and no 3D helper that fetches remote fonts, environment maps, or models.
9. THE Platform SHALL store reflection text and session data only in the browser's `localStorage`, SHALL send no network requests containing reflection text or session data, SHALL include no analytics or tracking scripts, and SHALL request no personal data (such as name, email, or account credentials) from the student. THE `.figma/make/site.json` file SHALL define no `analytics.googleAnalyticsId`, no `customScripts` entries, and `accessibility.addBypassLinks` SHALL NOT be true (it injects an inline style), and a unit test SHALL fail if any of these is present.
10. WHERE the build is a development or test build, THE Platform SHALL expose the current session state as a read-only snapshot on `window.__EI_STATE__`.
11. WHERE the build is a production build, THE Platform SHALL leave `window.__EI_STATE__` undefined.

### Requirement 24: Application Layout

**User Story:** As a student, I want a clear layout on both desktop and mobile, so that I can see the problem, the model, and the results together.

#### Acceptance Criteria

1. WHILE the viewport width is greater than 870 px, THE Workbench SHALL show its regions using the template's `.workbench` grid: the `design-panel` (Section_Palette and Numeric_Controls) in a left column, the viewport panel (Viewport) in a center column, the `challenge-panel` (Requirements_Panel) in a right column, and the `results-panel` (History_Compare) as a full-width section below all three columns, followed by the `page-footer`.
2. WHILE the viewport width is at most 620 px, THE Workbench SHALL arrange its regions in a single column, top to bottom, in this order: viewport panel, `design-panel`, `challenge-panel`, `results-panel`, `page-footer`, and THE Platform SHALL hide the sidebar.
3. WHEN the viewport width crosses the 1050 px, 870 px, or 620 px threshold in either direction, THE Platform SHALL switch to the matching layout from criteria 1, 2, 9, and 10 without a page reload and SHALL keep the Draft, the Test_Results, the compare selection, the active results tab, and the values typed into Numeric_Controls unchanged.
4. WHILE the viewport width is anywhere from 320 px to 2560 px, THE Platform SHALL show every region without page-level horizontal scrolling.
5. THE Platform SHALL load the 3D Viewport bundle separately from the main application bundle and only after the main bundle has been requested.
6. WHEN the application starts, THE Platform SHALL render the Requirements_Panel (including the problem statement and the Run Test button), the Section_Palette, the Numeric_Controls, and the History_Compare, with all of them operable, before the 3D Viewport bundle finishes loading.
7. WHILE the 3D Viewport bundle is loading, THE Platform SHALL show a loading placeholder in the Viewport region with the same footprint as the Viewport and a text label saying the 3D view is loading.
8. IF the 3D Viewport bundle fails to load, THEN THE Platform SHALL replace the loading placeholder with the SVG_Fallback from Requirement 31, SHALL keep all controls other than the 3D handles operable, and SHALL keep the Draft and Test_Results unchanged.
9. WHILE the viewport width is greater than 620 px and at most 870 px, THE Workbench SHALL show the `design-panel` and viewport panel side by side in two columns, the `challenge-panel` spanning both columns below them, and the `results-panel` full width below that.
10. WHILE the viewport width is greater than 620 px and at most 1050 px, THE Platform SHALL show the sidebar in its collapsed, icon-only form (72 px wide), and WHILE the viewport width is greater than 1050 px, THE Platform SHALL show the full sidebar.
11. THE Platform SHALL keep the template's visual design: `src/index.css`, `src/platform.css`, and `src/platform-base.css` remain the stylesheets for the Platform_Shell and Workbench, and the Workbench SHALL keep the template's class names for its regions (`design-panel`, `viewport`, `challenge-panel`, `results-panel`, `page-footer`, `toast`, `modal`) so those stylesheets apply unchanged, except for edits needed for self-hosted fonts and accessibility contrast (Requirement 32.5, 32.6).

### Requirement 25: 3D Viewport

*Amended by D-26 (2026-10-15): the visible envelope, dimension, span and axis guides, static text annotations and the "Fixed support" text (25.1, 25.12, 25.15) are removed from the 3D model. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to see the beam, load, and deformation in 3D, so that I can connect the numbers to physical behavior.

#### Acceptance Criteria

1. WHEN the Viewport finishes loading, THE Viewport SHALL render, in a single scene, the wall, the clamped root at X = 0, the beam extruded along +X for length L from the current Draft Section outline (with an inner hole matching the inner outline for tube sections), a downward (−Y) force arrow at the free end (X = L), dimension guides for each Section parameter shown in millimetres, the X/Y/Z axis triad, and an 80 × 80 mm (Z width × Y height) Envelope limit wireframe centered on the beam axis.
2. WHILE the "Show deformation" toggle is on, THE Viewport SHALL render the deformed beam shape of the latest tested snapshot, computing each point's visual vertical offset as the Physics_Engine deflection shape at that X multiplied by the Challenge exaggeration factor (15), and SHALL uniformly scale the offsets down so that the maximum visual offset does not exceed 0.3·L.
3. IF no snapshot has been tested in the current session, THEN THE Viewport SHALL render the deformed shape of the Baseline using the same exaggeration and 0.3·L limit as criterion 2.
4. WHILE a deformed shape is displayed, THE Viewport SHALL display the label "Exaggerated visualization (×N)", where N equals the Challenge exaggeration factor (15 for the MVP challenge).
5. WHILE `draftStatus` is `draft`, THE Viewport SHALL keep the displayed deformed shape equal to that of the latest tested snapshot (or the Baseline) and SHALL NOT update it from untested Draft edits.
6. THE Viewport SHALL use mesh geometry for display only, so that Analysis and evaluation results for a given Section are deep-equal whether or not the Viewport is mounted.
7. WHILE a Dimension_Handles drag is active, THE Viewport SHALL disable orbit controls, and WHEN the drag ends (pointer release or pointer cancel), THE Viewport SHALL re-enable orbit controls within the next animation frame.
8. WHEN the "Reset view" button is activated by pointer click or by Enter/Space keyboard input, THE Viewport SHALL restore the camera position, target, and zoom to the default values used on initial load.
9. WHILE the camera is at its default view, THE Viewport SHALL position the wall and force arrow so that every Dimension_Handle is fully visible and none is occluded by the wall or force arrow geometry.
10. THE Viewport SHALL render a new frame only when the scene, Draft, camera, or viewport size changes, and SHALL apply at most one Draft edit from handle drags per animation frame, using the most recent pointer position for that frame.
11. IF the 3D bundle fails to load or the browser cannot create a WebGL context, THEN THE Viewport SHALL display, in place of the 3D scene, a message indicating that the 3D view is unavailable, while the Requirements_Panel, Numeric_Controls, Section_Palette, and Run Test remain fully operable and the Draft is unchanged.
12. THE Viewport SHALL match the template scene style: beam surfaces in the template greens (`#345640` to `#91a99b` range), a wall with a hatch pattern, a floor grid, a downward force arrow in `#cf744b` labeled with the Challenge force in N and the text "TIP LOAD", a span guide labeled with the Challenge length in mm and "fixed span", and the deformed shape drawn as a dashed orange outline, with every displayed number read from the Challenge or the Draft.
13. THE Viewport SHALL provide the template scene controls as buttons with accessible names "Zoom in", "Zoom out", "Reset view", and "Fit view", operable by pointer and by Enter/Space. "Zoom in" and "Zoom out" SHALL change the camera zoom within fixed bounds, "Fit view" SHALL frame the whole beam, wall, and force arrow, and none of these controls SHALL change the session state.
14. THE Viewport SHALL provide a "Show deformation" toggle button with `aria-pressed` reflecting its state, on by default. WHILE the toggle is off, THE Viewport SHALL hide the deformed shape and the exaggeration label, and toggling SHALL NOT change the session state.
15. THE Viewport panel SHALL display the "Fixed support" label at the wall and a material strip showing the Challenge material name, the elastic modulus in GPa, and the density in kg/m³, each read from the Challenge, with a lock icon whose accessible name states that the material is fixed by the challenge.

### Requirement 26: Section Palette

**User Story:** As a student, I want to choose a section by dragging, clicking, or using the keyboard, so that I can swap shapes in whatever way suits me.

#### Acceptance Criteria

1. THE Section_Palette SHALL display exactly one draggable tile with `role="button"`, a section icon, and a visible text label naming the section kind for each section kind in the Challenge `allowedSections`, in the order listed there, and SHALL display no tile for any section kind outside `allowedSections`.
2. WHEN a tile is dropped on the beam, or on the Viewport canvas at a point where the beam is not hit, THE Section_Palette SHALL apply that tile's section kind to the Draft by replacing the Draft Section with the Section_Converter result for that kind.
3. WHILE a tile is dragged over the beam, THE Viewport SHALL highlight the beam as a drop target, and WHEN the drag leaves the beam, is dropped, or is cancelled, THE Viewport SHALL remove the highlight within one rendered frame.
4. WHEN a tile is clicked, THE Section_Palette SHALL apply that tile's section kind to the Draft by replacing the Draft Section with the Section_Converter result for that kind.
5. WHEN a focused tile receives Enter or Space, THE Section_Palette SHALL apply that tile's section kind to the Draft by replacing the Draft Section with the Section_Converter result for that kind, and SHALL keep keyboard focus on that tile.
6. THE Section_Palette SHALL mark the tile of the Draft's current section kind with an active-state icon, the visible text "Active", and `aria-pressed="true"`, and SHALL set `aria-pressed="false"` on every other tile, so that exactly one tile has `aria-pressed="true"` at any time.
7. IF a dragged tile is released outside the Viewport canvas or the drag is cancelled with Escape, THEN THE Section_Palette SHALL leave the Draft, `draftStatus`, and the active tile unchanged.
8. WHEN a tile whose section kind equals the Draft's current section kind is applied by drop, click, Enter, or Space, THE Section_Palette SHALL leave the Draft deep-equal to the previous Draft and SHALL leave `draftStatus` unchanged.
9. WHEN a tile whose section kind differs from the Draft's current section kind is applied, THE Section_Palette SHALL update the active tile marking, the Viewport beam shape, and the Numeric_Controls dimensions to the new section kind within one rendered frame, and THE Session_Reducer SHALL set `draftStatus` to `draft`.

### Requirement 27: Dimension Handles

*Amended by D-26 (2026-10-15): the live value label and limit feedback of 27.3–27.4 appear in a bar below the canvas, not next to the handle. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to drag handles to resize the section, so that I can explore shape changes directly in 3D.

#### Acceptance Criteria

1. WHEN the current Section kind or orientation changes, THE Dimension_Handles SHALL display exactly one draggable handle for each handle descriptor of the new Section and orientation, and SHALL remove all handles that belong to the previous Section kind or orientation, before the next rendered frame.
2. WHILE a handle drag is active, THE Dimension_Handles SHALL project the pointer position onto that handle's axis and set the parameter of that handle through the Section_Clamper in clamp mode, at most once per animation frame, so that the Draft changes only that parameter plus any coupled thicknesses the Section_Clamper shrinks.
3. WHILE a handle drag is active, THE Dimension_Handles SHALL display a label next to the dragged handle showing the current parameter value in millimetres, formatted by the Units_Module, and updated in the same animation frame as each Draft change.
4. IF a handle drag projects to a value below the minimum or above the maximum of the parameter's permissible range, THEN THE Dimension_Handles SHALL hold the parameter at that limit, keep the Section valid, and display a tooltip indicating that the limit was reached for as long as the projected value stays outside the range.
5. WHEN the projected value of a dragged handle returns inside the parameter's permissible range, THE Dimension_Handles SHALL hide the "limit reached" tooltip and resume setting the parameter to the projected value within the same animation frame.
6. WHEN a handle drag ends (pointer released or pointer cancelled), THE Dimension_Handles SHALL hide the live value label and any "limit reached" tooltip, and SHALL keep the Draft at the last clamped value set during the drag.
7. IF the pointer cannot be projected onto the handle axis during a drag (the projection yields a non-finite value), THEN THE Dimension_Handles SHALL leave the Draft unchanged for that pointer event and continue the drag.

### Requirement 28: Numeric Controls

**User Story:** As a student, I want to type exact dimensions, so that I can make precise changes.

#### Acceptance Criteria

1. THE Numeric_Controls SHALL display one numeric input for each parameter of the current Section. Each input SHALL have a visible label naming the parameter and the unit "mm", and its min, max, and step attributes SHALL equal the Challenge range for that parameter converted to millimetres by the Units_Module.
2. WHEN the current Section or orientation changes in the Draft, THE Numeric_Controls SHALL update every numeric input to the Draft parameter value formatted by the Units_Module, before the next rendered frame.
3. WHEN a numeric input loses focus or receives the Enter key, THE Numeric_Controls SHALL parse the field text with the Units_Module, convert it from millimetres to metres, and set the parameter in strict mode through the Strict_Setter.
4. WHEN a strict-mode set from a numeric input succeeds, THE Session_Reducer SHALL replace the Draft with the resulting Section, and THE Numeric_Controls SHALL clear any inline error message for that input and remove `aria-invalid` from it.
5. IF numeric input text is empty, non-numeric, or non-finite, lies outside the Challenge min to max range for that parameter, or makes the Section invalid according to the Geometry_Validator, THEN THE Numeric_Controls SHALL set `aria-invalid="true"` on the input and display an inline error message next to it, linked by `aria-describedby`, naming the parameter and the failed rule; THE Live_Region SHALL announce the error once; and THE Session_Reducer SHALL keep the Draft deep-equal to the previous Draft.
6. IF a numeric input receives the Escape key, THEN THE Numeric_Controls SHALL replace the field text with the current Draft value formatted by the Units_Module, clear any inline error message for that input, remove `aria-invalid`, and leave the Draft unchanged.
7. THE Numeric_Controls SHALL present orientation as a radio group with an accessible group label and exactly two options, 0° and 90°, with the option matching the Draft orientation checked.
8. WHEN an orientation option is selected, THE Session_Reducer SHALL set the Draft orientation to the selected value (0 or 90) and leave every Section parameter unchanged.

### Requirement 29: Requirements and Results Panel

*Amended by D-28, D-29 and D-30 (2026-10-16): a compact value/limit list with Pass/Fail badges; no Status banner in the panel (29.6); the full table sits in a collapsed Test details disclosure without explanation prose or college formulas (29.6, 29.8); Compare results uses the history list/detail layout (29.11). See [DECISIONS.md][decisions].*

**User Story:** As a student, I want the challenge requirements and my results in one place, so that I can see what passes and what fails.

#### Acceptance Criteria

1. THE Requirements_Panel SHALL display the Challenge problem statement, the locked load in N with its direction, the material name, the span in mm, and one row per Challenge constraint showing the constraint name and its limit, with lengths in mm, stresses in MPa, and masses in kg.
2. THE Requirements_Panel SHALL display Run Test as the only primary-styled button in the panel, labeled "Run Test" and reachable by keyboard.
3. WHEN the session holds at least one Test_Result, THE Requirements_Panel SHALL display a results table for the latest Test_Result with exactly one row per Constraint_Engine constraint result, in the order deflection, stress, mass, envelopeWidth, envelopeHeight, featureGeometry, applicability.
4. WHEN the results table is displayed, THE Requirements_Panel SHALL show in each numeric row the value and the limit formatted with 2 decimal places for mm, 1 decimal place for MPa, and 3 decimal places for kg, and SHALL show the featureGeometry and applicability rows with pass/fail state and no numeric value.
5. WHEN the results table is displayed, THE Requirements_Panel SHALL show in each row a ✓ icon with the text "Pass" for a passed constraint or a ✗ icon with the text "Fail" for a failed constraint, so that pass/fail state is conveyed by text and not by icon or color alone.
6. WHEN the session holds at least one Test_Result, THE Requirements_Panel SHALL display for the latest Test_Result a Status banner reading "Accepted", "Not accepted", or "Model not applicable" according to its Status, one entry per applicability warning with its message, and every explanation fact text in the order produced by the Explanation_Generator.
7. THE Platform SHALL display the notice "Idealized beam approximation, not a structural certification" in the Workbench `page-footer` at all times while the Workbench is shown, with or without a Test_Result.
8. WHERE the Challenge enables college details, THE Requirements_Panel SHALL provide a disclosure, collapsed by default and toggled by mouse or keyboard, that shows the deflection and stress formulas, I_bend in mm⁴, c in mm, and the model assumptions of the latest Test_Result Analysis.
9. WHERE the Challenge does not enable college details, THE Requirements_Panel SHALL render no college-details disclosure.
10. THE Requirements_Panel SHALL derive every pass/fail mark in its design requirements list from the latest Test_Result's Evaluation constraint results, including the "Section envelope" and "Min. feature size" rows, and SHALL show no pass mark for a constraint that the latest Evaluation reports as failed.
11. THE History_Compare SHALL present the "Design history" and "Compare results" tabs from the template `results-panel` as an accessible tab list, with "Design history" showing the iteration list and the selected iteration's results, and "Compare results" showing the comparison from Requirement 18.5 to 18.8; every metric, delta, and status shown in either tab SHALL be read from stored Test_Results.

### Requirement 30: Dialogs and Live Announcements

**User Story:** As a student using assistive technology, I want dialogs and state changes announced properly, so that I can follow the workflow.

#### Acceptance Criteria

1. WHEN the Prediction_Dialog, Submit_Dialog, or import error dialog opens, THE Platform SHALL render the dialog with `role="dialog"`, `aria-modal="true"`, and an accessible name taken from the dialog's visible title, and SHALL move keyboard focus to the first focusable element inside the dialog.
2. WHILE the Prediction_Dialog, Submit_Dialog, or import error dialog is open, THE Platform SHALL keep keyboard focus inside the dialog, so that Tab from the last focusable element moves focus to the first one, Shift+Tab from the first focusable element moves focus to the last one, and no element outside the dialog can receive focus by keyboard.
3. WHEN the Prediction_Dialog, Submit_Dialog, or import error dialog closes by confirm, cancel, or Escape, THE Platform SHALL return keyboard focus to the element that opened the dialog. IF that element is no longer in the document, THEN THE Platform SHALL return focus to the Requirements_Panel.
4. WHEN the Prediction_Dialog, Submit_Dialog, or import error dialog receives Escape, THE Platform SHALL close the dialog and leave the Draft, history, and submission state unchanged.
5. WHEN a Section is applied, a Test_Result is appended, a design is restored from History_Compare, or a validation, import, or analysis error occurs, THE Live_Region SHALL announce, within 1 second of the event, one text message that names the event type and includes: the Section name for an applied Section; the iteration number and Status for an appended Test_Result; the iteration number for a restored design; or a description of the cause for an error.
6. THE Live_Region SHALL be an element with `aria-live="polite"` that is present in the document from initial load and is not removed or hidden while the Platform is open. WHEN a new event occurs, THE Live_Region SHALL replace its previous message with the new one instead of appending to it.
7. IF the same event message occurs twice in a row, THEN THE Live_Region SHALL announce it again each time.

### Requirement 31: WebGL Fallback

**User Story:** As a student on a device without WebGL, I want a usable fallback, so that I can still complete the challenge.

#### Acceptance Criteria

1. IF WebGL is unavailable or the Viewport canvas fails to create a WebGL context when the 3D bundle loads, THEN THE Platform SHALL render the SVG_Fallback in the Viewport's layout position and in place of the Viewport: a 2D SVG section view showing the current Draft Section outline (including the hole for tubes), its millimetre dimensions, and the 80 × 80 mm Envelope box, plus the SVG beam projection adapted from the template's `BeamScene.tsx` showing the wall, the clamped root, the beam along X, and a downward force arrow at the free end.
2. WHEN the WebGL fallback is rendered, THE Platform SHALL display a visible text notice saying that 3D view is unavailable and that the 2D view and Numeric_Controls can be used instead, and THE Live_Region SHALL announce that notice once.
3. WHILE the WebGL fallback is shown, THE Platform SHALL keep the Section_Palette (click and Enter/Space selection), the Numeric_Controls (including orientation), the Requirements_Panel (including Run Test), the History_Compare (compare and restore), the reflection prompt, submission, the scene controls, and the "Show deformation" toggle operable, with only the Dimension_Handles omitted.
4. WHILE the WebGL fallback is shown, WHEN the Draft changes, THE Platform SHALL update the 2D SVG section view to the new Draft outline, dimensions, and Envelope box before the next user input is processed.
5. WHILE the WebGL fallback is shown, THE Platform SHALL give each 2D SVG view an accessible name and a text summary describing the section kind, dimensions in millimetres, and load, matching the content required of the Viewport canvas.
6. IF the WebGL fallback is shown, THEN THE Session_Reducer SHALL keep the Draft, tested snapshots, and history unchanged by the fallback switch, and a full challenge flow completed in fallback mode SHALL reach a session state equal to the same flow in the 3D Viewport, excluding timestamps and ids.
7. THE SVG_Fallback SHALL draw the beam cross-section from the typed Draft Section and orientation (`sectionOutline` and `orientedEnvelope`), including independent I-section flange and web thicknesses, and SHALL draw the deformed shape from the Physics_Engine `deflectionShape` of the latest tested snapshot (or the Baseline), using the same exaggeration factor and 0.3·L limit as Requirement 25.2, rather than a fixed curve.
8. THE SVG_Fallback SHALL keep the template projection's pointer-drag and arrow-key orbit, SHALL let focus leave it with Tab and Shift+Tab, and SHALL show the "Exaggerated visualization (×N)" label whenever the deformed shape is shown.

### Requirement 32: Accessibility

*Amended by D-29 (2026-10-16): the Not accepted badge shows text alone, with no icon (32.4). See [DECISIONS.md][decisions].*

**User Story:** As a student with a disability, I want to complete the whole challenge with a keyboard and assistive technology, so that I have equal access to the learning experience.

#### Acceptance Criteria

1. THE Platform SHALL provide, for every drag interaction, a click equivalent and a keyboard equivalent that produce the same Draft change as the drag: Section_Palette tile drag-and-drop SHALL be matched by tile click and by Enter or Space on a focused tile, and each Dimension_Handles parameter drag SHALL be matched by the corresponding Numeric_Controls input for that parameter.
2. THE Viewport canvas SHALL have an `aria-label` identifying it as the 3D beam view and an adjacent text summary, readable by assistive technology, that states the current section kind, orientation, every section parameter value in millimetres, the beam length, and the applied force with its unit.
3. WHEN the Draft section kind, orientation, any section parameter, or the latest Evaluation changes, THE Viewport SHALL update the text summary to match the new values within one rendered frame of the change.
4. THE Platform SHALL convey each constraint pass or fail result and each Status value (`accepted`, `notAccepted`, `modelNotApplicable`) with a distinct icon, a text label, and a color together, so that each result and Status remains distinguishable when color is removed.
5. THE Platform SHALL use design tokens that give normal-size text a contrast ratio of at least 4.5:1 and large text (at least 24 px regular or 18.66 px bold) a contrast ratio of at least 3:1 against its background.
6. WHEN an interactive element receives keyboard focus, THE Platform SHALL display a focus indicator on that element with a contrast ratio of at least 3:1 against adjacent colors, visible at all times while the element holds focus.
7. WHERE the user's operating system or browser reduced-motion preference is enabled, THE Viewport SHALL disable the deformation animation and render the final static deformed shape immediately after a test run completes.
8. WHEN the full challenge flow (select section, set every parameter, run the test, view results and Status) is completed by keyboard only, THE Platform SHALL reach a session state equal to the state reached by the equivalent mouse flow, excluding timestamps and ids.
9. THE Platform SHALL make every interactive element reachable with Tab and Shift+Tab in an order that follows the visual reading order, and SHALL allow focus to leave every element (including the Viewport canvas) using Tab, Shift+Tab, or Escape.
10. WHEN a test run completes, THE Platform SHALL announce the resulting Status and the number of failed constraints to assistive technology without moving keyboard focus.

### Requirement 33: Testing and Milestone Gates

**User Story:** As a developer, I want explicit test gates per milestone, so that each milestone is verified before the next begins.

#### Acceptance Criteria

1. THE Test_Suite SHALL implement each of the 37 design correctness properties (Properties 1–37) as a fast-check property test that executes 200 runs per property by default, executes 2000 runs per property when the environment variable `PBT_RUNS` is set to `2000`, and uses a fixed, recorded seed for every property test in CI so that two CI runs of the same commit generate identical inputs.
2. THE Test_Suite SHALL tag each property test with the feature name `engineering-intuition-mvp` and the design property number it validates (1–37), such that every property number from 1 to 37 maps to at least one tagged test and no tag references a property number outside 1–37.
3. THE Test_Suite SHALL drive the Session_Reducer through model-based testing with randomly generated action sequences, checking Properties 28–37 after every action in each sequence, using the same run counts and seeding rules as criterion 1.
4. THE Test_Suite SHALL measure line coverage separately for each of the `physics/`, `geometry/`, `evaluation/`, and `state/` directories and SHALL report a coverage failure for any of those directories whose line coverage is below 95%.
5. THE Test_Suite SHALL run each of the E2E scenarios happy-path, drag-drop, keyboard, invalid-path, and persistence on both Chromium desktop and an emulated mobile device viewport, and SHALL run an automated axe accessibility check on each scenario's rendered page, counting the scenario as failed if the check reports one or more violations of serious or critical impact.
6. WHEN the Milestone 0 gate is evaluated, THE CI_Pipeline SHALL run lint, typecheck, test, and build in that order and SHALL report the gate as passed only if all four steps complete with zero errors.
7. WHEN the Milestone 1 gate is evaluated, THE Test_Suite SHALL report the gate as passed only if all unit tests, all physics fixture tests, and property tests for Properties 1–27 pass with zero failures and the coverage threshold in criterion 4 is met.
8. WHEN the Milestone 2 gate is evaluated, THE Test_Suite SHALL report the gate as passed only if component tests pass with zero failures, rendering each of the four section kinds and confirming for each that the displayed section parameters equal the corresponding values in the typed state.
9. WHEN the Milestone 3 gate is evaluated, THE Test_Suite SHALL report the gate as passed only if property tests for Properties 28–37 and the E2E happy-path, invalid-path, keyboard, and persistence scenarios pass with zero failures on both target viewports defined in criterion 5.
10. IF any check in a milestone gate fails (a test failure, a coverage value below 95%, a serious or critical axe violation, or a non-zero exit from lint, typecheck, or build), THEN THE CI_Pipeline SHALL mark the run as failed, identify each failing check by name, and SHALL NOT report that milestone as complete.
11. IF a property test fails, THEN THE Test_Suite SHALL report the property number, the seed, and the shrunk counterexample, so that rerunning with that seed reproduces the same failure.

### Requirement 34: Platform Shell and Preview Items

*Amended by D-33 (2026-10-16), D-42–D-44 (2026-10-17), D-50 and D-53–D-55 (2026-10-18), and D-57–D-63 (2026-10-19): all ten catalog challenges are available and ordered by difficulty; My designs shows workspaces, not a results list (34.7); local accounts and a standalone Home page; Learning paths became Learn. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to browse the wider challenge library and learning paths, so that I can see where the platform is going, without being misled into thinking unfinished challenges are real simulations.

#### Acceptance Criteria

1. THE Platform_Shell SHALL provide the template's sidebar navigation (Challenges, Learning paths, My designs, Notebook), the challenge library with discipline and difficulty filters, text search, and Explore/Saved views, the challenge detail drawer, the learning paths page, the my designs page, the notebook page, and the help/resources dialog, with the template's visual design.
2. THE Platform_Shell SHALL mark Cantilever Beam I as the only available challenge and SHALL label every other challenge card and detail drawer as a preview or "Planned challenge".
3. IF the student opens the detail drawer of a Preview_Item challenge, THEN THE Platform_Shell SHALL render the open action disabled with the text "Not available yet", SHALL NOT open a Workbench for it, and SHALL show no simulated or computed result for it.
4. THE Platform_Shell SHALL label the Freeform mode as "Planned", SHALL render the open action disabled while Freeform is selected, and SHALL NOT run any analysis in Freeform mode.
5. THE Platform_Shell SHALL label every learning path step other than Cantilever Beam I as "Planned" and SHALL NOT display completed progress for any step the student has not tested in the current session.
6. WHEN the student navigates between Platform_Shell pages and the Workbench, THE Platform SHALL keep the session state (Draft, history, compare selection, reflection, and submission) unchanged.
7. THE "My designs" page SHALL list only Test_Results from the session state, with each displayed metric and Status read from the stored Test_Result.
8. THE Platform_Shell SHALL keep saved challenges and notebook text in memory for the page session only, SHALL NOT send them over the network, and SHALL NOT describe them as synced or account-backed.
9. THE Platform SHALL display the product name "Statica" in the sidebar brand, the document title, and the help dialog.

### Requirement 35: Interaction Modes and Workflow Stepper

*Amended by D-36, D-37 (2026-10-16) and D-49 (2026-10-18): the mode is chosen before entry and fixed inside the workbench; Guided runs single-variable experiments that lock parameters per step; the Workflow_Stepper (35.5) is removed. See [DECISIONS.md][decisions].*

**User Story:** As a student, I want to choose Guided or Parametric editing and see where I am in the workflow, so that I can learn in my preferred style while solving the same problem.

#### Acceptance Criteria

1. WHEN the student opens Cantilever Beam I in Guided or Parametric mode, THE Platform SHALL use the same Challenge, `BeamDesign` representation, Session_Reducer, Physics_Engine, and Constraint_Engine for both modes, and SHALL set the session `mode` to the selected Interaction_Mode.
2. THE Platform SHALL keep every Locked_Field read-only in both Guided and Parametric modes, and SHALL keep the Challenge `difficulty` unchanged by the selected mode.
3. FOR ALL action sequences, THE Session_Reducer SHALL produce the same Draft, history, and Evaluations for a given action sequence regardless of whether `mode` is `guided` or `parametric`, excluding the `mode` field itself.
4. IF a mode not in the Challenge `allowedModes` is requested, THEN THE Platform SHALL keep the current mode and open no Workbench for the requested mode.
5. THE Workflow_Stepper SHALL show the four steps Inspect, Modify & predict, Test & compare, and Explain & submit, marking "Test & compare" complete when history contains at least one Test_Result with iteration ≥ 1 and "Explain & submit" complete when a submission is recorded, with each step state conveyed by text or an accessible name and not by color alone.
6. THE Workbench `page-footer` SHALL contain the "Explain & submit" button that opens the Submit_Dialog, enabled under the same conditions the Submit_Dialog uses to enable submission targets (at least one Test_Result with iteration ≥ 1).
