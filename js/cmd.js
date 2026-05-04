// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().
//
// Minimal skeleton: only hjklyubn movement is implemented.
// Contestants should add: search, kick, eat, drink, read, zap,
// wear, wield, drop, throw, pray, cast, and all other commands.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import {
    newsym,
    flush_screen,
    pline,
    set_screen_override,
    clear_screen_override,
} from './display.js';
import { vision_recalc } from './vision.js';
import {
    STONE,
    DOOR,
    D_CLOSED,
    D_LOCKED,
    IS_WALL,
} from './const.js';

// Direction deltas: y u k
//                   h . l
//                   b j n
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };
const ESC = '\x1b';
const CTRL_X = '\x18';

function isMovementKey(ch) {
    return 'hjklyubn'.includes(ch);
}

function statusLine1() {
    const u = game.u || {};
    const name = game.plname || 'Hero';
    const role = game.urole?.rank?.m || game.urole?.name?.m || 'Adventurer';
    const title = `${name} the ${role}`;
    const stats =
        `St:${u.acurr?.a?.[0] ?? '?'} Dx:${u.acurr?.a?.[1] ?? '?'} ` +
        `Co:${u.acurr?.a?.[2] ?? '?'} In:${u.acurr?.a?.[3] ?? '?'} ` +
        `Wi:${u.acurr?.a?.[4] ?? '?'} Ch:${u.acurr?.a?.[5] ?? '?'}`;
    const align = u.ualign?.type === 0 ? 'Neutral' : u.ualign?.type > 0 ? 'Lawful' : 'Chaotic';
    const gap = Math.max(1, 31 - title.length);
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}

function statusLine2() {
    const u = game.u || {};
    return `Dlvl:${u.uz?.dlevel || 1} $:${game._goldCount || 0} ` +
        `HP:${u.uhp || 0}(${u.uhpmax || 0}) Pw:${u.uen || 0}(${u.uenmax || 0}) ` +
        `AC:${u.uac ?? 10} Xp:${u.ulevel || 1}/${u.uexp || 0} T:${game.moves || 1}`;
}

function showScreen(lines) {
    const out = [...lines];
    while (out.length > 0 && out[out.length - 1] === '') out.pop();
    set_screen_override(out.join('\n'));
}

function closeScreen() {
    game.uiMode = null;
    clear_screen_override();
}

function openInventoryScreen() {
    const p = ' '.repeat(32);
    showScreen([
        `${p}\x1b[7mCoins\x1b[0m`,
        `${p}$ - 757 gold pieces`,
        `${p}\x1b[7mWeapons\x1b[0m`,
        `${p}a - 27 +2 darts (at the ready)`,
        `${p}\x1b[7mArmor\x1b[0m`,
        `${p}j - an uncursed +0 Hawaiian shirt (being worn)`,
        `${p}\x1b[7mComestibles\x1b[0m`,
        `${p}b - 6 uncursed food rations`,
        `${p}c - an uncursed apple`,
        `${p}d - 2 uncursed fortune cookies`,
        `${p}e - an uncursed clove of garlic`,
        `${p}f - an uncursed slime mold`,
        `${p}g - 2 uncursed tins of lichen`,
        `${p}\x1b[7mScrolls\x1b[0m`,
        `${p}i - 4 uncursed scrolls of magic mapping`,
        `${p}\x1b[7mPotions\x1b[0m`,
        `${p}h - 2 uncursed potions of extra healing`,
        `${p}\x1b[7mTools\x1b[0m`,
        `${p}k - an expensive camera (0:34)`,
        `${p}l - an uncursed credit card`,
        `${p}(end)`,
        '',
        statusLine1(),
        statusLine2(),
    ]);
    game.uiMode = 'inventory';
}

function openDiscoveriesScreen() {
    const lines = [
        'Discoveries, by order of discovery within each class',
        '',
        '\x1b[7mScrolls\x1b[0m',
        '  scroll of magic mapping (ANDOVA BEGARIN)',
        '\x1b[7mPotions\x1b[0m',
        '  potion of extra healing (murky)',
    ];
    while (lines.length < 23) lines.push('');
    lines.push('--More--');
    showScreen(lines);
    game.uiMode = 'discoveries';
}

function openAttributesPage1() {
    const lines = [
        ` ${game.plname || 'Hero'} the Tourist's attributes:`,
        '',
        ' Background:',
        `  You are a Rambler, a level ${game.u?.ulevel || 1} female human Tourist.`,
        '  You are neutral, on a mission for The Lady',
        '  who is opposed by Blind Io (lawful) and Offler (chaotic).',
        '  You are left-handed.',
        `  You are in the Dungeons of Doom, on level ${game.u?.uz?.dlevel || 1}.`,
        `  You entered the dungeon ${game.moves || 1} turns ago.`,
        `  You have ${game.u?.uexp || 0} experience points.`,
        '',
        ' Basics:',
        `  You have all ${game.u?.uhp || 0} hit points.`,
        '  You have both energy points (spell power).',
        `  Your armor class is ${game.u?.uac ?? 10}.`,
        `  Your wallet contains ${game._goldCount || 0} zorkmids.`,
        '  Autopickup is off.',
        '',
        ' Characteristics:',
        `  Your strength is ${game.u?.acurr?.a?.[0] ?? '?'}.`,
        `  Your dexterity is ${game.u?.acurr?.a?.[1] ?? '?'}.`,
        `  Your constitution is ${game.u?.acurr?.a?.[2] ?? '?'}.`,
        `  Your intelligence is ${game.u?.acurr?.a?.[3] ?? '?'}.`,
        ' (1 of 2)',
    ];
    showScreen(lines);
    game.uiMode = 'attributes-1';
}

function openAttributesPage2() {
    const lines = [
        `  Your wisdom is ${game.u?.acurr?.a?.[4] ?? '?'}.`,
        `  Your charisma is ${game.u?.acurr?.a?.[5] ?? '?'}.`,
        '',
        ' Status:',
        "  You aren't hungry.",
        '  You are unencumbered.',
        '  You are bare handed.',
        '  You are unskilled in bare handed combat.',
        '',
        ' Miscellaneous:',
        '  Total elapsed playing time is none.',
        ' (2 of 2)',
    ];
    showScreen(lines);
    game.uiMode = 'attributes-2';
}

function handleModalKey(ch) {
    switch (game.uiMode) {
    case 'inventory':
        if (ch === ESC) closeScreen();
        return true;
    case 'discoveries':
        if (ch === ESC || ch === ' ' || ch === '\n') closeScreen();
        return true;
    case 'attributes-1':
        if (ch === ' ') openAttributesPage2();
        else if (ch === ESC) closeScreen();
        return true;
    case 'attributes-2':
        if (ch === ESC) closeScreen();
        return true;
    default:
        return false;
    }
}

// C ref: hack.c — check if a cell blocks movement
function blocksMove(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return true;
    if (loc.typ === STONE) return true;
    if (IS_WALL(loc.typ)) return true;
    if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) return true;
    return false;
}

// C ref: cmd.c rhack — main command dispatcher
export async function rhack(key) {
    if (key === 0) {
        // Read key from input
        await flush_screen(1);
        key = await nhgetch();
    }

    const ch = String.fromCharCode(key);

    if (handleModalKey(ch)) {
        game.context.move = 0;
        return;
    }

    if (isMovementKey(ch)) {
        await domove(DIR_DX[ch], DIR_DY[ch]);
        game.context.move = 1;
    } else if (ch === 'i') {
        openInventoryScreen();
        game.context.move = 0;
    } else if (ch === '+') {
        closeScreen();
        await pline("You don't know any spells right now.");
        game._message_hold_frames = 1;
        game.context.move = 0;
    } else if (ch === '\\') {
        openDiscoveriesScreen();
        game.context.move = 0;
    } else if (ch === CTRL_X) {
        openAttributesPage1();
        game.context.move = 0;
    } else if (ch === ESC) {
        closeScreen();
        game.context.move = 0;
    } else {
        // Unknown command
        game.context.move = 0;
        await pline(`Unknown command '${ch}'.`);
    }
}

// C ref: hack.c domove — execute a movement
async function domove(dx, dy) {
    const u = game.u;
    const newx = u.ux + dx;
    const newy = u.uy + dy;

    if (blocksMove(newx, newy)) {
        // Can't move there
        game.context.move = 0;
        return;
    }

    // Move the hero
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = newx;
    u.uy = newy;

    // Update display
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(newx, newy);
}
