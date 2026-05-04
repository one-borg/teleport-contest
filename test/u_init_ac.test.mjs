import test from 'node:test';
import assert from 'node:assert/strict';

import { computeStartingAC } from '../js/u_init.js';

test('u_init: starting AC matches role inventory bonuses', () => {
    assert.equal(computeStartingAC('Rogue'), 7);
    assert.equal(computeStartingAC('Tourist'), 10);
});
