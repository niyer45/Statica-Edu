# Milestone 4: Engineering review and student pilot

Plan created 2026-10-16 for task 29.1. Status: plan complete; independent review, manual readiness checks and student sessions have not occurred. The owner selected a **local-only pilot first**, followed by accounts and cloud-saved progress. Reviewer and participants are **not arranged**, as confirmed by the owner. No recruitment, deployment or invitations have been performed.

## Learners and learning objectives

Planning audience: introductory college engineering/mechanics students learning beam bending; confirm course and prior experience during recruitment. Start with 5 adult student participants as a practical formative target, not a statistically representative sample. If the group or count changes, record the reason before collecting results.

By the end of a session, a learner should be able to:

1. Identify the cantilever's fixed span, material, support and downward load, plus the design constraints.
2. Predict how changing section shape, dimensions or orientation affects stiffness, deflection, stress and mass.
3. Run and compare at least two non-Baseline designs, identify failed constraints and explain one tradeoff using stored results.
4. Distinguish an untested draft from the latest tested deformation/results, restore a design and submit a reflection.
5. Explain that an Accepted result meets this idealized model's constraints, not a real-world structural safety certification; recognize model-applicability limits.

## Scope and build

Pilot the existing Cantilever Beam I Guided and Parametric flows. Keep Freeform and preview challenges unavailable. Preserve the uncluttered viewport and compact history/compare presentation (D-26–D-33). No accounts, cloud synchronization, analytics or student personal data collection are added for this pilot. Current local-only storage is not an account or cross-device backup.

Verified baseline: implementation `eb1b56757b42192934f1b4cd3240515bb02237de`, [CI run 38936927907](https://github.com/niyer45/Statica-Edu/actions/runs/38936927907): 879 core tests, 2 focused responsive cases and 20 desktop/Pixel 7 E2E cases passed. Task 30.2 must pin the actual pilot release commit and retest delivery; this baseline is not evidence that a hosted pilot exists.

## Roles and availability

| Role | Responsibility | Arrangement |
| --- | --- | --- |
| Project owner (Nikhil) | Confirm audience, nominate reviewer, arrange access/recruitment and accept release decisions | Owner identified; availability not supplied |
| Independent engineering reviewer | Check model, constants and explanations against independent calculations/references; record signed/date-attributed findings | Not arranged; blocks 29.2 and pilot launch |
| Facilitator | Prepare consent/script, observe without teaching answers, collect de-identified notes | Not arranged; owner to nominate before sessions |
| Manual accessibility/usability reviewer | Execute task 30.1 using actual devices, assistive technology and build | Not arranged; may share facilitator role |
| Students | Participate voluntarily in the agreed learner group | Group, count and dates not arranged; target 5 adults pending recruitment |
| Development agent | Prepare materials, reproduce/remediate findings and record verification | Cannot substitute for independent review or real participants |

Next owner inputs: reviewer name/qualification and availability; course/group and participant dates; facilitator; agreed access URL or local delivery arrangement. Scheduling remains open under 29.2/30.2/31.1; task 29.1 records the confirmed unavailability rather than inventing arrangements.

## Engineering review checklist — task 29.2

Record reviewer, date, build/configuration version, calculation/reference evidence, expected/actual values, tolerance, finding severity and disposition for each check.

- Verify SI conversions and displayed mm, kg and MPa; fixed span/load/material/support and constraint limits match the configuration.
- Independently calculate section area, bending inertia and extreme-fiber distance for supported sections/orientations, including hollow sections and dimension boundaries.
- Check cantilever tip-load deflection, nominal bending stress and mass equations, fixture values and orientation dependence; do not use the implementation as the independent reference.
- Confirm Baseline fails deflection; reference design passes; exercise all existing fixtures and boundary tolerances, invalid/non-finite geometry and applicability thresholds.
- Review warnings for slenderness, large deflection, local buckling exclusions and unsupported model behavior. Distinguish warning, failed constraint and model-not-applicable states.
- Review prediction/explanation/reflection wording for instructional accuracy; Accepted must not imply construction approval or a safety guarantee.
- Verify displayed results derive from stored tested snapshots; draft changes, restore and deletion preserve numerical provenance and stable iteration numbering.

## Manual readiness and access — tasks 30.1–30.2

Proposed access is an owner-approved static build URL, with same-origin assets and no backend dependency. If hosting is unavailable, use a locally served production build on a participant device; never assume a public deployment is authorized by this plan. Task 30.2 records the chosen method, exact commit, instructions and successful fresh-device access before launch.

- Test real desktop Safari (owner preference) and Chromium, a real touch device when available, keyboard-only interaction and a screen reader. Record OS/browser/assistive-technology versions and any unavailable coverage.
- Check Guided/Parametric flows, accessible labels/announcements, dialog focus and Escape, touch/numeric alternatives, zoom to 200% and 400%, contrast, reduced motion, 320 px layout and WebGL fallback. Automated axe is separate evidence, not a substitute.
- Verify save/reload, reset, deleted-history persistence, invalid/corrupt saves, import/export, and compatibility with existing version-1 saves on the actual pilot build.
- Explain that progress stays in this browser/profile/device; private browsing, clearing storage or changing origin may lose it. No account or cross-device recovery exists. Verify the app's behavior after a network disconnect once assets are loaded; do not claim installability or offline cold-start support.
- Existing JSON export is a **design export**, not a complete session/history backup. Retain the same browser/profile and avoid destructive resets during a session. Record an interrupted session as interrupted if full recovery is unavailable.
- Use a fresh browser profile between participants, remove local reflections/history after agreed retention, and verify the next participant cannot see previous work. Record update/recovery instructions and a known-good build rollback path.

## Pilot protocol and measures — tasks 31.1–31.2

Before sessions, prepare a consent/introduction appropriate to the setting, a consistent script, pre/post questions and an observation sheet. Participation is voluntary; use participant codes P01 onward and collect no names/emails in research notes. Default to no audio/video or behavioral analytics. Notes should contain task outcomes, timings, prompts, short de-identified explanations and issues. Owner/facilitator holds notes with restricted access; proposed deletion is 30 days after pilot analysis, to be confirmed in 31.1. Publish only de-identified aggregate findings to the repository. If recruitment includes minors, resolve the setting's consent requirements before including them; this plan assumes adults.

Proposed 25–35 minute session:

1. Pre-question: predict how a taller versus wider section affects bending and name one limitation of a simple model.
2. Inspect the challenge; explain fixed fields and why Baseline is Not accepted.
3. Make and predict two distinct designs; run tests and compare values. Facilitator records prompts without supplying a solution.
4. Restore a stored design, explain draft versus tested deformation, enter a reflection and submit. An unsuccessful design submission still counts as a submitted attempt; separately record whether it is Accepted.
5. Reload/return through My designs on the same device and confirm work survives. Ask where progress is stored.
6. Post-question: explain one result-backed stiffness/mass tradeoff, identify a failed constraint and state an idealized-model limitation. Collect a brief ease/confusion rating.

Targets fixed before observations (report counts and denominators, not percentages alone):

| Measure | Proposed success criterion |
| --- | --- |
| Learning-loop usability | At least 4 of 5 finish inspect → predict/test twice → compare/restore → reflection/submit within 30 minutes, with no more than one neutral navigation prompt each |
| Constraint interpretation | At least 4 of 5 correctly identify a failing constraint and compare its value with its limit |
| Prediction/reflection reasoning | At least 4 of 5 explain one tradeoff using their stored results; incorrect initial predictions are not failures if reflection explains the outcome |
| Model limitations | At least 4 of 5 identify one excluded effect and do not treat Accepted as real-world certification |
| Snapshot/storage understanding | At least 4 of 5 distinguish draft from tested results and correctly say progress is device/browser-local |
| Save/recovery | Every attempted same-profile reload preserves expected session state; any unexplained data loss is blocking |
| Accessibility | No unresolved blocker in the manual matrix; keyboard/fallback flows can complete; serious/critical axe violations remain zero |

The 4-of-5 targets are formative decision aids. If the final sample differs, agree revised thresholds before sessions and report the small sample and recruitment limitations. Record all attempts, dropouts, facilitator interventions and unavailable device coverage; do not exclude failures to improve the rate. Task 31.2 compares actual observations with these targets, separates observed versus reported feedback and avoids causal/statistical learning claims.

## Severity and gates

| Severity | Examples | Disposition |
| --- | --- | --- |
| S0 critical | Untrustworthy analysis represented as valid, exposure of another participant's data, destructive unexplained data loss | Stop affected use; blocks launch and closeout until fixed and reverified |
| S1 high | Core task impossible for supported input/device or keyboard/fallback user; misleading model/acceptance wording; inaccessible essential control | Blocks pilot launch and milestone closeout; reproduce, fix and rerun affected checks |
| S2 medium | Recoverable confusion or friction with an available accessible workaround | Log owner disposition; defer only with rationale and if success criteria remain met |
| S3 low | Cosmetic issue without functional/instructional impact | May defer with owner acknowledgement and tracked task |

Pilot launch requires recorded independent review (29.2), manual checks (30.1), verified access/recovery (30.2), protocol/consent materials (31.1), arranged participants/facilitator and zero open S0/S1 findings. Passing CI alone cannot clear this gate.

Milestone 4 closeout (32.2) additionally requires actual student evidence, agreed measures met or remediation/retest demonstrating they are met, no unresolved S0/S1, documented S2/S3 dispositions, project-owner/reviewer disposition and passing required core/browser gates on the release candidate. A missed criterion is a finding to remediate or transparently re-plan, not a fabricated pass. Milestone 5 starts after this checkpoint.

## Requested account and saved-progress extension

Owner direction on 2026-10-16: support users, save their information and record completed challenges, **after the local-only pilot**. This is required future product scope tracked in 38.1–38.2, not functionality delivered by 29.1. Provider, hosting, costs and precise profile fields remain undecided. Do not add a pretend sign-in or describe local storage as cloud sync.

Inputs for the scoped account specification:

- A user can create/sign in to an account, sign out and recover access using a selected authentication provider. Store credentials through that provider, not in application session records or client logs.
- Persist minimal necessary profile data (proposed account id, email and optional display name), owned projects and progress by user + challenge id + challenge version. Additional student information requires a defined purpose before collection; no grades or institutional integrations are assumed.
- Save draft, tested history with archival metadata, predictions, reflection and submission using existing validated/versioned session boundaries. Restore the same user's work across devices. Preserve model/version provenance and never replace solver results with fabricated values.
- Define separate states: not started, in progress, submitted and completed. Proposed completion rule for later review: an explicit submission of an applicable, Accepted, non-Baseline result with nonblank reflection. Current submission accepts unsuccessful attempts, so submission alone must not become completion. Specify whether completion is retained after deleting an iteration/resetting a project and how challenge version changes affect it before implementation.
- Enforce ownership server-side on every read/write; test two-user isolation, expired/revoked sessions and no private progress after account switching/sign-out. Define verification of completion evidence; do not trust client-provided completed flags if progress is presented as verified achievement.
- Preserve guest/local use and offer an explicit, previewable local-to-account import. No silent upload of existing reflections or overwrite of another device's work. Define save acknowledgements, offline queue, conflicts, retries, interrupted saves, account export/deletion and recovery before coding.
- Keep My designs compact; show owned workspace/progress summaries without restoring the removed dense results table. Open a challenge/workbench for detailed results. Only genuinely available challenges may count toward completion.
- Add backend/service adapters outside pure domain/reducer modules. An approved scoped specification must explicitly replace the MVP no-network/data-local constraints for account flows, define CSP destinations, server-side secrets and deployment, and update network tests while preserving the guest path.

Tasks 36.1–36.2 and 38.1–38.2 resolve these decisions and implement/verify the account extension in the existing roadmap. No provider or architecture change is chosen in this plan. The pilot should gather whether users expect cross-device resume/completion history, without collecting account data or promising the feature exists.

## Evidence and next action

Task 29.1 produces this plan only. Reviewer/participants are confirmed not arranged; these are operational launch blockers, not missing fabricated planning results. Next task is 29.2: arrange and obtain an independent engineering review with the owner. Tasks 30.1 and 31.1 may be prepared according to their dependency graph; no participant contact is authorized by this document.

Documentation-task validation: lint passed with zero errors (10 existing warnings), typecheck passed, all 879 tests across 109 files passed and production build passed. Existing chunk-size warning is nonblocking. Task dependency JSON and unchanged future-task statuses were checked. No new browser run is claimed for this documentation-only change.
