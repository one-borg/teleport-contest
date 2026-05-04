// pet.js — starting pet RNG consumption (dog.c makedog/pet_type).

import { d, rn2, rnd } from './rng.js';
import { game } from './gstate.js';
import { getRolePetnum } from './roledata.js';
import { depth as depth_of_level } from './hacklib.js';
import { enexto_core } from './teleport.js';
import { CLR_WHITE } from './terminal.js';

export function consume_pet_type_rng() {
    if (game.preferred_pet === 'n') return;
    const roleName = game.urole?.name?.m || '';
    const petnum = getRolePetnum(roleName);
    if (petnum !== 'NON_PM') return;
    if (game.preferred_pet === 'c' || game.preferred_pet === 'd') return;
    rn2(2);
}

const PET_MLEVEL = {
    PM_LITTLE_DOG: 2,
    PM_KITTEN: 2,
    PM_PONY: 3,
};

function pet_type() {
    const roleName = game.urole?.name?.m || '';
    const petnum = getRolePetnum(roleName);
    if (petnum !== 'NON_PM') return petnum;
    if (game.preferred_pet === 'c') return 'PM_KITTEN';
    if (game.preferred_pet === 'd') return 'PM_LITTLE_DOG';
    return rn2(2) ? 'PM_KITTEN' : 'PM_LITTLE_DOG';
}

function adj_lev(mlevel) {
    let tmp = mlevel;
    if (tmp > 49) return 50;
    const difficulty = depth_of_level(game.u?.uz);
    let tmp2 = difficulty - tmp;
    if (tmp2 < 0) tmp--;
    else tmp += Math.trunc(tmp2 / 5);
    tmp2 = (game.u?.ulevel || 1) - mlevel;
    if (tmp2 > 0) tmp += Math.trunc(tmp2 / 4);
    let levLimit = Math.trunc((3 * mlevel) / 2);
    if (levLimit > 49) levLimit = 49;
    if (tmp > levLimit) return levLimit;
    return tmp > 0 ? tmp : 0;
}

function newmonhp_for_pet(mlevel) {
    const adj = adj_lev(mlevel);
    if (!adj) {
        rnd(4);
        return;
    }
    d(adj, 8);
}

export function makedog_stub() {
    if (game.preferred_pet === 'n') {
        game.context = game.context || {};
        game.context.startingpet_typ = 'NON_PM';
        return null;
    }

    const pettype = pet_type();
    game.context = game.context || {};
    game.context.startingpet_typ = pettype;

    let spot = null;
    if (game.u?.ux != null && game.u?.uy != null) {
        spot = enexto_core(game.u.ux, game.u.uy, 3, 0);
    }

    // makemon() core RNG for pets
    rnd(2); // next_ident
    newmonhp_for_pet(PET_MLEVEL[pettype] || 1);
    rn2(2); // gender

    if (spot && game.level) {
        if (!game.level.monsters) game.level.monsters = [];
        const glyph = pettype === 'PM_KITTEN' ? 'f' : pettype === 'PM_PONY' ? 'u' : 'd';
        game.level.monsters.push({ mx: spot.x, my: spot.y, glyph, color: CLR_WHITE, pet: true });
    }

    return { pettype };
}
