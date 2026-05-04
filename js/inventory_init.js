// inventory_init.js — RNG-only simulation of starting inventory.
// C ref: u_init.c (trobj tables + u_init_role).

import { rn2, rnd } from './rng.js';

const ROLE_INVENTORY_RANGES = {
    Archeologist: [
        { min: 1, max: 1 }, // bullwhip
        { min: 1, max: 1 }, // leather jacket
        { min: 1, max: 1 }, // fedora
        { min: 3, max: 3 }, // food ration
        { min: 1, max: 1 }, // pick-axe
        { min: 1, max: 1 }, // tinning kit
        { min: 1, max: 1 }, // touchstone
        { min: 1, max: 1 }, // sack
    ],
    Barbarian: [
        { min: 1, max: 1 }, // two-handed sword or battle axe
        { min: 1, max: 1 }, // axe or short sword
        { min: 1, max: 1 }, // ring mail
        { min: 1, max: 1 }, // food ration
    ],
    Caveman: [
        { min: 1, max: 1 }, // club
        { min: 1, max: 1 }, // sling
        { min: 10, max: 20 }, // flint
        { min: 3, max: 3 }, // rock
        { min: 1, max: 1 }, // leather armor
    ],
    Healer: [
        { min: 1, max: 1 }, // scalpel
        { min: 1, max: 1 }, // leather gloves
        { min: 1, max: 1 }, // stethoscope
        { min: 4, max: 4 }, // pot healing
        { min: 4, max: 4 }, // pot extra healing
        { min: 1, max: 1 }, // wand sleep
        { min: 1, max: 1 }, // spellbook healing
        { min: 1, max: 1 }, // spellbook extra healing
        { min: 1, max: 1 }, // spellbook stone to flesh
        { min: 5, max: 5 }, // apple
    ],
    Knight: [
        { min: 1, max: 1 }, // long sword
        { min: 1, max: 1 }, // lance
        { min: 1, max: 1 }, // ring mail
        { min: 1, max: 1 }, // helmet
        { min: 1, max: 1 }, // small shield
        { min: 1, max: 1 }, // leather gloves
        { min: 10, max: 10 }, // apple
        { min: 10, max: 10 }, // carrot
    ],
    Monk: [
        { min: 1, max: 1 }, // leather gloves
        { min: 1, max: 1 }, // robe
        { min: 1, max: 1, random: true }, // random scroll
        { min: 3, max: 3 }, // pot healing
        { min: 3, max: 3 }, // food ration
        { min: 5, max: 5 }, // apple
        { min: 5, max: 5 }, // orange
        { min: 3, max: 3 }, // fortune cookie
    ],
    Priest: [
        { min: 1, max: 1 }, // mace
        { min: 1, max: 1 }, // robe
        { min: 1, max: 1 }, // small shield
        { min: 4, max: 4 }, // pot water
        { min: 1, max: 1 }, // garlic
        { min: 1, max: 1 }, // wolfsbane
        { min: 2, max: 2, random: true }, // random spellbook
    ],
    Ranger: [
        { min: 1, max: 1 }, // dagger
        { min: 1, max: 1 }, // bow
        { min: 50, max: 59 }, // arrows
        { min: 30, max: 39 }, // arrows
        { min: 1, max: 1 }, // cloak of displacement
        { min: 4, max: 4 }, // cram ration
    ],
    Rogue: [
        { min: 1, max: 1 }, // short sword
        { min: 6, max: 15 }, // dagger
        { min: 1, max: 1 }, // leather armor
        { min: 1, max: 1 }, // potion of sickness
        { min: 1, max: 1 }, // lock pick
        { min: 1, max: 1 }, // sack
    ],
    Samurai: [
        { min: 1, max: 1 }, // katana
        { min: 1, max: 1 }, // short sword
        { min: 1, max: 1 }, // yumi
        { min: 26, max: 45 }, // ya
        { min: 1, max: 1 }, // splint mail
    ],
    Tourist: [
        { min: 21, max: 40 }, // darts
        { min: 10, max: 10, random: true }, // random food
        { min: 2, max: 2 }, // pot extra healing
        { min: 4, max: 4 }, // scroll magic mapping
        { min: 1, max: 1 }, // hawaiian shirt
        { min: 1, max: 1 }, // camera
        { min: 1, max: 1 }, // credit card
    ],
    Valkyrie: [
        { min: 1, max: 1 }, // spear
        { min: 1, max: 1 }, // dagger
        { min: 1, max: 1 }, // small shield
        { min: 1, max: 1 }, // food ration
    ],
    Wizard: [
        { min: 1, max: 1 }, // quarterstaff
        { min: 1, max: 1 }, // cloak of magic resistance
        { min: 1, max: 1, random: true }, // random wand
        { min: 2, max: 2, random: true }, // random rings
        { min: 3, max: 3, random: true }, // random potions
        { min: 3, max: 3, random: true }, // random scrolls
        { min: 1, max: 1 }, // force bolt
        { min: 1, max: 1, random: true }, // random spellbook
        { min: 1, max: 1 }, // magic marker
    ],
};

export function consume_role_inventory_rng(roleName) {
    const list = ROLE_INVENTORY_RANGES[roleName] || [];
    for (const item of list) {
        if (item.min === 0) continue;
        if (item.random) {
            // mkobj/next_ident uses rnd(2) in some cases; consume minimal RNG.
            rnd(2);
            rn2(6);
            rn2(11);
            rn2(10);
            rn2(10);
            rn2(100);
        }
        if (item.min !== item.max) rn2(item.max - item.min + 1);
    }
}

export function consume_role_extras_rng(roleName) {
    switch (roleName) {
    case 'Archeologist':
        if (rn2(10) !== 0) {
            if (rn2(4) !== 0) rn2(5);
        }
        break;
    case 'Barbarian':
        rn2(100);
        rn2(6);
        break;
    case 'Healer':
        rn2(25);
        break;
    case 'Monk':
        rn2(90);
        if (rn2(4) !== 0) rn2(10);
        break;
    case 'Priest':
        if (rn2(5) !== 0) rn2(10);
        break;
    case 'Rogue':
        rn2(5);
        break;
    case 'Samurai':
        rn2(5);
        break;
    case 'Tourist':
        if (rn2(25) !== 0) {
            if (rn2(25) !== 0) {
                if (rn2(25) !== 0) rn2(20);
            }
        }
        break;
    case 'Valkyrie':
        rn2(6);
        break;
    case 'Wizard':
        rn2(5);
        break;
    default:
        break;
    }
}
