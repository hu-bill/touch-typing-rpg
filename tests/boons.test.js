import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollBoonOffer, applyHuntMods, takeBoon, boonCount, boonText } from '../src/logic/boons.js';
import { BOONS } from '../src/data/boons.js';
import { computePlayerStats } from '../src/logic/stats.js';
import { createHunt } from '../src/logic/progression.js';
import { createNewSave } from '../src/core/save.js';
import { createRng } from '../src/core/rng.js';

const base = computePlayerStats(createNewSave());

test('offers are distinct, deterministic and respect max ranks', () => {
  for (let seed = 1; seed < 50; seed++) {
    const o = rollBoonOffer(createRng(seed), {}, 3);
    assert.equal(o.length, 3);
    assert.equal(new Set(o.map((b) => b.id)).size, 3);
    assert.deepEqual(rollBoonOffer(createRng(seed), {}, 3), o);
    assert.ok(!rollBoonOffer(createRng(seed), { grace: 1 }, 3).some((b) => b.id === 'grace'));
  }
  const maxed = Object.fromEntries(BOONS.map((b) => [b.id, b.max]));
  assert.deepEqual(rollBoonOffer(createRng(1), maxed, 3), []);
  const o = rollBoonOffer(createRng(3), { keen: 1 }, 23);
  const keen = o.find((b) => b.id === 'keen');
  assert.equal(keen.rank, 2);
});

test('applyHuntMods does not mutate its input', () => {
  const stats = computePlayerStats(createNewSave());
  const hunt = createHunt('hunt', 0);
  hunt.boons = { steady: 2, arcana: 1, heart: 2 };
  const before = { tolerance: stats.tolerance, arcane: stats.schoolPct.arcane, uniques: stats.uniques.size, maxHp: stats.maxHp };
  const out = applyHuntMods(stats, hunt);
  assert.equal(stats.tolerance, before.tolerance);
  assert.equal(stats.schoolPct.arcane, before.arcane);
  assert.equal(stats.uniques.size, before.uniques);
  assert.equal(stats.maxHp, before.maxHp);
  assert.notEqual(out.uniques, stats.uniques);
  assert.equal(out.tolerance, stats.tolerance + 2);
  assert.equal(out.schoolPct.arcane, stats.schoolPct.arcane + 20);
  assert.equal(out.maxHp, Math.round(stats.maxHp * 1.3));
  assert.deepEqual(out.boons, { steady: 2, arcana: 1, heart: 2 });
});

test('temporary mods are applied', () => {
  const hunt = createHunt('hunt', 0);
  hunt.mods = [{ id: 'x', fightsLeft: 3, stats: { tempoPct: -20, goldMult: 0.75 } }];
  const out = applyHuntMods(base, hunt);
  assert.equal(out.tempoPct, base.tempoPct - 20);
  assert.equal(out.goldMult, base.goldMult + 0.75);
});

test('every boon stat key exists in the player stats', () => {
  for (const b of BOONS) {
    for (const key of Object.keys(b.stats)) {
      if (key.startsWith('schoolPct.')) assert.ok(key.slice(10) in base.schoolPct, `${b.id}: ${key}`);
      else assert.ok(key in base, `${b.id}: ${key}`);
    }
    assert.ok(typeof b.text(1) === 'string' && b.text(1).length > 0);
    assert.equal(boonText(b.id, 1), b.text(1));
  }
});

test('takeBoon stacks up to max and boonCount sums ranks', () => {
  const hunt = createHunt('hunt', 0);
  takeBoon(hunt, 'grace');
  takeBoon(hunt, 'grace');
  takeBoon(hunt, 'keen');
  takeBoon(hunt, 'keen');
  assert.deepEqual(hunt.boons, { grace: 1, keen: 2 });
  assert.equal(boonCount(hunt), 3);
});
