// roledata.js — parse role.c to extract petnum per role.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let rolePetnumMap = null;

function parseRolePetnum() {
    try {
        const { readFileSync } = require('fs');
        const { join } = require('path');
        const path = join(process.cwd(), 'nethack-c', 'upstream', 'src', 'role.c');
        const raw = readFileSync(path, 'utf8');
        const lines = raw.split(/\n/);
        const map = new Map();

        let currentRole = null;
        let tokens = [];
        for (const line of lines) {
            const roleMatch = line.match(/^(\s*)\{\s*\{\s*\"([^\"]+)\"/);
            if (roleMatch && roleMatch[1].length <= 4) {
                currentRole = roleMatch[2];
                tokens = [];
            }
            if (!currentRole) continue;
            const matches = line.match(/\b(?:PM_[A-Z0-9_]+|NON_PM)\b/g);
            if (matches) tokens.push(...matches);
            if (tokens.length >= 2) {
                map.set(currentRole, tokens[1]);
                currentRole = null;
                tokens = [];
            }
        }
        return map;
    } catch {
        return new Map();
    }
}

export function getRolePetnum(roleName) {
    if (!rolePetnumMap) rolePetnumMap = parseRolePetnum();
    return rolePetnumMap.get(roleName) || 'NON_PM';
}
