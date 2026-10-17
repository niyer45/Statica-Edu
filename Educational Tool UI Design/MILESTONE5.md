# Milestone 5: Original six-challenge catalog

Current status, 2026-10-17: only Cantilever Beam I is runnable. User priority D-35 is to implement the five existing preview cards before second editions. See CATALOG_ROADMAP.md and task graph. Mode distinction is implemented/browser-verified (D-37); owner manual release QA remains open under 44.3/30.1.

Task 45.1 (2026-10-17) scoped objectives, bounded models, units/metrics/constraints, benchmark plans and delivery order for the five previews in `../.kiro/specs/original-catalog/` (D-38: Torsion → Vibration → Heat Sink → Bracket → Frame). These are proposed developer choices with standalone feasibility checks; owner review, model implementation and executed benchmarks remain open. Owner decisions HS-08 and MB-07 are pending. Task 45.2 (2026-10-17) specified the shared multi-model contracts in `../.kiro/specs/multi-model-architecture/` (D-39), including the frozen beam v1 save format. Task 47.1 specified Torsion Shaft I and its worksheet in `../.kiro/specs/torsion-shaft-1/`. Next is 34.1 step 1 (registry with beam only), then 47.2. Task 45.2 defines shared multi-model contracts; task 34 integrates challenge selection/session isolation; tracks 46–50 specify, implement, numerically verify and integrate each model. Gate 51 verifies the original catalog. Checkpoint 35.2 retains human-QA gate 32.2; no deployment is claimed.

## Deferred Cantilever Beam II artifacts

Historical tasks 33.1–33.2 completed additive specs at `../.kiro/specs/cantilever-beam-2/`, configuration `src/challenge/challenges/cantilever-beam-2.json` and 14 tests at `test/challenges/cantileverBeam2.test.ts`. The exercise uses a 40 × 20 mm rectangle whose 90° rotation improves bending stiffness at the same mass; it adds no new physics. Retain those completed artifacts/tests, but do not activate/integrate Beam II before task 52 after original-catalog gate 51. Task 34 is shared original-catalog infrastructure, not a Beam II activation task.

## Verification and remaining release work

Current implementation run 38970465802 on 878fb87bbf514e746f2ecd477a473b22a6b0bf75 passed 906 core tests/111 files, coverage/core/build/schema gates, 2 responsive cases and all 24 browser cases. This verifies today's Cantilever Beam I and dormant configuration tests, not any future multi-model integration. Nikhil is owner engineering reviewer; human model/manual/student evidence remains required before customer release and has not been recorded. See HANDOFF.md for exact links and next-task directives.
