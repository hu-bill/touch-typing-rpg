import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speedMultiplier, resolveSpell, rawPower, estimateCard } from '../src/logic/spellResolve.js';
import { computePlayerStats } from '../src/logic/stats.js';
import { createNewSave } from '../src/core/save.js';
import { createRng } from '../src/core/rng.js';

const stats = computePlayerStats(createNewSave());
const card = (school, tier = 2, text = 'flask salad dad') => ({ id: 'x', school, tier, text });

test('speed multiplier', () => {
  assert.equal(speedMultiplier(20), 1);
  assert.equal(speedMultiplier(0), 0.5);
  assert.equal(speedMultiplier(200), 3);
});

test('mistakes reduce damage', () => {
  const run = (errors) => resolveSpell({ card: card('arcane'), wpm: 30, errors, stats, rng: { chance: () => false }, layoutId: 'qwerty' }).damage;
  assert.ok(run(0) > run(1));
  assert.ok(run(1) > run(3));
});

test('schools produce their effect kinds', () => {
  const rng = createRng(1);
  const n = resolveSpell({ card: card('nature'), wpm: 30, errors: 0, stats, rng, layoutId: 'qwerty' });
  assert.ok(n.heal > 0);
  const w = resolveSpell({ card: card('ward'), wpm: 30, errors: 0, stats, rng, layoutId: 'qwerty' });
  assert.ok(w.shield > 0);
  assert.equal(w.damage, 0);
  const f = resolveSpell({ card: card('fire'), wpm: 30, errors: 0, stats, rng: { chance: () => false }, layoutId: 'qwerty' });
  assert.ok(f.burnTotal > 0);
});

test('harder characters have more raw power', () => {
  assert.ok(rawPower('Qwerty!', 'qwerty') > rawPower('asdfjkl', 'qwerty'));
});

test('estimate is positive', () => {
  assert.ok(estimateCard(card('fire'), stats, 25, 'qwerty', {}).value > 0);
});

const noCrit = { chance: () => false };
const dmg = (c, st, extra = {}) => resolveSpell({ card: c, wpm: 60, errors: 0, stats: st, rng: noCrit, layoutId: 'qwerty', ...extra });

test('combo multiplier scales damage', () => {
  const a = dmg(card('arcane'), stats).damage;
  const b = dmg(card('arcane'), stats, { comboMult: 1.1 }).damage;
  assert.ok(Math.abs(b - a * 1.1) <= 1, `${a} ${b}`);
});

test('cantor and kindling boons', () => {
  const c1 = card('arcane', 1, 'flask salad');
  const a = dmg(c1, stats).damage;
  const b = dmg(c1, { ...stats, cantripPct: 35 }).damage;
  assert.ok(Math.abs(b - a * 1.35) <= 1, `${a} ${b}`);
  const f0 = dmg(card('fire'), stats).burnTotal;
  const f1 = dmg(card('fire'), { ...stats, burnBonus: 0.5 }).burnTotal;
  assert.ok(Math.abs(f1 - f0 * 1.5) <= 1, `${f0} ${f1}`);
});

test('Glyphdeep rune and finger multipliers scale a character\'s power', () => {
  const base = rawPower('fff', 'qwerty', {}, new Set());
  assert.ok(Math.abs(rawPower('fff', 'qwerty', {}, new Set(), { runeMult: { f: 2 } }) - base * 2) < 1e-9);
  assert.equal(rawPower('jjj', 'qwerty', {}, new Set(), { runeMult: { f: 2 } }), rawPower('jjj', 'qwerty', {}, new Set()));
  const a = rawPower('a', 'qwerty', {}, new Set());
  assert.ok(Math.abs(rawPower('a', 'qwerty', {}, new Set(), { fingerMult: { lp: 3 } }) - a * 3) < 1e-9, 'a is a left-pinky key');
  assert.equal(rawPower('f', 'qwerty', {}, new Set(), { fingerMult: { lp: 3 } }), rawPower('f', 'qwerty', {}, new Set()));
});

test('forceCrit crits without changing RNG use; extraMult scales damage', () => {
  const noCrit = { chance: () => false };
  const c = { id: 'x', school: 'arcane', tier: 2, text: 'flask salad dad' };
  const plain = resolveSpell({ card: c, wpm: 60, errors: 0, stats, rng: noCrit, layoutId: 'qwerty' });
  const forced = resolveSpell({ card: c, wpm: 60, errors: 0, stats, rng: noCrit, layoutId: 'qwerty', forceCrit: true });
  assert.ok(!plain.crit && forced.crit);
  assert.ok(forced.damage > plain.damage);
  const steady = resolveSpell({ card: c, wpm: 60, errors: 0, stats, rng: noCrit, layoutId: 'qwerty', extraMult: 1.3 });
  assert.ok(Math.abs(steady.damage - plain.damage * 1.3) <= 1);
  assert.equal(steady.extraMult, 1.3);
});
