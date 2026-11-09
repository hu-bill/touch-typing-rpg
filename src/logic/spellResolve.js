import { SCHOOLS, TIERS } from '../data/spells.js';
import { BAL } from '../data/balance.js';
import { clamp } from '../core/util.js';
import { charWeight, charInfo } from './keyboard.js';
import { keyMastery, masteryBonus } from './mastery.js';

const isGlyph = (ch) => /[A-Z0-9]/.test(ch) || (/[^a-z\s]/i.test(ch) && ch !== "'");

/** Sum of character difficulty, boosted by real-life key mastery and uniques. */
export function rawPower(text, layoutId, keyStats = {}, uniques = new Set(), mults = null) {
  const runeMult = (mults && mults.runeMult) || null;
  const fingerMult = mults && mults.fingerMult && Object.keys(mults.fingerMult).length ? mults.fingerMult : null;
  let total = 0;
  for (const ch of text) {
    let w = charWeight(layoutId, ch);
    if (ch !== ' ') w *= 1 + masteryBonus(keyMastery(keyStats[ch]));
    if (uniques.has('hearth')) {
      const info = charInfo(layoutId, ch);
      if (info && info.row === 2) w *= 2;
    }
    // Glyphdeep: bane / tempered runes and finger relics
    if (runeMult && runeMult[ch]) w *= runeMult[ch];
    if (fingerMult && ch !== ' ') {
      const info = charInfo(layoutId, ch);
      if (info && fingerMult[info.finger]) w *= fingerMult[info.finger];
    }
    if (uniques.has('glyphwright') && isGlyph(ch)) w *= 1.5;
    total += w;
  }
  return total;
}

export function speedMultiplier(wpm) {
  return clamp(0.5 + wpm / 40, 0.5, 3.0);
}

export function accuracyMultiplier(errors, uniques = new Set()) {
  const per = BAL.errorPenalty * (uniques.has('perfectionist') ? 2 : 1);
  return Math.max(BAL.minAccMult, 1 - per * errors);
}

/** Resolve a completed cast into its effects. */
export function resolveSpell({ card, wpm, errors, stats, rng, keyStats = {}, layoutId, flow = 0, avalancheStacks = 0, paceMult = 1, comboMult = 1, extraMult = 1, forceCrit = false }) {
  const school = SCHOOLS[card.school];
  const tier = TIERS[card.tier];
  const uniques = stats.uniques || new Set();
  const power = rawPower(card.text, layoutId, keyStats, uniques, { runeMult: stats.runeMult, fingerMult: stats.fingerMult }) * tier.mult;

  let speed = speedMultiplier(wpm);
  if (speed > 1) speed = 1 + (speed - 1) * (1 + (stats.swiftness || 0) / 100);
  const acc = accuracyMultiplier(errors, uniques);
  const perfect = errors === 0;
  const perfMul = perfect
    ? BAL.perfectMult + (stats.perfectBonus || 0) / 100 + (uniques.has('perfectionist') ? 0.6 : 0)
    : 1;
  let base = power * stats.powerMult * speed * acc * perfMul * paceMult;
  base *= comboMult * extraMult;
  if (card.tier === 1 && stats.cantripPct) base *= 1 + stats.cantripPct / 100;

  const kind = school.kind;
  let crit = false;
  if (kind === 'damage') {
    const critCh = stats.critChance + (school.critBonus || 0) + (flow >= BAL.flowCritThreshold ? BAL.flowCritBonus : 0)
      + (school.id === 'storm' ? stats.stormCrit || 0 : 0);
    crit = rng.chance(critCh) || forceCrit; // forceCrit after the roll: the RNG is consumed exactly as before
  }
  const critMul = crit ? stats.critMult : 1;
  const aval = uniques.has('avalanche') ? 1 + 0.1 * avalancheStacks : 1;
  const schoolPct = (stats.schoolPct && stats.schoolPct[school.id]) || 0;

  let damage = Math.round(base * school.dmg * (1 + schoolPct / 100) * critMul * aval);
  if (kind === 'damage') damage = Math.max(1, damage);
  if (kind === 'shield') damage = 0;
  const heal = kind === 'heal' ? Math.max(1, Math.round(base * school.healPct * stats.healMult)) : 0;
  const shield = kind === 'shield' ? Math.max(1, Math.round(base * school.shieldPct * stats.shieldMult)) : 0;
  const burnTotal = school.burnPct ? Math.round(damage * school.burnPct * (1 + (stats.burnBonus || 0))) : 0;
  const freezePct = school.freezePct ? school.freezePct + (stats.freezeBonus || 0) : 0;
  const echoCh = (uniques.has('echo') ? 0.15 : 0) + (stats.echoChance || 0);
  const echo = kind === 'damage' && echoCh > 0 && rng.chance(echoCh);

  return { kind, damage: Math.max(0, damage), heal, shield, burnTotal, freezePct, crit, perfect, echo, speedMult: speed, accMult: acc, paceMult, comboMult, extraMult, power };
}

/** Preview value shown on a card: 0 mistakes, no crit, at the player's average WPM. */
export function estimateCard(card, stats, avgWpm, layoutId, keyStats) {
  const noCrit = { chance: () => false };
  const r = resolveSpell({ card, wpm: avgWpm, errors: 0, stats, rng: noCrit, keyStats, layoutId });
  if (r.kind === 'heal') return { kind: 'heal', value: r.heal };
  if (r.kind === 'shield') return { kind: 'shield', value: r.shield };
  return { kind: 'damage', value: r.damage };
}
