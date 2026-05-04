#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { pathToFileURL } from 'url';

const PROJECT_ROOT = process.cwd();

function isRngCall(entry) {
    return typeof entry === 'string' && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry);
}

function normalizeRng(entry) {
    return String(entry || '').replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
}

const STARTUP_VARIANT_LINES = [/Version\s+\d+\.\d+\.\d+[^\n]*/];

function canonSGR(s) {
    const ESC = '\x1b';
    let out = '';
    let fg = 39, bold = false, inverse = false, underline = false;
    let i = 0;
    while (i < s.length) {
        if (s[i] === ESC && s[i + 1] === '[') {
            let j = i;
            let tfg = fg, tbold = bold, tinv = inverse, tul = underline;
            let isSGR = true;
            while (isSGR && s[j] === ESC && s[j + 1] === '[') {
                let k = j + 2;
                const numStart = k;
                while (k < s.length && (s[k] === ';' || (s[k] >= '0' && s[k] <= '9'))) k++;
                if (k >= s.length || s[k] !== 'm') {
                    isSGR = false;
                    break;
                }
                const params = s
                    .slice(numStart, k)
                    .split(';')
                    .map(p => (p === '' ? 0 : parseInt(p, 10)));
                for (const p of params) {
                    if (p === 0) {
                        tfg = 39;
                        tbold = false;
                        tinv = false;
                        tul = false;
                    } else if (p === 1) tbold = true;
                    else if (p === 22) tbold = false;
                    else if (p === 4) tul = true;
                    else if (p === 24) tul = false;
                    else if (p === 7) tinv = true;
                    else if (p === 27) tinv = false;
                    else if ((p >= 30 && p <= 37) || p === 39) tfg = p;
                    else if (p >= 90 && p <= 97) tfg = p;
                }
                j = k + 1;
            }
            if (j > i) {
                if (tfg === 39 && !tbold && !tinv && !tul) {
                    if (fg !== 39 || bold || inverse || underline) out += ESC + '[0m';
                } else {
                    const parts = [];
                    const needReset = (!tbold && bold) || (!tinv && inverse) || (!tul && underline);
                    if (needReset) {
                        parts.push(0);
                        if (tbold) parts.push(1);
                        if (tinv) parts.push(7);
                        if (tul) parts.push(4);
                        if (tfg !== 39) parts.push(tfg);
                    } else {
                        if (tbold && !bold) parts.push(1);
                        if (tinv && !inverse) parts.push(7);
                        if (tul && !underline) parts.push(4);
                        if (tfg !== fg) parts.push(tfg);
                    }
                    if (parts.length) out += ESC + '[' + parts.join(';') + 'm';
                }
                fg = tfg;
                bold = tbold;
                inverse = tinv;
                underline = tul;
                i = j;
                continue;
            }
        }
        out += s[i];
        i++;
    }
    return out;
}

const DEC_TO_UNICODE = {
    '`': '\u25c6',
    a: '\u2592',
    f: '\u00b0',
    g: '\u00b1',
    j: '\u2518',
    k: '\u2510',
    l: '\u250c',
    m: '\u2514',
    n: '\u253c',
    q: '\u2500',
    t: '\u251c',
    u: '\u2524',
    v: '\u2534',
    w: '\u252c',
    x: '\u2502',
    y: '\u2264',
    z: '\u2265',
    '|': '\u2260',
    o: '\u23ba',
    s: '\u23bd',
    '{': '\u03c0',
    '~': '\u00b7',
};

function translateDecSpans(s) {
    let out = '';
    let dec = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\x0e') {
            dec = true;
            continue;
        }
        if (ch === '\x0f') {
            dec = false;
            continue;
        }
        if (ch === '\x1b' && s[i + 1] === '[') {
            const start = i;
            i += 2;
            while (i < s.length) {
                const c = s.charCodeAt(i);
                if (c >= 0x40 && c <= 0x7e) break;
                i++;
            }
            out += s.slice(start, i + 1);
            continue;
        }
        out += dec ? DEC_TO_UNICODE[ch] || ch : ch;
    }
    return out;
}

function normalizeScreen(s) {
    let cur = String(s || '');
    for (const re of STARTUP_VARIANT_LINES) cur = cur.replace(re, '<<VERSION_BANNER>>');
    cur = cur.replace(/^\d{2}:\d{2}:\d{2}\.$/gm, '<time>.');
    cur = canonSGR(cur);
    cur = cur.replace(/\x1b\[(\d+)C/g, (_, n) => ' '.repeat(parseInt(n, 10)));
    cur = translateDecSpans(cur);
    cur = cur.replace(/[\x0e\x0f]+$/gm, '');
    cur = cur.replace(/\x0f((?:\x1b\[[0-9;]*[a-zA-Z])*)$/gm, '$1');
    cur = cur.replace(/^\x0f( +\x0e)/gm, '$1');
    let prev;
    do {
        prev = cur;
        cur = cur.replace(/(\x1b\[[0-9;]*[a-zA-Z])\x0f/g, '\x0f$1');
        cur = cur.replace(/\x0e(\x1b\[[0-9;]*[a-zA-Z])/g, '$1\x0e');
        cur = cur.replace(/( +)\x0f/g, '\x0f$1');
        cur = cur.replace(/\x0e( +)/g, '$1\x0e');
        cur = cur.replace(/\x0e\x0f/g, '');
        cur = cur.replace(/\x0f\x0e/g, '');
    } while (cur !== prev);
    return cur;
}

function replayInputFor(segment) {
    return {
        seed: segment.seed,
        datetime: segment.datetime,
        nethackrc: segment.nethackrc,
        moves: segment.moves,
    };
}

function firstDiff(a, b, normalizer = x => x) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (normalizer(a[i] || '') !== normalizer(b[i] || '')) return i;
    }
    return -1;
}

function firstCharDiff(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) if ((a[i] || '') !== (b[i] || '')) return i;
    return -1;
}

function firstLineDiff(a, b) {
    const aLines = String(a || '').split('\n');
    const bLines = String(b || '').split('\n');
    const n = Math.max(aLines.length, bLines.length);
    for (let i = 0; i < n; i++) {
        if ((aLines[i] || '') !== (bLines[i] || '')) {
            return { lineIndex: i, expected: aLines[i] || '', actual: bLines[i] || '' };
        }
    }
    return null;
}

async function main() {
    const sessionPath = process.argv[2];
    if (!sessionPath) {
        console.error('Usage: node ai/scripts/first_mismatch.mjs <session-file>');
        process.exit(2);
    }

    const fullPath = sessionPath.startsWith('/')
        ? sessionPath
        : join(PROJECT_ROOT, sessionPath);
    const sessionData = JSON.parse(readFileSync(fullPath, 'utf8'));

    const { normalizeSession } = await import(pathToFileURL(join(PROJECT_ROOT, 'frozen/session_loader.mjs')).href);
    const { runSegment } = await import(pathToFileURL(join(PROJECT_ROOT, 'js/jsmain.js')).href);
    const segments = normalizeSession(sessionData).segments;

    const cRng = [];
    const cScreens = [];
    for (const seg of segments) {
        for (const step of seg.steps || []) {
            cRng.push(...(step.rng || []).filter(isRngCall));
            if (step.screen) cScreens.push(step.screen);
        }
    }

    let game = null;
    for (const seg of segments) game = await runSegment(replayInputFor(seg), game);

    const jsRng = (game.getRngLog() || []).map(e => e.replace(/^\d+\s+/, '')).filter(isRngCall);
    const jsScreens = game.getScreens() || [];

    const firstRngMismatch = firstDiff(cRng, jsRng, normalizeRng);
    const firstScreenMismatch = firstDiff(cScreens, jsScreens, normalizeScreen);
    const normExpected = firstScreenMismatch < 0 ? '' : normalizeScreen(cScreens[firstScreenMismatch]);
    const normActual = firstScreenMismatch < 0 ? '' : normalizeScreen(jsScreens[firstScreenMismatch] || '');
    const lineDiff = firstScreenMismatch < 0 ? null : firstLineDiff(normExpected, normActual);
    const charDiff = firstScreenMismatch < 0 ? -1 : firstCharDiff(normExpected, normActual);

    const result = {
        session: basename(fullPath),
        rng: {
            matchedPrefix: firstRngMismatch < 0 ? cRng.length : firstRngMismatch,
            total: cRng.length,
            firstMismatchIndex: firstRngMismatch,
            expected: firstRngMismatch < 0 ? null : cRng[firstRngMismatch],
            actual: firstRngMismatch < 0 ? null : jsRng[firstRngMismatch] || null,
        },
        screen: {
            matchedPrefix: firstScreenMismatch < 0 ? cScreens.length : firstScreenMismatch,
            total: cScreens.length,
            firstMismatchIndex: firstScreenMismatch,
            normalizedExpectedLength: normExpected.length,
            normalizedActualLength: normActual.length,
            firstCharDiff: charDiff,
            firstLineDiff: lineDiff,
            expectedPreview:
                firstScreenMismatch < 0
                    ? null
                    : normExpected.split('\n').slice(0, 4).join('\n'),
            actualPreview:
                firstScreenMismatch < 0
                    ? null
                    : normActual.split('\n').slice(0, 4).join('\n'),
        },
    };

    console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
    console.error(err?.stack || String(err));
    process.exit(1);
});
