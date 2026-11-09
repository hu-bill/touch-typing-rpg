import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestGoals } from '../src/logic/goals.js';
import { createNewSave, zoneState } from '../src/core/save.js';
import { xpToNext } from '../src/logic/progression.js';
import { recordKey } from '../src/logic/mastery.js';

const opts = { layoutId: 'qwerty', zoneIndex: 0 };

function check(goals, max = 3) {
  assert.ok(goals.length <= max);
  assert.equal(new Set(goals.map((g) => g.id)).size, goals.length);
  for (const g of goals) assert.ok(g.progress >= 0 && g.progress <= 1, `${g.id} ${g.progress}`);
}

test('boss kills goal', () => {
  const s = createNewSave();
  zoneState(s, 'meadow').kills = 4;
  const g = nearestGoals(s, opts);
  check(g);
  assert.ok(g.some((x) => x.text.includes('2 more kills')));
});

test('level goal first when almost there', () => {
  const s = createNewSave();
  s.player.xp = xpToNext(1) - 3;
  const g = nearestGoals(s, opts);
  check(g);
  assert.equal(g[0].id, 'level');
  assert.ok(g[0].text.includes('3 XP'));
});

test('rune goal', () => {
  const s = createNewSave();
  for (let i = 0; i < 18; i++) recordKey(s.keyStats, 'f', true, 200);
  const g = nearestGoals(s, opts);
  check(g);
  const rune = g.find((x) => x.id === 'rune');
  assert.ok(rune && rune.text.includes('f') && rune.text.includes('2 more presses'), JSON.stringify(g));
});

test('limits, ranges and unlocked achievements', () => {
  const s = createNewSave();
  s.stats.bestCombo = 45;
  s.stats.itemsSinceLegendary = 120;
  s.player.gold = 40;
  s.player.xp = 10;
  for (let i = 0; i < 18; i++) recordKey(s.keyStats, 'j', true, 200);
  for (const max of [1, 2, 3, 6]) check(nearestGoals(s, { ...opts, max }), max);
  assert.ok(nearestGoals(s, { ...opts, max: 6 }).some((g) => g.text.includes('In the Flow')));
  s.achievements.combo50 = Date.now();
  assert.ok(!nearestGoals(s, { ...opts, max: 6 }).some((g) => g.text.includes('In the Flow')));
});
