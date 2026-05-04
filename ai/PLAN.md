# Teleport Contest Submission Plan

## Goals
- Fast track: make two recorded sessions pass as quickly as possible.
- Best submission: maximize general correctness so held-out sessions pass without hacks.
- Keep RNG consumption and call order aligned with NetHack C, not just screen output.

## Constraints (Frozen Surfaces)
- Never edit frozen infrastructure (`js/isaac64.js`, `js/terminal.js`, `frozen/*`).
- README.md is frozen for this project. Do not edit it.
- If any additional files are explicitly declared frozen by the user, treat them as read-only and call that out here.

## Baseline (measured on 2026-05-04)
- Full score not re-run in this revision.
- `seed8000-tourist-starter`: RNG `3102/3102`, Screen `22/22` (passes).
- `seed0077-rogue-chargen`: RNG `3069/3242`, Screen `11/33`.
  - First RNG mismatch: `rn2(8)` expected at `collect_coords(teleport.c:700)` vs JS `rn2(1)`.
  - First screen mismatch: stats line (attribute order/values).

## Reflection (Step Back)
We have cleared early rumor/engraving RNG and mineralization mismatches for one session, so remaining failures are now concentrated in:
- Startup/chargen attribute initialization order (stats line mismatch).
- Missing teleport/placement RNG (`collect_coords` in `teleport.c`).
- Remaining mklev object/monster RNG ordering (`mkobj`, `makemon`, `rndmonst_adj`, `blessorcurse`).

These are still foundational. Fixing them should unlock both the two-session fast track and general robustness across held-out sessions.

## Two-Session Fast Track (Primary Objective)
Target sessions:
- `sessions/seed8000-tourist-starter.session.json`
- `sessions/seed0077-rogue-chargen.session.json`

### Step 1: Chargen and Stats Line Parity
- Port the exact C call order for role/race/align selection, `u_init`, `init_attr`/`vary_init_attr`, and initial HP/Pw.
- Verify `newhp`/`newpw` timing and `ulevel` transitions vs C.
- Confirm the very first stats line matches in both sessions.

### Step 2: Teleport RNG Alignment
- Implement `collect_coords` (ring collection + shuffling) in JS and wire to any early-game callers.
- If call sites are still missing, insert a temporary stub that consumes the correct RNG calls and returns a deterministic, safe result; then replace with full logic.

### Step 3: Early mklev RNG Ordering
- Align `fill_ordinary_room` RNG gates and `makemon`/`mktrap` ordering.
- Implement `makemon` RNG consumption more precisely (gender, peacefulness, group size).
- Ensure `rndmonst_adj` call sites are never skipped or reordered by JS stubs.

### Step 4: Engraving/Rumor RNG
- Implement `getrumor`/`get_rnd_line` and `wipeout_text` RNG sequences to match C.
- Use real rumor data (`nethack-c/upstream/dat/rumors.tru`/`rumors.fal`) with padding logic.
- Confirm RNG log matches expected `rn2(25762)` pattern and subsequent wipeouts.

### Step 5: Tight Verification Loop
- After each fix, run `node ai/scripts/first_mismatch.mjs` on both sessions.
- Record a snapshot with `node ai/scripts/progress_snapshot.mjs`.
- Run `node --test` to guard regressions.

Exit criteria:
- Both sessions pass RNG + Screen end-to-end.

## Best-Submission Plan (After the Two-Session Fast Track)
Phase A: Startup parity
- Replace startup fastforward with real `o_init`, dungeon init, inventory init, and `u_init` in exact C order.
- Remove hand-tuned stubs once full implementations exist.

Phase B: Core turn engine parity
- Replace `fastforward_step` with real per-turn logic (movement, vision refresh, message timing).
- Implement command dispatch and minimal core handlers used by sessions.

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
2. Find first RNG mismatch and first screen mismatch.
3. Port the exact C function(s) responsible.
4. Re-run targeted sessions.
5. Record a progress snapshot.
6. Run full `bash frozen/score.sh` after stable improvements.

## Commit Cadence
- Commit often, including partial progress commits.
- Update this plan whenever priorities or constraints change.
- Push only when at least one targeted session improves and regressions are understood.

## Immediate Next Actions
1. Fix chargen/stat initialization order and verify the stats line for Tourist/Rogue.
2. Implement `collect_coords` (or stub its RNG consumption) and wire early call sites.
3. Align `makemon` RNG consumption with C (gender/peace/group handling).
4. Re-run `ai/scripts/progress_snapshot.mjs` and update progress logs.
5. Keep `node --test` passing after each fix.
