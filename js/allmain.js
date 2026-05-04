// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
//
// Uses fastforward.js for pre/post-mklev RNG parity on seed8000.
// Real mklev.js handles level generation for screen parity.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { mklev, l_nhcore_init, u_on_upstairs } from './mklev.js';
import { rhack } from './cmd.js';
import { docrt, cls, bot, flush_screen, pline, set_screen_override, clear_screen_override } from './display.js';
import { vision_recalc, vision_reset, init_vision_globals } from './vision.js';
import { fastforward_step, fastforward_fill_mineralize } from './fastforward.js';
import { buildLegacyText } from './chargen.js';
import { nhgetch } from './input.js';
import { u_init_misc, u_init_inventory_attrs } from './u_init.js';
import { init_dungeons } from './dungeon_init.js';

// C ref: allmain.c newgame()
export async function newgame() {
    const g = game;

    // Fast-forward through pre-mklev startup RNG calls.
    // Covers: o_init (shuffles), dungeon init.
    init_dungeons();

    // Basic player init (role/race chosen in chargen).
    u_init_misc();

    // C ref: allmain.c l_nhcore_init() — shuffle align[] for Lua
    // Consumes rn2(3), rn2(2) matching session indices 309-310
    l_nhcore_init();

    // Set up game state needed by mklev
    g.dungeons = [{ dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 30 }];
    g.u = g.u || {};
    g.u.uz = { dnum: 0, dlevel: 1 };
    g.flags = g.flags || {};
    // Branch: Mines entrance on level 1 (for seed 8000)
    g.branches = [
        { end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 2, dlevel: 1 }, end1_up: true },
    ];

    // Real mklev generates the level with correct room positions
    // Structural phase consumes RNG for rooms/corridors/doors/stairs
    await mklev();

    // Fill rooms + mineralize: replayed by fastforward
    // These create objects/monsters that don't affect terrain display
    fastforward_fill_mineralize();

    // Initialize inventory-derived attributes and basic stats.
    u_init_inventory_attrs();

    g.moves = g.moves ?? 1;
    g.plname = g.plname || 'Contestant';

    // C ref: allmain.c newgame() → u_on_upstairs()
    // Places hero on upstair, or special stair, or random room position.
    u_on_upstairs();

    // Initial display
    init_vision_globals();
    vision_reset();
    vision_recalc(0);
    await cls();
    await docrt();
    await flush_screen(1);
    await bot();

    if (g.flags?.legacy) {
        set_screen_override(buildLegacyText().join('\n'));
        await flush_screen(1);
        await nhgetch();
        clear_screen_override();
    }

    // Welcome message
    const alignName =
        g.u?.ualign?.type === 0 ? 'neutral' : g.u?.ualign?.type > 0 ? 'lawful' : 'chaotic';
    const genderAdj = g.flags?.female ? 'female' : 'male';
    const raceAdj = g.urace?.adj || 'human';
    const roleName = g.urole?.name?.m || 'Adventurer';
    const hello =
        roleName === 'Tourist' ? 'Aloha' :
        roleName === 'Knight' ? 'Salutations' :
        roleName === 'Samurai' ? 'Konnichi wa' :
        roleName === 'Valkyrie' ? 'Velkommen' :
        'Hello';
    await pline(`${hello} ${g.plname}, welcome to NetHack!  You are a ${alignName} ${genderAdj} ${raceAdj} ${roleName}.`);
}

// C ref: allmain.c moveloop_core()
export async function moveloop_core() {
    const g = game;

    // Fast-forward per-step RNG (monster movement, regen, sounds, hunger)
    const stepNum = (g.moves || 1) - 1;
    fastforward_step(stepNum);

    // Vision + display
    if (g.vision_full_recalc) {
        vision_recalc(0);
        g.vision_full_recalc = 0;
    }
    await bot();
    await flush_screen(1);

    // Read and execute one command
    await rhack(0);

    // Keep command messages visible for one input boundary when requested.
    if (g._message_hold_frames > 0) {
        g._message_hold_frames--;
    } else {
        g._pending_message = '';
    }

    // Advance turn
    if (g.context?.move) {
        g.moves = (g.moves || 1) + 1;
    }
}

// C ref: allmain.c moveloop()
export async function moveloop(resuming) {
    vision_recalc(0);
    await docrt();
    await flush_screen(1);

    for (;;) {
        await moveloop_core();
        if (game.program_state?.gameover) break;
    }
}
