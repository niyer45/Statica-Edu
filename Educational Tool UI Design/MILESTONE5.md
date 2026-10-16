# Milestone 5 development status

Current priority (2026-10-16, D-35): the original six catalog challenges come before second editions. Read CATALOG_ROADMAP.md. Next task is 45.1 scoped requirements/delivery order for the five previews, then 45.2 multi-model contracts and task 34 shared integration. Tracks 46–50 implement and verify the five new models/flows; 51 verifies the complete original catalog. All five remain unavailable today. Customer release still requires owner/manual/student QA and Guided/Parametric distinction 44.

## Retained Beam II work — deferred


2026-10-16: owner authorized software development before human QA, with QA required before customer deployment. Task 33.1 defines a second configuration, Cantilever Beam II, using the current beam model to teach orientation at constant area/mass. This selection is provisional developer planning, not a conclusion from nonexistent pilot evidence.

Scoped requirements/design: `../.kiro/specs/cantilever-beam-2/`. Configuration: `src/challenge/challenges/cantilever-beam-2.json`; domain regression: `test/challenges/cantileverBeam2.test.ts`. Flat rectangle 40 × 20 mm fails deflection; rotating it 90° meets the reviewed-by-tests limits at the same 1.296 kg. Arithmetic fixtures are derived separately from the documented equations and are not owner engineering sign-off.

Tasks 33.1–33.2 cover specification and configuration development only. Task 34 must integrate challenge loading and isolated sessions before any availability change. Cantilever Beam II is deliberately absent from available catalog entries; existing users still have only Cantilever Beam I. No new physics or original challenge rewrite is included.

Human QA is deferred, not completed: Nikhil will conduct the owner engineering review under 29.2; manual checks and actual student evidence remain open under 30–32. Checkpoint 35.2 remains a release gate and requires those dispositions plus full multi-challenge browser evidence. Feature development can continue without claiming Milestone 4/5 release completion.

Local batch verification: lint zero errors (10 existing warnings), typecheck, full coverage with 898 tests across 110 files and production build passed. Schema generation via node --import tsx produced identical committed schema bytes; pnpm gen:schema itself hit the known sandbox IPC EPERM. No new browser pass is claimed before the pushed CI run.

The earlier Beam II integration direction above is historical and superseded by D-35. Retain these artifacts/tests; task 52 revisits further Beam II work only after task 51. Task 34 now serves the original catalog rather than activating Beam II.
