# Claude Code — Statica Edu entry point

Repository: https://github.com/niyer45/Statica-Edu — branch main.

Before editing, read these files in order (paths relative to repository root):

1. `Educational Tool UI Design/AGENTS.md` — authoritative development rules.
2. `Educational Tool UI Design/HANDOFF.md` — current implementation, evidence and next work.
3. `Educational Tool UI Design/CATALOG_ROADMAP.md` and `.kiro/specs/engineering-intuition-mvp/tasks.md` — priority/dependencies.
4. `.kiro/specs/engineering-intuition-mvp/requirements.md`, `design.md`, and `Educational Tool UI Design/DECISIONS.md`.
5. Relevant additive specs under `.kiro/specs/interaction-modes/`, `.kiro/specs/original-catalog/` and `.kiro/specs/multi-model-architecture/`; dormant `.kiro/specs/cantilever-beam-2/` is retained history, not the next integration target.

Task 45.1 is complete as specification: `.kiro/specs/original-catalog/` scopes the five previews and D-38 sets the delivery order Torsion → Vibration → Heat Sink → Bracket → Frame. Task 45.2 is complete as specification: `.kiro/specs/multi-model-architecture/` and D-39 freeze the beam v1 save format. Task 34 (multi-challenge integration), all five models (46.2–50.2) and Torsion Shaft I (47, activated by the owner, D-42) are complete. Cantilever Beam I and Torsion Shaft I are runnable. All six original challenges are openable (D-42–D-44) and task 54 added 3D views with 2D fallbacks for the bracket, torsion shaft and frame (D-45). Next: gate 51. See HANDOFF.md before resuming. Activating any card, or merging work an agent was blocked from committing, requires explicit owner approval. Prioritize the original six cards before second editions; do not activate previews using invented beam results.

Summarize status/next task/discrepancies before source changes, then proceed with authorized development. Preserve existing architecture and completed features. Update tasks/HANDOFF/AGENTS and relevant docs after each completed task, run required verification and push verified batches. After pushing, monitor the GitHub workflow continuously yourself (user update 2026-10-17); run independent tasks in parallel with agents. No customer deployment or external messages are authorized by this handoff.

Mode rule: choose Guided/Parametric before entering; no in-workbench switching. Mode distinction is implemented/browser-verified. Task 44.3/parent 44 remain open only for owner manual release QA; do not block development or fabricate human evidence.

Run pnpm commands in `Educational Tool UI Design/`, using Node 22 and pnpm 10.34.3. Keep sibling `.kiro/` and root workflow/README intact. The original `/Users/nikhiliyer/Documents/Kiro/` is a local mirror without .git: inspect/reconcile it, and use a separate normal clone for CLI git work rather than initializing unrelated history or overwriting files. Paths in HANDOFF.md explain both layouts.

HANDOFF_HISTORY.md is an archive of superseded instructions, not current guidance.
