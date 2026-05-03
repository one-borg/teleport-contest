# The Teleport Coding Challenge

*A guide to porting the Mazes of Menace from C to JavaScript, for
adventurers traveling with a small swarm of LLM coding assistants.*

NetHack is one of the longest-lived and most peculiar open source
programs ever written. After 46 years of continuous development —
tracing its lineage from Rogue (1980) to Hack (1982) to NetHack —
v5.0 just shipped: the first major version bump since 3.0 in 1989.
That's 442,901 lines of C and Lua to port. The dungeon is deep and
the corridors twist.

Your task, should you choose to accept it, is to fork this repository
and produce a JavaScript implementation whose external behavior is
*indistinguishable* from upstream NetHack 5.0. Bit-exact. Same PRNG
sequence, same terminal output, frame for frame, byte for byte, all
the way down to which random newt corpse you trip over on Dlvl 3.

You may use any tools you can muster: AI agents, hand-coding,
transpilers, monks chanting in caves. The contest's hypothesis is
that **the magic is in the LLM methods, not the code itself**. If
your method works, sharing the code costs you nothing. If it doesn't,
no one was going to copy your code anyway.

*You feel deep wisdom for a moment. You hear bubbling water somewhere
in the distance.* Let's begin.

## How

1. **Fork this repo.** It's a playable NetHack skeleton with the PRNG
   and terminal already wired up. The `js/` directory contains the
   game logic — almost none of it, in fact. That's the point.
2. **Read the C.** The full NetHack 5.0 source lives upstream at
   [NetHack/NetHack](https://github.com/NetHack/NetHack) (tag
   `NetHack-5.0.0_Release`, also pulled in here as a submodule at
   `nethack-c/upstream/`). Read it. Implement the equivalent in
   `js/`. Faithfully — including its bugs, its quirks, and its
   forty-six years of accumulated tradition.
3. **Push.** GitHub Actions on your fork scores you on every push
   against 44 public sessions — fast feedback in your own Actions
   minutes. Every six hours, the official judge re-scores the
   latest commit on every fork against all 88 sessions (44 public
   and 44 held-out) and updates the leaderboard.
4. **Climb.** Both up the leaderboard, and metaphorically toward
   the Amulet of Yendor. Mostly the leaderboard.

## Quick start

```bash
gh repo fork davidbau/teleport-contest --clone --remote
cd teleport-contest
git submodule update --init    # pulls in nethack-c/upstream

# Play the skeleton in your browser
python3 -m http.server 8000
# then open http://localhost:8000/

# Score locally against all 44 public sessions
bash frozen/score.sh
```

The skeleton passes `seed8000-tourist-starter` out of the box. That's
your hello world. The other 87 sessions await.

## What's in this repo

Three things, layered like the Dungeons of Doom themselves.

### 1. A skeleton port of NetHack 5.0

A minimal JavaScript implementation that does just enough to play
through one short tourist game (`seed8000-tourist-starter`) and not
much more. Think of it as the surface layer: gentle, well-mapped, and
populated almost entirely with grid bugs. You will have to dig.

**Where the code lives:**

```
js/
├── jsmain.js          ← contest entry point; exports runSegment
├── isaac64.js         ← FROZEN: canonical PRNG engine. Don't touch.
├── terminal.js        ← FROZEN: 24×80 grid + serialize(). Don't touch.
├── rng.js             ← PRNG wrappers (rn2, rnd, d, …). Edit freely.
├── nethack.js         ← top-level NetHack class. Mostly a stub.
├── const.js           ← 2,000+ constants imported from upstream headers.
├── allmain.js         ← the move loop. Currently very polite.
├── cmd.js             ← command dispatch. Knows about ~5 commands.
├── display.js         ← screen rendering. Renders some things.
├── mklev.js           ← level generation. Almost entirely unwritten.
├── input.js           ← input handling. Partially wired.
└── …
```

**Run it locally:**

```bash
python3 -m http.server 8000   # any static server works
open http://localhost:8000/
```

You will be greeted by a NetHack chargen prompt. Pick a tourist
(the skeleton hasn't met the other twelve roles yet — they may seem
strange to it). Move around a few squares. Watch your `js/jsmain.js`
get exercised in real time.

**A brief tour:** start in `js/jsmain.js` to see the contest API
entry point, then follow the call chain into `js/nethack.js` →
`js/allmain.js` → `js/cmd.js`. The actual game logic to fill in is
mostly under `js/mklev.js`, `js/cmd.js`, and a long list of files that
don't exist yet but need to (`js/mon.js`, `js/dog.js`, `js/spell.js`,
etc. — a complete NetHack port has on the order of 80 source files).

The skeleton is "what works without porting much." Everything beyond
is yours to build. *Be careful, ahead.*

### 2. Patches that make C NetHack reproducible

NetHack as shipped is a wonderfully nondeterministic program. It
seeds its PRNG from the system clock. It calls `time(NULL)` for moon
phase, hire dates, and shopkeeper greetings ("Hello stranger" varies
with the hour you visit). It uses the platform's `qsort`, whose
tie-breaking varies by libc. It writes to ncurses, not a captured
stream you can compare. None of this is a bug; it's how NetHack has
always behaved. If you played twice in a row at exactly midnight on a
full moon, the dungeon would helpfully cooperate to make sure you
noticed.

For the contest to score "did your JS produce the same behavior as
C," the C side has to behave the same way every time you run it.
That takes eight small patches, all in `nethack-c/patches/`:

| # | What | Why |
|---|---|---|
| 001 | Pin date/time + RNG seed via env vars | Time-of-day affects everything from moon phase to which line the shopkeeper greets you with |
| 002 | Replace `qsort` with a stable sort | Tie-breaking order varies by libc, scrambling the order of monsters and objects |
| 003 | Log every core PRNG call (`rn2`/`rnd`/`d`/...) | First of three PRNG contexts the port must reproduce |
| 004 | Tag Lua-side PRNG calls with their source location | Lua scripts (special levels) use the same PRNG, and we need to know which call is which |
| 005 | Log the third PRNG context (display/hallucination) | Hallucination uses a separate stream so it doesn't perturb gameplay PRNG |
| 006-008 | Replace tty curses with deterministic 24×80 frame capture | We need exact terminal contents at every input boundary |

Yes, NetHack has **three independent PRNG contexts** — core gameplay,
Lua-script (for special levels), and display (for hallucination
effects). Your JS port has to reproduce all three, in the right
order, with the right values. PRNG parity is the foundation: a
single off-by-one RNG call cascades through the entire dungeon and
nothing else can match. But getting the random numbers right doesn't
get you the screens — that's a separate, harder problem. The screens
are where most of NetHack actually lives: the message line, the map
draws, the inventory menus, the prompts, the cursor dance, the
forty-six years of accumulated terminal handling. Most contestants'
time will be spent there.

**Build the recorder:**

```bash
git submodule update --init nethack-c/upstream
bash nethack-c/build-recorder.sh
```

This pulls upstream NetHack 5.0 (the same source that ships from
github.com/NetHack/NetHack at tag `NetHack-5.0.0_Release`), applies
the eight patches, and builds the recorder under `nethack-c/recorder/`
(gitignored). You don't need to do this to enter the contest — the
recorded sessions are already in `sessions/`. You only need to build
the recorder if you want to record your own debugging delvings.

**Why clang specifically:** C's argument evaluation order is
officially undefined. In practice, gcc evaluates right-to-left and
clang evaluates left-to-right. A single innocent line like
`d(rn2(5), rn2(3))` consumes RNG calls in opposite orders depending
on the compiler — completely scrambling the entire PRNG sequence.
We pin to clang so the recorder's behavior is reproducible across
machines, and the JS port (which evaluates left-to-right) can match
it. *If you build with gcc, your dungeon will look correct but every
random number will be wrong. You sense the presence of an unfortunate
compiler.*

### 3. A pile of recorded delvings to score against

Forty-four recorded sessions live in `sessions/` as `*.session.json`.
Each is a complete game (or a chain of games) played from chargen to
wherever it ended, with the PRNG sequence and screen output of the C
recorder captured at every input boundary. They are the standard
against which your port is measured: same input, same output, or you
fail.

**Run them locally:**

```bash
bash frozen/score.sh                             # score all 44
node frozen/ps_test_runner.mjs sessions/seed8000-tourist-starter.session.json
                                                 # score one
```

You'll get a report like:

```
seed8000-tourist-starter        PASS  RNG: 22/22       Screen: 23/23
seed0007-rogue-snake-swamp      FAIL  RNG: 391/3706 (10.5%)   div@392
…
```

A session **passes** when both PRNG and screen match 100%. Less than
that is a failure, no matter how close. The dungeon does not award
partial credit.

**Your real score uses more than these.** The judge — running
privately, every six hours — re-scores your fork against all 88
sessions: the 44 public ones above PLUS 44 held-out sessions you
never see. Held-out sessions are how the contest distinguishes
"hardcoded the test cases" from "actually ported NetHack." They
exercise the same engine the public sessions do, but with different
seeds, different roles, different divergences. If you've built a
faithful port, they pass; if you've memorized the public set, they
do not.

If top scores cluster too tightly to distinguish the strongest
entrants, additional and harder held-out sessions will be added over
the summer (see `docs/PHASES.md`). Plan accordingly.

**The 6-hour cron:** the judge auto-discovers every fork of
`davidbau/teleport-contest` on GitHub. When you push to your fork,
the next cron firing (within six hours) will pick up your latest
commit and score it. Your row on the leaderboard at
[mazesofmenace.ai](https://mazesofmenace.ai/leaderboard/) updates
shortly after.

You don't need to do anything special to "submit." Forking and pushing
is the entire protocol. There is no application form, no submission
button, no email to send. The dungeon notices when you arrive.

*Welcome to NetHack. Good luck, and have fun.*

## The Teleport Contest

### Scoring API

Your fork must export `runSegment(input, prevGame=null)` from
`js/jsmain.js`. The full contract is in [`docs/API.md`](docs/API.md);
the short version is that for each game segment, you receive a seed,
a datetime, an `OPTIONS=…` rc-text blob, and a string of keys. You
return an object whose `getScreens()`, `getRngLog()`, and
`getCursors()` methods can be read back at the end. The recorded
ground truth is never passed in. You can't peek at the answer key.
You have to actually port the game.

Two channels are scored, both required:

- **P (PRNG):** every `rn2`/`rnd`/`d`/`rn1`/`rne`/`rnz`/`rnl` call
  must return the same value in the same order as C.
- **S (Screen):** the 24×80 terminal output at each input boundary
  must match C's display, byte-for-byte (after a small charset and
  SGR canonicalization that forgives the terminal's many ways of
  saying "draw a space").

A session passes when both P and S match 100%. Your score is the
count of passing sessions. The dungeon, again, does not award partial
credit.

### What's frozen

Two files in your fork are overlaid from the canonical copy before
every scoring run:

| File | Why frozen |
|---|---|
| `js/isaac64.js` | The canonical PRNG. Without this, anyone could fake any RNG sequence trivially. |
| `js/terminal.js` | The canonical 24×80 grid. Defines what counts as "the screen" — which is itself a non-trivial question once you start thinking about it. |

That is the entire fixed surface. Everything else in `js/` —
including `jsmain.js`, `rng.js`, `display.js`, `const.js` — is yours
to edit, replace, or restructure. Burn the skeleton down and
rebuild it if that helps you. (Many roles have done so. Few have
ascended.)

### Rules

- **Any approach is allowed.** LLM agents, manual coding, hybrid,
  transpilers, the aforementioned chanting monks — whatever produces
  the right output. The two-phase design specifically rewards
  generalization, so handcrafted solutions face strong headwind in
  Phase 2.
- **Submissions must be JavaScript.** ES6 modules, runnable in
  Node 22+ and modern Chrome. No build step required. No native
  addons.
- **Frozen files cannot be modified.** The judge overlays them on
  every scoring run, so editing them locally only fools your local
  score, not the leaderboard.
- **Sandboxed scoring.** Your code runs in a Node child process with
  `--permission` and a minimal `--allow-fs-read` whitelist: no file
  writes, no network sockets, no `child_process`, no native addons.
  Don't try to escape the sandbox. The dungeon has lived through
  better attempts than yours.
- **Public source code.** All forks are public on GitHub. Anyone can
  read your code, your prompts, your agent harness. That's by design.
  If your method is so good it produces winning code, sharing the
  code doesn't compromise your method. If you'd rather not show your
  work in public, this isn't your contest.

### Two phases

This is a journey in two parts.

**Phase 1 — Foundation.** Deadline Sunday Nov 29, 2026 (00:00 UTC,
the Sunday after US Thanksgiving). A standard parity contest against
NetHack 5.0. Top 10 teams by score qualify for Phase 2. Everyone
else is welcome to keep submitting after the deadline, but only the
top 10 compete in the second phase.

**Phase 2 — Generalization.** Target announced Nov 30; deadline
Dec 31, 2026 (00:00 UTC). The judges pick a "5.1" — a slightly newer
C codebase, perhaps a real upstream release, perhaps a designated
post-5.0 commit, perhaps a small judge-curated patch set. Your Phase
2 score is parity against 5.1, **divided by** a penalty proportional
to how much you changed your `js/` from your Phase 1 submission.

The point: hand-tuned ports get crushed by 5.1 because they overfit
to the exact 5.0 code paths. Methods that generalize win. Or, in
NetHack terms: the player who memorized the layout of the Castle
does not necessarily survive Gehennom.

Full mechanics in [`docs/PHASES.md`](docs/PHASES.md).

## Prizes

- **Top 10 from Phase 1** — qualification for Phase 2 and a
  spotlight on the leaderboard.
- **Phase 2 winner** — highest combined parity-divided-by-diff score
  against the 5.1 target. Bragging rights, durable place on the
  leaderboard, and the satisfaction of having ported NetHack twice.
- **Best Method award** — judged separately on the quality and
  reproducibility of your team's writeup. You don't need to win
  Phase 2 outright to win the method prize. The contest's long-term
  value is the techniques people share, not the ranking.
- **Spotlights** — throughout both phases, judges may spotlight any
  team's pipeline writeup on the leaderboard. Write up your agent
  harness, your prompts, your evaluation loop, the parts that
  surprised you, the parts you would do differently — link from your
  fork's README and we'll feature the most interesting ones.

## Leaderboard

**[mazesofmenace.ai](https://mazesofmenace.ai/)**

Updates every six hours. Public scores recompute on every push;
held-out scores update when the cron fires. The official upstream
skeleton is included as a baseline reference, currently scoring
0/88 — the floor from which everyone climbs. (For now.)

## Questions

Open an issue on this repo, or check the docs:

- [`docs/API.md`](docs/API.md) — the full `runSegment` contract,
  scoring mechanics, screen comparator, sandbox details
- [`docs/PHASES.md`](docs/PHASES.md) — two-phase mechanics,
  diff-penalty formula, summer-escalation policy
- [`nethack-c/README.md`](nethack-c/README.md) — building the
  recorder, the env-var protocol, what each patch does

---

*You die...*

Just kidding. Nobody dies in this contest. The worst that happens is
the leaderboard says 0/88 for a while. That's also where everyone
starts.

*Welcome to NetHack.*
