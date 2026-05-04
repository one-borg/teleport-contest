import test from 'node:test';
import assert from 'node:assert/strict';

import { getRolePetnum } from '../js/roledata.js';

test('roledata: petnum mapping matches role.c', () => {
    assert.equal(getRolePetnum('Knight'), 'PM_PONY');
    assert.equal(getRolePetnum('Archeologist'), 'NON_PM');
});

test('roledata: unknown role defaults to NON_PM', () => {
    assert.equal(getRolePetnum('NotARole'), 'NON_PM');
});
