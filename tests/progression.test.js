import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  xpToNext, addXp, grantVictory, bossAvailable, chainMilestone, nextChainMilestone, prevChainMilestoneAt,
  grantChainMilestone, spawnEnemy, huntHeat,
} from '../src/logic/progression.js';
import { RARITY_INDEX } from '../src/data/items.js';
import { BAL } from '../src/data/balance.js';
import { generateItem } from '../src/logic/loot.js';
import { createNewSave, zoneState } from '../src/core/save.js';
import { computePlayerStats } from '../src/logic/stats.js';
import { createRng } from '../src/core/rng.js';

test('xp curve is monotonic', () => {
  for (let l = 1; l < 60; l++) assert.ok(xpToNext(l + 1) > xpToNext(l));
});

test('addXp levels up and grants points', () => {
  const save = createNewSave();
  const gained = addXp(save, xpToNext(1) + xpToNext(2) + 1);
  assert.equal(gained, 2);
  assert.equal(save.player.level, 3);
  assert.equal(save.player.points, 2);
});

test('kills unlock the boss; boss unlocks next zone', () => {
  const save = createNewSave();
  const stats = computePlayerStats(save);
  const rng = createRng(4);
  for (let i = 0; i < 6; i++) grantVictory(save, { zoneIndex: 0, kind: 'mob', stats, rng });
  assert.ok(bossAvailable(save, 0));
  const r = grantVictory(save, { zoneIndex: 0, kind: 'boss', stats, rng });
  assert.equal(r.zoneUnlocked, 1);
  assert.equal(save.unlockedZone, 1);
  assert.ok(zoneState(save, 'meadow').bossDefeated);
  assert.ok(r.items.length === 2);
  assert.ok(r.gold > 0 && r.xp > 0);
});

test('rewardMult scales xp and gold', () => {
  const a = createNewSave();
  const b = createNewSave();
  const stats = computePlayerStats(a);
  const r1 = grantVictory(a, { zoneIndex: 3, kind: 'mob', stats, rng: createRng(7) });
  const r2 = grantVictory(b, { zoneIndex: 3, kind: 'mob', stats, rng: createRng(7), rewardMult: 1.35 });
  assert.ok(r2.xp > r1.xp);
  assert.ok(r2.gold > r1.gold);
});

test('chain milestones', () => {
  const at = [];
  for (let c = 1; c <= 30; c++) if (chainMilestone(c)) at.push(c);
  assert.deepEqual(at, [3, 5, 7, 10, 15, 20, 25, 30]);
  assert.equal(chainMilestone(20).id, 'vault');
  assert.equal(chainMilestone(30).id, 'vault');
  assert.equal(chainMilestone(15).id, 'gilded');
  assert.equal(chainMilestone(15).chain, 15);
  assert.equal(nextChainMilestone(0).chain, 3);
  assert.equal(nextChainMilestone(7).chain, 10);
  assert.equal(nextChainMilestone(10).chain, 15);
  assert.equal(prevChainMilestoneAt(4), 3);
  assert.equal(prevChainMilestoneAt(2), 0);
});

test('granting chain milestones', () => {
  const save = createNewSave();
  const stats = computePlayerStats(save);
  const rng = createRng(12);
  const r = grantChainMilestone(save, { milestone: chainMilestone(5), zoneIndex: 2, stats, rng });
  assert.equal(r.items.length, 1);
  assert.ok(RARITY_INDEX[r.items[0].rarity] >= 1);
  assert.equal(save.stats.milestonesReached, 1);
  while (save.inventory.length < BAL.inventorySize) save.inventory.push(generateItem({ rng, ilvl: 1, rarity: 'common' }));
  const full = grantChainMilestone(save, { milestone: chainMilestone(3), zoneIndex: 2, stats, rng });
  assert.equal(full.items.length, 0);
  assert.equal(full.autoSold.length, 1);
  assert.ok(full.gold > 0);
  const lure = grantChainMilestone(save, { milestone: chainMilestone(7), zoneIndex: 2, stats, rng });
  assert.deepEqual(lure.items, []);
  assert.ok(lure.lure);
  assert.equal(spawnEnemy({ rng, zoneIndex: 0, forceGlimmer: true }).kind, 'glimmerkin');
});

test('hunt heat grows and caps', () => {
  assert.equal(huntHeat(0), 0);
  assert.ok(huntHeat(5) > huntHeat(2));
  assert.equal(huntHeat(1000), BAL.huntHeatMax);
});
