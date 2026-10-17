# Statica Edu

**Learn engineering by designing, predicting, testing and improving.**

Statica Edu is a browser-based learning tool that helps students connect engineering theory with design decisions. Instead of only reading equations, learners change a design, predict its behavior, test it against constraints and explain what the results mean.

The current application focuses on structural mechanics through **Cantilever Beam I**: redesign a beam's cross-section to reduce bending while staying within limits for mass, nominal stress and overall size.

## What the program is intended to do

The goal is to build engineering intuition through a repeatable learning loop:

1. **Inspect** a challenge, its initial design and fixed conditions.
2. **Modify and predict** how a design change will affect behavior.
3. **Test and compare** alternatives using consistent numerical models.
4. **Explain and submit** a design supported by results and reflection.

As the platform develops, students should be able to work through more challenges, sign in, save their work across devices and see which challenges they have completed. Those account and progress features are planned; the current app saves its challenge workspace locally in the browser.

## What works now

| Capability | Current implementation |
| --- | --- |
| Runnable challenge | Cantilever Beam I; Guided adds browsable instructions and optional hints, while Parametric provides direct editing without scaffolding. Choose the mode before entering; it stays fixed inside the workbench. |
| Cross-section editing | Solid circles, hollow tubes, rectangles and I-sections; numeric dimensions, orientation controls and supported visual drag handles |
| Interactive visualization | 3D beam view, scene controls and a deformation outline; an SVG 2D fallback keeps the numeric workflow available if 3D is unavailable |
| Numerical analysis | Cross-sectional area, bending inertia, mass, tip deflection and nominal maximum bending stress |
| Design evaluation | Pass/fail checks for deflection, stress, mass, envelope size, feature geometry and model applicability |
| Predictions | Prediction checkpoints before selected tests, with feedback against the resulting change |
| Design history | Stored tested iterations, selectable results, restore and confirmed deletion of non-Baseline entries |
| Comparison | Baseline plus up to three selected iterations; select a design to inspect its values and differences |
| Reflection and submission | Record an explanation and submit a tested design with its actual evaluation status |
| Local saving | Restore the challenge workspace, history, reflection and submission after a reload in the same browser/profile/origin |
| Design files | Export and validate/import a design JSON file; reject invalid or mismatched challenge data |
| Platform shell | Challenge library, learning-path previews, a compact My designs workspace card and a session-only notebook with text export |
| Accessibility support | Keyboard controls, dialog focus management, text-based statuses, announcements and numeric alternatives to visual manipulation |

A submission can record an unsuccessful design attempt. **Submitted does not automatically mean Accepted or a completed challenge.** Account-backed completion history has not been implemented.

## Try the current learning loop

Open **Cantilever Beam I**, choose Guided or Parametric, and inspect the Baseline. Change a section or its dimensions, make a prediction when prompted, and select **Run Test**. Compare the new result with Baseline, restore a design if useful, then explain your reasoning and submit a recorded iteration.

The dotted deformation outline represents the **latest tested design**. Editing an untested draft changes the solid beam, while the outline and stored results remain tied to the previous test until you run another test.

**My designs** returns you to the saved workspace. Detailed numerical results live in the workbench's history and comparison views.

## In development and planned

**Priority: complete the six challenges already displayed in the library before second editions.** Cantilever Beam I works today; Mounting Bracket I, Torsion Shaft I, Heat Sink I, Braced Frame I and Vibration Isolation I each need scoped, validated models and complete learning-loop integration. Next is task 45.1: define their requirements and delivery order. See the [catalog roadmap](Educational%20Tool%20UI%20Design/CATALOG_ROADMAP.md).

| Area | Status |
| --- | --- |
| Cantilever Beam II | Configuration and domain tests are retained, but further development is **deferred until the original six catalog challenges are implemented**. It is not available in the UI. |
| Engineering and student QA | Review plan and pilot materials are prepared. Owner engineering review, manual accessibility/readiness checks and actual student sessions remain open before customer deployment. |
| Guided / Parametric distinction | Implemented and browser-verified: staged Guided instructions/optional hints versus direct Parametric editing, sharing controls, predictions and results. Owner manual release QA remains open under 44.3. |
| Multiple challenge workspaces | Planned integration with separate saved sessions and correctly attributed results for each challenge |
| User accounts and saved information | Planned authentication, minimal profile information, owned projects and cross-device resume |
| Challenge completion history | Planned per-user, per-challenge progress with explicit completion rules and versioned evidence |
| Freeform design and advanced physics | Future scoped extensions requiring their own specifications, benchmarks and validation |
| Optional AI learning assistance | Future coaching capability; deterministic numerical analysis remains authoritative |

Bracket, torsion, thermal, frame and vibration cards are concept previews. Their presence in the library does not mean their physics or challenges are implemented. Freeform mode is also unavailable.

## Model and storage limits

The current solver uses an idealized **Euler–Bernoulli cantilever beam with a downward point load at its free end**, a rigid fixed root and an educational nominal aluminum material. Span, material, load and support are fixed by the challenge; students redesign the cross-section.

The model does not account for effects such as shear deformation, local or lateral-torsional buckling, plasticity, root stress concentrations, joint compliance or self-weight. Applicability checks flag unsupported regimes. **Accepted means the design meets this educational model's constraints; it is not approval for real-world construction.**

There is currently no backend, sign-in, cloud synchronization or analytics. Challenge work stays in the browser on that device and can be lost if storage is cleared or a different browser/profile/origin is used. Design JSON export saves a design, **not a complete session/history backup**. Notebook text and saved-library selections are session-only; they do not have the same persistence as the challenge workspace. A hosted/offline-installable customer service is not established by this repository.

## Run locally

Requires **Node 22** and **pnpm 10.34.3**.

```sh
git clone https://github.com/niyer45/Statica-Edu.git
cd "Statica-Edu/Educational Tool UI Design"
pnpm install --frozen-lockfile
pnpm run dev
```

Open the local URL printed by Vite. For a production build:

```sh
pnpm run build
pnpm run preview
```

See the [developer README](Educational%20Tool%20UI%20Design/README.md) for verification commands and architecture details.

## Technology and verification

The application uses React 19, strict TypeScript, Vite, Three.js / React Three Fiber and a validated JSON challenge schema. Geometry, analysis and evaluation are pure domain modules; rendering does not determine numerical results. The existing Figma Make visual shell is retained.

Verification includes Vitest, fast-check property tests, architecture checks and Playwright desktop/mobile flows with axe accessibility checks. [CI run 38970465802](https://github.com/niyer45/Statica-Edu/actions/runs/38970465802) passed **906 tests across 111 files**, domain coverage thresholds, lint, typecheck, production build and schema drift on commit `878fb87`. Both focused responsive checks and all **24 desktop/Pixel 7 browser cases** passed, including mode-specific and axe checks. Automated results do not substitute for the pending owner engineering review, manual accessibility/mode checks or student pilot.

## Project documentation

New contributors and Claude Code should start with [CLAUDE.md](CLAUDE.md), then the current handoff and agent instructions below. Superseded status notes are archived separately.

| Document | Purpose |
| --- | --- |
| [Handoff](Educational%20Tool%20UI%20Design/HANDOFF.md) | Current implementation, latest verification, next task and known limitations |
| [Agent instructions](Educational%20Tool%20UI%20Design/AGENTS.md) | Architecture rules and development workflow |
| [Task list](.kiro/specs/engineering-intuition-mvp/tasks.md) | Completed MVP work, maintenance and the Milestone 4–6 roadmap |
| [MVP requirements](.kiro/specs/engineering-intuition-mvp/requirements.md) / [design](.kiro/specs/engineering-intuition-mvp/design.md) | Original Milestone 0–3 specification and architecture |
| [Design decisions](Educational%20Tool%20UI%20Design/DECISIONS.md) | Recorded implementation and sequencing decisions |
| [Milestone 4 plan](Educational%20Tool%20UI%20Design/MILESTONE4.md) / [pilot protocol](Educational%20Tool%20UI%20Design/PILOT_PROTOCOL.md) | Pre-deployment review, learning goals and student pilot materials |
| [Milestone 5 status](Educational%20Tool%20UI%20Design/MILESTONE5.md) / [second-challenge specification](.kiro/specs/cantilever-beam-2/requirements.md) | Cantilever Beam II development and remaining integration work |
