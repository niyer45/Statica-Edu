# Claude Code — Statica Edu entry point

Repository: https://github.com/niyer45/Statica-Edu — branch main.

Before editing, read these files in order (paths relative to repository root):

1. `Educational Tool UI Design/AGENTS.md` — authoritative development rules.
2. `Educational Tool UI Design/HANDOFF.md` — current implementation, evidence and next work.
3. `Educational Tool UI Design/CATALOG_ROADMAP.md` and `.kiro/specs/engineering-intuition-mvp/tasks.md` — priority/dependencies.
4. `.kiro/specs/engineering-intuition-mvp/requirements.md`, `design.md`, and `Educational Tool UI Design/DECISIONS.md`.
5. Relevant additive specs under `.kiro/specs/interaction-modes/`; dormant `.kiro/specs/cantilever-beam-2/` is retained history, not the next integration target.

Next task is **45.1**: scope requirements, supported models/benchmarks and delivery order for Mounting Bracket I, Torsion Shaft I, Heat Sink I, Braced Frame I and Vibration Isolation I. Only Cantilever Beam I runs today. Prioritize the original six cards before second editions; do not activate previews using invented beam results. 45.2 model architecture precedes shared task 34 integration.

Summarize status/next task/discrepancies before source changes, then proceed with authorized development. Preserve existing architecture and completed features. Update tasks/HANDOFF/AGENTS and relevant docs after each completed task, run required verification and push verified batches. Stop continuous CI polling after push and await user feedback. No customer deployment or external messages are authorized by this handoff.

Mode rule: choose Guided/Parametric before entering; no in-workbench switching. Mode distinction is implemented/browser-verified. Task 44.3/parent 44 remain open only for owner manual release QA; do not block development 45.1 or fabricate human evidence.

Run pnpm commands in `Educational Tool UI Design/`, using Node 22 and pnpm 10.34.3. Keep sibling `.kiro/` and root workflow/README intact. The original `/Users/nikhiliyer/Documents/Kiro/` is a local mirror without .git: inspect/reconcile it, and use a separate normal clone for CLI git work rather than initializing unrelated history or overwriting files. Paths in HANDOFF.md explain both layouts.

HANDOFF_HISTORY.md is an archive of superseded instructions, not current guidance.
