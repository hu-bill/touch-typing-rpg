import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine, summarizeFight, paceMultiplier, comboTier } from '../src/logic/combat.js';
import { recordKey } from '../src/logic/mastery.js';
import { DIFFICULTIES, BAL } from '../src/data/balance.js';
import { computePlayerStats } from '../src/logic/stats.js';
import { createNewSave } from '../src/core/save.js';
import { createRng } from '../src/core/rng.js';
import { ZONES } from '../src/data/zones.js';

function makeEngine(opts = {}) {
  const save = createNewSave();
  const stats = computePlayerStats(save);
  return new CombatEngine({
    zoneIndex: 0, kind: 'mob', enemyDef: ZONES[0].mobs[2], stats, layoutId: 'qwerty',
    keyStats: save.keyStats, rng: createRng(opts.seed || 1), now: 0, ...opts,
  });
}

/** type a card's full text perfectly starting at time t with dtMs between keys; returns end time */
function typeCard(engine, card, t, dtMs = 150) {
  for (const ch of card.text) {
    t += dtMs;
    engine.update(t);
    engine.handleChar(ch, t);
  }
  return t;
}

test('perfect cast completes and damages enemy', () => {
  const e = makeEngine();
  const hp0 = e.enemy.hp;
  const card = e.cards.find((c) => c.school !== 'ward');
  const idx = e.cards.indexOf(card);
  typeCard(e, card, 0);
  const events = e.drainEvents();
  const done = events.find((ev) => ev.type === 'castComplete');
  assert.ok(done, 'castComplete emitted');
  assert.equal(done.errors, 0);
  assert.ok(e.enemy.hp < hp0 || e.phase === 'victory');
  assert.notEqual(e.cards[idx].id, card.id, 'card replaced');
  assert.ok(e.keyStats[card.text[1]], 'key stats recorded');
});

test('too many mistakes fizzle', () => {
  const e = makeEngine();
  const card = e.cards[0];
  e.handleChar(card.text[0], 10);
  const wrong = card.text[1] === '#' ? '@' : '#';
  for (let i = 0; i < 3; i++) e.handleChar(wrong, 20 + i);
  const events = e.drainEvents();
  assert.ok(events.some((ev) => ev.type === 'fizzle'));
  assert.equal(e.cast, null);
});

test('no matching first char does not start a cast', () => {
  const e = makeEngine();
  e.handleChar('#', 5);
  assert.equal(e.cast, null);
  assert.ok(e.drainEvents().some((ev) => ev.type === 'noMatch'));
});

test('enemy attacks when the timer fills', () => {
  const e = makeEngine();
  const hp0 = e.player.hp;
  let t = 0;
  while (t < (e.interval + 0.5) * 1000) {
    t += 50;
    e.update(t);
  }
  const events = e.drainEvents();
  assert.ok(events.some((ev) => ev.type === 'windup'));
  assert.ok(events.some((ev) => ev.type === 'enemyAttack'));
  assert.ok(e.player.hp < hp0);
});

test('enough perfect casts win the fight', () => {
  const e = makeEngine({ tempoMult: 100 });
  let t = 0;
  let guard = 0;
  while (e.phase === 'fighting' && guard++ < 100) {
    const card = e.cards.find((c) => c.school !== 'nature' && c.school !== 'ward') || e.cards[0];
    t = typeCard(e, card, t, 60);
    t += 200;
  }
  assert.equal(e.phase, 'victory');
  const sum = summarizeFight(e);
  assert.ok(sum.casts > 0 && sum.accuracy === 1);
});

test('player dies at 0 hp', () => {
  const e = makeEngine();
  e.damagePlayer(10000, 'attack');
  assert.equal(e.phase, 'defeat');
  assert.ok(e.drainEvents().some((ev) => ev.type === 'defeat'));
});

test('full flow adds a Forbidden Rite card', () => {
  const e = makeEngine({ tempoMult: 100 });
  e.enemy.hp = e.enemy.maxHp = 1e9;
  let t = 0;
  let guard = 0;
  while (!e.cards.some((c) => c.tier === 4) && guard++ < 200) {
    t = typeCard(e, e.cards[0], t, 60);
  }
  assert.ok(e.cards.some((c) => c.tier === 4));
  const firsts = e.cards.map((c) => c.text[0].toLowerCase());
  assert.equal(new Set(firsts).size, e.cards.length, 'distinct first chars with rite');
  const rite = e.cards.find((c) => c.tier === 4);
  typeCard(e, rite, t, 60);
  assert.ok(!e.cards.some((c) => c.tier === 4));
  assert.equal(e.flow, 0);
});

test('boss mechanics: enrage and barrier trigger', () => {
  const boss = ZONES[8].boss;
  const e = makeEngine({ kind: 'boss', enemyDef: boss, zoneIndex: 8 });
  e.damageEnemy(e.enemy.maxHp * 0.8, { tier: 3, text: 'x' });
  const ev = e.drainEvents();
  assert.ok(ev.some((x) => x.type === 'barrier'));
  assert.ok(ev.some((x) => x.type === 'mechanic' && x.id === 'enrage'));
  assert.ok(e.enemy.barrier > 0);
});

test('armored reduces damage unless pattern matches', () => {
  const golem = ZONES[7].boss;
  const e = makeEngine({ kind: 'boss', enemyDef: golem, zoneIndex: 7 });
  const a = e.damageEnemy(100, { tier: 3, text: 'no digits' });
  const b = e.damageEnemy(100, { tier: 3, text: 'has 7 digits' });
  assert.ok(a.resisted && !b.resisted);
  assert.ok(a.dealt < b.dealt);
});

test('dummy never attacks or dies', () => {
  const e = makeEngine({ kind: 'dummy', enemyDef: { id: 'dummy', name: 'Dummy', icon: '🎯', dummy: true } });
  for (let t = 0; t < 30000; t += 50) e.update(t);
  assert.equal(e.phase, 'fighting');
  assert.equal(e.player.hp, e.player.maxHp);
});

test('difficulty scales enemies and mistake tolerance', () => {
  const easy = makeEngine({ difficulty: DIFFICULTIES.apprentice });
  const normal = makeEngine({ difficulty: DIFFICULTIES.adept });
  const hard = makeEngine({ difficulty: DIFFICULTIES.archmage });
  assert.ok(easy.enemy.maxHp < normal.enemy.maxHp && normal.enemy.maxHp < hard.enemy.maxHp);
  assert.ok(easy.enemy.atk < normal.enemy.atk && normal.enemy.atk < hard.enemy.atk);
  assert.ok(easy.interval > normal.interval && normal.interval > hard.interval);
  const card = normal.cards[0];
  assert.equal(easy.toleranceFor(card), normal.toleranceFor(card) + 1);
  assert.equal(hard.toleranceFor(card), Math.max(1, normal.toleranceFor(card) - 1));
});

test('apprentice fizzles never backfire', () => {
  const e = makeEngine({ difficulty: DIFFICULTIES.apprentice });
  const card = e.cards.find((c) => c.tier === 3);
  const hp0 = e.player.hp;
  e.handleChar(card.text[0], 10);
  const wrong = card.text[1] === '#' ? '@' : '#';
  for (let i = 0; i < 6; i++) e.handleChar(wrong, 20 + i);
  const fizzle = e.drainEvents().find((ev) => ev.type === 'fizzle');
  assert.ok(fizzle);
  assert.equal(fizzle.backfire, 0);
  assert.equal(e.player.hp, hp0);
});

test('archmage pace rewards beating your average speed', () => {
  assert.equal(paceMultiplier(40, 40), 1);
  assert.ok(paceMultiplier(52, 40) > 1);
  assert.ok(paceMultiplier(30, 40) < 1);
  assert.equal(paceMultiplier(500, 40), 1.4);
  assert.equal(paceMultiplier(1, 40), 0.7);
  const e = makeEngine({ difficulty: DIFFICULTIES.archmage, paceRef: 10 });
  typeCard(e, e.cards[0], 0, 40);
  const done = e.drainEvents().find((ev) => ev.type === 'castComplete');
  assert.ok(done.result.paceMult > 1);
});

const baseStats = (extra = {}) => ({ ...computePlayerStats(createNewSave()), ...extra });
const wrongFor = (ch) => (ch === '#' ? '@' : '#');

test('a mastery level-up emits masteryUp', () => {
  const save = createNewSave();
  const probe = makeEngine();
  const card = probe.cards.find((c) => c.text[1] !== ' ' && c.text[1] !== c.text[0]);
  const ch = card.text[1];
  for (let i = 0; i < 19; i++) recordKey(save.keyStats, ch, true, 200);
  save.keyStats[ch].peak = 0;
  const e = makeEngine({ keyStats: save.keyStats });
  const same = e.cards.find((c) => c.text === card.text);
  typeCard(e, same, 0);
  const up = e.drainEvents().find((ev) => ev.type === 'masteryUp');
  assert.ok(up, 'masteryUp emitted');
  assert.equal(up.ch, ch);
  assert.equal(up.level, 1);
});

test('combo tiers', () => {
  assert.equal(comboTier(24).index, 0);
  assert.equal(comboTier(25).index, 1);
  assert.equal(comboTier(199).index, 3);
  assert.equal(comboTier(999).index, 4);
  const e = makeEngine({ tempoMult: 100 });
  e.combo = 24;
  const card = e.cards.find((c) => c.tier === 1);
  typeCard(e, card, 0);
  const done = e.drainEvents().find((ev) => ev.type === 'castComplete');
  assert.equal(done.result.comboMult, 1.05);
});

test('grace forgives the first mistake of a spell', () => {
  const e = makeEngine({ stats: baseStats({ grace: 1 }) });
  const card = e.cards[0];
  e.handleChar(card.text[0], 10);
  const combo = e.combo;
  e.handleChar(wrongFor(card.text[1]), 20);
  assert.equal(e.cast.errors, 0);
  assert.equal(e.combo, combo);
  assert.ok(e.drainEvents().some((ev) => ev.type === 'grace'));
  e.handleChar(wrongFor(card.text[1]), 30);
  assert.equal(e.cast.errors, 1);
});

test('momentum halves the combo', () => {
  const e = makeEngine({ stats: baseStats({ momentum: 1 }) });
  const card = e.cards[0];
  e.handleChar(card.text[0], 10);
  e.combo = 40;
  e.handleChar(wrongFor(card.text[1]), 20);
  assert.equal(e.combo, 20);
  const err = e.drainEvents().find((ev) => ev.type === 'keyError');
  assert.equal(err.combo, 20);
});

test('start flow and dawn ward', () => {
  assert.equal(makeEngine({ stats: baseStats({ startFlow: 30 }) }).flow, 30);
  const st = baseStats({ startShieldPct: 0.1 });
  assert.equal(makeEngine({ stats: st }).player.shield, Math.round(st.maxHp * 0.1));
});

test('hunt heat makes enemies tougher', () => {
  const a = makeEngine();
  const b = makeEngine({ heat: 0.3 });
  assert.ok(Math.abs(b.enemy.maxHp - Math.round(a.enemy.maxHp * 1.3)) <= 1);
  assert.ok(b.enemy.atk > a.enemy.atk);
});

test('executioner deals more damage to weakened foes', () => {
  const run = (stats) => {
    const e = makeEngine({ stats, tempoMult: 100, seed: 9 });
    e.enemy.maxHp = 10000;
    e.enemy.hp = 2000;
    const card = e.cards.find((c) => ['arcane', 'fire', 'frost', 'storm'].includes(c.school));
    typeCard(e, card, 0);
    return e.drainEvents().find((ev) => ev.type === 'castComplete').result;
  };
  const plain = run(baseStats());
  const exec = run(baseStats({ executePct: 0.25 }));
  assert.ok(exec.damage > plain.damage);
  assert.ok(exec.executed);
});

// ---------------------------------------------------------------- Glyphdeep hooks (PLAN §13.5)
import { rhythmScore } from '../src/logic/combat.js';

test('enemyOverride replaces zone scaling', () => {
  const e = makeEngine({ enemyOverride: { hp: 321, atk: 9, attackSec: 5 } });
  assert.equal(e.enemy.maxHp, 321);
  assert.equal(e.enemy.atk, Math.round(9 * BAL.enemyDamageMult)); // longer incantations → every enemy hits softer
});

test('golden runes pay only when typed cleanly', () => {
  const stats = { ...computePlayerStats(createNewSave()), goldenRate: 1 };
  const e = makeEngine({ stats, seed: 4 });
  const card = e.cards.find((c) => c.text.length > 4 && c.golden.includes(1) && c.golden.includes(2));
  assert.ok(card);
  e.handleChar(card.text[0], 10);
  e.handleChar(card.text[1], 20);
  const wrong = card.text[2] === '#' ? '@' : '#';
  e.handleChar(wrong, 30);
  e.handleChar(card.text[2], 40);
  const golden = e.drainEvents().filter((ev) => ev.type === 'golden').map((ev) => ev.index);
  assert.deepEqual(golden, [1]);
  assert.equal(e.fight.golden, 1);
  assert.equal(summarizeFight(e).golden, 1);
});

test('goldenCrit forces a crit on a spell with a golden rune', () => {
  const stats = { ...computePlayerStats(createNewSave()), goldenRate: 1, goldenCrit: 1, critChance: 0 };
  const e = makeEngine({ stats, seed: 6 });
  const card = e.cards.find((c) => c.school !== 'ward' && c.school !== 'nature');
  typeCard(e, card, 0);
  const done = e.drainEvents().find((ev) => ev.type === 'castComplete');
  assert.ok(done.result.crit);
  assert.ok(done.result.golden > 0);
});

test('Glass Quill mistakes hurt; Space Between shields', () => {
  const stats = { ...computePlayerStats(createNewSave()), glassPct: 0.04, spaceShieldPct: 0.015 };
  const e = makeEngine({ stats, seed: 2 });
  const card = e.cards.find((c) => c.text.includes(' ') && c.text.indexOf(' ') > 1) || e.cards[2];
  e.handleChar(card.text[0], 10);
  e.handleChar(card.text[1] === '#' ? '@' : '#', 20);
  assert.equal(e.player.hp, e.player.maxHp - 4);
  const sp = card.text.indexOf(' ');
  let t = 30;
  for (let i = 1; i <= sp; i++) e.handleChar(card.text[i], (t += 100));
  assert.equal(e.player.shield, 2);
});

test('Combo Crown doubles the combo used for tiers; blind seals the guide', () => {
  const stats = { ...computePlayerStats(createNewSave()), comboRate: 2, blind: 1 };
  const e = makeEngine({ stats, seed: 3 });
  assert.ok(e.blindfold);
  e.combo = 12;
  const card = e.cards[0];
  typeCard(e, card, 0);
  const done = e.drainEvents().find((ev) => ev.type === 'castComplete');
  assert.equal(done.result.comboMult, comboTier(25).mult);
});

test('rhythm score rewards an even beat', () => {
  assert.equal(rhythmScore([200, 200, 200, 200]), 1);
  assert.equal(rhythmScore([200, 200]), 0);
  assert.ok(rhythmScore([80, 400, 120, 600, 90, 500]) < 0.5);
  const stats = { ...computePlayerStats(createNewSave()), rhythm: 0.35 };
  const steady = makeEngine({ stats, seed: 8 });
  const card = steady.cards.find((c) => c.school === 'arcane' || c.school === 'fire' || c.school === 'storm' || c.school === 'frost');
  typeCard(steady, card, 0, 150);
  const done = steady.drainEvents().find((ev) => ev.type === 'castComplete');
  if (card.text.length > 5) {
    assert.equal(done.result.rhythm, 1);
    assert.equal(done.result.extraMult, 1.35);
  }
});
