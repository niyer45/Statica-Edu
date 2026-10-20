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

- Director turns findings into numbered tasks; `platform-engineer` and `challenge-developer` fix blocking usability, correctness and accessibility issues with regression tests; `release-verifier` reviews only the high-stakes changes (rule 3 in §3).
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

Two tiers plus a critic, defined in `.claude/agents/`. The director (Fable) is the sole orchestrator and briefs Sonnet workers directly; there is no intermediate supervisor layer, so context passes once, from the director to the worker that does the work. Sonnet workers have no `Agent` tool and run a self-check before reporting. `release-verifier` is the only Opus agent: a temporary critic the director spawns for high-stakes work and reads once. `.claude/settings.json` caps spawn depth at 1.

| Group | Agent | Model | Does | Spawns |
| --- | --- | --- | --- | --- |
| Director | `director` | Fable | Plans, briefs, reviews hand-backs, integrates, pushes, watches CI, reports to the owner. Executes nothing process-heavy; never spawns Fable. | Sonnet workers; Opus critic when high-stakes |
| Worker | `challenge-developer` | Sonnet | One design challenge, or the slice of one the director assigns. | none |
| Worker | `learn-developer` | Sonnet | One Learn module or a slice of one. | none |
| Worker | `platform-engineer` | Sonnet | Cross-cutting work: shell, accounts, persistence, CI, deploy, cleanup, teacher features. | none |
| Worker | `docs-steward` | Sonnet | Tracking docs, decisions, handoff, checklists, READMEs. | none |
| Worker | `spec-worksheet` | Sonnet | Standalone Python worksheet, grid search, cross-checks; never reads app code for numbers. | none |
| Worker | `test-writer` | Sonnet | Vitest unit, property and component tests for a fixed API. | none |
| Worker | `e2e-runner` | Sonnet | Runs Playwright, triages flakes, writes a spec from a pattern. | none |
| Worker | `ui-implementer` | Sonnet | One component or drawing against an existing pattern. | none |
| Worker | `code-reviewer` | Sonnet | Read-only diff review against the project rules. | none |
| Worker | `doc-editor` | Sonnet | Link checks, ID diffs, evidence tables, count sync. | none |
| Critic | `release-verifier` | Opus | Temporary validator for physics models, save formats, CI/deploy changes, security-sensitive code and final synthesis; recomputes numbers; never edits; done after its report. | none |

### How to run it

From the clone (`/Users/nikhiliyer/Documents/Statica-Edu`):

```bash
claude --agent director
```

That runs the main session on Fable with the director's prompt. A plain `claude` session on Fable that reads this file behaves the same way; the definition only makes it the default. Workers are spawned by the director with the Agent tool (`subagent_type: challenge-developer` and so on, `model: "sonnet"`); each gets its own worktree from `isolation: worktree`.

### Delegation rules

1. The director is the sole orchestrator. It briefs Sonnet workers directly for every process-heavy piece (code, specs, worksheets, document rewrites, test runs, reviews) and runs isolated pieces in parallel. No intermediate supervisors.
2. A brief is self-contained: task number, goal, files, rules that apply, definition of done, what the owner must approve, and the self-check the worker runs before reporting (re-read the brief, run the checks, diff against the brief, fix, report with evidence).
3. Opus appears only as `release-verifier`, a temporary critic for high-stakes work (new or changed physics or evaluation models, save formats, CI/deploy workflows, security-sensitive code, final synthesis of multi-worker tasks). The director reads its verdict and does not keep it running. Neither tier spawns Fable.
4. At most three workers run browser tests at the same time. Five parallel agents pushed the load average above 100 and Playwright timed out; everything passed on serial reruns.
5. Nothing merges without the director reading the hand-back and checking the key numbers. High-stakes changes (rule 3) also go through the `release-verifier` critic.
6. Two agents never edit the same tracking document at once. The director serializes `docs-steward`.
7. Shared registration files (`catalog.ts`, `bundled.ts`, `models.ts`, `runtimes.ts`, `registry.ts`, `TechnicalArt.tsx`) conflict on every parallel merge: keep both sides, restore closing braces, and make count-based tests read the catalogs.
8. Escalate to the owner, through `OWNER_REVIEW_CHECKLIST.md` §8 and the director's report, anything that changes engineering content, product scope, or what students see during an active pilot.

### Definition of done, by tier

- Worker: the deliverable, the self-check run with its output pasted, and anything not verified stated plainly.
- Critic: a ranked verdict (blocking / should-fix / notes) with file and line, and what it ran.
- Director: integrated, full gate passed, pushed, CI watched to green, `tasks.md`/`HANDOFF.md`/`DECISIONS.md`/checklist updated, owner told what to decide and what to run.

## 4. Owner's standing list

1. Enable Pages and deploy 618e2ee; record the build id in the pilot notes.
2. Run the pilot sessions; send the notes (or a photo of the sheets) to the director.
3. Work through `OWNER_REVIEW_CHECKLIST.md` §8, introductory pairs first.
4. Decide after the pilot: Phase 3 (modules), Phase 4 (teacher hand-in) or Phase 5 (cloud accounts) next.
5. Talk to two or three instructors before Phase 4.
