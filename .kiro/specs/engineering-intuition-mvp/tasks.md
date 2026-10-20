# Statica Edu — task plan

This is the task plan for Statica Edu: the completed MVP (Milestones 0–3), the post-MVP work, and the open work in execution order.
Task numbers and titles are stable identifiers used in HANDOFF.md, DECISIONS.md, the MILESTONE files, OWNER_REVIEW_CHECKLIST.md and commit messages. Never renumber, rename or merge tasks. Numbers are not chronological (see "Sequencing rules and notes").
Checkboxes: `[x]` done, `[ ]` not started, `[-]` in progress, `[~]` queued; `*` after the box marks an optional MVP test task.
Completed tasks appear here as one-line ledger entries. Their full text and evidence (subtasks, completion notes, commits, CI runs, deviations) is in [tasks-history.md](tasks-history.md).
After every completed task, change only that task's box and record the evidence (commit, CI run, decision) on one line. Once a whole parent task is complete, its full text may move verbatim to tasks-history.md, leaving a ledger line here.
Requirements live in [requirements.md](requirements.md) (MVP) and the additive specs in `.kiro/specs/<feature>/`.

## Status at a glance (2026-10-20, main 618e2ee)

| Milestone | Scope | State | Open tasks |
| --- | --- | --- | --- |
| M0–M3 MVP | Cantilever Beam I learning loop, domain, 3D UI, E2E | Complete (closed 2026-10-16) | None (tasks 1–28) |
| Post-MVP maintenance and owner feedback | UI maintenance, docs, 3D views, owner batch, four new challenges, Learn, Pages workflow | Complete | None (41–43, 53–73) |
| M4 Engineer review and pilot | Owner engineering QA, manual checks, student pilot, fixes | Open: needs owner and student evidence | 29.2, 30.1, 30.2, 31.2, 32.1, 32.2; gate 44.3 |
| M5 Original catalog | Six original challenges first, then second editions | 46–50 complete; 51 and 35 open pending owner QA; 52 deferred | 51, 35.1, 35.2, 52 |
| M6 Platform extensions | Freeform, advanced physics, accounts, AI | Unscoped; 38.0 (local accounts) done | 36–40 |
| Program tasks | Documentation cleanup, more Learn modules, teacher hand-in | New 2026-10-20 | 74–76 |

## Open work, in order

### (a) Pilot and owner review gate (Milestone 4)

These tasks need the owner and real students. Agents prepare materials and record evidence; they do not claim human results.

- [-] 29. Prepare educational and engineering review
  - [x] 29.1 Create the Milestone 4 review plan — 2026-10-16, `MILESTONE4.md`
  - [ ] 29.2 Obtain and record owner engineering QA before customer deployment
    - Review challenge constants, units, fixtures, formulas, applicability thresholds, boundary behavior, explanation wording and limitations against independent calculations/references.
    - Nikhil is the nominated owner reviewer; record qualifications, date, reviewed release commit, independent calculations/references, discrepancies and disposition. Include each new challenge/model before release. Do not describe owner review as external independence or substitute agent self-review/passing tests for human findings. Deferred until pre-deployment QA, not complete.

- [-] 44. Implement distinct Guided and Parametric experiences before deployment
  - [x] 44.1 Specify mode behavior and acceptance criteria — 2026-10-16, `.kiro/specs/interaction-modes/`
  - [x] 44.2 Implement the reviewed mode distinction in the existing workbench — 2026-10-16, D-37; Guided/Parametric later redesigned in task 58 (D-49)
  - [-] 44.3 Verify mode-specific behavior and gate user deployment
    - Add meaningful component and desktop/mobile keyboard/fallback/browser coverage for distinct experiences, shared numerical results and state preservation after entry/reloading. Run full required core/coverage/build/browser gates and manual mode checks on the release candidate. Depends on 44.2.
    - Automated verification passed 2026-10-16: [run 38970465802](https://github.com/niyer45/Statica-Edu/actions/runs/38970465802) on `878fb87bbf514e746f2ecd477a473b22a6b0bf75` passed lint, typecheck, 906 tests across 111 files, domain coverage, build, schema drift, 2/2 focused responsive cases and all 24 desktop/Pixel 7 E2E cases including axe. This includes four mode cases for keyboard pre-entry selection, no in-workbench switch, retained mode/results/reflection/submission after reload, predictions and SVG fallback. User confirmed workflow success.
    - Remaining: owner manual mode checks on the release candidate (including screen-reader/touch checks under 30.1). Keep 44.3 and parent 44 in progress until that evidence is recorded; automated implementation/browser work is verified. This does not block software tasks 45.x and later development.
    - Required before customer deployment and checkpoint 32.2; not optional or satisfied by component tests alone. Keep Freeform separately tracked under 37.1, unavailable until its own complete flow is verified.

- [ ] 30. Verify pilot readiness manually
  - [ ] 30.1 Run manual usability and accessibility checks
    - Exercise Guided/Parametric modes, keyboard-only navigation, screen reader labels/announcements, zoom, contrast, reduced motion, touch, 320 px layout and WebGL fallback on representative devices; document actual browser/device versions and results.
    - Keep automated axe results separate from manual accessibility evidence; log reproducible issues with acceptance criteria.
  - [ ] 30.2 Verify pilot delivery and recovery
    - Test the agreed access method, offline/local-storage limitations, reset/reload, import/export, update compatibility and recovery instructions using the actual pilot build. Record the tested commit and access instructions; deployment/access decisions precede publishing.

- [-] 31. Conduct and analyze the student pilot
  - [x] 31.1 Prepare the pilot protocol and materials — 2026-10-16, `PILOT_PROTOCOL.md`
  - [ ] 31.2 Run sessions with actual students and summarize findings
    - Record participant count, sessions completed, observations and results against the predefined criteria; distinguish reported feedback from inference. Do not fabricate participants, approvals or outcomes.
    - Produce prioritized findings and limitations, including sample-size limitations, in `MILESTONE4.md`.

- [ ] 32. Resolve pilot findings and close Milestone 4
  - [ ] 32.1 Fix blocking findings and verify them
    - Turn findings into reproducible tasks; resolve pilot-blocking correctness/accessibility/usability issues in the existing architecture. Add meaningful regression coverage and repeat affected manual checks; record deferred issues and rationale.
  - [ ] 32.2 Milestone 4 checkpoint
    - Confirm task 44.3 mode-distinction verification, recorded owner engineering QA and actual pilot evidence exist, agreed success criteria are met, no blocking finding remains, and lint/typecheck/unit/property/component/build/browser gates pass for the release candidate. Record reviewer/project-owner disposition and any deferred limitations before customer deployment; isolated M5 development may proceed earlier under D-34.

### (b) Catalog release gate (Milestone 5)

- [-] 51. Verify original six-challenge catalog completion
  - Confirm Cantilever Beam I and all five original preview challenges have implemented, numerically validated and integrated learning loops, correctly attributed/isolation-tested saves, truthful model limits and no placeholder results. Retain original regressions and record owner engineering/manual QA before customer release. Depends on 46.3–50.3 and 44.3. Do not mark complete merely because cards are clickable.
  - Automated audit recorded 2026-10-18 in `Educational Tool UI Design/MILESTONE5.md` (per-challenge validation, browser loop, isolation and limits evidence; new `e2e/catalog.spec.ts` checks all six saves together). Open: 44.3 and owner engineering/manual QA (29.2, 30) before this can be marked complete.

- [-] 35. Verify and release Milestone 5
  - [-] 35.1 Add multi-challenge regression coverage
    - Test configuration fixtures, challenge switching, storage/import isolation and migration behavior; complete each implemented original-catalog learning loop on desktop and Pixel 7, with keyboard/fallback and serious/critical axe gates. Retain all original challenge tests.
    - Progress 2026-10-18 (automated): each challenge's own spec covers its loop on desktop and Pixel 7 (Guided by keyboard, axe, 320 px, reload, isolation vs beam; WebGL-off fallback for beam, bracket, torsion and frame). `e2e/catalog.spec.ts` adds all six saves together and design files that import only into their own challenge (refused elsewhere, draft and history unchanged). Unit: per-model import refusals and the frozen beam v1 fixture. Stays open with its dependencies 44.3 and 51.
  - [ ] 35.2 Milestone 5 checkpoint
    - Confirm the original six catalog challenges meet their reviewed criteria and task 51 passes, no fabricated results or cross-session leakage exist, all relevant coverage/core/browser gates pass, and documentation explains supported models and limits. Record the verified commit and review evidence in `MILESTONE5.md`.

- [ ] 52. Revisit second-edition challenges after the original catalog
  - Review dormant Cantilever Beam II assets against the current architecture and findings only after 51. Keep its existing configuration/tests as retained work, not a runnable challenge or first-priority integration target. Specify any needed updates, then integrate and verify if still desired; do not activate it just because its configuration exists.

### (c) Program tasks (added 2026-10-20)

- [-] 74. Development program setup and documentation cleanup (owner, 2026-10-20: "clean out the requirement, handoff, agents, and tasks document" and "lay out the plan forward")
  - [-] 74.1 Reorganize AGENTS.md, HANDOFF.md, tasks.md and requirements.md so a new agent can find state, rules and next work without reading history; archive superseded text verbatim (HANDOFF_HISTORY.md, tasks-history.md).
  - [-] 74.2 Define the agent hierarchy in `.claude/agents/` (Fable director, Opus developers, Sonnet specialists) and the program plan in `PROGRAM.md`; record the roles and escalation rules.
  - [ ] 74.3 Verify documentation-only change: task IDs, relative links and factual claims checked; CI green on the merge commit; no runtime testing claimed.

- [ ] 75. Learn modules for the remaining challenge topics (director plan; draft on branches, merge after the pilot shows the module format works)
  - [ ] 75.1 Buckling module (Apply it → Column Buckling I). Replace the Planned entry in `src/learn/catalog.ts`; demos call `physics/column` only; prediction answers verified against the physics in tests; owner review item in OWNER_REVIEW_CHECKLIST.md.
  - [ ] 75.2 Pressure vessel module (Apply it → Pressure Vessel I): hoop vs longitudinal stress, thin-wall limits, head thickness.
  - [ ] 75.3 Fins and heat sinks module (Apply it → Heat Sink I): fin efficiency, surface area vs gap, the given-h caveat.
  - [ ] 75.4 Resonance and isolation module (Apply it → Vibration Isolation I): natural frequency, transmissibility, damping trade-off.
  - [ ] 75.5 Stress concentration module (Apply it → Mounting Bracket I): shoulder fillets, Kt, why a step matters.
  - [ ] 75.6 Fatigue module (Apply it → Fatigue Analysis I, Advanced): S-N, endurance limit, mean stress; depends on owner review of D-60 constants.
  - [ ] 75.7 Trusses and bracing module (Apply it → Braced Frame I): load paths, member buckling, mechanisms.
  - Each module follows D-57 (predict before show), the spec in `.kiro/specs/learn-modules/`, and the Beam bending / Torsion / Stress and strain modules as templates; every number from the physics code; unit tests for every correct option; Learn E2E extended.

- [ ] 76. Teacher hand-in without a server (director plan; after 2–3 instructor conversations, which the owner conducts)
  - [ ] 76.1 Specify in `.kiro/specs/teacher-handin/`: a shareable challenge link that preselects challenge and mode; a hand-in file (design JSON v2 + tested results + reflection + build id) a student downloads and a teacher can open read-only; no network, no accounts, CSP unchanged.
  - [ ] 76.2 Implement and verify: export/import round-trip, read-only viewer, E2E on desktop and Pixel 7, axe gates; owner review before release.

### (d) Milestone 6: scoped platform extensions

Original-catalog model work is now explicitly tracked in 45–51 rather than blocked behind this milestone. This milestone groups the previously named future areas: Freeform, advanced physics, accounts and AI. Their implementation scope is not yet specified. Task 36 defines feature boundaries and delivery order; each track requires its own requirements/design/test plan before implementation. A decision to defer a track must remain visible in the roadmap rather than being checked off as implemented.

- [ ] 36. Define Milestone 6 scope and architecture
  - [ ] 36.1 Prioritize the extension tracks and define acceptance criteria
    - Use M4/M5 evidence to define concrete user stories, included/excluded capabilities, dependencies, measurable gates and delivery order in `MILESTONE6.md` and scoped specification extensions. Resolve the current browser-only/no-network boundary explicitly for any online capability. Development planning depends on 45.2 under D-35; customer release retains the M4/M5 gates.
  - [ ] 36.2 Record shared technical and data decisions
    - Specify model dispatch/versioning, geometry validation, save/import compatibility, local/offline behavior and any backend/auth/provider choices. Define data minimization, deletion/export, failure behavior, cost limits and rollback where applicable; keep pure domain modules independent of React and services.

- [ ] 37. Extend geometry and analysis
  - [ ] 37.1 Implement and verify the scoped Freeform capability
    - Specify supported sketch/extrusion/edit operations, invalid or unsupported geometry, section-property computation and model compatibility before coding. Provide numeric/keyboard equivalents and truthful fallback behavior; validate properties against independent fixtures.
    - Integrate valid geometry with the existing prediction/results/history/persistence loop. Keep Freeform marked Planned until its complete reviewed flow and accessibility/browser gates pass.
  - [ ] 37.2 Implement and validate the selected advanced physics model
    - This track covers additional physics beyond the original catalog work in 46–50; avoid duplicating those model implementations. Choose a bounded model from the scoped requirements; document equations, assumptions, applicability and independent benchmarks before implementation. Dispatch by explicit model identity/version and keep recorded results reproducible.
    - Verify accuracy/tolerances, units, boundaries, failure states and runtime on target devices. Unsupported analyses must be rejected or clearly identified; preserve the validated Euler–Bernoulli path.

- [-] 38. Add accounts and saved-project synchronization
  - [x] 38.0 Local-first accounts and Home — 2026-10-18, D-50 (device-only accounts; full text in tasks-history.md)
  - [ ] 38.1 Specify account, storage and offline behavior
    - Define provider/backend, identity, ownership/access rules, session lifecycle, data retention/export/deletion and sync/conflict handling. Document the migration from local-only use and necessary CSP/network changes before implementation.
    - Owner-confirmed scope (2026-10-16): accounts with minimal profile information, cloud-saved owned challenge sessions and cross-device progress/completion, after the local-only pilot. MILESTONE4.md records planning inputs: explicit completion rules distinct from unsuccessful submissions, versioned provenance, guest migration, deletion/reset semantics and server-side ownership enforcement. Resolve these in a scoped specification before coding; no account feature is implemented by task 29.1.
  - [ ] 38.2 Implement and verify the scoped account/sync flow
    - Implement the reviewed user profile, challenge session and completion-history flows; verify cross-device resume, challenge/version attribution and completion evidence. Test authentication lifecycle, authorization isolation, project ownership, offline editing, conflicts, interrupted saves and recovery. Preserve local-only operation according to the agreed requirements; do not expose credentials or other users' projects in client state or logs.

- [ ] 39. Add optional AI learning assistance
  - [ ] 39.1 Specify the assistant's educational and data boundaries
    - Define a bounded coaching use case, provider, consent/data flow, cost/rate limits and evaluation criteria. Keep deterministic solver results authoritative and reflection ungraded unless an explicit later requirement changes that policy.
  - [ ] 39.2 Implement and evaluate the scoped coaching flow
    - Test grounded explanations against stored design/results, unsupported claims, prompt injection, unavailable/rate-limited services and offline use. Keep secrets server-side; assess assistance quality with engineer/educator review and representative learners before release.

- [ ] 40. Milestone 6 integration and release gate
  - [ ] 40.1 Verify compatibility and cross-feature regressions
    - Exercise the scoped Freeform/model/account/AI combinations, legacy saves/imports, model-result identity and failure recovery. Run core, independent numerical, authorization, accessibility, desktop/mobile and performance checks required by the new specifications.
  - [ ] 40.2 Milestone 6 checkpoint
    - Record each track's implemented/deferred status, acceptance evidence, known limitations, documentation and verified commit in `MILESTONE6.md`. Declare a track complete only when its own requirements and gates pass; future work outside the chosen release stays open or explicitly deferred.

## Completed work (ledger)

Subtasks are collapsed into their parent line. Completed subtasks of open parents (29.1, 31.1, 44.1, 44.2, 38.0) are listed under their parents above. Commits marked "git" were taken from `git log` subjects that name the task; all other evidence is from the task text.

### Milestones 0–3: MVP (closed 2026-10-16, CI run 38927191840)

- [x] 1. Adapt the template project, boundaries, schema, CI, and docs (1.1–1.10)
- [x] 2. Checkpoint – Milestone 0 gate
- [x] 3. Units module (3.1–3.2)
- [x] 4. Challenge loader and bundled challenge (4.1–4.4)
- [x] 5. Geometry core and validation (5.1–5.6)
- [x] 6. Clamp, strict set, and conversion (6.1–6.7)
- [x] 7. Outline and handle descriptors (7.1–7.2)
- [x] 8. Section properties and tolerance (8.1–8.7)
- [x] 9. Applicability and analysis (9.1–9.11)
- [x] 10. Evaluation, explanations, and prediction scoring (10.1–10.10)
- [x] 11. Fixtures and pure import/export (11.1–11.8)
- [x] 12. Checkpoint – Milestone 1 gate
- [x] 13. Session skeleton and app shell (13.1–13.6)
- [x] 14. Mesh, viewport, and WebGL fallback (14.1–14.5)
- [x] 15. Section palette (15.1–15.2)
- [x] 16. Dimension handles (16.1–16.2)
- [x] 17. Numeric controls (17.1–17.2)
- [x] 18. Checkpoint – Milestone 2 gate
- [x] 19. Complete the session reducer (19.1–19.15)
- [x] 20. Persistence (20.1–20.4)
- [x] 21. Requirements and results panel (21.1–21.2)
- [x] 22. Dialogs and live announcements (22.1–22.4)
- [x] 23. History and compare (23.1–23.2)
- [x] 24. Reflection and submission (24.1–24.2)
- [x] 25. Import/export UI (25.1–25.2)
- [x] 26. Checkpoint – pre-E2E
- [x] 27. End-to-end tests (27.1–27.7) — 2026-10-16, CI run 38927191840 (873 core tests, 18/18 E2E)
- [x] 28. Final checkpoint – Milestone 3 gate — 2026-10-16, CI run 38927191840

### Post-MVP maintenance

- [x] 41. Complete post-MVP UI maintenance (UI-01–UI-07 as 41.1–41.7) — 2026-10-16, eb1b567, CI run 38936927907, D-28–D-33
- [x] 42. Verify CI preview-gating test repair — a76b8ad, CI run 38966388585 (after failed runs 38965356799, 38965945029)
- [x] 43. Expand repository and developer README documentation — documentation only
- [x] 53. Prepare current documentation and Claude Code handoff — audited 2026-10-17; HANDOFF_HISTORY.md, root CLAUDE.md/AGENTS.md
- [x] 54. Improve new-challenge visualizations (54.1–54.3) — 2026-10-17, cc257f3, 6e7ec71, d2fa208, 403a6b6, D-45
- [x] 55. Compile the owner review checklist — 2026-10-17, 2f1d84c; `OWNER_REVIEW_CHECKLIST.md`

### Owner feedback batch

Agent commits used provisional numbers: the L-bracket commits say "Task 55" (recorded as 57) and the local accounts commits say "Task 38" (recorded as 38.0).

- [x] 56. Declutter Braced Frame I and Vibration Isolation I — 2026-10-18, D-48; amended to the beam's panel layout, f3ab7c0, 784ad1c
- [x] 57. Rebuild Mounting Bracket I as a bolted L-bracket — 2026-10-18, D-46
- [x] 58. Make Guided and Parametric genuinely different — 2026-10-18, D-49; supersedes the 44.2 prompts, so 44.3 manual checks must be redone
- [x] 59. Hardest valid baselines — 2026-10-18, D-47; beam amendment 87cde96, 828b713, 5cbd474
- [x] 60. Reset to baseline in every challenge — 2026-10-18, 9c35569, 436942e, e4ddae9, D-51
- [x] 61. Owner follow-ups: bracket panel text, disclosures that shrink back, ways out after Submit — 2026-10-18, a12028f, CI run 39184394328, D-52
- [x] 62. Home as a product outlook; progress moves to My designs — 2026-10-18, f64d247, D-53 (CI run 39187253202 failed; fixed in 63)
- [x] 63. Home becomes a standalone landing page — 2026-10-18, 2e8fea7 (git), D-54
- [x] 64. Home redesigned from the owner's Figma homepage export — 2026-10-18, ea0aeb8 (git), D-55; CI run 39193389901 timeout fixed by splitting the test (3bf107f, git)
- [x] 65. Reference dialogs as key points with typeset formulas; bracket cover art — 2026-10-18, 64f207f, CI run 39195142214, D-56; bracket art redrawn 2026-10-19
- [x] 66. GitHub Pages deployment for the pilot — 2026-10-19, acb2927 (git); live deployment needs the owner (supports 30.2)
- [x] 67. Learn pillar: first guided learning module — 2026-10-19, c7faf33 (git), D-57
- [x] 68. Column Buckling I: an introductory buckling challenge — 2026-10-19, 5bbed03, merge d23619b (git), D-58
- [x] 69. Pressure Vessel I, an owner-requested intermediate challenge — 2026-10-19, e297703, merge 3ac4fdb (git), D-59; pressure arrows ed58280 (git)
- [x] 70. Fatigue Analysis I: an owner-requested Advanced challenge — 2026-10-19, 740fe04, merge b7c4a12 (git), D-60; card art fixed 2026-10-20, 618e2ee (git)
- [x] 71. Torsion Shaft I becomes introductory; Torsion learn module — 2026-10-19, 15f4bbf, merge 3c395e4 (git), D-61
- [x] 72. Stress and Strain I challenge and the Stress and strain Learn module — 2026-10-19, e7e5417, merge d97adff (git), D-62; card art fixed 2026-10-20, 618e2ee (git)
- [x] 73. Challenges ordered by difficulty; faster CI; repository cleanup — 2026-10-19, 5c9e2ba (git), D-63

### Milestone 5: original catalog

- [x] 33. Define the second challenge (historical; further Beam II work deferred) — 2026-10-16; `.kiro/specs/cantilever-beam-2/`; Beam II stays dormant until 52
- [x] 34. Integrate multiple runnable challenges — 2026-10-17; 34.1 506864a (CI run 39072650734), c4c5718; 34.2 656789d, 481874c (deviation from MM-21: Guided step content lives in the UI registry)
- [x] 45. Scope the original catalog and shared model architecture — 2026-10-17, specification only, D-38, D-39
- [x] 46. Develop Mounting Bracket I — 2026-10-17, b322eb6, 2d72cdf, 75a103d, activated 766e1c7, D-40, D-41, D-43 (rebuilt as an L-bracket in 57)
- [x] 47. Develop Torsion Shaft I — 2026-10-17, 20f966c, 656789d, 6ae2231, activated D-42 (deviation from TSH-14: SVG primary view; 3D added in 54.2)
- [x] 48. Develop Heat Sink I — 2026-10-17, e136bf1, f12a6a9, 3662124, activated 049147a, D-40, D-43
- [x] 49. Develop Braced Frame I — 2026-10-17, 2417a2c, 8e238c3, a4878d2, activated 6853d94, D-44
- [x] 50. Develop Vibration Isolation I — 2026-10-17, fb9805b, 6306d0c, da32094, activated 8fbb61f, D-43

Details: [tasks-history.md](tasks-history.md).

## Sequencing rules and notes

**Scope of new work.** Tasks 1–28 and Requirements 1–35 describe the completed M0–M3 baseline. Their statements that M4+ is outside MVP scope are historical boundaries, not specifications for new features. Write each new feature's requirements and acceptance criteria as an additive, scoped spec in `.kiro/specs/<feature>/` before implementation. Do not regenerate the completed MVP specifications and do not invent requirement IDs.

**Software before human QA (D-34, 2026-10-16).** Nikhil is the nominated owner engineering reviewer; 29.2 is owner-conducted review, not external independent review. Human QA is deferred until before customer deployment and is never checked complete without recorded evidence. Scoped configuration and specification work may proceed from 29.1 without pilot evidence.

**Deployment gates.** Tasks 29.2, 30, 31.2 and 32.2 (which also confirms 44.3) are required before customer deployment. Feature release checkpoints, such as 35.2, still require 32.2. No sequencing change authorizes or performs a deployment. The plan schedules work; it does not by itself recruit participants, publish the app or enable network services.

**Original six before second editions (D-35, 2026-10-16).** Implement the original catalog entries before second editions. Tasks 33.1–33.2 are truthful historical completion for dormant Beam II assets; they do not prioritize its integration (52 comes after 51). Preview challenges need scoped models and requirements and cannot be enabled by copying beam JSON. See CATALOG_ROADMAP.md.

**After the pilot.** After the pilot (31.2) the owner decides between 75 (more modules), 76 (teacher hand-in) and 38.1 (cloud accounts) based on findings; items on hold until there is evidence: new disciplines, second editions (52), Freeform (37.1), AI assistance (39), cloud sync (38.2).

**Milestone 6 tracks.** Each track needs its own requirements, design and test plan before implementation. A decision to defer a track stays visible here; it is never checked off as implemented. Feature-specific backend, model, provider and challenge choices are decisions made inside those tasks.

**Engineering rules that still apply.**

- No new testing task is optional. The `*` marks apply only to MVP test tasks; Requirement 33 gates still expected them before a milestone was declared complete.
- Preserve the existing architecture, solver-backed results, D-26/D-27 and the complete MVP regression suite.
- The architecture test (task 1.3, fixture E6) is required: Requirement 1.5 names it as an enforcement mechanism.
- `REL_TOL`/`withinLimit` live in `physics/tolerance.ts` and `TestResult`/`Prediction` types live in `evaluation/types.ts`, so the import boundaries in Requirements 1.5 and 1.7 hold; `evaluation/` and `state/` re-export them.
- Every property test uses fast-check through the shared helper that reads `PBT_RUNS` (default 200) and a fixed recorded seed, and carries the tag comment `// Feature: engineering-intuition-mvp, Property N: <title>`. Each property test lives in its own file (`<module>/<name>.p<N>.test.ts`) and each fixture example (E1–E5) in its own file under `test/fixtures/`.
- Update supporting documentation after each completed task and push verified batches.

**Numbering.** Numbers are not chronological and do not follow milestones. Tasks 29–40 were the first post-MVP roadmap; 41 groups the UI-01–UI-07 maintenance work without renumbering 29–40; 44 belongs to Milestone 4 and 45–52 to Milestone 5; 42–43 and 53–73 are maintenance and owner-requested work. MVP-only notes (task-by-task template refactor mapping, split properties, early reducer actions) are kept in tasks-history.md.

## Task dependency graph

Dependencies of the open work, in short:

- M4: 29.2 → 30 (30.2 needs 29.2 and 30.1) → 31.2 → 32.1 → 32.2; 32.2 also needs 44.3.
- M5: 44.3 + 29.2 + 30 (owner QA) → 51 → 35.1 → 35.2 (35.2 also needs 32.2); 51 → 52.
- M6: 36.1 → 36.2 → 37.1 / 37.2 / 38.1 / 39.1; 38.1 → 38.2; 39.1 → 39.2; 37.x + 38.2 + 39.2 → 40.1 → 40.2.
- Program: 74 → 75 / 76. 75 merges after the pilot shows the module format works; 76 follows 2–3 instructor conversations. Tasks 74–76 are only in this list.

The full JSON dependency graph (MVP waves for tasks 1–28 and `postMvpDependencies` for 29–55) is kept verbatim in [tasks-history.md](tasks-history.md#task-dependency-graph-json).
