// The Glyphdeep — endless roguelike mode (PLAN §13). Pure: no DOM, all randomness through `rng`.
import { ROGUE } from '../data/balance.js';
import { ZONES, GLIMMERKIN, ELITE_TRAITS } from '../data/zones.js';
import { RELICS, RELIC_BY_ID, CURSE_IDS, META_BY_ID, FIGHT_TYPES, CIRCLE_TITLES } from '../data/rogue.js';
import { HUNT_EVENTS, ROGUE_EVENTS } from '../data/events.js';
import { createNewSave } from '../core/save.js';
import { mean, round1 } from '../core/util.js';
import { computePlayerStats } from './stats.js';
import { applyHuntMods, rollBoonOffer } from './boons.js';
import { allowedChars, newCharsForZone } from './keyboard.js';
import { wordPool } from './textGen.js';
import { weakChars, keySummary } from './mastery.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/** Stats only the Glyphdeep uses. The engine treats missing keys as these defaults, so campaign stats need none. */
export const ROGUE_STAT_DEFAULTS = {
  rhythm: 0, glassPct: 0, spaceShieldPct: 0, comboRate: 1, paceRune: 0, blind: 0, goldenCrit: 0,
  extraChoice: 0, ledger: 0, rerollPerGuardian: 0, temperBonus: 0, baneBonus: 0, bloodToll: 0, blots: 0,
};

export const isGuardianDepth = (depth) => depth > 0 && depth % ROGUE.guardianEvery === 0;
export const stratumOf = (depth) => Math.floor((Math.max(1, depth) - 1) / ROGUE.guardianEvery);
export const stratumZone = (depth) => stratumOf(depth) % ZONES.length;
/** Depth of the next guardian at or after `depth`. */
export const nextGuardianDepth = (depth) => Math.ceil(Math.max(1, depth) / ROGUE.guardianEvery) * ROGUE.guardianEvery;

/** Display info of a rune circle. */
export function circleLabel(layoutId, circle) {
  const z = ZONES[circle];
  const fresh = [...newCharsForZone(layoutId, circle)].filter((c) => c !== ' ');
  let keys;
  if (z.modifiers.includes('shift')) keys = 'Shift + A–Z';
  else {
    const list = fresh.filter((c) => c === c.toLowerCase());
    keys = list.slice(0, 14).join(' ') + (list.length > 14 ? ' …' : '');
  }
  return { circle, roman: ROMAN[circle], icon: z.icon, title: CIRCLE_TITLES[circle], zoneName: z.name, keys, size: allowedChars(layoutId, circle).size - 1 };
}

const numericStats = (stats) => Object.fromEntries(Object.entries(stats).filter(([, v]) => typeof v === 'number'));

/** Run stats before boons and relics: a fresh level-1 mage + Scriptorium upgrades. Campaign level and gear never count. */
export function runBaseStats(save) {
  const st = computePlayerStats(createNewSave());
  const up = (save.rogue && save.rogue.upgrades) || {};
  return {
    ...st,
    ...ROGUE_STAT_DEFAULTS,
    maxHp: ROGUE.baseHp + 8 * (up.vigor || 0),
    goldenRate: ROGUE.goldenRate * (1 + 0.25 * (up.gild || 0)),
    campfireBonus: 0.1 * (up.embers || 0),
    fingerMult: {},
    runeMult: {},
  };
}

/** Fight stats of a run: boons, temporary mods, relics, curses, tempered runes and the bane. Never mutates `base`. */
export function rogueFightStats(base, run) {
  const defs = (run.relics || []).map((id) => RELIC_BY_ID[id]).filter(Boolean);
  const mods = [...(run.mods || [])];
  for (const d of defs) mods.push({ stats: numericStats(d.stats) });
  if (run.vital) mods.push({ stats: { maxHpPct: ROGUE.vitalHpPct * run.vital } });
  const out = applyHuntMods(base, { boons: run.boons || {}, mods });
  out.fingerMult = { ...(base.fingerMult || {}) };
  for (const d of defs) {
    for (const u of d.stats.uniques || []) out.uniques.add(u);
    for (const [f, m] of Object.entries(d.stats.fingerMult || {})) out.fingerMult[f] = (out.fingerMult[f] || 1) * m;
  }
  const runeMult = {};
  const mul = (ch, m) => {
    for (const c of new Set([ch, ch.toUpperCase()])) runeMult[c] = (runeMult[c] || 1) * m;
  };
  for (const [ch, rank] of Object.entries(run.tempered || {})) {
    if (rank > 0) mul(ch, 1 + rank * ROGUE.temperBonus * (1 + (out.temperBonus || 0)));
  }
  if (run.bane) mul(run.bane, ROGUE.bane + (out.baneBonus || 0));
  out.runeMult = runeMult;
  out.bane = run.bane || null;
  out.relics = defs.map((d) => d.id);
  out.maxHp = Math.max(1, out.maxHp);
  return out;
}

export function emptyRunStats() {
  return { kills: 0, elites: 0, guardians: 0, casts: 0, correct: 0, errors: 0, golden: 0, perfects: 0, fizzles: 0, bestCombo: 0, seconds: 0, fights: [] };
}

export function createRun({ save, circle, layoutId, rng }) {
  const up = save.rogue.upgrades || {};
  const run = {
    mode: 'rogue',
    version: 1,
    circle,
    zoneIndex: circle,
    layoutId,
    seed: rng.int(1, 1e9),
    depth: 0,
    hp: null,
    coins: 20 * (up.purse || 0),
    rerolls: ROGUE.startRerolls + (up.bones || 0),
    boons: {},
    mods: [],
    relics: [],
    spent: [],
    tempered: {},
    vital: 0,
    doors: [],
    room: null,
    bane: null,
    lastEvent: null,
    keepsake: null,
    prevBest: save.rogue.best[String(circle)] || 0,
    recordBroken: false,
    log: [],
    stats: emptyRunStats(),
    startKeys: keySnapshot(save.keyStats, allowedChars(layoutId, circle)),
    startedAt: Date.now(),
  };
  if (up.keepsake) run.keepsake = rollRelicOffer(rng, run, 3);
  run.doors = rollDoors(rng, run, { layoutId });
  return run;
}

// ------------------------------------------------------------ foes

/** Enemy stats at a depth (same shape as progression.enemyStats; the engine takes it as `enemyOverride`). */
export function rogueEnemyStats(depth, kind, def) {
  const KIND_HP = { mob: 1, elite: ROGUE.eliteHp, boss: ROGUE.guardianHp, glimmerkin: 1 };
  const KIND_ATK = { mob: 1, elite: ROGUE.eliteAtk, boss: ROGUE.guardianAtk, glimmerkin: 0 };
  const d = Math.max(1, depth);
  return {
    hp: Math.max(1, Math.round(ROGUE.hpBase * Math.pow(ROGUE.hpGrowth, d - 1) * (def.hpMult ?? 1) * (KIND_HP[kind] ?? 1))),
    atk: Math.round(ROGUE.atkBase * Math.pow(ROGUE.atkGrowth, d - 1) * (def.atkMult ?? 1) * (KIND_ATK[kind] ?? 1)),
    attackSec: Math.max(ROGUE.minAttackSec, (ROGUE.attackSecBase - ROGUE.attackSecPerDepth * (d - 1)) * (def.speedMult ?? 1)),
  };
}

/** The stratum's region boss, minus mechanics the circle cannot answer (armor needing digits on the home row…). */
export function guardianDef(depth, layoutId, circle) {
  const boss = ZONES[stratumZone(depth)].boss;
  const allowed = [...allowedChars(layoutId, circle)];
  const mechanics = boss.mechanics
    .map((m) => ({ ...m, ...(Array.isArray(m.at) ? { at: [...m.at] } : {}) }))
    .filter((m) => m.id !== 'armored' || allowed.some((ch) => new RegExp(m.unless).test(ch)));
  const def = { ...boss, mechanics };
  if (stratumOf(depth) >= ZONES.length) {
    def.name = `Echo of ${boss.name.replace(/^The /, 'the ')}`;
    if (!mechanics.some((m) => m.id === 'enrage')) mechanics.push({ id: 'enrage', at: 0.3, mult: 0.7 });
  }
  return def;
}

export function rollFoe(rng, depth, type, { layoutId, circle }) {
  if (type === 'guardian') return { def: guardianDef(depth, layoutId, circle), kind: 'boss' };
  if (type === 'glimmer') return { def: { ...GLIMMERKIN }, kind: 'glimmerkin' };
  const base = rng.pick(ZONES[stratumZone(depth)].mobs);
  if (type === 'elite') {
    const trait = rng.pick(ELITE_TRAITS);
    return { def: { ...base, name: `${trait.prefix} ${base.name}`, aura: trait.aura, mechanics: [{ ...trait.mechanic }] }, kind: 'elite' };
  }
  return { def: { ...base }, kind: 'mob' };
}

/** The bane rune of a fight: one of the player's weakest keys (letters preferred), else a random letter. */
export function pickBane(rng, keyStats, layoutId, circle) {
  const allowed = allowedChars(layoutId, circle);
  const weak = [...new Set(weakChars(keyStats, allowed, 4).map((c) => c.toLowerCase()))].filter((c) => allowed.has(c));
  const weakLetters = weak.filter((c) => /^[a-z]$/.test(c));
  if (weakLetters.length) return rng.pick(weakLetters.slice(0, 3));
  if (weak.length) return rng.pick(weak.slice(0, 3));
  const letters = [...allowed].filter((c) => /^[a-z]$/.test(c));
  return rng.pick(letters.length ? letters : [...allowed].filter((c) => c !== ' '));
}

// ------------------------------------------------------------ doors

/** `count` words with distinct first letters for the doors, typeable in the circle. */
export function doorWords(rng, layoutId, circle, count, depth) {
  const maxLen = 5 + Math.min(3, Math.floor(depth / 5));
  const all = wordPool(layoutId, circle).filter((w) => /^[a-z]+$/.test(w));
  const out = [];
  const take = (list) => {
    for (const w of rng.shuffle(list)) {
      if (out.length >= count) return;
      if (!out.some((t) => t[0] === w[0])) out.push(w);
    }
  };
  take(all.filter((w) => w.length >= 3 && w.length <= maxLen));
  if (out.length < count) take(all);
  if (out.length < count) {
    const letters = [...allowedChars(layoutId, circle)].filter((c) => c !== ' ' && c === c.toLowerCase());
    for (const c of rng.shuffle(letters)) {
      if (out.length >= count) break;
      if (!out.some((t) => t[0] === c)) out.push(c.repeat(3));
    }
  }
  return out.slice(0, count);
}

/** The doors offered after clearing `run.depth` (they lead to depth run.depth + 1). */
export function rollDoors(rng, run, { layoutId = run.layoutId } = {}) {
  const next = run.depth + 1;
  const last = run.log.length ? run.log[run.log.length - 1].type : null;
  let types;
  if (isGuardianDepth(next)) {
    types = ['guardian'];
  } else {
    const n = next === 1 ? 2 : 3;
    const W = ROGUE.doorWeights;
    const ok = (t) => {
      if ((t === 'elite' || t === 'shop' || t === 'glimmer') && next < 3) return false;
      if ((t === 'mystery' || t === 'campfire') && next < 2) return false;
      if (t === 'treasure' && next < 4) return false;
      if ((t === 'campfire' || t === 'shop') && last === t) return false;
      return true;
    };
    types = [];
    for (let i = 0; i < n; i++) {
      const options = Object.keys(W).filter((t) => ok(t) && (t === 'fight' || !types.includes(t)));
      types.push(rng.weighted(options, (t) => W[t]) || 'fight');
    }
    const restBefore = isGuardianDepth(next + 1) && last !== 'campfire';
    if (restBefore && !types.includes('campfire')) types[n - 1] = 'campfire';
    if (!types.some((t) => t === 'fight' || t === 'elite')) {
      // keep the pre-guardian campfire: force the fight onto another door
      const i = types.findIndex((t) => !(restBefore && t === 'campfire'));
      types[i < 0 ? 0 : i] = 'fight';
    }
  }
  const fightRewards = [];
  const doors = types.map((type, i) => {
    let reward = null;
    if (type === 'fight') {
      const W = ROGUE.fightRewardWeights;
      let opts = Object.keys(W).filter((r) => !fightRewards.includes(r));
      if (!opts.length) opts = Object.keys(W);
      reward = rng.weighted(opts, (r) => W[r]);
      fightRewards.push(reward);
    } else if (type === 'elite' || type === 'guardian' || type === 'treasure') reward = 'relic';
    else if (type === 'glimmer') reward = 'coins';
    const door = { id: `d${next}-${i}`, depth: next, type, reward, word: '' };
    if (FIGHT_TYPES.includes(type)) door.foe = rollFoe(rng, next, type, { layoutId, circle: run.circle });
    return door;
  });
  const words = doorWords(rng, layoutId, run.circle, doors.length, next);
  doors.forEach((d, i) => {
    d.word = words[i] || 'aaa';
  });
  return doors;
}

// ------------------------------------------------------------ relics

export function rollRelicOffer(rng, run, count = 3) {
  const spent = run.spent || [];
  let pool = RELICS.filter((r) => !r.curse && !run.relics.includes(r.id) && !spent.includes(r.id) && (r.minCircle || 0) <= run.circle);
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const r = rng.weighted(pool, (x) => x.weight);
    if (!r) break;
    pool = pool.filter((x) => x !== r);
    out.push(r.id);
  }
  return out;
}

export function rollCurse(rng, run) {
  const pool = CURSE_IDS.filter((id) => !run.relics.includes(id));
  return pool.length ? rng.weighted(pool, (id) => RELIC_BY_ID[id].weight) : null;
}

/** Add a relic once. Loaded Dice pays its 2 rerolls immediately. → true if added */
export function takeRelic(run, id) {
  if (!RELIC_BY_ID[id] || run.relics.includes(id)) return false;
  run.relics.push(id);
  if (id === 'dice') run.rerolls += 2;
  return true;
}

export function removeRelic(run, id) {
  const had = run.relics.includes(id);
  run.relics = run.relics.filter((r) => r !== id);
  if (had && RELIC_BY_ID[id] && RELIC_BY_ID[id].consumable) {
    run.spent = run.spent || [];
    run.spent.push(id);
  }
  return had;
}

export const runCurses = (run) => run.relics.filter((id) => RELIC_BY_ID[id] && RELIC_BY_ID[id].curse);
export const runRelics = (run) => run.relics.filter((id) => RELIC_BY_ID[id] && !RELIC_BY_ID[id].curse);

// ------------------------------------------------------------ rewards & shop

export function fightCoins(rng, run, { kind, door, stats }) {
  const d = run.depth + 1;
  const doorMult = door && door.reward === 'coins' && kind !== 'glimmerkin' ? ROGUE.coinsDoorMult : 1;
  return Math.round(rng.int(ROGUE.coinMin, ROGUE.coinMax) * (1 + ROGUE.coinPerDepth * (d - 1)) * (ROGUE.coinKind[kind] || 1) * doorMult * (stats.goldMult || 1));
}

/** Everything a won fight pays. Pure: the controller applies it. */
export function rogueVictoryRewards(rng, run, { kind, door, summary, stats }) {
  const base = fightCoins(rng, run, { kind, door, stats });
  const golden = (summary.golden || 0) * ROGUE.goldenCoins;
  const ledger = stats.ledger ? Math.floor((summary.correct * stats.ledger) / 100) : 0;
  const heal = Math.round(stats.maxHp * (kind === 'boss' ? ROGUE.guardianHeal : ROGUE.victoryHeal));
  const n = 3 + (stats.extraChoice || 0);
  let offer = { kind: null, choices: [] };
  const reward = door ? door.reward : null;
  if (kind === 'boss' || kind === 'elite' || reward === 'relic') {
    const choices = rollRelicOffer(rng, run, n);
    offer = choices.length ? { kind: 'relic', choices } : { kind: 'boon', choices: rollBoonOffer(rng, run.boons, n) };
  } else if (reward === 'boon') {
    offer = { kind: 'boon', choices: rollBoonOffer(rng, run.boons, n) };
  }
  return {
    coins: { base, golden, ledger, total: base + golden + ledger },
    heal,
    vital: reward === 'vital',
    offer,
    rerollGain: kind === 'boss' ? stats.rerollPerGuardian || 0 : 0,
  };
}

export function shopPrice(kind, depth) {
  return Math.round(ROGUE.prices[kind] * (1 + ROGUE.shopScalePerDepth * depth));
}

/** The Ink Merchant's stock: 2 relics, 2 boons, mending, a reroll and (with a curse) cleansing. */
export function rollShop(rng, run) {
  const d = run.depth + 1;
  const items = [];
  for (const id of rollRelicOffer(rng, run, 2)) items.push({ kind: 'relic', id, price: shopPrice('relic', d) });
  for (const b of rollBoonOffer(rng, run.boons, 2)) items.push({ kind: 'boon', id: b.id, rank: b.rank, price: shopPrice('boon', d) });
  items.push({ kind: 'heal', price: shopPrice('heal', d) });
  items.push({ kind: 'reroll', price: shopPrice('reroll', d) });
  if (runCurses(run).length) items.push({ kind: 'cleanse', price: shopPrice('cleanse', d) });
  return items.map((it, i) => ({ ...it, key: String(i + 1), sold: false }));
}

// ------------------------------------------------------------ campfire tempering

/** Three runes the campfire offers to temper: the weakest keys first, then random letters. */
export function temperCandidates(keyStats, layoutId, circle, run, rng) {
  const allowed = allowedChars(layoutId, circle);
  const ok = (c) => c !== ' ' && c === c.toLowerCase() && allowed.has(c) && ((run.tempered || {})[c] || 0) < ROGUE.temperMax;
  const out = [...new Set(weakChars(keyStats, allowed, 6).map((c) => c.toLowerCase()))].filter(ok).slice(0, 3);
  const pool = [...allowed].filter((c) => ok(c) && !out.includes(c));
  const letters = rng.shuffle(pool.filter((c) => /^[a-z]$/.test(c)));
  const others = rng.shuffle(pool.filter((c) => !/^[a-z]$/.test(c)));
  for (const c of [...letters, ...others]) {
    if (out.length >= 3) break;
    out.push(c);
  }
  return out;
}

/** A drill line rich in `ch` (≥ ROGUE.temperLen characters, only characters of the circle). */
export function temperDrill(ch, { layoutId, circle, rng }) {
  const allowed = allowedChars(layoutId, circle);
  const words = rng.shuffle(wordPool(layoutId, circle).filter((w) => w.includes(ch) && w.length <= 8));
  const parts = [ch.repeat(3)];
  let len = 3;
  if (words.length >= 3) {
    for (const w of words) {
      if (len >= ROGUE.temperLen) break;
      parts.push(w);
      len += 1 + w.length;
    }
  }
  const homes = [...'asdfjkl'].filter((c) => allowed.has(c) && c !== ch);
  while (len < ROGUE.temperLen) {
    const l = rng.pick(homes) || ch;
    const g = rng.chance(0.5) ? `${l}${ch}${l}` : `${ch}${l}${ch}`;
    parts.push(g);
    len += 1 + g.length;
  }
  return parts.join(' ');
}

// ------------------------------------------------------------ events

/** A mystery room: a hunt event or a Glyphdeep trial, never the same event twice in a row. */
export function rollRogueEvent(rng, run) {
  const pool = [...HUNT_EVENTS, ...ROGUE_EVENTS].filter((e) => {
    if (e.id === run.lastEvent) return false;
    if (e.id === 'trader') return run.coins >= 40;
    if (e.id === 'pact') return !!rollCurseAvailable(run) && rollRelicPoolSize(run) > 0;
    return true;
  });
  return rng.weighted(pool, (e) => e.weight) || HUNT_EVENTS[0];
}
const rollCurseAvailable = (run) => CURSE_IDS.some((id) => !run.relics.includes(id));
const rollRelicPoolSize = (run) => RELICS.filter((r) => !r.curse && !run.relics.includes(r.id) && (r.minCircle || 0) <= run.circle).length;

// ------------------------------------------------------------ chronicle

/** Per-key speed/accuracy at the start of a run, to measure what improved. */
export function keySnapshot(keyStats, allowedSet) {
  const out = {};
  for (const ch of allowedSet) {
    if (ch === ' ') continue;
    const st = keyStats[ch];
    if (!st || !st.n) continue;
    const { acc, medianMs } = keySummary(st);
    out[ch] = { n: st.n, acc: Math.round(acc * 1000) / 1000, ms: medianMs };
  }
  return out;
}

/** Keys that got faster or more accurate during the run, best first. */
export function keyImprovements(before, keyStats, { min = 6 } = {}) {
  const list = [];
  for (const [ch, b] of Object.entries(before || {})) {
    const st = keyStats[ch];
    if (!st || st.n - b.n < min) continue;
    const { acc, medianMs } = keySummary(st);
    if (b.ms == null || medianMs == null) continue;
    const gain = b.ms - medianMs + (acc - b.acc) * 1000;
    if (gain > 0) list.push({ ch, msBefore: b.ms, msAfter: medianMs, accBefore: b.acc, accAfter: acc, gain });
  }
  return list.sort((a, b) => b.gain - a.gain);
}

export function runInk(run) {
  const st = run.stats;
  return Math.round(ROGUE.inkPerDepth * run.depth + ROGUE.inkPerGuardian * st.guardians + ROGUE.inkPerGolden * st.golden);
}

export function bestDepth(save, circle) {
  return (save.rogue && save.rogue.best[String(circle)]) || 0;
}

/** End a run: build its Chronicle, pay Ink, update records. Clears save.rogue.run. */
export function finishRun(save, run, { cause = 'defeat', killedBy = null } = {}) {
  const st = run.stats;
  const r = save.rogue;
  const key = String(run.circle);
  const prev = r.best[key] || 0;
  const total = st.correct + st.errors;
  const ink = runInk(run);
  const chronicle = {
    t: Date.now(),
    circle: run.circle,
    layoutId: run.layoutId,
    depth: run.depth,
    cause,
    killedBy,
    prevBest: prev,
    record: run.depth > prev,
    first: r.totalRuns === 0,
    ink,
    guardians: st.guardians,
    kills: st.kills,
    relics: run.relics.slice(),
    boons: { ...run.boons },
    tempered: { ...run.tempered },
    avgWpm: round1(mean(st.fights.map((f) => f.wpm)) || 0),
    accuracy: total ? st.correct / total : 1,
    bestCombo: st.bestCombo,
    golden: st.golden,
    seconds: Math.round(st.seconds),
    fights: st.fights.slice(-40),
    improvements: keyImprovements(run.startKeys, save.keyStats).slice(0, 3),
    weakest: weakChars(save.keyStats, allowedChars(run.layoutId, run.circle), 1)[0] || null,
  };
  r.ink += ink;
  r.best[key] = Math.max(prev, run.depth);
  r.runs.unshift(chronicle);
  if (r.runs.length > ROGUE.keepRuns) r.runs.length = ROGUE.keepRuns;
  r.totalRuns += 1;
  r.run = null;
  const s = save.stats;
  s.bestDepth = Math.max(s.bestDepth || 0, run.depth);
  s.bestRelics = Math.max(s.bestRelics || 0, runRelics(run).length);
  s.guardiansSlain = (s.guardiansSlain || 0) + st.guardians;
  s.goldenRunes = (s.goldenRunes || 0) + st.golden;
  return chronicle;
}

// ------------------------------------------------------------ Scriptorium

export function upgradeCost(id, rank) {
  return META_BY_ID[id].cost(rank);
}

export function buyUpgrade(save, id) {
  const def = META_BY_ID[id];
  if (!def) return false;
  const up = save.rogue.upgrades;
  const rank = up[id] || 0;
  if (rank >= def.max) return false;
  const cost = def.cost(rank);
  if (save.rogue.ink < cost) return false;
  save.rogue.ink -= cost;
  up[id] = rank + 1;
  return true;
}
