import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { rollRarity, generateItem, rollItem, sellValue } from '../src/logic/loot.js';
import { RARITIES, RARITY_INDEX } from '../src/data/items.js';

test('rarity distribution and minRarity', () => {
  const rng = createRng(3);
  const counts = {};
  for (let i = 0; i < 10000; i++) {
    const r = rollRarity(rng);
    counts[r] = (counts[r] || 0) + 1;
  }
  for (const r of RARITIES) assert.ok(counts[r.id] > 0, `missing ${r.id}`);
  const commonShare = counts.common / 10000;
  assert.ok(commonShare > 0.55 && commonShare < 0.65, `common share ${commonShare}`);
  for (let i = 0; i < 2000; i++) assert.ok(RARITY_INDEX[rollRarity(rng, { minRarity: 'rare' })] >= 2);
});

test('items have correct affix counts and distinct affixes', () => {
  const rng = createRng(11);
  for (const r of RARITIES) {
    for (let i = 0; i < 50; i++) {
      const item = generateItem({ rng, ilvl: 1 + (i % 9), rarity: r.id });
      assert.equal(item.affixes.length, r.affixes);
      assert.equal(new Set(item.affixes.map((a) => a.id)).size, item.affixes.length);
      assert.ok(item.name.length > 0);
      if (r.id === 'legendary') assert.ok(item.unique);
      if (RARITY_INDEX[r.id] < 2) assert.ok(!item.affixes.some((a) => a.id === 'steady'));
      assert.ok(sellValue(item) > 0);
    }
  }
});

test('pity guarantees a legendary', () => {
  const rng = createRng(1);
  const pity = { itemsSinceLegendary: 150 };
  const item = rollItem({ rng, ilvl: 1, pity });
  assert.equal(item.rarity, 'legendary');
  assert.equal(pity.itemsSinceLegendary, 0);
});

test('itemScore, isUpgrade and stashItems', async () => {
  const { itemScore, isUpgrade, stashItems } = await import('../src/logic/loot.js');
  const { createNewSave } = await import('../src/core/save.js');
  const { BAL } = await import('../src/data/balance.js');
  assert.equal(itemScore(null), 0);
  const rng = createRng(5);
  const item = generateItem({ rng, ilvl: 2, rarity: 'rare' });
  assert.ok(isUpgrade(item, { staff: null, robe: null, amulet: null, ring: null, tome: null }));
  const save = createNewSave();
  for (let i = 0; i < BAL.inventorySize; i++) save.inventory.push(generateItem({ rng, ilvl: 1, rarity: 'common' }));
  const res = stashItems(save, [item]);
  assert.deepEqual(res.kept, []);
  assert.equal(res.autoSold[0], item);
  assert.equal(res.gold, sellValue(item));
  assert.equal(save.inventory.length, BAL.inventorySize);
});
