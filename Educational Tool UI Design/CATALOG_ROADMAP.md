# Original catalog development priority

Owner direction, 2026-10-16 (D-35): complete the six existing library challenges before second editions. Only Cantilever Beam I is currently runnable. No additional card is activated by this planning update.

| Existing card | Current status | Development work |
| --- | --- | --- |
| Cantilever Beam I | Implemented learning loop | Guided/Parametric distinction implemented and CI verified; preserve regressions and complete manual release-mode QA (44.3) |
| Mounting Bracket I | Preview only | Scope supported geometry/load paths and stress assumptions; implement/benchmark appropriate model and integrate (46) |
| Torsion Shaft I | Preview only | Scope torsional deformation/stress, implement/benchmark appropriate shaft model and integrate (47) |
| Heat Sink I | Preview only | Scope thermal assumptions/boundaries, implement/benchmark heat-transfer model and integrate (48) |
| Braced Frame I | Preview only | Scope joint/member/support idealization, implement/benchmark frame/truss model and integrate (49) |
| Vibration Isolation I | Preview only | Scope excitation/damping/response, implement/benchmark appropriate dynamics model and integrate (50) |

45.1 is complete as specification (2026-10-17): see [`.kiro/specs/original-catalog/`](../.kiro/specs/original-catalog/requirements.md) and D-38. Proposed models and delivery order:

| Order | Card | Proposed bounded model | Open owner decision |
| --- | --- | --- | --- |
| 1 | Torsion Shaft I (47) | Circular solid/tube Saint-Venant torsion: twist, shear stress, mass, OD packaging; 47.1 specified; 47.2 model implemented/registered; next 47.3 workbench (card unavailable until verified) | — |
| 2 | Vibration Isolation I (50) | Single-DOF base-excited spring/viscous damper, steady-state transmissibility, static sag, resonance peak; 50.1 specified; 50.2 model implemented | — |
| 3 | Heat Sink I (48) | Steady plate-fin conduction/convection, fin and surface efficiency, specified effective h with minimum gap; 48.1 specified; 48.2 model implemented | Resolved: D-40 |
| 4 | Mounting Bracket I (46) | Stepped flat-bar nominal bending with a published shoulder-fillet Kt fit; stepped-cantilever deflection 46.1 specified (`.kiro/specs/mounting-bracket-1/`) | Resolved: D-40, D-41 (printed-source Kt check deferred to owner QA) |
| 5 | Braced Frame I (49) | 2D pin-jointed frame by direct stiffness; mechanism detection; yield/Euler member checks; 49.1 specified; 49.2 model implemented | — |

All choices await owner engineering review (29.2); none is implemented. 45.2 (complete as specification, `.kiro/specs/multi-model-architecture/`, D-39) defines shared model/config/result versioning, model-specific metrics/controls, validation, evaluation, visualization/fallback and persistence/import contracts. The order above is a default sequence chosen for implementation risk; it adds no hard dependency edges and the owner may reorder it. Task 34 builds shared selection/session infrastructure against those contracts, preserving Cantilever Beam I saves and pure domain boundaries. Each model track has separate specification, numerical validation and integrated learning-loop gates; keep the card unavailable until its supported flow is real and verified.

The current beam solver supports none of the other five advertised disciplines as implemented challenges. Do not label a bracket, heat sink or vibration problem as analyzed by substituting cantilever metrics. Choose bounded educational models and disclose assumptions; if the advertised objective cannot be supported, resolve it in the scoped specification before implementation.

Cantilever Beam II's configuration, specifications and 14 tests are retained. Tasks 33.1–33.2 stay completed historically; further integration is deferred to 52 after original-catalog gate 51. It is neither a seventh available card nor a required intermediate step. Its constant-mass rectangle-orientation exercise may later become a second edition or guided experiment, subject to owner direction.

Customer deployment still requires task 44's observable Guided/Parametric distinction and recorded owner engineering/manual/student QA. Nikhil is the nominated engineering reviewer; no review, participant outcomes, deployment or new model completion is claimed. Accounts/saved user information/progress remain planned under 38; this priority update concerns challenge editions and does not delete those requirements.
