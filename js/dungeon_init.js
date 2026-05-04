// dungeon_init.js — Scaffold for init_dungeons() RNG parity.
// C ref: dungeon.c init_dungeons().
//
// TODO: Replace fastforward replay with real dungeon Lua parsing and
// placement logic.

import { fastforward_pre_mklev } from './fastforward.js';

// TODO: implement real dungeon init from dungeon.lua via Lua port.
function init_dungeon_dungeons_scaffold() {
    // Placeholder for init_dungeon_dungeons() + init_level() + place_level().
}

function init_castle_tune_scaffold() {
    // Placeholder for init_castle_tune(). RNG consumed in fastforward_pre_mklev().
}

export function init_dungeons_scaffold() {
    // Current placeholder uses the seed8000 replay sequence.
    // This keeps RNG alignment for the skeleton while we port the real logic.
    fastforward_pre_mklev();
}

export function init_dungeons() {
    // Structural scaffold mirroring dungeon.c init_dungeons().
    init_dungeon_dungeons_scaffold();
    init_castle_tune_scaffold();
    init_dungeons_scaffold();
}
