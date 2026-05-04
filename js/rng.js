// rng.js — PRNG wrappers around ISAAC64.
// C ref: rng.c — three RNG contexts: core, display, lua.
// Contest: only core context is used for parity.

import { isaac64_init, isaac64_next_uint64 } from './isaac64.js';
import { game } from './gstate.js';

let _rngLog = [];
let _rngLogEnabled = false;
let _rngTraceIndex = null;

if (typeof process !== 'undefined' && process?.env?.RNG_TRACE_INDEX) {
    const idx = Number(process.env.RNG_TRACE_INDEX);
    if (Number.isFinite(idx) && idx >= 0) _rngTraceIndex = idx;
}

function maybeTrace(entry) {
    if (_rngTraceIndex === null) return;
    if (_rngLog.length - 1 !== _rngTraceIndex) return;
    const hit = { index: _rngTraceIndex, entry, stack: new Error().stack };
    if (!game._rngTraceHits) game._rngTraceHits = [];
    game._rngTraceHits.push(hit);
}

export function initRng(seed) {
    game.currentSeed = seed;
    // Convert seed to 8 little-endian bytes
    let s = BigInt(seed) & 0xFFFFFFFFFFFFFFFFn;
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        bytes[i] = Number(s & 0xFFn);
        s >>= 8n;
    }
    game.coreCtx = isaac64_init(bytes);
    _rngLog = [];
}

export function enableRngLog() { _rngLogEnabled = true; _rngLog = []; }
export function getRngLog() { return _rngLog; }
export function pushRngLogEntry(entry) { if (_rngLogEnabled) _rngLog.push(entry); }

function RND(x) {
    const val = isaac64_next_uint64(game.coreCtx);
    return Number(val % BigInt(x));
}

// C ref: rn2(x) — random number 0..x-1
export function rn2(x) {
    if (x <= 0) return 0;
    const val = RND(x);
    if (_rngLogEnabled) {
        const entry = `rn2(${x})=${val}`;
        _rngLog.push(entry);
        maybeTrace(entry);
    }
    return val;
}

// C ref: rnl(x) — 0..x-1 with Luck adjustment, logged as rnl().
export function rnl(x) {
    if (x <= 0) return 0;
    let adjustment = game.u?.uluck || 0;
    if (x <= 15) {
        const absAdj = Math.abs(adjustment);
        adjustment = Math.trunc((absAdj + 1) / 3) * Math.sign(adjustment);
    }
    let i = RND(x);
    if (adjustment) {
        const roll = Number(isaac64_next_uint64(game.coreCtx) % BigInt(37 + Math.abs(adjustment)));
        if (roll !== 0) {
            i -= adjustment;
            if (i < 0) i = 0;
            else if (i >= x) i = x - 1;
        }
    }
    if (_rngLogEnabled) {
        const entry = `rnl(${x})=${i}`;
        _rngLog.push(entry);
        maybeTrace(entry);
    }
    return i;
}

// C ref: rnd(x) — random number 1..x
export function rnd(x) {
    if (x <= 0) return 0;
    const val = RND(x) + 1;
    if (_rngLogEnabled) {
        const entry = `rnd(${x})=${val}`;
        _rngLog.push(entry);
        maybeTrace(entry);
    }
    return val;
}

// C ref: rn1(x, y) — random number y..y+x-1
export function rn1(x, y) { return rn2(x) + y; }

// C ref: d(n, x) — roll n dice of x sides
export function d(n, x) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += RND(x) + 1;
    if (_rngLogEnabled) {
        const entry = `d(${n},${x})=${sum}`;
        _rngLog.push(entry);
        maybeTrace(entry);
    }
    return sum;
}

// C ref: rne(x) — exponentially distributed
export function rne(x) {
    const ulevel = game.u?.ulevel || 1;
    const utmp = ulevel < 15 ? 5 : Math.trunc(ulevel / 3);
    let tmp = 1;
    while (tmp < utmp && !rn2(x)) tmp++;
    if (_rngLogEnabled) {
        const entry = `rne(${x})=${tmp}`;
        _rngLog.push(entry);
        maybeTrace(entry);
    }
    return tmp;
}

// C ref: rnz(i) — fuzzy random around i
export function rnz(i) {
    let x = i;
    let tmp = 1000;
    tmp += rn2(1000);
    tmp *= rne(4);
    if (rn2(2)) { x *= tmp; x = Math.trunc(x / 1000); }
    else { x *= 1000; x = Math.trunc(x / tmp); }
    if (_rngLogEnabled) {
        const entry = `rnz(${i})=${x}`;
        _rngLog.push(entry);
        maybeTrace(entry);
    }
    return x;
}

export const c_d = d;
export const lua_d = d;
