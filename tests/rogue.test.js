import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createNewSave, loadSave, writeSave } from '../src/core/save.js';
import { ROGUE } from '../src/data/balance.js';
import { RELICS, RELIC_BY_ID, CURSE_IDS, META_UPGRADES } from '../src/data/rogue.js';
import { ZONES } from '../src/data/zones.js';
import { allowedChars, isTextAllowed } from '../src/logic/keyboard.js';
import { recordKey } from '../src/logic/mastery.js';
import { generateItem } from '../src/logic/loot.js';
import {
  runBaseStats, rogueFightStats, createRun, rogueEnemyStats, guardianDef, rollDoors, rollRelicOffer, rollCurse,
  takeRelic, removeRelic, rogueVictoryRewards, rollShop, shopPrice, temperCandidates, temperDrill, rollRogueEvent,
  keySnapshot, keyImprovements, finishRun, buyUpgrade, isGuardianDepth, stratumZone, pickBane, doorWords, ROGUE_STAT_DEFAULTS,
} from '../src/logic/rogue.js';

const LAYOUTS = ['qwerty', 'qwertz'];

function freshRun(circle = 4, seed = 1, save = createNewSave()) {
  return createRun({ save, circle, layoutId: 'qwerty', rng: createRng(seed) });
}

test('run base stats ignore campaign level and gear, and apply Scriptorium vigor', () => {
  const fresh = createNewSave();
  const vet = createNewSave();
  vet.player.level = 30;
  vet.player.attune.might = 10;
  vet.equipment.staff = generateItem({ rng: createRng(2), slot: 'staff', ilvl: 9, rarity: 'epic' });
  vet.equipment.robe = generateItem({ rng: createRng(3), slot: 'robe', ilvl: 9, rarity: 'epic' });
  const a = runBaseStats(fresh);
  const b = runBaseStats(vet);
  assert.equal(a.maxHp, b.maxHp);
  assert.equal(a.powerMult, b.powerMult);
  assert.equal(a.maxHp, ROGUE.baseHp);
  vet.rogue.upgrades.vigor = 2;
  assert.equal(runBaseStats(vet).maxHp, ROGUE.baseHp + 16);
});

test('rogueFightStats applies relics, curses, uniques, fingers, bane and tempered runes without mutating', () => {
  const save = createNewSave();
  const base = runBaseStats(save);
  const run = freshRun();
  run.relics = ['heartstone', 'pinky', 'ringbearer', 'hearth', 'banebrand'];
  run.boons = { steady: 1 };
  run.tempered = { k: 2 };
  run.bane = 'f';
  const before = JSON.stringify({ ...base, uniques: [...base.uniques] });
  const out = rogueFightStats(base, run);
  assert.equal(JSON.stringify({ ...base, uniques: [...base.uniques] }), before, 'base untouched');
  assert.equal(out.maxHp, Math.round(base.maxHp * 1.25));
  assert.ok(out.uniques.has('hearth'));
  assert.equal(out.fingerMult.lp, 3);
  assert.equal(out.fingerMult.rr, 2);
  assert.equal(out.tolerance, base.tolerance + 1);
  assert.equal(out.runeMult.f, ROGUE.bane + 1);
  assert.equal(out.runeMult.F, ROGUE.bane + 1);
  assert.equal(out.runeMult.k, 1 + 2 * ROGUE.temperBonus);
  run.relics.push('frail');
  assert.equal(rogueFightStats(base, run).maxHp, Math.round(base.maxHp * 1.05));
  run.relics = ['whetstone'];
  run.bane = null;
  assert.equal(rogueFightStats(base, run).runeMult.k, 1 + 2 * ROGUE.temperBonus * 2);
  assert.equal(rogueFightStats(base, run).runeMult.f, undefined);
});

test('every numeric relic stat key exists in the run base stats (catches typos)', () => {
  const base = runBaseStats(createNewSave());
  for (const r of RELICS) {
    assert.ok(r.text && r.name && r.icon, r.id);
    for (const [k, v] of Object.entries(r.stats)) {
      if (k === 'uniques' || k === 'fingerMult') continue;
      assert.equal(typeof v, 'number', `${r.id}.${k}`);
      assert.ok(k in base || k.startsWith('schoolPct.'), `${r.id}: unknown stat ${k}`);
    }
  }
  for (const k of Object.keys(ROGUE_STAT_DEFAULTS)) assert.ok(k in base, k);
  for (const u of META_UPGRADES) assert.ok(u.text(1) && u.cost(0) > 0, u.id);
});

test('enemies grow with depth; elites are tougher; glimmerkins never attack', () => {
  const def = ZONES[0].mobs[2];
  let prev = rogueEnemyStats(1, 'mob', def);
  for (let d = 2; d <= 40; d++) {
    const cur = rogueEnemyStats(d, 'mob', def);
    assert.ok(cur.hp > prev.hp, `hp at ${d}`);
    assert.ok(cur.atk >= prev.atk, `atk at ${d}`);
    assert.ok(cur.attackSec >= ROGUE.minAttackSec);
    prev = cur;
  }
  assert.ok(rogueEnemyStats(6, 'elite', def).hp > rogueEnemyStats(6, 'mob', def).hp);
  assert.equal(rogueEnemyStats(6, 'glimmerkin', { hpMult: 0.8 }).atk, 0);
});

test('doors: a lone guardian every 5th depth, two doors first, at least one fight, typeable distinct words', () => {
  for (const layoutId of LAYOUTS) {
    for (let circle = 0; circle < ZONES.length; circle++) {
      const allowed = allowedChars(layoutId, circle);
      for (let seed = 1; seed <= 30; seed++) {
        const rng = createRng(seed * 31 + circle);
        const run = createRun({ save: createNewSave(), circle, layoutId, rng });
        assert.equal(run.doors.length, 2);
        for (let depth = 0; depth < 16; depth++) {
          run.depth = depth;
          const doors = rollDoors(rng, run, { layoutId });
          const next = depth + 1;
          if (isGuardianDepth(next)) {
            assert.equal(doors.length, 1);
            assert.equal(doors[0].type, 'guardian');
            assert.equal(doors[0].foe.kind, 'boss');
          } else {
            assert.ok(doors.some((d) => d.type === 'fight' || d.type === 'elite'), `fight door at ${next}`);
            if (isGuardianDepth(next + 1) && (run.log.at(-1) || {}).type !== 'campfire') assert.ok(doors.some((d) => d.type === 'campfire'), `campfire before guardian ${next}`);
            if ((run.log.at(-1) || {}).type === 'shop') assert.ok(!doors.some((d) => d.type === 'shop'));
          }
          const firsts = doors.map((d) => d.word[0]);
          assert.equal(new Set(firsts).size, doors.length, firsts.join());
          for (const d of doors) assert.ok(isTextAllowed(d.word, allowed), `${layoutId} ${circle} ${d.word}`);
          run.log.push({ depth: next, type: doors[seed % doors.length].type });
        }
      }
    }
  }
});

test('door words widen gracefully', () => {
  const words = doorWords(createRng(4), 'qwerty', 0, 3, 1);
  assert.equal(words.length, 3);
  assert.equal(new Set(words.map((w) => w[0])).size, 3);
});

test('guardians drop armor the circle cannot pierce; strata cycle through the regions', () => {
  const forgeDepth = 5 * 8; // stratum 7 = Numeral Forge
  assert.equal(stratumZone(forgeDepth), 7);
  assert.ok(!guardianDef(forgeDepth, 'qwerty', 0).mechanics.some((m) => m.id === 'armored'));
  assert.ok(guardianDef(forgeDepth, 'qwerty', 8).mechanics.some((m) => m.id === 'armored'));
  assert.equal(stratumZone(46), 0);
  assert.match(guardianDef(50, 'qwerty', 0).name, /^Echo of/);
  assert.equal(ZONES[7].boss.mechanics.length, 2, 'zone data untouched');
});

test('relic offers: distinct, unowned, no curses, minCircle respected; curses never owned twice', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const run = freshRun(seed % 5, seed);
    run.relics = ['metronome', 'blots'];
    const offer = rollRelicOffer(rng, run, 4);
    assert.equal(offer.length, 4);
    assert.equal(new Set(offer).size, 4);
    for (const id of offer) {
      assert.ok(!RELIC_BY_ID[id].curse);
      assert.ok(!run.relics.includes(id));
      assert.ok((RELIC_BY_ID[id].minCircle || 0) <= run.circle);
    }
    const c = rollCurse(rng, run);
    assert.ok(CURSE_IDS.includes(c) && c !== 'blots');
  }
  const run = freshRun();
  run.relics = [...CURSE_IDS];
  assert.equal(rollCurse(createRng(1), run), null);
});

test('takeRelic once; dice pays rerolls; spent consumables never return', () => {
  const run = freshRun();
  const r0 = run.rerolls;
  assert.ok(takeRelic(run, 'dice'));
  assert.ok(!takeRelic(run, 'dice'));
  assert.equal(run.rerolls, r0 + 2);
  takeRelic(run, 'phoenix');
  removeRelic(run, 'phoenix');
  for (let s = 1; s < 60; s++) assert.ok(!rollRelicOffer(createRng(s), run, 6).includes('phoenix'));
});

test('victory rewards: golden and ledger coins, relics from elites and guardians, coin doors triple', () => {
  const run = freshRun();
  const stats = rogueFightStats(runBaseStats(createNewSave()), run);
  const summary = { golden: 3, correct: 250 };
  const r = rogueVictoryRewards(createRng(5), run, { kind: 'mob', door: { reward: 'boon' }, summary, stats });
  assert.equal(r.coins.golden, 3 * ROGUE.goldenCoins);
  assert.equal(r.coins.ledger, 0);
  assert.equal(r.offer.kind, 'boon');
  assert.equal(r.offer.choices.length, 3);
  assert.equal(r.coins.total, r.coins.base + r.coins.golden);
  const withLedger = { ...stats, ledger: 8 };
  assert.equal(rogueVictoryRewards(createRng(5), run, { kind: 'mob', door: { reward: 'boon' }, summary, stats: withLedger }).coins.ledger, 20);
  const boss = rogueVictoryRewards(createRng(5), run, { kind: 'boss', door: { reward: 'relic' }, summary, stats });
  assert.equal(boss.offer.kind, 'relic');
  assert.ok(boss.heal > r.heal);
  const plain = rogueVictoryRewards(createRng(9), run, { kind: 'mob', door: { reward: 'vital' }, summary, stats });
  const hoard = rogueVictoryRewards(createRng(9), run, { kind: 'mob', door: { reward: 'coins' }, summary, stats });
  assert.equal(hoard.coins.base, Math.round(plain.coins.base * ROGUE.coinsDoorMult) || hoard.coins.base);
  assert.ok(plain.vital);
  assert.equal(plain.offer.kind, null);
  assert.equal(rogueVictoryRewards(createRng(9), run, { kind: 'mob', door: { reward: 'boon' }, summary, stats: { ...stats, extraChoice: 1 } }).offer.choices.length, 4);
});

test('shop: stock and prices; cleanse only with a curse', () => {
  const run = freshRun();
  run.depth = 9;
  const stock = rollShop(createRng(3), run);
  assert.equal(stock.filter((i) => i.kind === 'relic').length, 2);
  assert.ok(!stock.some((i) => i.kind === 'cleanse'));
  assert.equal(stock.find((i) => i.kind === 'heal').price, shopPrice('heal', 10));
  assert.ok(shopPrice('relic', 20) > shopPrice('relic', 1));
  run.relics.push('brittle');
  assert.ok(rollShop(createRng(3), run).some((i) => i.kind === 'cleanse'));
  assert.deepEqual(stock.map((i) => i.key), stock.map((_, i) => String(i + 1)));
});

test('temper drills use only circle characters and repeat the rune', () => {
  for (const layoutId of LAYOUTS) {
    for (let circle = 0; circle < ZONES.length; circle++) {
      const allowed = allowedChars(layoutId, circle);
      const rng = createRng(circle + 11);
      const run = freshRun(circle);
      const cands = temperCandidates({}, layoutId, circle, run, rng);
      assert.equal(cands.length, 3);
      for (const ch of [...cands, 'a', 'k']) {
        const drill = temperDrill(ch, { layoutId, circle, rng });
        assert.ok(drill.length >= ROGUE.temperLen, drill);
        assert.ok(isTextAllowed(drill, allowed), `${layoutId} ${circle}: ${drill}`);
        assert.ok([...drill].filter((c) => c === ch).length >= 3, drill);
      }
    }
  }
  const run = freshRun(0);
  run.tempered = { a: ROGUE.temperMax };
  for (let s = 1; s < 30; s++) assert.ok(!temperCandidates({}, 'qwerty', 0, run, createRng(s)).includes('a'));
});

test('temper candidates prefer weak keys; bane comes from weak letters', () => {
  const ks = {};
  for (let i = 0; i < 30; i++) recordKey(ks, 'f', i % 3 !== 0, 400);
  for (const c of 'asdjkl') for (let i = 0; i < 30; i++) recordKey(ks, c, true, 150);
  assert.equal(temperCandidates(ks, 'qwerty', 0, freshRun(0), createRng(1))[0], 'f');
  for (let s = 1; s < 20; s++) assert.ok('fasdjkl'.includes(pickBane(createRng(s), ks, 'qwerty', 0)));
  assert.ok(/^[a-z]$/.test(pickBane(createRng(3), {}, 'qwerty', 4)));
});

test('mystery events: never repeat, trader needs coins', () => {
  const run = freshRun();
  run.coins = 0;
  for (let s = 1; s <= 300; s++) {
    run.lastEvent = 'wisp';
    const ev = rollRogueEvent(createRng(s), run);
    assert.notEqual(ev.id, 'wisp');
    assert.notEqual(ev.id, 'trader');
  }
});

test('key improvements and finishing a run update records, ink and history', () => {
  const save = createNewSave();
  const ks = save.keyStats;
  for (let i = 0; i < 40; i++) recordKey(ks, 'j', true, 400);
  const run = createRun({ save, circle: 0, layoutId: 'qwerty', rng: createRng(2) });
  for (let i = 0; i < 40; i++) recordKey(ks, 'j', true, 200);
  const imp = keyImprovements(run.startKeys, ks);
  assert.equal(imp[0].ch, 'j');
  assert.ok(imp[0].msAfter < imp[0].msBefore);
  assert.deepEqual(keySnapshot({}, allowedChars('qwerty', 0)), {});

  save.rogue.run = run;
  run.depth = 12;
  run.stats.guardians = 2;
  run.stats.golden = 9;
  run.stats.correct = 900;
  run.stats.errors = 30;
  run.stats.fights = [{ d: 1, wpm: 30, acc: 0.97 }, { d: 2, wpm: 34, acc: 0.95 }];
  const ch = finishRun(save, run, { cause: 'defeat', killedBy: 'Mossback' });
  assert.equal(save.rogue.run, null);
  assert.equal(save.rogue.best['0'], 12);
  assert.equal(save.rogue.totalRuns, 1);
  assert.equal(save.rogue.runs[0], ch);
  assert.equal(ch.ink, Math.round(12 * ROGUE.inkPerDepth + 2 * ROGUE.inkPerGuardian + 9 * ROGUE.inkPerGolden));
  assert.equal(save.rogue.ink, ch.ink);
  assert.ok(ch.record && ch.first);
  assert.equal(ch.avgWpm, 32);
  assert.equal(save.stats.bestDepth, 12);
  assert.equal(save.stats.guardiansSlain, 2);

  const run2 = createRun({ save, circle: 0, layoutId: 'qwerty', rng: createRng(3) });
  assert.equal(run2.prevBest, 12);
  run2.depth = 4;
  const ch2 = finishRun(save, run2, { cause: 'abandon' });
  assert.ok(!ch2.record);
  assert.equal(save.rogue.best['0'], 12);
});

test('Scriptorium purchases respect ink and max rank; keepsake offers 3 relics', () => {
  const save = createNewSave();
  assert.ok(!buyUpgrade(save, 'vigor'));
  save.rogue.ink = 1000;
  for (let i = 0; i < 5; i++) assert.ok(buyUpgrade(save, 'vigor'));
  assert.ok(!buyUpgrade(save, 'vigor'));
  assert.equal(save.rogue.ink, 1000 - (20 + 30 + 40 + 50 + 60));
  buyUpgrade(save, 'keepsake');
  buyUpgrade(save, 'purse');
  const run = createRun({ save, circle: 2, layoutId: 'qwerty', rng: createRng(1) });
  assert.equal(run.keepsake.length, 3);
  assert.equal(run.coins, 20);
});

test('old saves load with Glyphdeep defaults; a run survives a save roundtrip', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const old = createNewSave();
  delete old.rogue;
  delete old.stats.bestDepth;
  storage.setItem('spellstroke.save.v1', JSON.stringify(old));
  const loaded = loadSave(storage);
  assert.equal(loaded.rogue.ink, 0);
  assert.equal(loaded.rogue.run, null);
  assert.equal(loaded.stats.bestDepth, 0);
  loaded.rogue.run = createRun({ save: loaded, circle: 3, layoutId: 'qwertz', rng: createRng(8) });
  writeSave(loaded, storage);
  const again = loadSave(storage);
  assert.deepEqual(again.rogue.run, JSON.parse(JSON.stringify(loaded.rogue.run)));
});
