// teleport.js — helpers for teleport placement and coordinate collection.

import {
    COLNO,
    ROWNO,
    CC_INCL_CENTER,
    CC_UNSHUFFLED,
    CC_RING_PAIRS,
    CC_SKIP_MONS,
    CC_SKIP_INACCS,
    STONE,
    SPACE_POS,
} from './const.js';
import { rn2 } from './rng.js';
import { game } from './gstate.js';

function m_at(x, y) {
    const mons = game.level?.monsters || [];
    return mons.find((m) => m?.mx === x && m?.my === y) || null;
}

function zap_pos(typ) {
    if (typ === undefined || typ === null) return false;
    return typ !== STONE;
}

function goodpos(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return false;
    if (!SPACE_POS(loc.typ)) return false;
    if (game.u?.ux === x && game.u?.uy === y) return false;
    if (m_at(x, y)) return false;
    return true;
}

export function collect_coords(cx, cy, maxradius, cc_flags, filter = null) {
    const include_cxcy = (cc_flags & CC_INCL_CENTER) !== 0;
    const scramble = (cc_flags & CC_UNSHUFFLED) === 0;
    const ring_pairs = scramble && (cc_flags & CC_RING_PAIRS) !== 0;
    const skip_mons = (cc_flags & CC_SKIP_MONS) !== 0;
    const skip_inaccs = (cc_flags & CC_SKIP_INACCS) !== 0;

    const rowrange = (cy < ROWNO / 2) ? (ROWNO - 1 - cy) : cy;
    const colrange = (cx < COLNO / 2) ? (COLNO - 1 - cx) : cx;
    let k = Math.max(rowrange, colrange);

    if (!maxradius) maxradius = k;
    else maxradius = Math.min(maxradius, k);

    const coords = [];
    let passStart = 0;
    let n = 0;

    for (let radius = include_cxcy ? 0 : 1; radius <= maxradius; radius++) {
        let newpass;
        let passend;
        if (!ring_pairs) {
            newpass = true;
            passend = true;
        } else {
            newpass = ((radius % 2) !== 0 || radius === 0);
            passend = ((radius % 2) === 0 || radius === maxradius);
        }
        if (newpass) {
            passStart = coords.length;
            n = 0;
        }

        const lox = cx - radius;
        const hix = cx + radius;
        const loy = cy - radius;
        const hiy = cy + radius;

        for (let y = Math.max(loy, 0); y <= hiy; y++) {
            if (y > ROWNO - 1) break;
            for (let x = Math.max(lox, 1); x <= hix; x++) {
                if (x > COLNO - 1) break;
                if (x !== lox && x !== hix && y !== loy && y !== hiy) continue;
                if (skip_mons && m_at(x, y)) continue;
                if (skip_inaccs && !zap_pos(game.level?.at(x, y)?.typ)) continue;
                if (filter && !filter(x, y)) continue;
                coords.push({ x, y });
                n++;
            }
        }

        if (scramble && passend) {
            let idx = passStart;
            let remain = n;
            while (remain > 1) {
                const pick = rn2(remain);
                if (pick) {
                    const tmp = coords[idx];
                    coords[idx] = coords[idx + pick];
                    coords[idx + pick] = tmp;
                }
                idx++;
                remain--;
            }
        }
    }

    return coords;
}

export function enexto_core(cx, cy, maxradius = 3, cc_flags = 0) {
    const coords = collect_coords(cx, cy, maxradius, cc_flags, null);
    for (const c of coords) {
        if (goodpos(c.x, c.y)) return c;
    }
    return { x: cx, y: cy };
}
