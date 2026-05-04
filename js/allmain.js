// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
//
// Uses fastforward.js for pre/post-mklev RNG parity on seed8000.
// Real mklev.js handles level generation for screen parity.

import { game } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { mklev, l_nhcore_init, u_on_upstairs } from './mklev.js';
import { rhack, openTutorialPrompt } from './cmd.js';
import { docrt, cls, bot, flush_screen, pline, set_screen_override, clear_screen_override } from './display.js';
import { vision_recalc, vision_reset, init_vision_globals } from './vision.js';
import { fastforward_step } from './fastforward.js';
import { buildLegacyText } from './chargen.js';
import { nhgetch } from './input.js';
import { u_init_misc, u_init_inventory_attrs, applyStartingAC } from './u_init.js';
import { init_dungeons } from './dungeon_init.js';
import { init_objects } from './o_init.js';
import { makedog_stub } from './pet.js';

// C ref: allmain.c newgame()
export async function newgame() {
    const g = game;

    // Object and dungeon initialization (RNG parity critical).
    init_objects();
    init_dungeons();

    // Basic player init (role/race chosen in chargen).
    u_init_misc();

    // C ref: allmain.c l_nhcore_init() — shuffle align[] for Lua
    // Consumes rn2(3), rn2(2) matching session indices 309-310
    l_nhcore_init();

    // Set up game state needed by mklev
    g.u = g.u || {};
    g.u.uz = { dnum: 0, dlevel: 1 };
    g.flags = g.flags || {};
    if (!g.dungeons || g.dungeons.length === 0) {
        g.dungeons = [{ dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 30 }];
    }

    // Real mklev generates the level with correct room positions
    // Structural phase consumes RNG for rooms/corridors/doors/stairs
    await mklev();

    g.moves = g.moves ?? 1;
    g.plname = g.plname || 'Contestant';

    // C ref: allmain.c newgame() → u_on_upstairs()
    // Places hero on upstair, or special stair, or random room position.
    u_on_upstairs();

    // Starting pet creation (makedog/pet_type RNG + placement).
    makedog_stub();

    // Initialize inventory-derived attributes and basic stats.
    u_init_inventory_attrs();

    // C Lua core shuffle observed after inventory init in session logs.
    if (g.flags?.legacy) {
        rn2(3);
        rn2(2);
    }

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

    // Apply starting AC after legacy splash (C computes it before welcome).
    applyStartingAC();

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
    if (g.flags?.tutorial) {
        if (g._pending_message != null) g._pending_message += '--More--';
        g._message_hold_frames = 1;
        g._tutorial_prompt_armed = true;
    } else {
        g._message_hold_frames = 0;
    }
}

// C ref: allmain.c moveloop_core()
export async function moveloop_core() {
    const g = game;
    if (!g._did_moveloop_preamble) {
        moveloop_preamble(false);
        g._did_moveloop_preamble = true;
    }

    // Vision + display
    if (g.vision_full_recalc) {
        vision_recalc(0);
        g.vision_full_recalc = 0;
    }
    await bot();
    await flush_screen(1);

    if (g._tutorial_prompt_pending && !g.uiMode) {
        openTutorialPrompt();
        g._tutorial_prompt_pending = false;
        await flush_screen(1);
    }

    // Read and execute one command
    await rhack(0);

    // Fast-forward per-step RNG (monster movement, regen, sounds, hunger)
    if (g.context?.move) {
        if (g.urole?.name?.m === 'Tourist') {
            const stepNum = g.moves || 1;
            fastforward_step(stepNum);
        } else {
            turn_rng_stub();
        }
    }

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

function moveloop_preamble(resuming) {
    if (!resuming) {
        rnd(9000);
        rnd(30);
    }
}

function turn_rng_stub() {
    rn2(12);
    rn2(12);
    rn2(70);
    rn2(400);
    rn2(20);
    rn2(94);
}

// C ref: allmain.c moveloop()
export async function moveloop(resuming) {
    moveloop_preamble(resuming);
    vision_recalc(0);
    await docrt();
    await flush_screen(1);

    for (;;) {
        await moveloop_core();
        if (game.program_state?.gameover) break;
    }
}
