import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedChars, charWeight, newCharsForZone, charInfo } from '../src/logic/keyboard.js';
import { ZONES } from '../src/data/zones.js';

test('home row zone chars per layout', () => {
  assert.deepEqual([...allowedChars('qwerty', 0)].sort(), [' ', ';', 'a', 'd', 'f', 'j', 'k', 'l', 's'].sort());
  assert.deepEqual([...allowedChars('qwertz', 0)].sort(), [' ', 'a', 'd', 'f', 'j', 'k', 'l', 's', 'ö'].sort());
});

test('shift zone adds uppercase, earlier zones do not', () => {
  const citadel = ZONES.findIndex((z) => z.id === 'citadel');
  for (const l of ['qwerty', 'qwertz']) {
    assert.ok(!allowedChars(l, citadel - 1).has('A'));
    assert.ok(allowedChars(l, citadel).has('A'));
    assert.ok(newCharsForZone(l, citadel).has('Q'));
  }
});

test('y and z follow physical positions', () => {
  // QWERTZ: z is on KeyY (ember, zone 2), y on KeyZ (archive, zone 5)
  assert.ok(allowedChars('qwertz', 2).has('z'));
  assert.ok(!allowedChars('qwertz', 2).has('y'));
  assert.ok(allowedChars('qwerty', 2).has('y'));
  assert.ok(!allowedChars('qwerty', 2).has('z'));
});

test('weights grow with difficulty', () => {
  for (const l of ['qwerty', 'qwertz']) {
    assert.ok(charWeight(l, 'A') > charWeight(l, 'a'));
    assert.ok(charWeight(l, '1') > charWeight(l, 'q'));
    assert.ok(charWeight(l, 'q') > charWeight(l, 'f'));
    assert.ok(charWeight(l, ' ') < charWeight(l, 'f'));
  }
  assert.ok(charWeight('qwertz', '{') > charWeight('qwerty', '{'));
});

test('dead keys never allowed', () => {
  const all = allowedChars('qwertz', ZONES.length - 1);
  for (const dead of ['^', '´', '`']) assert.ok(!all.has(dead), `dead key ${dead} allowed`);
  assert.equal(charInfo('qwertz', '{').altgr, true);
});
