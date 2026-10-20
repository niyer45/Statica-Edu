# Statica Edu handoff

Last updated: 2026-10-20 (commit 618e2ee, CI run 39368119809 passed).

This file is the current state. Rules are in `AGENTS.md`, the plan is in `../PROGRAM.md`, and
everything older is in `HANDOFF_HISTORY.md`. CI run links follow the pattern
`https://github.com/niyer45/Statica-Edu/actions/runs/<run id>`.

## 1. State right now

- `main` is at `618e2ee` and CI is green (run 39368119809).
- Live for students: ten challenges, each in Guided and Parametric, ordered by difficulty (D-63).

  | Level | Challenges |
  | --- | --- |
  | Introductory | 001 Cantilever Beam I · 002 Torsion Shaft I · 003 Column Buckling I · 004 Stress and Strain I |
  | Intermediate | 005 Mounting Bracket I · 006 Heat Sink I · 007 Pressure Vessel I |
  | Advanced | 008 Braced Frame I · 009 Vibration Isolation I · 010 Fatigue Analysis I |

- Learn: three modules available (Beam bending, Torsion, Stress and strain). Buckling, Natural
  frequency and resonance, and Fins and heat sinks are listed as Planned.
- Accounts are local-first (38.0, D-50): accounts and progress stay in the browser. There is no
  backend and no cross-device sync (38.1–38.2 not started).
- Home is a standalone landing page at `/` (D-54, D-55); the library is at `/#challenges`; Learn is
  at `#learn`.
- Deployment: a manual, CI-gated GitHub Pages workflow (`DEPLOY.md`). Site:
  https://niyer45.github.io/Statica-Edu/. The Home footer shows the build id. No deployment is
  recorded in these documents yet.
- Tests: 3216 unit tests and 110/110 Playwright E2E cases (desktop and Pixel 7). CI takes about
  10 minutes: the `verify` job about 1.8 minutes, then four Playwright shards.
- Every new challenge and module since 2026-10-19 awaits owner engineering review (section 3).
- Known gaps: no password recovery or cross-tab session sync for local accounts; the 2D bracket
  fallback leaves empty space above the drawing; Guided vs Parametric screenshots not taken. A design
  JSON export is not a full session backup, and a submission can be Not accepted (it is not a
  completion flag).

## 2. Pilot

- The owner is about to pilot the full product with five aerospace-engineering friends.
- Before the first session the owner does two things once: on GitHub, Settings → Pages → Source:
  GitHub Actions; then Actions → Deploy to GitHub Pages → Run workflow on `main`. Check the footer
  build id and record it in the pilot notes (`DEPLOY.md`).
- `PILOT_PROTOCOL.md` is the session script.
- Progress is per browser: it is not shared across devices, browsers or profiles, and a private
  window loses it. Deploy only between sessions; an open tab on an old build can break its lazy 3D
  and formula chunks.
- No pilot session, finding or outcome is recorded yet (task 31.2 is open).

## 3. Awaiting the owner

Work through `OWNER_REVIEW_CHECKLIST.md` §8. Defaults stay live until the owner answers. The main
open questions:

- Engineering review of the four new challenges (Column Buckling I, Stress and Strain I, Pressure
  Vessel I, Fatigue Analysis I) and the three Learn modules.
- Fatigue Analysis I: which Roark edition the shoulder-fillet Kt fit should follow (a later edition
  revised part of it; the fit reads about 6 % above a Shigley chart value), and whether surface
  finish should carry a cost (it has none in the model).
- Fatigue Analysis I models a non-rotating stub-axle spindle under a fluctuating load, not the
  rotating shaft in the owner's request (D-60). Confirm the scope change.
- Torsion Shaft I: the shear-stress and outer-diameter checks never decide the result, because any
  shaft that meets the twist and 50 mm limits also passes stress. Keep or remove them (removal
  needs a new content version).
- Stress and Strain I: confirm the material values (steel, aluminium 6061-T6, Ti-6Al-4V), the
  design factor and limits, and the baseline choice.
- Column Buckling I uses aluminium, because efficient steel tubes at this scale fall outside the
  Euler range (D-58). Confirm.
- Pressure Vessel I adds an overall-length limit (1000 mm) so that volume is a real check (D-59).
  Confirm.
- Older open items: the backend choice for cross-device sync (38.1), and the manual checks that keep
  44.3, 30 and gate 51 open.

## 4. Next work

The plan lives in `../PROGRAM.md`. Open tasks in `../.kiro/specs/engineering-intuition-mvp/tasks.md`:
29.2 (owner engineering review), 30 (manual pilot readiness), 31.2 (student pilot sessions),
32 (pilot findings and Milestone 4 checkpoint), 44.3 (manual mode release checks), 51 (original
catalog gate), 35.2 (Milestone 5 checkpoint), then 74 onward.

## 5. Recent changes (newest first, since 2026-10-17)

| Task | Date | Commit | CI run | Decision |
| --- | --- | --- | --- | --- |
| 77 learningLoop keyboard/mouse E2E split; keyboard path no longer pre-scrolls | 2026-10-20 | this branch | pending | — |
| Card art: Fatigue Analysis I spindle, Stress and Strain I hanger rod (owner) | 2026-10-20 | 618e2ee | 39368119809 passed | — |
| 73 Difficulty order, numbers 001–010; CI split into `verify` + 4 shards; cleanup | 2026-10-19 | 5c9e2ba | 39363320472 passed (9.9 min) | D-63 |
| Pressure Vessel I internal-pressure arrows (2D, 3D cutaway, card art) | 2026-10-19 | ed58280 | not recorded | — |
| Integration of 68–72; CI job limit raised to 60 min (replaced by sharding in 73) | 2026-10-19 | 0fbf607, 44ab95c, a59a353 | 39341585291 hit the 30-min limit; 39344818393 passed on a59a353 | — |
| 72 Stress and Strain I and the Stress and strain module | 2026-10-19 | e7e5417 (merge d97adff) | see integration | D-62 |
| 71 Torsion Shaft I introductory (content v3) and the Torsion module | 2026-10-19 | 15f4bbf (merge 3c395e4) | see integration | D-61 |
| 70 Fatigue Analysis I | 2026-10-19 | e4541e1, 740fe04 (merge b7c4a12) | see integration | D-60 |
| 69 Pressure Vessel I | 2026-10-19 | e297703 (merge 3ac4fdb) | see integration | D-59 |
| 68 Column Buckling I | 2026-10-19 | 5bbed03 (merge d23619b) | see integration | D-58 |
| 67 Learn pillar and the Beam bending module | 2026-10-19 | c7faf33, 625fef2 | not recorded | D-57 |
| 66 GitHub Pages workflow and `DEPLOY.md` | 2026-10-19 | acb2927 | not recorded | — |
| Bracket card art redrawn as the bolted L; owner approvals recorded | 2026-10-19 | 18d1d26 | not recorded | — |
| 65 Reference dialogs as KaTeX formulas and key points | 2026-10-18 | 64f207f | 39195142214 passed | D-56 |
| 64 Home from the owner's Figma export; long account test split | 2026-10-18 | ea0aeb8, 3bf107f | 39193389901 failed on ea0aeb8 (5 s timeout) | D-55 |
| 63 Home as a standalone landing page; lighter spring drawing | 2026-10-18 | 2e8fea7 | not recorded | D-54 |
| 62 Home as a product outlook; progress moves to My designs | 2026-10-18 | f64d247 | 39187253202 failed (coverage timeout, fixed in 63) | D-53 |
| 61 Bracket panel text, disclosures shrink back, exits after Submit | 2026-10-18 | a12028f | 39184394328 passed | D-52 |
| 56–60, 38.0 owner batch: declutter, L-bracket, Guided vs Parametric, hardest baselines, Reset, local accounts and Home | 2026-10-18 | merges 1b893bc, 976858e, 75220b4, bdefcf9, 8eb007f; docs d478b5b, 5a7f7b1, bd2e6c9 | not recorded | D-46–D-51 |
| 35.1 progress: design files import only into their own challenge | 2026-10-18 | 77e2cc6 | not recorded | — |
| 51 automated gate audit (`MILESTONE5.md`); six-challenge save isolation E2E | 2026-10-18 | a161b2e | 39096633953 passed | — |
| 54 3D views for bracket, torsion and frame with 2D fallbacks | 2026-10-17 | cc257f3, 6e7ec71, d2fa208, 403a6b6, 899b892 | 39095502817 passed on 899b892 | D-45 |
| 55 Owner review checklist | 2026-10-17 | 2f1d84c | not recorded | — |
| 50.3, 48.3, 46.3, 49.3 activations: Vibration, Heat Sink, Bracket, Frame | 2026-10-17 | 8fbb61f, 049147a, 766e1c7, 6853d94 | 39084951759 passed (pre-activation); 39090168010 passed on c8cd1c4 | D-43, D-44 |
| 47.3 Torsion Shaft I activated | 2026-10-17 | 0180066 | 39081602702 passed | D-42 |
| 46.2, 48.2, 49.2, 50.2 models | 2026-10-17 | 2d72cdf, f12a6a9, 8e238c3, 6306d0c | 39077702539 on f026ad0; 39078354891 on 3acd077, both passed | — |
| 34.2 generic store, runtimes, UI slots (task 34 complete); 47.2 torsion model | 2026-10-17 | 656789d, 20f966c, 481874c | 39075393554 passed on 249b96d | — |
| 46.1, 49.1 specifications; bracket K-1–K-5 resolved | 2026-10-17 | b322eb6, 2417a2c, c441249 | 39076192198 passed on c441249 | D-41 |
| 34.1 model registry and one store per challenge; 48.1, 50.1 specifications | 2026-10-17 | 506864a, c4c5718, e136bf1, fb9805b | 39072650734 on 506864a; 39073599296 on 37f8296, both passed | D-40 |
| 45.1, 45.2, 47.1 specifications | 2026-10-17 | ba1dc2d | 39071816823 passed | D-38, D-39 |
| 53 Documentation and Claude Code handoff | 2026-10-17 | 5751999 | not recorded | — |

## 6. Environment and gotchas

- Local paths: `/Users/nikhiliyer/Documents/Statica-Edu` is the git clone. `/Users/nikhiliyer/Documents/Kiro`
  is an older non-git mirror, behind `main`, served on port 8443 by the user's Kiro dev server.
  Leave it alone; refresh it only on owner request.
- Node 22 is keg-only: prefix `PATH` with `/opt/homebrew/opt/node@22/bin`. The default `node` is 24.
- Playwright reuses any server already on 4173/4174. Use `PW_DEV_PORT`/`PW_PREVIEW_PORT` per
  worktree and check `lsof -iTCP:4173 -iTCP:4174` first.
- Rebuilding `dist` while a preview tab is open breaks its lazy 3D chunk until the tab reloads.
- Software WebGL under load can take more than 5 s to show a canvas; canvas assertions wait up to
  20 s.
- A failed Playwright run leaves a trace viewer in `playwright-report/`, which makes lint report
  thousands of errors. Delete that git-ignored folder.
- E2E cases that time out while the machine's load average is above 40 have passed on a serial
  rerun. Rerun serially before treating them as regressions.
- GitHub runners can be 2–3× slower than local; `learningLoop` keyboard flow ran 72–96 s against a
  90 s budget before task 77 split it. Treat a single-job E2E timeout with no assertion failure as a
  runner-speed flake: re-run the failed job first.
- Saves: the beam's v1 format is frozen, because `deserializeSession` compares stored results key
  for key. Other models use v2 envelopes. There is no v1 → v2 migration.
- Content versions are part of the storage key `ei:session:<id>:v<n>` (Learn: `ei:learn:<id>:v<n>`).
  Current versions: Cantilever Beam I and Torsion Shaft I v3; Heat Sink I, Mounting Bracket I and
  Braced Frame I v2; the rest v1. Older saves stay in place and are never re-scored.
- Guided progress is derived from history (no persisted step field). Unit tests that edit freely
  enter in Parametric, because Guided locks parameters per step.
- Vite chunk-size and `THREE_CJS_DEPRECATED` warnings are expected and nonblocking.
- The user prefers Safari for manual inspection; automated gates use Chromium and Pixel 7.

## 7. Architecture invariants to preserve

- Pure layers (`units`, `challenge`, `geometry`, `physics`, `evaluation`, `learn`) never import
  React, Three, UI or state. Physics never imports evaluation; evaluation never imports state or
  units. UI and state never implement solver formulas. Cross-layer tests live in `test/`.
- The reducer is pure: ids and time are injected. Prediction uses `setPrediction` with
  `now: store.clock()`, then `store.runTest()` (D-27).
- StoreProvider reduces and persists synchronously before the next action, including batched
  renders. Browser storage is injected; isolated test providers default to memory.
- Persistence envelope `{schemaVersion, savedAt, session, undefinedFields}`. Loading re-analyzes
  recorded geometry and results and rejects corrupt or unknown-version sessions. Keep explicit-
  undefined round trips.
- `deletedIterationIds` is archival metadata. Keep archived TestResults, prediction provenance and
  numbering; `selectVisibleHistory` filters. Reject restore, compare or submit of deleted
  iterations.
- Student challenge data excludes `referenceDesign`. Invalid imports leave the session unchanged.
- The main-bundle `ViewportBoundary`, `FallbackViewport` and 2D views stay independent of the lazy
  Three.js chunk. Dialogs are body-portaled and keep focus, Escape and focus return. One shared
  LiveRegion handles announcements.
- Runtime is same-origin and browser-only: self-hosted fonts, CSP `default-src 'self'`, no network
  calls, analytics, inline scripts or styles, or secrets.
- Playwright: dev port 4174 exposes test-only `__EI_STATE__`; production port 4173 must not. Test
  real Tab order and native manipulation, the requested viewport width and serious/critical axe
  gates.
