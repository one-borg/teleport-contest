# Teleport Contest Submission Plan

## Goal
Maximize final contest performance, not just public-session score:
- Get passing sessions quickly to build momentum.
- Keep changes faithful to NetHack C so held-out sessions also pass.
- Avoid brittle hacks that hurt Phase 2 (5.1 + diff penalty).

## Baseline (measured on 2026-05-04)
- `0/44` public sessions passing.
- `seed8000-tourist-starter`: RNG `3102/3102`, Screen `4/22` (closest to passing).
- All other sessions: Screen `0/*`; RNG diverges early-to-mid run.
- Current code still relies on large `fastforward.js` replay scaffolding and many stubs.

## Current Status (updated on 2026-05-04)
- `1/44` public sessions passing.
- `seed8000-tourist-starter` now passes fully (RNG + Screen).
- Stage 1 objective achieved; next focus is Stage 2 startup/chargen generalization.

## Non-Negotiable Strategy
1. Port behavior from C, do not memorize sessions.
2. Drive work by first mismatch in existing sessions.
3. Prioritize shared foundations over isolated one-off features.
4. Keep module boundaries close to upstream C files to reduce Phase 2 diff.
5. Never edit frozen surfaces (`js/isaac64.js`, `js/terminal.js`, `frozen/*`) as part of feature work.
   Treat any local edits to frozen files as accidental; revert them before commit.
6. README.md is frozen for this project. Do not edit it.

## Execution Loop (for every milestone)
1. Run targeted sessions only.
2. Find first RNG mismatch and first screen mismatch.
3. Port the exact C function(s) responsible.
4. Re-run targeted sessions.
5. Re-run full `bash frozen/score.sh` after each stable improvement.
6. If scoring overlays touched frozen surfaces, restore them before staging or committing.

## Session Ladder (fastest path to first passes)

### Stage 1: First pass ASAP
Target:
- `seed8000-tourist-starter`

Focus:
- Fix screen parity/capture timing for startup + early movement.
- Keep existing RNG parity intact while fixing display pipeline.

Exit criteria:
- `seed8000-tourist-starter` fully passes (P+S).

### Stage 2: Remove startup hardcoding (high leverage)
Targets:
- `seed0077-rogue-chargen`
- `seed0102-ranger-name-cancel`
- `seed0101-ranger-quiver-throw-travel-engrave`

Focus:
- Replace `fastforward_pre_mklev` / `fastforward_post_mklev` with real startup/chargen flow.
- Implement real role/race/gender/align handling from `nethackrc`.
- Port init paths (`o_init`, dungeon init, `u_init`, inventory/attributes init) instead of replayed RNG calls.

Exit criteria:
- Chargen sessions produce matching RNG prefixes across multiple roles.
- No startup RNG replay lists required.

### Stage 3: Core turn engine + movement parity
Targets:
- `seed1500-rogue-explore-move`
- `seed0900-tourist-explore-actions`
- `seed1150-caveman-explore-move`
- `seed0700-samurai-explore-descend`

Focus:
- Replace `fastforward_step` with real per-turn game logic.
- Port movement blockers, door interactions, vision refresh, status/message timing.
- Ensure frame capture happens exactly at each input boundary.

Exit criteria:
- Movement/exploration sessions begin passing without session-specific branches.

### Stage 4: Command families by coverage
Targets:
- `seed0060-orc-rogue-kick-search`
- `seed1800-tourist-eat-throw`
- `seed2200-wizard-quaff-zap-read`
- `seed0501-priest-cast-read-turn`
- `seed0106-priest-extcmd-sweep`
- `seed0108-wizard-extcmd-wishlist`

Focus:
- Port command dispatch and handlers (`rhack` family) in C order.
- Implement inventory/menu/prompt behavior and command side effects.
- Validate both RNG sequence and emitted messages/screens.

Exit criteria:
- At least one passing session per command family, then full family sweep.

### Stage 5: World generation + advanced systems
Targets:
- Tour/coverage/hallucination/stress sessions (`seed0360+`, `seed0383`, `seed0399`, `seed4500`, `seed5002`, `seed5006`)

Focus:
- Replace remaining mklev/object/monster/trap stubs with faithful ports.
- Implement display RNG and Lua RNG contexts where needed.
- Handle multi-segment state (`save/restore`, bones chain cases).

Exit criteria:
- Public score climbs through long and high-coverage sessions.

## Parallel Workstreams

### A) Differential tooling
- Add scripts that print first RNG mismatch index + call pair and first screen mismatch frame.
- Track per-session progress snapshots to avoid regressions.

### B) Port ledger
- For each JS function, record upstream C source/function reference.
- Mark status: `stub`, `partial`, `ported`, `verified`.
- Use this ledger to choose next highest-leverage port work.

### C) Regression gates
- Fast gate: 3-5 representative sessions.
- Medium gate: 10-15 varied sessions.
- Full gate: all 44 public sessions before push.

## Architectural Rules (to win Phase 2 too)
- No seed/session conditionals in game logic.
- Delete `fastforward.js` incrementally as real code lands.
- Preserve deterministic ordering of RNG-relevant operations.
- Prefer direct C-to-JS transliteration for critical subsystems first; refactor only after parity.
- Treat frozen/overlay files as read-only and exclude them from feature edits.

## Commit and Push Cadence
1. Commit often, including partial progress commits even when no new sessions pass.
2. Before every commit, verify this plan is still current; update `ai/PLAN.md` if priorities changed.
3. Push only when at least one targeted session improved and gated regressions are clear.
4. Maintain a changelog of which sessions/features each commit is intended to unlock.

## Immediate Next Actions
1. Replace startup RNG replay with real chargen/init paths (`seed0077`, `seed0102` as primary checks).
2. Use first-mismatch tooling on chargen-heavy sessions to identify the first real startup divergence.
3. Start deleting `fastforward_pre_mklev` / `fastforward_post_mklev` calls as corresponding C init functions are ported.
