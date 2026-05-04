// u_init.js — initialize player attributes and basic stats.
// C ref: u_init.c, attrib.c, exper.c (subset).

import { game } from './gstate.js';
import { A_MAX, A_STR, A_CON, A_WIS } from './const.js';
import { roles, races, aligns } from './roles.js';
import { rn2, rnd, rn1 } from './rng.js';
import { consume_money_rng, consume_role_inventory_rng, consume_role_extras_rng } from './inventory_init.js';

function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

function curRole() {
    return game.urole || roles[0];
}

function curRace() {
    return game.urace || races[0];
}

function attrMin(idx) {
    const race = curRace();
    return race.attrmin?.[idx] ?? 3;
}

function attrMax(idx) {
    const race = curRace();
    return race.attrmax?.[idx] ?? 18;
}

function ensureAttrArrays() {
    const u = game.u;
    if (!u.acurr) u.acurr = { a: new Array(A_MAX).fill(0) };
    if (!u.amax) u.amax = { a: new Array(A_MAX).fill(0) };
    if (!u.atemp) u.atemp = { a: new Array(A_MAX).fill(0) };
    if (!u.atime) u.atime = { a: new Array(A_MAX).fill(0) };
}

function abase(i) { return game.u.acurr.a[i]; }
function amax(i) { return game.u.amax.a[i]; }
function set_abase(i, v) { game.u.acurr.a[i] = v; }
function set_amax(i, v) { game.u.amax.a[i] = v; }

function rnd_attr() {
    const dist = curRole().attrdist || [20, 20, 20, 10, 20, 10];
    let x = rn2(100);
    for (let i = 0; i < A_MAX; i++) {
        x -= dist[i] || 0;
        if (x < 0) return i;
    }
    return A_MAX;
}

function init_attr_role_redist(np, addition) {
    let tryct = 0;
    const adj = addition ? 1 : -1;
    while ((addition ? np > 0 : np < 0) && tryct < 100) {
        const i = rnd_attr();
        if (i >= A_MAX) { tryct++; continue; }
        if (addition) {
            if (abase(i) >= attrMax(i)) { tryct++; continue; }
        } else {
            if (abase(i) <= attrMin(i)) { tryct++; continue; }
        }
        tryct = 0;
        set_abase(i, abase(i) + adj);
        set_amax(i, amax(i) + adj);
        np -= adj;
    }
    return np;
}

export function init_attr(np) {
    ensureAttrArrays();
    const base = curRole().attrbase || [10, 10, 10, 10, 10, 10];
    for (let i = 0; i < A_MAX; i++) {
        set_abase(i, base[i] || 3);
        set_amax(i, base[i] || 3);
        game.u.atemp.a[i] = 0;
        game.u.atime.a[i] = 0;
        np -= base[i] || 0;
    }
    np = init_attr_role_redist(np, true);
    np = init_attr_role_redist(np, false);
}

function adjattrib(idx, delta) {
    const min = attrMin(idx);
    const max = attrMax(idx);
    const nb = clamp(abase(idx) + delta, min, max);
    const nm = clamp(amax(idx) + delta, min, max);
    set_abase(idx, nb);
    set_amax(idx, nm);
}

export function vary_init_attr() {
    for (let i = 0; i < A_MAX; i++) {
        if (!rn2(20)) {
            const xd = rn2(7) - 2;
            adjattrib(i, xd);
            if (abase(i) < amax(i)) set_amax(i, abase(i));
        }
    }
}

function conPlus(con) {
    if (con <= 3) return -2;
    if (con <= 6) return -1;
    if (con <= 14) return 0;
    if (con <= 16) return 1;
    if (con === 17) return 2;
    if (con === 18) return 3;
    return 4;
}

export function newhp() {
    const u = game.u;
    const role = curRole();
    const race = curRace();
    let hp;
    if (u.ulevel === 0) {
        hp = role.hpadv.infix + race.hpadv.infix;
        if (role.hpadv.inrnd > 0) hp += rnd(role.hpadv.inrnd);
        if (race.hpadv.inrnd > 0) hp += rnd(race.hpadv.inrnd);
        u.ualign.type = aligns[game.flags.initalign]?.value ?? 0;
        u.ualign.record = role.initrecord;
    } else {
        if (u.ulevel < role.xlev) {
            hp = role.hpadv.lofix + race.hpadv.lofix;
            if (role.hpadv.lornd > 0) hp += rnd(role.hpadv.lornd);
            if (race.hpadv.lornd > 0) hp += rnd(race.hpadv.lornd);
        } else {
            hp = role.hpadv.hifix + race.hpadv.hifix;
            if (role.hpadv.hirnd > 0) hp += rnd(role.hpadv.hirnd);
            if (race.hpadv.hirnd > 0) hp += rnd(race.hpadv.hirnd);
        }
        hp += conPlus(abase(A_CON));
    }
    return hp;
}

function enermod(roleName, en) {
    switch (roleName) {
    case 'Priest':
    case 'Wizard':
        return 2 * en;
    case 'Healer':
    case 'Knight':
        return Math.floor((3 * en) / 2);
    case 'Barbarian':
    case 'Valkyrie':
        return Math.floor((3 * en) / 4);
    default:
        return en;
    }
}

const STARTING_ARMOR = Object.freeze({
    Archeologist: [
        { ac: 9, spe: 0 },  // leather jacket
        { ac: 10, spe: 0 }, // fedora
    ],
    Barbarian: [
        { ac: 7, spe: 0 },  // ring mail
    ],
    Caveman: [
        { ac: 8, spe: 0 },  // leather armor
    ],
    Healer: [
        { ac: 9, spe: 1 },  // leather gloves +1
    ],
    Knight: [
        { ac: 7, spe: 1 },  // ring mail +1
        { ac: 9, spe: 0 },  // helmet
        { ac: 9, spe: 0 },  // small shield
        { ac: 9, spe: 0 },  // leather gloves
    ],
    Monk: [
        { ac: 9, spe: 2 },  // leather gloves +2
        { ac: 8, spe: 1 },  // robe +1
    ],
    Priest: [
        { ac: 8, spe: 0 },  // robe
        { ac: 9, spe: 0 },  // small shield
    ],
    Ranger: [
        { ac: 9, spe: 2 },  // cloak of displacement +2
    ],
    Rogue: [
        { ac: 8, spe: 1 },  // leather armor +1
    ],
    Samurai: [
        { ac: 4, spe: 0 },  // splint mail
    ],
    Tourist: [
        { ac: 10, spe: 0 }, // Hawaiian shirt
    ],
    Valkyrie: [
        { ac: 9, spe: 3 },  // small shield +3
    ],
    Wizard: [
        { ac: 9, spe: 0 },  // cloak of magic resistance
    ],
});

function armorBonus({ ac, spe }) {
    return (10 - ac) + (spe || 0);
}

export function computeStartingAC(roleName) {
    const items = STARTING_ARMOR[roleName] || [];
    let bonus = 0;
    for (const item of items) bonus += armorBonus(item);
    return 10 - bonus;
}

export function applyStartingAC() {
    const u = game.u || {};
    if (u.uac != null) return;
    if (u._pending_ac != null) {
        u.uac = u._pending_ac;
        delete u._pending_ac;
        return;
    }
    const roleName = curRole().name.m;
    u.uac = computeStartingAC(roleName);
}

export function newpw() {
    const u = game.u;
    const role = curRole();
    const race = curRace();
    let en = 0;
    if (u.ulevel === 0) {
        en = role.enadv.infix + race.enadv.infix;
        if (role.enadv.inrnd > 0) en += rnd(role.enadv.inrnd);
        if (race.enadv.inrnd > 0) en += rnd(race.enadv.inrnd);
    } else {
        let enrnd = Math.floor(abase(A_WIS) / 2);
        let enfix;
        if (u.ulevel < role.xlev) {
            enrnd += role.enadv.lornd + race.enadv.lornd;
            enfix = role.enadv.lofix + race.enadv.lofix;
        } else {
            enrnd += role.enadv.hirnd + race.enadv.hirnd;
            enfix = role.enadv.hifix + race.enadv.hifix;
        }
        en = enermod(role.name.m, rn1(enrnd, enfix));
    }
    if (en <= 0) en = 1;
    if (!u.ueninc) u.ueninc = [];
    u.ueninc[u.ulevel || 0] = en;
    return en;
}

export function u_init_misc() {
    const u = game.u;
    game.flags.female = game.flags.initgend === 1;
    if (!u.uhave) u.uhave = { amulet: false };
    if (!u.ualign) u.ualign = { type: 0, record: 0 };
    if (!u.ualignbase) u.ualignbase = [0, 0];
    u.ulevel = 0;
    u.uhp = u.uhpmax = u.uhppeak = newhp();
    u.uen = u.uenmax = u.uenpeak = newpw();
    u.ulevel = 1;
    u.ulevelmax = 1;
    u.ualignbase[0] = u.ualignbase[1] = u.ualign.type;
    u.uhandedness = rn2(10) ? 0 : 1; // RIGHT_HANDED=0, LEFT_HANDED=1
}

export function u_init_inventory_attrs() {
    const u = game.u;
    u.umoney0 = 0;
    const roleName = curRole().name.m;
    if (roleName === 'Healer') u.umoney0 = rn1(1000, 1001);
    if (roleName === 'Tourist') u.umoney0 = rnd(1000);

    // Consume RNG for role inventory quantities and random extras.
    consume_role_inventory_rng(roleName);
    consume_role_extras_rng(roleName);
    if (u.umoney0) consume_money_rng();

    init_attr(75);
    vary_init_attr();

    game._goldCount = u.umoney0;
    u.uexp = 0;
    if (u.uac == null) u._pending_ac = computeStartingAC(roleName);
}
