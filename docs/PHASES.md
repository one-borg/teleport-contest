# Two-phase contest mechanics

The contest runs in two phases, intentionally separated to test
generalization rather than just hand-tuning.

## Phase 1 — Foundation

| | |
|---|---|
| **Target** | NetHack 5.0 (released May 2, 2026 — first major version bump since 3.0 in 1989; 46 years into the game's history) |
| **Open** | (announce date) |
| **Deadline** | Sunday Nov 29, 2026 (the Sunday after US Thanksgiving), 00:00 UTC |
| **Scoring** | Standard P+S parity against 88 sessions (44 public and 44 held-out) |
| **Qualification** | Top 10 teams by total session-pass count qualify for Phase 2 |

### Session difficulty escalation

The contest opens in May 2026 with a preliminary held-out set. **If
top scores cluster too tightly to distinguish entrants, the judges
will release additional, harder held-out sessions over the summer**
(deeper dungeon levels, more subsystems exercised, more multi-segment
save/restore chains, rarer monsters and items). New sessions are
added to the held-out pool and re-scored across all submissions; they
do not retroactively invalidate prior passes, they just create more
room at the top of the leaderboard.

Public sessions are not changed by escalation — they remain the
fixed self-test set you score against locally.

### Phase 1 freeze

At the deadline, the judge takes a `git tag phase1/<owner>/<sha>`
snapshot of every fork's HEAD. That tag is immutable and serves as
the diff baseline for Phase 2 scoring.

### Phase 1 winners

Final Phase 1 leaderboard is announced Nov 30. Top 10 invited to
continue. (Everyone else can keep submitting after Phase 1 closes,
but only the top 10 compete in Phase 2.)

## Phase 2 — Generalization

| | |
|---|---|
| **Target** | "5.1" — chosen by judges Nov 30. Could be: a real upstream NetHack release after 5.0; a designated post-5.0 commit on the upstream master; or a specific patch set the judges curate. |
| **Diff penalty formula** | Announced Nov 30. Likely shape: `final_score = ps_score / (1 + lines_changed_in_js / N)`, where `N` is tuned for fairness. Comment-only changes don't count; `frozen/` doesn't count. |
| **Open** | Nov 30, 2026 (target announcement) |
| **Deadline** | Dec 31, 2026, 00:00 UTC |
| **Scoring** | P+S parity against new 5.1 sessions (also 88 sessions, mix of public + held-out), divided by the diff penalty |

### How the diff is measured

The judge runs `git diff phase1/<your-tag> HEAD -- 'js/**' \
  ':(exclude)js/isaac64.js' ':(exclude)js/terminal.js' \
  --numstat` and sums added + deleted lines. Whitespace-only and
comment-only changes are normalized out.

A team that re-runs their LLM pipeline on 5.1 and gets a small
diff will out-score a team that hand-tweaks dozens of files to
match.

### Final ranking

Final Phase 2 leaderboard published Jan 2027. Highest combined
P+S/diff score wins.

## Spotlights and Best-Method award

Throughout both phases, the judges can spotlight any team's
pipeline writeup on the public leaderboard. After Phase 2, a
separate **Best Method** award is judged on the quality and
reproducibility of the writeup — independent of where you placed in
the parity ranking. The goal: capture and share the actual
techniques that worked.

## What "public source code" means

All forks are public on GitHub. Anyone can read your code, your
prompts, your agent harness. That's by design — the contest's
hypothesis is that **the magic is in the LLM methods, not the
code**. If your method is so good it produces winning code, sharing
the code doesn't compromise your method.

If you'd rather not show your work in public, this isn't your
contest.

## What if 5.1 doesn't ship?

Plan A: real upstream 5.1 by Nov 30 → that's the target.

Plan B: judges designate a specific upstream commit after 5.0 as the
"5.1 surrogate" — real C-source changes, just not branded as a
release.

Plan C: judges hand-curate a small patch set (rename a function,
swap a constant, change one RNG call site) and apply it on top of
5.0. Most artificial, but always available as a backstop.

Decision happens Nov 30 alongside the target announcement.

## Eligibility & conduct

- **No collusion between teams.** Each entry must be the work of one
  team (one or more people).
- **Fork hygiene:** only your fork's `js/`, `package.json`, and
  `index.html` count toward judging. Anything else (build configs,
  CI tweaks, README) is yours to play with.
- **Anti-cheat:** the judge runs your code in a sandbox that denies
  filesystem writes, network access, child processes, and worker
  threads. The contestant API receives only `{seed, datetime,
  nethackrc, moves}` per segment — never the recorded answer key.
  Don't try to circumvent; you'll just lose points.
- **Disqualification:** the judges reserve the right to disqualify
  any submission that violates the spirit of the contest
  (intentional cheating, plagiarism, harassment of other teams).
