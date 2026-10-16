# Milestone 3 progress

Tasks 19.1–19.5 were verified before this batch (828 tests). The last pushed starting point is a8a3c6b5b37bb162675de5738d2d9c9df85aec33 (through 19.4).

Each completed task below passed lint (zero errors), typecheck, the full Vitest suite and build. Browser gates remain separate.

- **19.6 complete** — Property 30 checks exact draft/latest equality ignoring only id after every generated action. Verification: 831 tests pass. Next: 19.7.
- **19.7 complete** — Property 31 checks restore isolation, unknown ids, unchanged history and repeated analysis on retest. Verification: 831 tests pass. Next: 19.8.
- **19.8 complete** — Property 32 checks every reachable draft and recorded design after valid and hostile actions. Verification: 831 tests pass. Next: 19.9.
- **19.9 complete** — Property 33 verifies exact locked length/material across all draft and history transitions. Verification: 835 tests pass. Next: 19.10.
- **19.10 complete** — Property 34 verifies deterministic replay on frozen state/action/challenge, including null-prototype hostile imports. Verification: 835 tests pass. Next: 19.11.
- **19.11 complete** — Property 36 verifies required-iteration prediction gating, cancellation and no consumed iteration on rejection. Verification: 835 tests pass. Next: 19.12.
- **19.12 complete** — Property 37 verifies valid and rejected submissions preserve stored status/efficiency and untrimmed reflection. Verification: 835 tests pass. Next: 19.13.
- **19.13 complete** — Properties 14,17,26 now cover hostile drafts/imports, strict rejection and immutable challenges in reducer sequences. Verification: 841 tests pass. Next: 19.14.
- **19.14 complete** — The full specified example flow, cancel/confirm, bad restore, baseline submission, locked import reasons and invalid init are verified. Verification: 841 tests pass. Next: 19.15.
- **19.15 complete** — Generated sequences produce identical state and evaluations in Guided and Parametric modes apart from mode. Verification: 841 tests pass. Next: 20.1.
- **20.1 complete** — Implemented versioned persistence, strict validation, reanalysis/re-evaluation, 1e-9 numeric tolerance, immutable history and storage-failure controller. Explicit undefined optional fields are tracked in the envelope for exact round-trips; save time is injected. Verification: 856 tests pass. Next: 20.2.
- **20.2 complete** — Property 35 round-trips reachable sessions exactly; arbitrary corrupted strings are rejected without throwing. Verification: 856 tests pass. Next: 20.3.
- **20.3 complete** — Verified corrupt/version/missing/invalid/tampered sessions, migration ordering, tolerance boundaries and once-per-load storage exception notices. Verification: 856 tests pass. Next: 20.4.
- **20.4 complete** — App injects browser storage; the provider loads before children render and reduces/persists synchronously before the next action, including batched confirmation and submit. Isolated providers default to memory only; storage failures retain the in-memory session. Verification: 858 tests pass. Next: 22.1.
- **22.1 complete** — Shared Dialog preserves template classes, uses a body portal, labelled modal semantics, initial focus, Tab/Shift+Tab trapping, Escape and opener/fallback focus restoration. Verification: 860 tests pass. Next: 22.2.
- **22.2 complete** — Prediction dialog opens from reducer state, starts with no selected radio, validates explanation/direction, cancels cleanly and confirms via injected clock then runTest. Help shares the focus-safe primitive. Verification: 860 tests pass. Next: 21.1.
