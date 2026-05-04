// chargen.js — Player selection flow (name + role/race/gender/align).
// C ref: role.c genl_player_setup(), unixmain.c.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { set_screen_override, clear_screen_override, flush_screen } from './display.js';
import {
    roles, races, genders, aligns,
    str2role, str2race, str2gend, str2align,
    pick_role, pick_race, pick_gend, pick_align,
    ok_race, ok_gend,
    rigid_role_checks, align_gname, align_gtitle, rank_of,
} from './roles.js';
import { ROLE_NONE, ROLE_RANDOM, ROLE_GENDERS, ROLE_ALIGNS } from './const.js';
import { rn2 } from './rng.js';

const ESC = 27;

function isPrintable(ch) {
    return ch >= 32 && ch <= 126;
}

function keyToChar(key) {
    return String.fromCharCode(key);
}

function renderSplash(name, promptLine) {
    const lines = new Array(13).fill('');
    if (promptLine) lines[0] = promptLine;
    lines[4] = 'NetHack, Copyright 1985-2026';
    lines[5] = '\x1b[9CBy Stichting Mathematisch Centrum and M. Stephenson.';
    lines[6] = '\x1b[9CVersion 5.0.0 JS, built Jan  1 2026 00:00:00.';
    lines[7] = '\x1b[9CSee license for details.';
    lines[12] = name ? `Who are you? ${name}` : 'Who are you?';
    return lines.join('\n');
}

async function promptForName(iflags) {
    let name = '';
    if (!iflags.wc_splash_screen) return name;
    for (;;) {
        set_screen_override(renderSplash(name, ''));
        await flush_screen(1);
        const key = await nhgetch();
        if (key === 10 || key === 13) break;
        if (key === 8 || key === 127) {
            name = name.slice(0, -1);
            continue;
        }
        if (isPrintable(key)) name += keyToChar(key);
    }
    clear_screen_override();
    return name;
}

async function promptPick4u(name) {
    const prompt = "Shall I pick character's race, role, gender and alignment for you? [ynaq]";
    set_screen_override(renderSplash(name, prompt));
    await flush_screen(1);
    const key = await nhgetch();
    const ch = keyToChar(key).toLowerCase();
    clear_screen_override();
    if (key === ESC || ch === 'q') return 'q';
    if (ch === ' ' || ch === '\n' || ch === '\r') return 'y';
    if (ch === '@' || ch === '*') return 'a';
    if (ch === 'n' || ch === 'y' || ch === 'a') return ch;
    return 'y';
}

function roleMenuLines() {
    return [
        ' \x1b[7mPick a role or profession\x1b[0m',
        '',
        ' <role> <race> <gender> <alignment>',
        '',
        ' a - an Archeologist',
        ' b - a Barbarian',
        ' c - a Caveman/Cavewoman',
        ' h - a Healer',
        ' k - a Knight',
        ' m - a Monk',
        ' p - a Priest/Priestess',
        ' r - a Rogue',
        ' R - a Ranger',
        ' s - a Samurai',
        ' t - a Tourist',
        ' v - a Valkyrie',
        ' w - a Wizard',
        ' * * Random',
        ' / - Pick race first',
        ' " - Pick gender first',
        ' [ - Pick alignment first',
        ' ~ - Set role/race/&c filtering',
        ' q - Quit',
        ' (end)',
    ];
}

function raceMenuLines(roleName, alignName, racesAvail) {
    const indent = '\x1b[41C';
    const lines = [
        `${indent}\x1b[7mPick a race or species\x1b[0m`,
        '',
        `${indent}${roleName} <race> <gender> ${alignName}`,
        '',
    ];
    for (const r of racesAvail) lines.push(`${indent}${r.key} - ${r.label}`);
    lines.push(`${indent}* * Random`);
    lines.push('');
    lines.push(`${indent}? - Pick another role first`);
    lines.push(`${indent}" - Pick gender first`);
    if (alignName === 'chaotic' || alignName === 'lawful' || alignName === 'neutral')
        lines.push(`${indent}    role forces ${alignName}`.replace(`${indent}    `, '\x1b[45C'));
    lines.push(`${indent}~ - Set role/race/&c filtering`);
    lines.push(`${indent}q - Quit`);
    lines.push(`${indent}(end)`);
    return lines;
}

function genderMenuLines(roleName, raceName, alignName, gendersAvail) {
    const indent = '\x1b[41C';
    const lines = [
        `${indent}\x1b[7mPick a gender or sex\x1b[0m`,
        '',
        `${indent}${roleName} ${raceName} <gender> ${alignName}`,
        '',
    ];
    for (const g of gendersAvail) lines.push(`${indent}${g.key} - ${g.label}`);
    lines.push(`${indent}* * Random`);
    lines.push('');
    lines.push(`${indent}? - Pick another role first`);
    lines.push(`${indent}/ - Pick another race first`);
    if (alignName === 'chaotic' || alignName === 'lawful' || alignName === 'neutral')
        lines.push(`${indent}    role forces ${alignName}`.replace(`${indent}    `, '\x1b[45C'));
    lines.push(`${indent}~ - Set role/race/&c filtering`);
    lines.push(`${indent}q - Quit`);
    lines.push(`${indent}(end)`);
    return lines;
}

function confirmMenuLines(name, roleName, raceName, genderName, alignName) {
    const indent = '\x1b[41C';
    return [
        `${indent}\x1b[7mIs this ok? [ynaq]\x1b[0m`,
        '',
        `${indent}${name} the ${alignName} ${genderName} ${raceName} ${roleName}`,
        '',
        `${indent}y * Yes; start game`,
        `${indent}n - No; choose role again`,
        `${indent}a - Not yet; choose another name`,
        `${indent}q - Quit`,
        `${indent}(end)`,
    ];
}

function roleKeyToIndex(ch) {
    switch (ch) {
    case 'a': return 0; // Archeologist
    case 'b': return 1; // Barbarian
    case 'c': return 2; // Caveman
    case 'h': return 3; // Healer
    case 'k': return 4; // Knight
    case 'm': return 5; // Monk
    case 'p': return 6; // Priest
    case 'r': return 7; // Rogue
    case 'R': return 8; // Ranger
    case 's': return 9; // Samurai
    case 't': return 10; // Tourist
    case 'v': return 11; // Valkyrie
    case 'w': return 12; // Wizard
    default: return ROLE_NONE;
    }
}

function raceKeyToIndex(ch) {
    switch (ch) {
    case 'h': return 0; // human
    case 'e': return 1; // elf
    case 'd': return 2; // dwarf
    case 'g': return 3; // gnome
    case 'o': return 4; // orc
    default: return ROLE_NONE;
    }
}

function genderKeyToIndex(ch) {
    switch (ch) {
    case 'm': return 0;
    case 'f': return 1;
    default: return ROLE_NONE;
    }
}

function alignNameFromIndex(idx) {
    if (idx < 0 || idx >= ROLE_ALIGNS) return '<alignment>';
    return aligns[idx].name;
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
    const baseAc = (u.uac ?? 10) - 10;
    return `Dlvl:${u.uz?.dlevel || 1} $:${game._goldCount || 0} ` +
        `HP:${u.uhp || 0}(${u.uhpmax || 0}) Pw:${u.uen || 0}(${u.uenmax || 0}) ` +
        `AC:${baseAc} Xp:${u.ulevel || 1}`;
}

export async function player_selection(opts) {
    const g = game;
    const flags = g.flags;

    flags.initrole = str2role(opts.role);
    flags.initrace = str2race(opts.race);
    flags.initgend = str2gend(opts.gender);
    flags.initalign = str2align(opts.align);

    if (!g.plname) g.plname = opts.name || '';

    if (!g.plname) {
        g.plname = await promptForName(g.iflags);
    }

    const picksomething =
        flags.initrole === ROLE_NONE ||
        flags.initrace === ROLE_NONE ||
        flags.initgend === ROLE_NONE ||
        flags.initalign === ROLE_NONE;

    if (flags.randomall && picksomething) {
        if (flags.initrole === ROLE_NONE) flags.initrole = ROLE_RANDOM;
        if (flags.initrace === ROLE_NONE) flags.initrace = ROLE_RANDOM;
        if (flags.initgend === ROLE_NONE) flags.initgend = ROLE_RANDOM;
        if (flags.initalign === ROLE_NONE) flags.initalign = ROLE_RANDOM;
    }

    rigid_role_checks(flags);

    let pick4u = 'n';
    if (picksomething) {
        pick4u = await promptPick4u(g.plname);
        if (pick4u === 'q') throw new Error('Quit during chargen');
    }

    if (pick4u === 'y' || pick4u === 'a' || flags.initrole === ROLE_RANDOM) {
        if (flags.initrole < 0) {
            let k = pick_role(flags.initrace, flags.initgend, flags.initalign, 'random');
            if (k < 0) k = rn2(roles.length);
            flags.initrole = k;
        }
        if (flags.initrace < 0) flags.initrace = pick_race(flags.initrole, flags.initgend, flags.initalign, 'random');
        if (flags.initgend < 0) flags.initgend = pick_gend(flags.initrole, flags.initrace, flags.initalign, 'random');
        if (flags.initalign < 0) flags.initalign = pick_align(flags.initrole, flags.initrace, flags.initgend, 'random');
    } else {
        if (flags.initrole === ROLE_NONE) {
            set_screen_override(roleMenuLines().join('\n'));
            await flush_screen(1);
            let key = await nhgetch();
            clear_screen_override();
            let ch = keyToChar(key);
            if (ch === 'q' || key === ESC) throw new Error('Quit during chargen');
            if (ch === '*') flags.initrole = pick_role(flags.initrace, flags.initgend, flags.initalign, 'random');
            else flags.initrole = roleKeyToIndex(ch);
            rigid_role_checks(flags);
        }
        if (flags.initrace === ROLE_NONE) {
            const roleName = roles[flags.initrole]?.name?.m || 'Role';
            const alignName = alignNameFromIndex(flags.initalign);
            const racesAvail = races
                .map((r, idx) => ({ r, idx }))
                .filter(({ idx }) => ok_race(flags.initrole, idx, flags.initgend, flags.initalign))
                .map(({ r, idx }) => ({ key: ['h', 'e', 'd', 'g', 'o'][idx], label: r.name }));
            set_screen_override(raceMenuLines(roleName, alignName, racesAvail).join('\n'));
            await flush_screen(1);
            let key = await nhgetch();
            clear_screen_override();
            let ch = keyToChar(key);
            if (ch === 'q' || key === ESC) throw new Error('Quit during chargen');
            if (ch === '*') flags.initrace = pick_race(flags.initrole, flags.initgend, flags.initalign, 'random');
            else flags.initrace = raceKeyToIndex(ch);
        }
        if (flags.initgend === ROLE_NONE) {
            const roleName = roles[flags.initrole]?.name?.m || 'Role';
            const raceName = races[flags.initrace]?.name || 'race';
            const alignName = alignNameFromIndex(flags.initalign);
            const gendersAvail = genders
                .slice(0, ROLE_GENDERS)
                .map((g, idx) => ({ g, idx }))
                .filter(({ idx }) => ok_gend(flags.initrole, flags.initrace, idx, flags.initalign))
                .map(({ g, idx }) => ({ key: idx === 0 ? 'm' : 'f', label: g.name }));
            set_screen_override(genderMenuLines(roleName, raceName, alignName, gendersAvail).join('\n'));
            await flush_screen(1);
            let key = await nhgetch();
            clear_screen_override();
            let ch = keyToChar(key);
            if (ch === 'q' || key === ESC) throw new Error('Quit during chargen');
            if (ch === '*') flags.initgend = pick_gend(flags.initrole, flags.initrace, flags.initalign, 'random');
            else flags.initgend = genderKeyToIndex(ch);
        }
        if (flags.initalign === ROLE_NONE) {
            flags.initalign = pick_align(flags.initrole, flags.initrace, flags.initgend, 'random');
        }
    }

    const getconfirmation = (picksomething && pick4u !== 'a' && !flags.randomall);
    if (getconfirmation) {
        for (;;) {
            const roleName = roles[flags.initrole]?.name?.m || 'Adventurer';
            const raceName = races[flags.initrace]?.name || 'human';
            const genderName = genders[flags.initgend]?.name || 'male';
            const alignName = alignNameFromIndex(flags.initalign);
            set_screen_override(confirmMenuLines(g.plname, roleName, raceName, genderName, alignName).join('\n'));
            await flush_screen(1);
            const key = await nhgetch();
            clear_screen_override();
            const ch = keyToChar(key).toLowerCase();
            if (ch === 'y' || ch === ' ' || ch === '\n' || ch === '\r') break;
            if (ch === 'a') {
                g.plname = await promptForName(g.iflags);
                continue;
            }
            if (ch === 'n') {
                flags.initrole = ROLE_NONE;
                flags.initrace = ROLE_NONE;
                flags.initgend = ROLE_NONE;
                flags.initalign = ROLE_NONE;
                return await player_selection(opts);
            }
            if (ch === 'q' || key === ESC) throw new Error('Quit during chargen');
        }
    }

    const role = roles[flags.initrole];
    const race = races[flags.initrace];
    const alignIdx = flags.initalign;

    g.urole = role;
    g.urace = race;
    g.flags.female = flags.initgend === 1;
    g.u = g.u || {};
    g.u.ualign = { type: aligns[alignIdx]?.value ?? 0, record: 0 };
    g.u.ualignbase = [aligns[alignIdx]?.value ?? 0, aligns[alignIdx]?.value ?? 0];

    return {
        role, race,
        gender: genders[flags.initgend],
        align: aligns[alignIdx],
    };
}

export function buildLegacyText() {
    const role = game.urole || roles[0];
    const alignment = game.u?.ualign?.type ?? 0;
    const name = align_gname(role, alignment);
    const title = align_gtitle(role, alignment);
    const rank = rank_of(role, 1, game.flags?.female);
    const ind23 = '\x1b[23C';
    const ind27 = '\x1b[27C';
    const lines = new Array(24).fill('');
    lines[0] = `${ind23}It is written in the Book of ${name}:`;
    lines[2] = `${ind27}After the Creation, the cruel god Moloch rebelled`;
    lines[3] = `${ind27}against the authority of Marduk the Creator.`;
    lines[4] = `${ind27}Moloch stole from Marduk the most powerful of all`;
    lines[5] = `${ind27}the artifacts of the gods, the Amulet of Yendor,`;
    lines[6] = `${ind27}and he hid it in the dark cavities of Gehennom, the`;
    lines[7] = `${ind27}Under World, where he now lurks, and bides his time.`;
    lines[9] = `${ind23}Your ${title} ${name} seeks to possess the Amulet, and with it`;
    lines[10] = `${ind23}to gain deserved ascendance over the other gods.`;
    lines[12] = `${ind23}You, a newly trained ${rank}, have been heralded`;
    lines[13] = `${ind23}from birth as the instrument of ${name}.  You are destined`;
    lines[14] = `${ind23}to recover the Amulet for your deity, or die in the`;
    lines[15] = `${ind23}attempt.  Your hour of destiny has come.  For the sake`;
    lines[16] = `${ind23}of us all:  Go bravely with ${name}!`;
    lines[17] = `${ind23}--More--`;
    lines[22] = statusLine1();
    lines[23] = statusLine2();
    return lines;
}
