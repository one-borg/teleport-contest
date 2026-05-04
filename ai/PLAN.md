# Teleport Contest Submission Plan

## Goals
- Two-session fast track: make two recorded sessions pass as quickly as possible.
- Best submission: improve general correctness so held-out sessions pass without one-off hacks.
- Preserve RNG consumption order and call sites exactly as in NetHack C; screens must follow.

## Constraints (Frozen Surfaces)
- Never edit frozen infrastructure: `js/isaac64.js`, `js/terminal.js`, `frozen/*`.
- README.md is frozen. Do not edit it.
- If the user marks any additional file frozen, treat it as read-only and note it here.

## Baseline (measured on 2026-05-04)
- `seed8000-tourist-starter`: RNG `3102/3102`, Screen `22/22` (passes).
- `seed0077-rogue-chargen`: RNG `3242/3242`, Screen fails at step 12.
  - First screen mismatch: status line 2 shows `AC:10 Xp:1/0 T:1` but expected `AC:7 Xp:1`.

## Reflection (Step Back)
We now have full RNG parity for `seed0077`, which means remaining failures are display/state mismatches rather than RNG order. The only failing screen is the early status line for the Rogue, which points to an incomplete AC calculation (`u.uac`) or character sheet initialization. We should fix state to drive the display, rather than changing display formatting, to preserve the Tourist session which expects `AC:10 Xp:1/0 T:1`.

## Two-Session Fast Track (Primary Objective)
Target sessions:
- `sessions/seed8000-tourist-starter.session.json`
- `sessions/seed0077-rogue-chargen.session.json`

### Step 1: AC and Status Line Parity
- Implement real AC initialization in `u_init_inventory_attrs` (or equivalent) using starting inventory.
- For Rogue, ensure leather armor and role defaults yield `u.uac = 7`.
- Keep `display.js` status line formatting unchanged to avoid breaking Tourist.
- Add a unit test for initial AC by role (Tourist stays 10; Rogue becomes 7).

### Step 2: Regression Guardrails
- Re-run `node ai/scripts/first_mismatch.mjs` for both sessions after each change.
- Record snapshot with `node ai/scripts/progress_snapshot.mjs`.
- Run `node --test` to catch regressions.

Exit criteria:
- Both sessions pass RNG + Screen end-to-end.

## Best-Submission Plan (After the Two-Session Fast Track)
Phase A: Startup parity
- Replace remaining fastforward scaffolding with real `o_init`, dungeon init, inventory init, and `u_init` order from C.
- Remove hand-tuned stubs once full implementations exist.

Phase B: Core turn engine parity
- Replace `fastforward_step` with real per-turn logic (movement, vision refresh, message timing).
- Implement command dispatch and minimal core handlers used by recorded sessions.

Phase C: Worldgen depth
- Complete `mklev`/`mkobj`/`makemon`/`mktrap` parity, special rooms, and post-processing hooks.
- Implement save/restore behavior for multi-segment state.

Phase D: Gameplay breadth
- Commands: search, kick, eat, throw, read, zap, cast, extcmds.
- Menu/prompt behavior and inventory management consistency.

## Tooling, Tests, and Progress Monitoring
- First-mismatch tooling: `ai/scripts/first_mismatch.mjs` (single session).
- Progress snapshots: `ai/scripts/progress_snapshot.mjs` with `ai/progress_sessions.json`.
- Unit tests: `node --test` for RNG, geometry, display, and utility helpers.
- Keep tests small but strict; update expected values only with intentional changes.

## Execution Loop (Every Milestone)
1. Run targeted sessions only.
2. Find first screen mismatch.
3. Fix state or logic that drives display (not the display output itself).
4. Re-run targeted sessions.
5. Record a progress snapshot.
6. Run full `bash frozen/score.sh` after stable improvements.

## Commit Cadence
- Commit often, including partial progress commits.
- Update this plan whenever priorities or constraints change.
- Push only when at least one targeted session improves and regressions are understood.

## Immediate Next Actions
1. Implement initial AC calculation from starting inventory and confirm Rogue `AC:7`.
2. Add unit tests for role-based initial AC.
3. Re-run `ai/scripts/first_mismatch.mjs` for both sessions and snapshot progress.
4. Keep `node --test` passing after each fix.
