# Statica Edu development program

Last updated: 2026-10-20 (main at 618e2ee, CI green). Owner: Nikhil Iyer. This file is the director's plan and the description of the agent hierarchy that executes it. State lives in `Educational Tool UI Design/HANDOFF.md`; rules in `Educational Tool UI Design/AGENTS.md`; the task list in `.kiro/specs/engineering-intuition-mvp/tasks.md`.

## 1. Where the product is

- Ten runnable design challenges, ordered by difficulty (D-63): Introductory 001 Cantilever Beam I, 002 Torsion Shaft I, 003 Column Buckling I, 004 Stress and Strain I; Intermediate 005 Mounting Bracket I, 006 Heat Sink I, 007 Pressure Vessel I; Advanced 008 Braced Frame I, 009 Vibration Isolation I, 010 Fatigue Analysis I. Each has a spec with independent hand calculations, a hardest valid baseline and a hidden passing reference (D-47), Guided and Parametric modes, a typeset reference dialog, 3D and 2D views, unit and browser tests.
- Three Learn modules (D-57, predict before show): Beam bending, Torsion, Stress and strain. Planned in the Learn catalog with no content: Buckling, Natural frequency and resonance, Fins and heat sinks.
- Local-first accounts, Home page from the owner's Figma design, My designs progress. No server, no network, CSP `default-src 'self'`.
- CI: verify job plus four Playwright shards, about 10 minutes. Deploy: manual, CI-gated GitHub Pages workflow (`DEPLOY.md`); site https://niyer45.github.io/Statica-Edu/; the footer shows the build id.
- Verification on main: 3216 unit tests, 110/110 E2E on desktop Chromium and Pixel 7.
- Nobody outside the project has used it yet. The owner is about to run a pilot with five aerospace-engineering friends on the full product.

Against the four product pillars: simulations and design challenges are strong; guided learning modules are early (3 of 10 topics); curriculum and progression is a catalog, not a path; teacher and account features do not exist beyond on-device accounts.

## 2. The plan forward

The ordering follows the recommendation the owner accepted on 2026-10-19 and 2026-10-20: get the product in front of real students, learn from that, and do not add scope until there is evidence that the core learning loop works.

### Phase 0. Pilot launch (owner, now)

Entry: main green at 618e2ee. Exit: five friends have used the site and the owner has notes.

- Owner: enable Pages once (Settings → Pages → Source: GitHub Actions), then Actions → Deploy to GitHub Pages → Run workflow on `main`. Confirm the footer shows Build 618e2ee and the library starts with the four Introductory cards.
- Owner: run the sessions with `PILOT_PROTOCOL.md` (pre/post questions, observation sheet). Watch three things: whether predictions improve between tests, where people get stuck, whether they understand the model's limits. Each friend creates an account on their own device or uses a browser profile; progress is per browser.
- Nothing deploys during the pilot. Agents work on branches only; the director merges to main but does not ask for a deploy until the sessions are done.
- Director support: a one-page findings template in `MILESTONE4.md` (task 31.2) so the owner's notes land in the form task 32 needs.

### Phase 1. Owner engineering review (owner, during and after the pilot; task 29.2)

Entry: any time. Exit: `OWNER_REVIEW_CHECKLIST.md` §8 answered for the pilot set, then for the rest.

- Priority order: the three introductory pairs first (Beam bending → Cantilever Beam I; Stress and strain → Stress and Strain I; Torsion → Torsion Shaft I), then Column Buckling I, Pressure Vessel I, then the advanced three and the older intermediate two.
- Open questions the agents left: Fatigue (which Roark edition; whether surface finish should carry a cost, since ground is always best; non-rotating spindle instead of a rotating shaft), Torsion (two checks never decide the result: keep or remove), Stress and Strain (confirm the three material value sets), Column Buckling (aluminium chosen because steel tubes fall outside Euler at this size), Pressure Vessel (overall-length limit added), plus the Heat Sink, Vibration, Bracket and Frame questions from the original catalog.
- Each answer is recorded by `docs-steward` as a D-number and, if it changes content, becomes a task for `challenge-developer`.

### Phase 2. Pilot findings and release gate (after the pilot; tasks 30, 32, 44.3, 51, 35.2)

Entry: the owner's pilot notes. Exit: Milestone 4 checkpoint 32.2 and Milestone 5 checkpoint 35.2 recorded.

- Director turns findings into numbered tasks; `platform-engineer` and `challenge-developer` fix blocking usability, correctness and accessibility issues with regression tests; `release-verifier` checks the integrated tree.
- Owner does the manual checks in 30.1 on the devices students used (keyboard, screen reader, touch, 320 px, slow machine) and records them; 44.3 and 51 close on that evidence, not on CI.
- The owner then chooses the next phase from the evidence. Default order is 3, 4, 5.

### Phase 3. Learn modules for the remaining topics (task 75; `learn-developer`, in parallel, two or three at a time)

Entry: the pilot shows the module format works (or the owner says to proceed anyway). Exit: every available challenge has a module whose Apply it opens it.

Buckling → Column Buckling I; Pressure vessels → Pressure Vessel I; Fins and heat sinks → Heat Sink I; Resonance and isolation → Vibration Isolation I; Stress concentration → Mounting Bracket I; Trusses and bracing → Braced Frame I; Fatigue → Fatigue Analysis I (after the D-60 constants are reviewed). Each: spec amendment first, demos call the model's physics only, every correct answer tested against the physics, Learn E2E extended, owner review item.

### Phase 4. Teacher hand-in without a server (task 76; `platform-engineer`)

Entry: the owner has talked to two or three instructors and confirms the need. Exit: a student can hand in a file and a teacher can open it.

A shareable link that preselects challenge and mode; a hand-in file (design JSON v2, tested results, reflection, build id) that a teacher opens read-only in the app. No network, no accounts, CSP unchanged. Spec under `.kiro/specs/teacher-handin/` before code.

### Phase 5. Accounts in the cloud, only if shared devices hurt (task 38.1, then 38.2)

Entry: pilot evidence that per-browser progress is a real problem, and an owner decision on hosting, personal data and whether users include minors. The specification (provider, ownership, retention, sync conflicts, CSP changes) comes before any code.

### On hold until there is evidence

New disciplines (fluids, controls), second editions (task 52, Cantilever Beam II stays dormant), the CAD-like Freeform mode (37.1), an AI assistant (39), cloud sync (38.2). None of these starts without an owner instruction and a scoped spec.

### Standing engineering work (any time, `platform-engineer`)

Keep CI near 10 minutes; remove dead worktrees and branches (never uncommitted work without asking); keep the lint warning count at or below the current 10; pin dependencies exactly.

## 3. The agent hierarchy

Three tiers, defined in `.claude/agents/`. Nesting depth is capped at two below the main session by `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2` in `.claude/settings.json`; Sonnet specialists have no `Agent` tool, so they are leaves.

| Tier | Agent | Model | Does | Spawns |
| --- | --- | --- | --- | --- |
| Director | `director` | Fable | Plans, briefs, reviews numbers, integrates, pushes, watches CI, reports to the owner. Writes no feature code. | Opus developers |
| Developer | `challenge-developer` | Opus | One design challenge end to end, in its own worktree. | Sonnet specialists |
| Developer | `learn-developer` | Opus | One Learn module end to end, in its own worktree. | Sonnet specialists |
| Developer | `platform-engineer` | Opus | Shell, accounts, persistence, CI, deploy, cleanup, teacher features. | Sonnet specialists |
| Developer | `release-verifier` | Opus | Independent check of a branch or the integrated tree; recomputes numbers; runs the full gate; never edits. | `spec-worksheet`, `e2e-runner` |
| Developer | `docs-steward` | Opus | Tracking docs, decisions, handoff, checklists, READMEs. | `doc-editor` |
| Specialist | `spec-worksheet` | Sonnet | Standalone Python worksheet, grid search, cross-checks; never reads app code for numbers. | none |
| Specialist | `test-writer` | Sonnet | Vitest unit, property and component tests for a fixed API. | none |
| Specialist | `e2e-runner` | Sonnet | Runs Playwright, triages flakes, writes a spec from a pattern. | none |
| Specialist | `ui-implementer` | Sonnet | One component or drawing against an existing pattern. | none |
| Specialist | `code-reviewer` | Sonnet | Read-only diff review against the project rules. | none |
| Specialist | `doc-editor` | Sonnet | Link checks, ID diffs, evidence tables, count sync. | none |

### How to run it

From the clone (`/Users/nikhiliyer/Documents/Statica-Edu`):

```bash
claude --agent director
```

That runs the main session on Fable with the director's prompt. A plain `claude` session on Fable that reads this file behaves the same way; the definition only makes it the default. Developers are spawned by the director with the Agent tool (`subagent_type: challenge-developer` and so on); each gets its own worktree from `isolation: worktree`.

### Delegation rules

1. The director delegates everything that produces code. It reviews, integrates and records.
2. A developer's brief states the task number, the goal, the files, the rules that apply, the definition of done and what the owner must approve. Developers refuse to start without a spec when the task is a model.
3. Developers delegate narrow, well-specified pieces (a worksheet, a test file, a component, an E2E run) and keep the design decisions. They do not delegate "build the challenge".
4. At most three developers run browser tests at the same time. Five parallel agents pushed the load average above 100 and Playwright timed out; everything passed on serial reruns.
5. Nothing merges without the director reading the hand-back and checking the key numbers. Physics, save-format, CI and multi-model changes also go through `release-verifier`.
6. Two agents never edit the same tracking document at once. The director serializes `docs-steward`.
7. Shared registration files (`catalog.ts`, `bundled.ts`, `models.ts`, `runtimes.ts`, `registry.ts`, `TechnicalArt.tsx`) conflict on every parallel merge: keep both sides, restore closing braces, and make count-based tests read the catalogs.
8. Escalate to the owner, through `OWNER_REVIEW_CHECKLIST.md` §8 and the director's report, anything that changes engineering content, product scope, or what students see during an active pilot.

### Definition of done, by tier

- Specialist: the deliverable, the command it was checked with, and the output pasted in the report.
- Developer: lint 0 errors, typecheck, unit tests with coverage, build, schema no drift, the relevant E2E specs on desktop and Pixel 7; committed on the branch; report with numbers, shared files touched, deviations and owner questions.
- Director: integrated, full gate passed, pushed, CI watched to green, `tasks.md`/`HANDOFF.md`/`DECISIONS.md`/checklist updated, owner told what to decide and what to run.

## 4. Owner's standing list

1. Enable Pages and deploy 618e2ee; record the build id in the pilot notes.
2. Run the pilot sessions; send the notes (or a photo of the sheets) to the director.
3. Work through `OWNER_REVIEW_CHECKLIST.md` §8, introductory pairs first.
4. Decide after the pilot: Phase 3 (modules), Phase 4 (teacher hand-in) or Phase 5 (cloud accounts) next.
5. Talk to two or three instructors before Phase 4.
