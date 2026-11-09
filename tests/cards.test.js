import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createInitialCards, replaceCard } from '../src/logic/cards.js';
import { SCHOOLS } from '../src/data/spells.js';

test('initial cards: tiers 1-3, distinct first chars, at most one support card', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const cards = createInitialCards({ layoutId: 'qwerty', zoneIndex: seed % 9, weakChars: [] }, rng);
    assert.deepEqual(cards.map((c) => c.tier), [1, 2, 3]);
    const firsts = cards.map((c) => c.text[0].toLowerCase());
    assert.equal(new Set(firsts).size, 3, firsts.join(','));
    assert.ok(cards.filter((c) => SCHOOLS[c.school].kind !== 'damage').length <= 1);
  }
});

test('replaceCard keeps position and tier', () => {
  const rng = createRng(9);
  const ctx = { layoutId: 'qwerty', zoneIndex: 3 };
  const cards = createInitialCards(ctx, rng);
  const out = replaceCard(cards, cards[1].id, ctx, rng);
  assert.equal(out[1].tier, 2);
  assert.notEqual(out[1].id, cards[1].id);
  assert.equal(out[0], cards[0]);
});

test('golden runes: none (and the same texts) without a rate; every letter with rate 1', () => {
  const plain = createInitialCards({ layoutId: 'qwerty', zoneIndex: 4, weakChars: [] }, createRng(5));
  const again = createInitialCards({ layoutId: 'qwerty', zoneIndex: 4, weakChars: [], goldenRate: 0 }, createRng(5));
  assert.deepEqual(plain.map((c) => c.text), again.map((c) => c.text));
  for (const c of plain) assert.deepEqual(c.golden, []);
  const gold = createInitialCards({ layoutId: 'qwerty', zoneIndex: 4, weakChars: [], goldenRate: 1 }, createRng(5));
  for (const c of gold) {
    const expect = [...c.text].map((ch, i) => (i >= 1 && ch !== ' ' ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(c.golden, expect);
  }
});
