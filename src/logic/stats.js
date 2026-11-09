import { AFFIXES } from '../data/items.js';
import { BAL } from '../data/balance.js';

export const ATTUNEMENTS = [
  { id: 'might', name: 'Might', icon: '💪', desc: '+3% spell damage' },
  { id: 'focus', name: 'Focus', icon: '🎯', desc: '+1.5% critical chance, +3% flow gain' },
  { id: 'vigor', name: 'Vigor', icon: '❤️', desc: '+8 maximum health' },
  { id: 'fortune', name: 'Fortune', icon: '🍀', desc: '+4% gold, +3% item rarity' },
];

/** Sum all affixes of the given items into a flat map keyed by stat key. */
export function gearTotals(items) {
  const g = {};
  const uniques = new Set();
  for (const item of items) {
    if (!item) continue;
    if (item.unique) uniques.add(item.unique);
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def) continue;
      g[def.stat] = (g[def.stat] || 0) + a.value;
    }
  }
  return { g, uniques };
}

/** Derived player stats from level, attunements and equipped gear. */
export function computePlayerStats(save) {
  const level = save.player.level;
  const a = save.player.attune;
  const { g, uniques } = gearTotals(Object.values(save.equipment));
  const v = (k) => g[k] || 0;
  return {
    level,
    maxHp: Math.round(100 + BAL.hpPerLevel * (level - 1) + 8 * a.vigor + v('maxHp')),
    powerMult: 1 + BAL.powerPerLevel * (level - 1) + 0.03 * a.might + v('powerPct') / 100,
    critChance: Math.min(0.75, 0.05 + 0.015 * a.focus + v('critPct') / 100),
    critMult: 1.75 + v('critDmgPct') / 100,
    flowGainMult: 1 + 0.03 * a.focus + v('flowPct') / 100,
    goldMult: 1 + 0.04 * a.fortune + v('goldPct') / 100,
    magicFind: 3 * a.fortune + v('magicFind'),
    tolerance: v('tolerance'),
    tempoPct: v('tempoPct'),
    healMult: 1 + v('healPct') / 100,
    shieldMult: 1 + v('shieldPct') / 100,
    schoolPct: {
      fire: v('school.fire'),
      frost: v('school.frost'),
      storm: v('school.storm'),
      arcane: v('school.arcane'),
      nature: 0,
      ward: 0,
    },
    perfectBonus: v('perfectBonus'),
    swiftness: v('swiftness'),
    leechPct: v('leechPct'),
    burnBonus: 0,
    freezeBonus: 0,
    stormCrit: 0,
    cantripPct: 0,
    echoChance: 0,
    maxHpPct: 0,
    startFlow: 0,
    startShieldPct: 0,
    executePct: 0,
    grace: 0,
    momentum: 0,
    boons: {},
    uniques,
  };
}
