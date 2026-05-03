#!/bin/bash
# score.sh — Run PS (PRNG + Screen) scoring against public sessions.
# Usage: bash score.sh [session_dir]
#
# This is the contest scoring script. It compares your JS implementation
# against recorded C sessions, checking:
#   P (PRNG): Every RNG call must match C's sequence exactly
#   S (Screen): Terminal output at each input boundary must match
#
# Results are printed to stderr (human-readable) and stdout (JSON).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSIONS_DIR="${1:-$PROJECT_ROOT/sessions}"

# Overlay frozen infrastructure files. The contest fixture is
# ISAAC64 (canonical PRNG) and Terminal (24x80 grid that the judge
# reads back). Everything else — including const.js, display.js,
# game_display.js, and the rest of js/ — is contestant-owned.
cp "$SCRIPT_DIR/isaac64.js" "$PROJECT_ROOT/js/isaac64.js" 2>/dev/null || true
cp "$SCRIPT_DIR/terminal.js" "$PROJECT_ROOT/js/terminal.js" 2>/dev/null || true

exec node "$SCRIPT_DIR/ps_test_runner.mjs" "$SESSIONS_DIR"
