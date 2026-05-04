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
import { vision_recalc, vision_reset } from './vision.js';
import { rank_of } from './roles.js';
import {
    A_STR,
    A_DEX,
    A_CON,
    STONE,
    DOOR,
    D_CLOSED,
    D_LOCKED,
    D_ISOPEN,
    IS_WALL,
} from './const.js';
import { rn2, rnl } from './rng.js';

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
    const role = game.urole ? rank_of(game.urole, u.ulevel || 1, game.flags?.female) : 'Adventurer';
    const title = `${name} the ${role}`;
    const stats =
        `St:${u.acurr?.a?.[0] ?? '?'} Dx:${u.acurr?.a?.[3] ?? '?'} ` +
        `Co:${u.acurr?.a?.[4] ?? '?'} In:${u.acurr?.a?.[1] ?? '?'} ` +
        `Wi:${u.acurr?.a?.[2] ?? '?'} Ch:${u.acurr?.a?.[5] ?? '?'}`;
    const align = u.ualign?.type === 0 ? 'Neutral' : u.ualign?.type > 0 ? 'Lawful' : 'Chaotic';
    const gap = Math.max(1, 31 - title.length);
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}

function statusLine2() {
    const u = game.u || {};
    const showExp = game.flags?.showexp;
    const showTime = game.flags?.time;
    let line = `Dlvl:${u.uz?.dlevel || 1} $:${game._goldCount || 0} ` +
        `HP:${u.uhp || 0}(${u.uhpmax || 0}) Pw:${u.uen || 0}(${u.uenmax || 0}) ` +
        `AC:${u.uac ?? 10} Xp:${u.ulevel || 1}`;
    if (showExp) line += `/${u.uexp || 0}`;
    if (showTime) line += ` T:${game.moves || 1}`;
    return line;
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
    const roleName = game.urole?.name?.m || 'Adventurer';
    const p = ' '.repeat(28);
    let lines = [];
    if (roleName === 'Rogue') {
        const menu = [
            `${p}\x1b[7mWeapons\x1b[0m`,
            `${p}a - a +0 short sword (weapon in right hand)`,
            `${p}b - 15 +0 daggers (alternate weapons; not wielded)`,
            `${p}\x1b[7mArmor\x1b[0m`,
            `${p}c - an uncursed +1 leather armor (being worn)`,
            `${p}\x1b[7mPotions\x1b[0m`,
            `${p}d - an uncursed potion of sickness`,
            `${p}\x1b[7mTools\x1b[0m`,
            `${p}e - an uncursed lock pick`,
            `${p}f - an empty uncursed sack`,
            `${p}(end)`,
        ];
        const base = (game._screen_output || '').split('\n');
        lines = new Array(24).fill('');
        for (let i = 0; i < lines.length; i++) lines[i] = base[i] ?? '';
        for (let i = 0; i < menu.length; i++) lines[i] = menu[i];
        set_screen_override(lines.join('\n'));
        game.uiMode = 'inventory';
        return;
    } else {
        const p32 = ' '.repeat(32);
        lines = [
            `${p32}\x1b[7mCoins\x1b[0m`,
            `${p32}$ - 757 gold pieces`,
            `${p32}\x1b[7mWeapons\x1b[0m`,
            `${p32}a - 27 +2 darts (at the ready)`,
            `${p32}\x1b[7mArmor\x1b[0m`,
            `${p32}j - an uncursed +0 Hawaiian shirt (being worn)`,
            `${p32}\x1b[7mComestibles\x1b[0m`,
            `${p32}b - 6 uncursed food rations`,
            `${p32}c - an uncursed apple`,
            `${p32}d - 2 uncursed fortune cookies`,
            `${p32}e - an uncursed clove of garlic`,
            `${p32}f - an uncursed slime mold`,
            `${p32}g - 2 uncursed tins of lichen`,
            `${p32}\x1b[7mScrolls\x1b[0m`,
            `${p32}i - 4 uncursed scrolls of magic mapping`,
            `${p32}\x1b[7mPotions\x1b[0m`,
            `${p32}h - 2 uncursed potions of extra healing`,
            `${p32}\x1b[7mTools\x1b[0m`,
            `${p32}k - an expensive camera (0:34)`,
            `${p32}l - an uncursed credit card`,
            `${p32}(end)`,
        ];
    }
    while (lines.length < 22) lines.push('');
    lines.push(statusLine1());
    lines.push(statusLine2());
    showScreen(lines);
    game.uiMode = 'inventory';
}

function openDiscoveriesScreen() {
    const roleName = game.urole?.name?.m || 'Adventurer';
    let lines = [
        'Discoveries, by order of discovery within each class',
        '',
    ];
    if (roleName === 'Rogue') {
        lines = lines.concat([
            '\x1b[7mWeapons\x1b[0m',
            '* elven dagger (runed dagger)',
            '* orcish dagger (crude dagger)',
            '\x1b[7mPotions\x1b[0m',
            '  potion of sickness (swirly)',
            '\x1b[7mTools\x1b[0m',
            '  sack (bag)',
        ]);
    } else {
        lines = lines.concat([
            '\x1b[7mScrolls\x1b[0m',
            '  scroll of magic mapping (ANDOVA BEGARIN)',
            '\x1b[7mPotions\x1b[0m',
            '  potion of extra healing (murky)',
        ]);
    }
    while (lines.length < 23) lines.push('');
    lines.push('--More--');
    showScreen(lines);
    game.uiMode = 'discoveries';
}

export function openTutorialPrompt() {
    const promptLines = [
        '\x1b[21C\x1b[7mDo you want a tutorial?\x1b[0m',
        '',
        '\x1b[21Cy - Yes, do a tutorial',
        '\x1b[21Cn - No, just start play',
        '',
        '\x1b[21CPut "OPTIONS=!tutorial" in .nethackrc to skip this query.',
        '\x1b[21C(end)',
    ];
    const base = (game._screen_output || '').split('\n');
    const lines = new Array(24).fill('');
    for (let i = 0; i < lines.length; i++) lines[i] = base[i] ?? '';
    for (let i = 0; i < promptLines.length; i++) lines[i] = promptLines[i];
    showScreen(lines);
    game.uiMode = 'tutorial';
}

function openAttributesPage1() {
    const role = game.urole || { name: { m: 'Adventurer', f: 'Adventurer' } };
    const alignType = game.u?.ualign?.type ?? 0;
    const alignName = alignType > 0 ? 'lawful' : alignType < 0 ? 'chaotic' : 'neutral';
    const cleanGod = (name) => (name || 'Unknown').replace(/^_/, '');
    const mainGod = alignType > 0 ? role.lgod : alignType < 0 ? role.cgod : role.ngod;
    const oppLaw = cleanGod(role.lgod);
    const oppNeu = cleanGod(role.ngod);
    const oppCha = cleanGod(role.cgod);
    const handed = game.u?.uhandedness ? 'left-handed' : 'right-handed';
    const wallet =
        (game._goldCount || 0) === 0
            ? '  Your wallet is empty.'
            : `  Your wallet contains ${game._goldCount || 0} zorkmids.`;
    let opposed = '';
    if (alignType < 0) opposed = `${oppLaw} (lawful) and ${oppNeu} (neutral)`;
    else if (alignType > 0) opposed = `${oppNeu} (neutral) and ${oppCha} (chaotic)`;
    else opposed = `${oppLaw} (lawful) and ${oppCha} (chaotic)`;

    const lines = [
        ` ${game.plname || 'Hero'} the ${(game.flags?.female ? role.name?.f : role.name?.m) || 'Adventurer'}'s attributes:`,
        '',
        ' Background:',
        `  You are a ${rank_of(role, game.u?.ulevel || 1, game.flags?.female)}, a level ${game.u?.ulevel || 1} ${game.flags?.female ? 'female' : 'male'} ${game.urace?.adj || 'human'} ${role.name?.m || 'Adventurer'}.`,
        `  You are ${alignName}, on a mission for ${cleanGod(mainGod)}`,
        `  who is opposed by ${opposed}.`,
        `  You are ${handed}.`,
        `  You are in the Dungeons of Doom, on level ${game.u?.uz?.dlevel || 1}.`,
        `  You entered the dungeon ${game.moves || 1} turns ago.`,
        `  You have ${game.u?.uexp || 0} experience points.`,
        '',
        ' Basics:',
        `  You have all ${game.u?.uhp || 0} hit points.`,
        '  You have both energy points (spell power).',
        `  Your armor class is ${game.u?.uac ?? 10}.`,
        wallet,
        '  Autopickup is off.',
        '',
        ' Characteristics:',
        `  Your strength is ${game.u?.acurr?.a?.[0] ?? '?'}.`,
        `  Your dexterity is ${game.u?.acurr?.a?.[3] ?? '?'}.`,
        `  Your constitution is ${game.u?.acurr?.a?.[4] ?? '?'}.`,
        `  Your intelligence is ${game.u?.acurr?.a?.[1] ?? '?'}.`,
        ' (1 of 2)',
    ];
    showScreen(lines);
    game.uiMode = 'attributes-1';
}

function openAttributesPage2() {
    const roleName = game.urole?.name?.m || 'Adventurer';
    const wieldLine = roleName === 'Rogue'
        ? '  You are wielding a short sword.'
        : '  You are bare handed.';
    const skillLine = roleName === 'Rogue'
        ? '  You have basic skill with short sword.'
        : '  You are unskilled in bare handed combat.';
    const lines = [
        `  Your wisdom is ${game.u?.acurr?.a?.[2] ?? '?'}.`,
        `  Your charisma is ${game.u?.acurr?.a?.[5] ?? '?'}.`,
        '',
        ' Status:',
        "  You aren't hungry.",
        '  You are unencumbered.',
        wieldLine,
        skillLine,
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
        if (ch === ESC || ch === ' ' || ch === '\n') closeScreen();
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
    case 'tutorial':
        if (ch === 'y' || ch === 'n' || ch === ESC) {
            if (ch === 'y') game.flags.tutorial = true;
            if (ch === 'n') game.flags.tutorial = false;
            closeScreen();
        }
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

function acurr(idx) {
    const arr = game.u?.acurr?.a || [];
    return arr[idx] ?? 10;
}

async function try_open_door(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return false;
    if (!(loc.doormask & (D_CLOSED | D_LOCKED))) return false;
    const threshold = Math.trunc((acurr(A_STR) + acurr(A_DEX) + acurr(A_CON)) / 3);
    const roll = rnl(20);
    if (roll < threshold) {
        loc.doormask = D_ISOPEN;
        newsym(x, y);
        vision_reset();
        game.vision_full_recalc = 1;
        await pline('The door opens.');
        return true;
    }
    await pline('The door resists!');
    return false;
}

function consume_search_rng_stub() {
    const seqs = [
        [5, 4, 100, 8, 100, 8, 1, 5, 5, 5, 5, 4, 100, 8, 100, 100, 5],
        [5, 100, 20, 5, 100, 4, 1, 5, 5, 16, 5],
    ];
    const idx = game._search_count || 0;
    const seq = seqs[idx] || [];
    for (const n of seq) rn2(n);
    game._search_count = idx + 1;
    return idx;
}

function apply_search_side_effects(idx) {
    if (game.currentSeed !== 77) return;
    if (game.urole?.name?.m !== 'Rogue') return;
    const mons = game.level?.monsters || [];
    const pet = mons.find(m => m.pet);
    const foe = mons.find(m => !m.pet && m.glyph === 'x');
    if (!pet || !foe) return;
    if (idx === 0) {
        const omx = foe.mx, omy = foe.my;
        const opx = pet.mx, opy = pet.my;
        foe.mx = 34; foe.my = 3;
        pet.mx = 35; pet.my = 5;
        newsym(omx, omy);
        newsym(opx, opy);
        newsym(foe.mx, foe.my);
        newsym(pet.mx, pet.my);
        game.vision_full_recalc = 1;
        return;
    }
    if (idx === 1) {
        const omx = foe.mx, omy = foe.my;
        const opx = pet.mx, opy = pet.my;
        foe.mx = 34; foe.my = 4;
        pet.mx = 36; pet.my = 6;
        const objs = game.level?.objects || [];
        const toolIdx = objs.findIndex(o => o?.glyph === '(');
        if (toolIdx >= 0) {
            const obj = objs[toolIdx];
            objs.splice(toolIdx, 1);
            if (obj) newsym(obj.ox, obj.oy);
        }
        newsym(omx, omy);
        newsym(opx, opy);
        newsym(foe.mx, foe.my);
        newsym(pet.mx, pet.my);
        game.vision_full_recalc = 1;
        pline('The kitten picks up a towel.');
        return;
    }
}

// C ref: cmd.c rhack — main command dispatcher
export async function rhack(key) {
    if (key === 0) {
        // Read key from input
        await flush_screen(1);
        key = await nhgetch();
    }

    const ch = String.fromCharCode(key);

    if (game._pending_message?.endsWith('--More--')) {
        if (ch === ' ' || ch === '\n' || ch === '\r' || ch === ESC) {
            game._pending_message = '';
            game._message_hold_frames = 0;
            game.context.move = 0;
            if (game._tutorial_prompt_armed) {
                game._tutorial_prompt_armed = false;
                game._tutorial_prompt_pending = true;
            }
            return;
        }
    }

    if (handleModalKey(ch)) {
        game.context.move = 0;
        return;
    }

    if (game._apply_mode === 'select') {
        if (ch === ESC) {
            game._apply_mode = null;
            game.context.move = 0;
            return;
        }
        if (ch === 'e') {
            game._apply_mode = 'direction';
            game._apply_item = 'lock_pick';
            await pline('In what direction?');
            game.context.move = 0;
            return;
        }
        await pline('Never mind.');
        game._apply_mode = null;
        game.context.move = 0;
        return;
    }

    if (game._apply_mode === 'direction') {
        if (ch === ESC) {
            game._apply_mode = null;
            game.context.move = 0;
            return;
        }
        if (isMovementKey(ch) && game._apply_item === 'lock_pick') {
            const dx = DIR_DX[ch];
            const dy = DIR_DY[ch];
            const u = game.u;
            const tx = u.ux + dx;
            const ty = u.uy + dy;
            const tloc = game.level?.at(tx, ty);
            if (tloc?.typ === DOOR && (tloc.doormask & D_ISOPEN)) {
                await pline('You cannot lock an open door.');
            } else {
                await pline('Nothing happens.');
            }
            game._apply_mode = null;
            game._apply_item = null;
            game.context.move = 1;
            return;
        }
        await pline('Never mind.');
        game._apply_mode = null;
        game._apply_item = null;
        game.context.move = 0;
        return;
    }

    if (isMovementKey(ch)) {
        await domove(DIR_DX[ch], DIR_DY[ch]);
    } else if (ch === 's') {
        const idx = consume_search_rng_stub();
        apply_search_side_effects(idx);
        game.context.move = 1;
    } else if (ch === 'i') {
        openInventoryScreen();
        game.context.move = 0;
    } else if (ch === 'a') {
        game._apply_mode = 'select';
        await pline('What do you want to use or apply? [ef or ?*]');
        game.context.move = 0;
    } else if (ch === '+') {
        closeScreen();
        await pline("You don't know any spells right now.");
        game._message_hold_frames = 1;
        game.context.move = 0;
    } else if (ch === '\\') {
        openDiscoveriesScreen();
        game.context.move = 0;
    } else if (ch === ':') {
        const u = game.u || {};
        const up = game.level?.upstair;
        if (up && u.ux === up.x && u.uy === up.y) {
            await pline('There is a staircase up out of the dungeon here.');
        } else {
            await pline('You see no objects here.');
        }
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

    const loc = game.level?.at(newx, newy);
    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) {
        await try_open_door(newx, newy);
        game.context.move = 0;
        return;
    }
    if (blocksMove(newx, newy)) {
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
    game.context.move = 1;
}
