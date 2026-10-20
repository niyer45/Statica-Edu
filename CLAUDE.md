# Claude Code: Statica Edu entry point

Repository: https://github.com/niyer45/Statica-Edu, branch `main`.

Read these in order before editing (paths from the repository root):

1. `PROGRAM.md`: the director's plan and the agent hierarchy.
2. `Educational Tool UI Design/AGENTS.md`: the development rules.
3. `Educational Tool UI Design/HANDOFF.md`: the state right now and what waits on the owner.
4. `.kiro/specs/engineering-intuition-mvp/tasks.md`: the task list.
5. `Educational Tool UI Design/DECISIONS.md`: decisions D-01–D-63.

App commands (Node 22, pnpm 10.34.3) run in `Educational Tool UI Design/`. Specifications live in
`.kiro/specs/`. Agent definitions live in `.claude/agents/`: the director runs on Fable, developers
on Opus, specialists on Sonnet.

Three rules never bend: never fabricate human QA or owner review; activating a card or deploying
needs explicit owner approval; update `tasks.md` and `HANDOFF.md` after every task.
