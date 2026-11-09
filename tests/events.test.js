import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollHuntEvent, eventText, mimicTimeLimit, traderPrice, tickMods, altarMod } from '../src/logic/events.js';
import { EVENT_TEXT } from '../src/data/events.js';
import { createHunt } from '../src/logic/progression.js';
import { allowedChars, isTextAllowed } from '../src/logic/keyboard.js';
import { ZONES } from '../src/data/zones.js';
import { createRng } from '../src/core/rng.js';

const always = { chance: () => true, weighted: (items) => items[0] };
const hunt = (extra = {}) => ({ ...createHunt('hunt', 0), chain: 5, ...extra });

test('events are gated', () => {
  assert.equal(rollHuntEvent(always, hunt({ chain: 1 })), null);
  assert.equal(rollHuntEvent(always, hunt({ lastWasEvent: true })), null);
  assert.equal(rollHuntEvent(always, hunt({ lure: true })), null);
  assert.equal(rollHuntEvent(always, hunt({ mode: 'boss' })), null);
  assert.equal(rollHuntEvent(always, null), null);
  assert.ok(rollHuntEvent(always, hunt()));
});

test('event rate and trader gate', () => {
  let n = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const ev = rollHuntEvent(createRng(seed), hunt());
    if (ev) {
      n += 1;
      assert.notEqual(ev.id, 'trader');
    }
  }
  assert.ok(n >= 160 && n <= 240, `rate ${n / 10}%`);
  let trader = false;
  for (let seed = 1; seed <= 2000 && !trader; seed++) trader = rollHuntEvent(createRng(seed), hunt({ satchel: 100 }))?.id === 'trader';
  assert.ok(trader, 'trader appears with a full satchel');
});

test('mimic time limit and trader price', () => {
  assert.ok(Math.abs(mimicTimeLimit(20, 25) - 15.36) < 0.05);
  assert.equal(mimicTimeLimit(2, 25), 4);
  assert.equal(mimicTimeLimit(200, 25), 20);
  assert.equal(traderPrice(10), 20);
  assert.equal(traderPrice(200), 60);
});

test('tickMods expires mods', () => {
  const h = hunt({ mods: [altarMod()] });
  tickMods(h);
  tickMods(h);
  assert.equal(h.mods.length, 1);
  tickMods(h);
  assert.equal(h.mods.length, 0);
});

test('event text uses only allowed characters', () => {
  const rng = createRng(21);
  for (const layoutId of ['qwerty', 'qwertz']) {
    for (let z = 0; z < ZONES.length; z++) {
      const allowed = allowedChars(layoutId, z);
      for (const id of Object.keys(EVENT_TEXT)) {
        const text = eventText(id, { layoutId, zoneIndex: z, rng });
        assert.ok(text && isTextAllowed(text, allowed), `${layoutId} ${z} ${id}: ${text}`);
      }
    }
  }
});
