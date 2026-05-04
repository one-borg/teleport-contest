import test from 'node:test';
import assert from 'node:assert/strict';

import { getGemProbTable, getGemProbTotal } from '../js/objdata.js';

test('objdata: gem probability table parses objects.h', () => {
    const table = getGemProbTable();
    const bySn = new Map(table.map((entry) => [entry.sn, entry.prob]));

    assert.equal(bySn.get('ROCK'), 100);
    assert.equal(bySn.get('LUCKSTONE'), 10);
    assert.equal(bySn.get('LOADSTONE'), 10);
    assert.equal(bySn.get('TOUCHSTONE'), 8);
    assert.ok(getGemProbTotal() > 0);
});
