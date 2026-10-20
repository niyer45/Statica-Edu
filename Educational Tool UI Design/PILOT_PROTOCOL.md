# Local pilot protocol and recording materials — task 31.1

**Updated 2026-10-20** for the full-product pilot. Changed: access is now the GitHub Pages site, with the footer build id recorded per session; the product facts below list ten challenges, three Learn modules and on-device accounts; the suggested session set is the three introductory Learn → challenge pairs instead of Cantilever Beam I alone; no deploy during a session. The session script, pre/post questions, rubric and sheets are unchanged. The two replaced sentences of the 2026-10-16 version are kept in HANDOFF_HISTORY.md.

Prepared 2026-10-16. Materials are ready for owner review; no participants, consent, sessions or outcomes are claimed. Nikhil is the nominated owner engineering reviewer. Per owner direction, human QA and student testing occur on a release candidate before customer deployment and do not block isolated development. The pilot uses the full product on the GitHub Pages site, including on-device accounts (see Access and product).

## Access and product (2026-10-20)

- **Access:** the GitHub Pages site, https://niyer45.github.io/Statica-Edu/ (deploy steps in DEPLOY.md). Record the build id shown in the Home page footer ("Build" and seven characters of the commit) on each session cover sheet.
- **Challenges (ten, each in Guided or Parametric, chosen before entry):** Introductory: 001 Cantilever Beam I, 002 Torsion Shaft I, 003 Column Buckling I, 004 Stress and Strain I. Intermediate: 005 Mounting Bracket I, 006 Heat Sink I, 007 Pressure Vessel I. Advanced: 008 Braced Frame I, 009 Vibration Isolation I, 010 Fatigue Analysis I.
- **Learn modules (three):** Beam bending, Torsion, Stress and strain. Each ends with Apply it, which opens its challenge (Cantilever Beam I, Torsion Shaft I, Stress and Strain I) in Guided mode.
- **Accounts:** local, on-device only. Each participant creates an account on their own device or uses their own browser profile. Accounts never leave the device; there is no password reset.
- **Progress** is saved per browser. It is not shared between devices, browsers or profiles, a private window loses it when closed, and there is no cloud backup.
- **No deploy during a session.** An open tab on an old build can break its lazily loaded 3D and formula views until it reloads.
- **Facilitator note:** the opening script now says accounts stay on the device and that "Accepted" refers to an idealized engineering model (it said "beam model" when the pilot covered one challenge).

## Session cover sheet

Copy this section into a restricted local notes file for each session; do not commit identifiable participant data or raw reflections to GitHub.

- Participant code: P__ (no name/email/student identifier)
- Facilitator / observer:
- Date; build commit and challenge id/version:
- Access method; device/OS/browser/version; assistive technology/version:
- Relevant prior mechanics experience (none / introductory / other, optional):
- Information/consent discussion completed and participation agreed: yes / no
- Start/end time; interruption or withdrawal:
- Actual data-retention/deletion date:

Do not proceed without agreement or if access/readiness/reviewer gates are uncleared. Plan targets adults; if a different setting is chosen, resolve appropriate permissions before recruitment. No audio/video or analytics are required.

## Opening script — read consistently

“We are testing an educational design tool, not grading you. Your feedback helps identify confusing parts. Participation is voluntary; you may skip a question or stop. We will record task outcomes and brief de-identified observations, not your name or email. Avoid entering identifying information in your reflection. Your designs and any account you create stay in this browser on this device; there is no cloud backup in this pilot. ‘Accepted’ refers to an idealized engineering model, not approval for real construction. Please describe what you expect and what you find confusing.”

Explain where notes will be kept and the actual deletion date (proposed 30 days after analysis; confirm with owner before sessions). Confirm the participant agrees before recording observations. State whether anyone else observes. Do not imply institutional consent/approval has been obtained.

## Pre-questions — record before instruction

1. With the same material and cross-sectional area, would a taller section necessarily have the same deflection as a wider one? Explain your prediction.
2. Does a design passing a simple bending simulation prove it is safe to build? Name an effect the model might omit.

Record the answer in de-identified paraphrase and use the rubric below. Do not teach the answer before the main tasks.

## Tasks and neutral facilitator prompts

Suggested session set, kept the same across participants so sessions can be compared: the three introductory pairs, each a Learn module followed by its challenge — Beam bending → Cantilever Beam I, Stress and strain → Stress and Strain I, Torsion → Torsion Shaft I. The tasks below apply to each challenge. Other challenges are optional and should be recorded separately. Allow 30 minutes for core tasks and roughly 5 minutes for wrap-up.

| Task | Participant instruction | Observer records |
| --- | --- | --- |
| Inspect | Open the challenge. Describe what is fixed and which constraint Baseline fails. | Correct fixed fields/failed constraint; navigation prompts |
| Predict/test | Change the cross section or dimensions, state your prediction, then run a test. | Prediction before result; test success; confusion/errors |
| Iterate | Try a second distinct design, predict and test again. | Distinct stored results; interventions; interpretation |
| Compare | Compare Baseline and your designs; explain a stiffness/mass tradeoff using the values. | Values used correctly; selected-detail discoverability |
| Restore | Restore one recorded design, edit it without testing and explain which shape/results are draft versus tested. | Snapshot understanding; wrong assumptions |
| Reflect/submit | Enter a short reflection and submit a recorded non-Baseline result. | Submit attempt versus Accepted status separately |
| Resume | Go to My designs, return to workbench and reload in the same browser profile. | Draft/history/reflection/submission preserved; storage understanding |

Neutral prompts: “What are you trying to do?”, “What do you expect that control to do?”, “What does that value mean to you?” Count navigation assistance; do not point out a solution. If stuck for two minutes, offer one navigation prompt, record it and resume. Record any safety/accessibility/data-loss blocker, stop the affected flow and follow severity rules. Participants need not reach Accepted for a submitted attempt to count; report design acceptance separately.

## Post-questions and observation rubric

Ask without giving the answer:

1. What changed between two tested designs? Use their values to explain the tradeoff.
2. Identify a failing constraint, its value and its limit, or explain why all constraints pass.
3. What does the dotted deformation show after you edit without testing?
4. Where is your progress saved, and could you resume on a different device today?
5. Name one model limitation and explain what “Accepted” does and does not tell you.
6. How easy was the workflow (1 very difficult–5 very easy)? What was most confusing?

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Constraint interpretation | Incorrect/no answer | Identifies constraint but misreads limit | Correct value/limit/pass-fail interpretation |
| Prediction/reflection reasoning | No causal explanation | Directional explanation without evidence | Result-backed explanation connecting material placement/orientation with behavior |
| Model limitations | Treats Accepted as safety approval | Recognizes idealization without an example | Names omitted effect and rejects safety-certification interpretation |
| Snapshot understanding | Confuses draft with result | Partly correct or needs explanation | Correctly distinguishes untested draft and latest tested snapshot |
| Storage understanding | Assumes cloud/cross-device save | Unsure | Correctly identifies browser/profile/device-local storage |

Keep pre/post answers distinct. Scores describe responses, not graded student achievement. A changed response in a small formative sample is not proof of causal learning improvement.

## Outcome sheet — leave blank until observed

- Core loop completed: yes / no / interrupted; elapsed minutes:
- Distinct tests run (excluding Baseline):
- Navigation prompts / teaching interventions (record separately):
- Submission recorded: yes / no; selected result status:
- Same-profile reload preserved expected state: yes / no / not attempted; what changed:
- Pre rubric / post rubric by dimension:
- Ease rating / reported confusion:
- Observed issue IDs and severity:
- Participant-reported comments versus observer interpretation:

Targets remain those predefined in MILESTONE4.md: formative target five adults; at least four of five complete within 30 minutes with at most one neutral prompt, interpret constraints, explain a result-backed tradeoff, identify model limits and understand snapshot/local storage behavior. Every attempted reload must preserve expected state. No unresolved S0/S1 finding is allowed. If recruitment changes, revise targets with owner before collecting results, preserve the revision history and report actual denominators/dropouts.

## Finding and analysis templates

For each issue record: ID; observed or reported; build/device; task; exact reproduction steps; expected/actual behavior; de-identified evidence; severity S0–S3; affected criteria; regression/manual verification needed; assignee; disposition and date. Use MILESTONE4.md severity definitions. No blank row counts as an observation.

Aggregate report: actual participants/attempts/completions/interrupted sessions; counts meeting each criterion; prompts and recurring confusion; successful/failed/not-attempted reloads; issue priorities; fixes/retests; deferred findings and owner disposition; sample/recruitment/device limitations. Report unavailable screen-reader/touch coverage explicitly. Do not publish raw reflections or identifiable notes.

## Before and after each session

Before: record the exact release build (the footer build id); confirm no deploy will run during the session; verify owner engineering review, manual accessibility/readiness and pilot access/recovery checks; use a fresh browser profile; check no previous participant work appears; read consent/data handling and confirm agreement. If shared devices are used, ensure the previous profile is removed.

After: retain only agreed de-identified notes; verify saved work as part of the participant's task before clearing it; close/remove the participant browser profile and local session data; check the next session starts clean. Design JSON export does not back up full session history. Do not promise recovery or transfer that has not been implemented.
