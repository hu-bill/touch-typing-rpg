import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewSave, loadSave, writeSave, SAVE_KEY } from '../src/core/save.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('roundtrip', () => {
  const st = memoryStorage();
  const s = createNewSave();
  s.player.gold = 123;
  writeSave(s, st);
  const loaded = loadSave(st);
  assert.equal(loaded.player.gold, 123);
});

test('deepMerge fills missing keys from defaults', () => {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ player: { gold: 5 }, settings: { layout: 'qwertz' } }));
  const loaded = loadSave(st);
  assert.equal(loaded.player.gold, 5);
  assert.equal(loaded.player.level, 1);
  assert.equal(loaded.settings.layout, 'qwertz');
  assert.equal(loaded.settings.guide, 'hints');
  assert.ok(Array.isArray(loaded.inventory));
});

test('invalid json returns null', () => {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, '{nope');
  assert.equal(loadSave(st), null);
});

test('old saves get the v1.1 stats keys at 0', () => {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ stats: { totalKills: 9 } }));
  const loaded = loadSave(st);
  assert.equal(loaded.stats.totalKills, 9);
  for (const k of ['milestonesReached', 'boonsTaken', 'bestBoonCount', 'eventsCompleted']) assert.equal(loaded.stats[k], 0, k);
});
