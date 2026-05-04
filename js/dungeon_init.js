// dungeon_init.js — init_dungeons() port (RNG parity focus).
// C ref: dungeon.c init_dungeons(), place_level(), level_range(), init_castle_tune().

import { game } from './gstate.js';
import { rn2, rn1 } from './rng.js';
import {
    MAXLEVEL,
    MAXDUNGEON,
    TOWN,
    HELLISH,
    MAZELIKE,
    ROGUELIKE,
    UNCONNECTED,
    D_ALIGN_NONE,
    D_ALIGN_LAWFUL,
    D_ALIGN_NEUTRAL,
    D_ALIGN_CHAOTIC,
    D_ALIGN_MASK,
    TBR_STAIR,
    TBR_NO_UP,
    TBR_NO_DOWN,
    TBR_PORTAL,
    BR_STAIR,
    BR_NO_END1,
    BR_NO_END2,
    BR_PORTAL,
} from './const.js';
import { DUNGEON_DATA } from './dungeon_data.js';

function alignFlag(name) {
    switch (name) {
    case 'lawful': return D_ALIGN_LAWFUL;
    case 'neutral': return D_ALIGN_NEUTRAL;
    case 'chaotic': return D_ALIGN_CHAOTIC;
    case 'noalign':
    case 'unaligned':
    default:
        return D_ALIGN_NONE;
    }
}

function flagsMask(flags) {
    if (!flags) return 0;
    const list = Array.isArray(flags) ? flags : [flags];
    let mask = 0;
    for (const f of list) {
        switch (f) {
        case 'town': mask |= TOWN; break;
        case 'hellish': mask |= HELLISH; break;
        case 'mazelike': mask |= MAZELIKE; break;
        case 'roguelike': mask |= ROGUELIKE; break;
        case 'unconnected': mask |= UNCONNECTED; break;
        default: break;
        }
    }
    return mask;
}

function branchType(name) {
    switch (name) {
    case 'no_up': return TBR_NO_UP;
    case 'no_down': return TBR_NO_DOWN;
    case 'portal': return TBR_PORTAL;
    case 'stair':
    default:
        return TBR_STAIR;
    }
}

function branchDir(name) {
    return name === 'up';
}

function createProto() {
    return {
        tmpdungeon: [],
        tmplevel: [],
        tmpbranch: [],
        final_lev: [],
        n_levs: 0,
        n_brs: 0,
        start: 0,
    };
}

function find_branch(name, pd) {
    for (let i = 0; i < pd.n_brs; i++) {
        if (pd.tmpbranch[i].name === name) return i;
    }
    throw new Error(`find_branch: can't find ${name}`);
}

function parent_dnum(name, pd) {
    let i = find_branch(name, pd);
    for (let pdnum = 0; pdnum < pd.tmpdungeon.length; pdnum++) {
        if (pd.tmpdungeon[pdnum].name === name) break;
        i -= pd.tmpdungeon[pdnum].branches;
        if (i < 0) return pdnum;
    }
    throw new Error('parent_dnum: could not resolve branch');
}

function level_range(dgn, base, randc, chain, pd) {
    const lmax = game.dungeons[dgn].num_dunlevs;
    if (chain >= 0) {
        const levtmp = pd.final_lev[chain];
        if (!levtmp) throw new Error('level_range: empty chain level');
        base += levtmp.dlevel.dlevel;
    } else {
        if (base < 0) base = (lmax + base + 1);
    }
    if (base < 1 || base > lmax) throw new Error('level_range: base out of range');
    const adjusted_base = base;
    if (randc === -1) return { count: (lmax - base + 1), base: adjusted_base };
    if (randc) {
        const count = ((base + randc - 1) > lmax) ? (lmax - base + 1) : randc;
        return { count, base: adjusted_base };
    }
    return { count: 1, base: adjusted_base };
}

function parent_dlevel(name, pd) {
    const dnum = parent_dnum(name, pd);
    const brIdx = find_branch(name, pd);
    const lr = level_range(dnum, pd.tmpbranch[brIdx].lev.base, pd.tmpbranch[brIdx].lev.rand,
        pd.tmpbranch[brIdx].chain, pd);
    const num = lr.count;
    const base = lr.base;
    let i = rn2(num);
    const j = i;
    do {
        i = (i + 1) % num;
        const candidate = base + i;
        let blocked = false;
        for (const curr of game.branches) {
            if ((curr.end1.dnum === dnum && curr.end1.dlevel === candidate)
                || (curr.end2.dnum === dnum && curr.end2.dlevel === candidate)) {
                blocked = true;
                break;
            }
        }
        if (!blocked) break;
    } while (i !== j);
    return base + i;
}

function correct_branch_type(tbr) {
    switch (tbr.type) {
    case TBR_STAIR: return BR_STAIR;
    case TBR_NO_UP: return tbr.up ? BR_NO_END1 : BR_NO_END2;
    case TBR_NO_DOWN: return tbr.up ? BR_NO_END2 : BR_NO_END1;
    case TBR_PORTAL: return BR_PORTAL;
    default:
        return BR_STAIR;
    }
}

function insert_branch(newBranch, extractFirst) {
    if (extractFirst) {
        const idx = game.branches.indexOf(newBranch);
        if (idx === -1) throw new Error('insert_branch: not found');
        game.branches.splice(idx, 1);
    }

    const branchVal = (bp) => ((((bp.end1.dnum * (MAXLEVEL + 1) + bp.end1.dlevel)
        * (MAXDUNGEON + 1) * (MAXLEVEL + 1))
        + (bp.end2.dnum * (MAXLEVEL + 1) + bp.end2.dlevel)));

    const newVal = branchVal(newBranch);
    let insertAt = 0;
    let prevVal = -1;
    for (; insertAt < game.branches.length; insertAt++) {
        const currVal = branchVal(game.branches[insertAt]);
        if (prevVal < newVal && newVal <= currVal) break;
        prevVal = currVal;
    }
    game.branches.splice(insertAt, 0, newBranch);
}

function add_branch(dgn, childEntryLevel, pd) {
    if (game._branch_id == null) game._branch_id = 0;
    const branchNum = find_branch(game.dungeons[dgn].dname, pd);
    const newBranch = {
        id: game._branch_id++,
        type: correct_branch_type(pd.tmpbranch[branchNum]),
        end1: { dnum: parent_dnum(game.dungeons[dgn].dname, pd), dlevel: 0 },
        end2: { dnum: dgn, dlevel: childEntryLevel },
        end1_up: pd.tmpbranch[branchNum].up ? true : false,
    };
    newBranch.end1.dlevel = parent_dlevel(game.dungeons[dgn].dname, pd);
    insert_branch(newBranch, false);
    return newBranch;
}

function init_dungeon_set_entry(pd, dngidx) {
    const dgn_entry = pd.tmpdungeon[dngidx].entry_lev;
    if (dgn_entry < 0) {
        game.dungeons[dngidx].entry_lev = game.dungeons[dngidx].num_dunlevs + dgn_entry + 1;
        if (game.dungeons[dngidx].entry_lev <= 0) game.dungeons[dngidx].entry_lev = 1;
    } else if (dgn_entry > 0) {
        game.dungeons[dngidx].entry_lev = dgn_entry;
        if (game.dungeons[dngidx].entry_lev > game.dungeons[dngidx].num_dunlevs)
            game.dungeons[dngidx].entry_lev = game.dungeons[dngidx].num_dunlevs;
    } else {
        game.dungeons[dngidx].entry_lev = 1;
    }
}

function init_dungeon_set_depth(pd, dngidx) {
    const br = add_branch(dngidx, game.dungeons[dngidx].entry_lev, pd);
    const fromDepth = (br.end1.dnum === dngidx) ? depth(br.end2) : depth(br.end1);
    const fromUp = (br.end1.dnum === dngidx) ? !br.end1_up : br.end1_up;
    game.dungeons[dngidx].depth_start = fromDepth
        + (br.type === BR_PORTAL ? 0 : (fromUp ? -1 : 1))
        - (game.dungeons[dngidx].entry_lev - 1);
}

function depth(lev) {
    return game.dungeons[lev.dnum].depth_start + lev.dlevel - 1;
}

function init_dungeon_levels(pd, dngidx, levels) {
    const nlevels = levels.length;
    pd.tmpdungeon[dngidx].levels = nlevels;
    for (let f = 0; f < nlevels; f++) {
        const lvl = levels[f];
        const tmpl = {
            name: lvl.name,
            boneschar: lvl.bonetag ? lvl.bonetag : 0,
            lev: { base: lvl.base, rand: lvl.range || 0 },
            chance: (lvl.chance == null ? 100 : lvl.chance),
            rndlevs: lvl.nlevels || 0,
            flags: flagsMask(lvl.flags) | alignFlag(lvl.alignment),
            chainlvl: lvl.chainlevel || null,
            chain: -1,
        };
        if (tmpl.chainlvl) {
            for (let bi = 0; bi < pd.n_levs + f; bi++) {
                if (pd.tmplevel[bi].name === tmpl.chainlvl) {
                    tmpl.chain = bi;
                    break;
                }
            }
            if (tmpl.chain === -1) throw new Error(`Could not chain level ${tmpl.name}`);
        }
        pd.tmplevel[pd.n_levs + f] = tmpl;
    }
    pd.n_levs += nlevels;
}

function init_dungeon_branches(pd, dngidx, branches) {
    const nbranches = branches.length;
    pd.tmpdungeon[dngidx].branches = nbranches;
    for (let f = 0; f < nbranches; f++) {
        const br = branches[f];
        const tmpb = {
            name: br.name,
            lev: { base: br.base, rand: br.range || 0 },
            type: branchType(br.branchtype || 'stair'),
            up: branchDir(br.direction || 'down'),
            chain: -1,
        };
        if (br.chainlevel) {
            for (let bi = 0; bi < pd.n_levs + f - 1; bi++) {
                if (pd.tmplevel[bi].name === br.chainlevel) {
                    tmpb.chain = bi;
                    break;
                }
            }
            if (tmpb.chain === -1) throw new Error(`Could not chain branch ${tmpb.name}`);
        }
        pd.tmpbranch[pd.n_brs + f] = tmpb;
    }
    pd.n_brs += nbranches;
}

function init_dungeon_dungeons(pd, dngidx, dgn) {
    const dgn_flags = flagsMask(dgn.flags);
    const dgn_align = alignFlag(dgn.alignment);
    const dgn_entry = dgn.entry || 0;
    const dgn_chance = (dgn.chance == null ? 100 : dgn.chance);
    if (dgn_chance && dgn_chance <= rn2(100)) {
        return false;
    }

    pd.tmpdungeon[dngidx] = {
        name: dgn.name,
        protoname: dgn.protofile || '',
        boneschar: dgn.bonetag || 0,
        lev: { base: dgn.base, rand: dgn.range || 0 },
        flags: dgn_flags,
        align: dgn_align,
        chance: dgn_chance,
        entry_lev: dgn_entry,
        levels: dgn.levels ? dgn.levels.length : 0,
        branches: dgn.branches ? dgn.branches.length : 0,
    };

    if (dgn.levels) init_dungeon_levels(pd, dngidx, dgn.levels);
    if (dgn.branches) init_dungeon_branches(pd, dngidx, dgn.branches);

    if (!game.dungeons) game.dungeons = [];
    const dptr = {
        dname: dgn.name,
        proto: dgn.protofile || '',
        fill_lvl: dgn.lvlfill || '',
        themerms: dgn.themerooms || '',
        boneid: dgn.bonetag || 0,
        num_dunlevs: dgn.range ? rn1(dgn.range, dgn.base) : dgn.base,
        ledger_start: 0,
        depth_start: 1,
        dunlev_ureached: 0,
        entry_lev: 1,
        flags: {
            hellish: !!(dgn_flags & HELLISH),
            maze_like: !!(dgn_flags & MAZELIKE),
            rogue_like: !!(dgn_flags & ROGUELIKE),
            align: dgn_align,
            unconnected: !!(dgn_flags & UNCONNECTED),
        },
    };

    if (!dngidx) {
        dptr.ledger_start = 0;
        dptr.depth_start = 1;
        dptr.dunlev_ureached = 1;
    } else {
        const prev = game.dungeons[dngidx - 1];
        dptr.ledger_start = prev.ledger_start + prev.num_dunlevs;
        dptr.dunlev_ureached = 0;
    }

    game.dungeons[dngidx] = dptr;

    init_dungeon_set_entry(pd, dngidx);
    if (dptr.flags.unconnected) {
        dptr.depth_start = 1;
    } else if (dngidx) {
        init_dungeon_set_depth(pd, dngidx);
    }

    if (dptr.num_dunlevs > MAXLEVEL) dptr.num_dunlevs = MAXLEVEL;
    return true;
}

function init_level(dgn, protoIndex, pd) {
    const tlevel = pd.tmplevel[protoIndex];
    pd.final_lev[protoIndex] = null;
    if (tlevel.chance <= rn2(100)) return;
    const newLevel = {
        proto: tlevel.name,
        boneid: tlevel.boneschar,
        dlevel: { dnum: dgn, dlevel: 0 },
        flags: {
            town: !!(tlevel.flags & TOWN),
            hellish: !!(tlevel.flags & HELLISH),
            maze_like: !!(tlevel.flags & MAZELIKE),
            rogue_like: !!(tlevel.flags & ROGUELIKE),
            align: ((tlevel.flags & D_ALIGN_MASK) >> 4) || ((pd.tmpdungeon[dgn].flags & D_ALIGN_MASK) >> 4),
        },
        rndlevs: tlevel.rndlevs,
        next: null,
    };
    pd.final_lev[protoIndex] = newLevel;
}

function possible_places(idx, map, pd) {
    const lev = pd.final_lev[idx];
    for (let i = 0; i <= MAXLEVEL; i++) map[i] = false;
    const lr = level_range(lev.dlevel.dnum, pd.tmplevel[idx].lev.base,
        pd.tmplevel[idx].lev.rand, pd.tmplevel[idx].chain, pd);
    for (let i = lr.base; i < lr.base + lr.count; i++) map[i] = true;
    let count = lr.count;
    for (let i = pd.start; i < idx; i++) {
        if (pd.final_lev[i] && map[pd.final_lev[i].dlevel.dlevel]) {
            map[pd.final_lev[i].dlevel.dlevel] = false;
            count--;
        }
    }
    return count;
}

function pick_level(map, nth) {
    for (let i = 1; i <= MAXLEVEL; i++) {
        if (map[i] && !nth--) return i;
    }
    throw new Error('pick_level: ran out of valid levels');
}

function place_level(protoIndex, pd) {
    if (protoIndex === pd.n_levs) return true;
    const lev = pd.final_lev[protoIndex];
    if (!lev) return place_level(protoIndex + 1, pd);
    const map = new Array(MAXLEVEL + 1).fill(false);
    let npossible = possible_places(protoIndex, map, pd);
    for (; npossible; --npossible) {
        lev.dlevel.dlevel = pick_level(map, rn2(npossible));
        if (place_level(protoIndex + 1, pd)) return true;
        map[lev.dlevel.dlevel] = false;
    }
    return false;
}

function add_level(newLev) {
    if (!game.sp_levchn) {
        game.sp_levchn = newLev;
        return;
    }
    let prev = null;
    let curr = game.sp_levchn;
    while (curr) {
        if (curr.dlevel.dnum === newLev.dlevel.dnum && curr.dlevel.dlevel > newLev.dlevel.dlevel) break;
        prev = curr;
        curr = curr.next;
    }
    if (!prev) {
        newLev.next = game.sp_levchn;
        game.sp_levchn = newLev;
    } else {
        newLev.next = curr;
        prev.next = newLev;
    }
}

function init_castle_tune() {
    game._castle_tune = '';
    for (let i = 0; i < 5; i++) {
        const ch = String.fromCharCode('A'.charCodeAt(0) + rn2(7));
        game._castle_tune += ch;
    }
}

export function init_dungeons() {
    const pd = createProto();
    game.branches = [];
    game.sp_levchn = null;
    game.dungeons = [];

    if (DUNGEON_DATA.length >= MAXDUNGEON) throw new Error('init_dungeons: too many dungeons');

    let cl = 0;
    let i = 0;
    pd.start = 0;
    pd.n_levs = 0;
    pd.n_brs = 0;

    for (const dgn of DUNGEON_DATA) {
        if (init_dungeon_dungeons(pd, i, dgn)) {
            for (; cl < pd.n_levs; cl++) init_level(i, cl, pd);
            if (!place_level(pd.start, pd)) throw new Error('init_dungeon: could not place levels');
            for (; pd.start < pd.n_levs; pd.start++) if (pd.final_lev[pd.start]) add_level(pd.final_lev[pd.start]);
            i++;
        }
    }

    init_castle_tune();
}
