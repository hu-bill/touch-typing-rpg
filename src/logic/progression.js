import { BAL, CHAIN_MILESTONES } from '../data/balance.js';
import { ZONES, GLIMMERKIN, ELITE_TRAITS } from '../data/zones.js';
import { zoneState } from '../core/save.js';
import { rollDrops, stashItems, openChest } from './loot.js';

export function createHunt(mode, zoneIndex) {
  return { mode, zoneIndex, chain: 0, satchel: 0, hp: null, boons: {}, mods: [], lure: false, lastWasEvent: false };
}

/** Enemy toughness multiplier added for each win in the current hunt. */
export function huntHeat(chain) {
  return Math.min(BAL.huntHeatMax, chain * BAL.huntHeatPer);
}

export function xpToNext(level) {
  return Math.round(25 * Math.pow(level, 1.5));
}

/** Adds xp; returns number of levels gained. Each level grants one attunement point. */
export function addXp(save, xp) {
  const p = save.player;
  let gained = 0;
  p.xp += Math.max(0, Math.round(xp));
  while (p.level < BAL.maxLevel && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    p.points += 1;
    gained += 1;
  }
  if (p.level >= BAL.maxLevel) p.xp = Math.min(p.xp, xpToNext(p.level));
  return gained;
}

const KIND_HP = { mob: 1, elite: 2.2, boss: 1, glimmerkin: 1, dummy: 1 };
const KIND_ATK = { mob: 1, elite: 1.3, boss: 1, glimmerkin: 0, dummy: 0 };
const KIND_XP = { mob: 1, elite: 2.5, boss: 10, glimmerkin: 2, dummy: 0 };
const KIND_GOLD = { mob: 1, elite: 2.5, boss: 8, glimmerkin: 6, dummy: 0 };

export function enemyStats(zoneIndex, kind, def) {
  const z = zoneIndex;
  return {
    hp: Math.max(1, Math.round(BAL.enemyHpBase * Math.pow(BAL.enemyHpGrowth, z) * (def.hpMult ?? 1) * KIND_HP[kind])),
    atk: Math.round(BAL.enemyAtkBase * Math.pow(BAL.enemyAtkGrowth, z) * (def.atkMult ?? 1) * KIND_ATK[kind]),
    attackSec: Math.max(BAL.minAttackSec, (BAL.attackSecBase - BAL.attackSecPerZone * z) * (def.speedMult ?? 1)),
  };
}

export function chainBonus(chain) {
  return Math.min(chain * BAL.chainBonusPer, BAL.chainBonusMax);
}

/** Choose the next hunt opponent. */
export function spawnEnemy({ rng, zoneIndex, chain = 0, forceGlimmer = false }) {
  const zone = ZONES[zoneIndex];
  if (forceGlimmer) return { def: { ...GLIMMERKIN }, kind: 'glimmerkin' };
  if (rng.chance(BAL.glimmerChance)) return { def: { ...GLIMMERKIN }, kind: 'glimmerkin' };
  const base = rng.pick(zone.mobs);
  if (rng.chance(BAL.eliteChance + BAL.eliteChancePerChain * chain)) {
    const trait = rng.pick(ELITE_TRAITS);
    return {
      def: { ...base, name: `${trait.prefix} ${base.name}`, aura: trait.aura, mechanics: [{ ...trait.mechanic }] },
      kind: 'elite',
    };
  }
  return { def: { ...base }, kind: 'mob' };
}

export function bossAvailable(save, zoneIndex) {
  const zs = zoneState(save, ZONES[zoneIndex].id);
  return zs.bossDefeated || zs.kills >= BAL.killsForBoss;
}

/**
 * Apply all rewards of a victory to the save.
 * Gold is returned (not added) — the caller puts it into the hunt satchel.
 */
export function grantVictory(save, { zoneIndex, kind, chain = 0, stats, rng, enemyDef = {}, rewardMult = 1 }) {
  const z = zoneIndex;
  const zone = ZONES[z];
  const zs = zoneState(save, zone.id);
  const bonus = chainBonus(chain);
  const xp = Math.round(BAL.xpBase * Math.pow(BAL.xpGrowth, z) * KIND_XP[kind] * rewardMult);
  let gold = Math.round(rng.int(5, 10) * Math.pow(BAL.goldGrowth, z) * KIND_GOLD[kind] * stats.goldMult * (1 + bonus) * rewardMult);

  const items = rollDrops({
    rng,
    kind,
    zoneIndex: z,
    magicFind: stats.magicFind + bonus * 50,
    pity: save.stats,
    minRarity: enemyDef.minRarity,
  });
  const stashed = stashItems(save, items);
  const { kept, autoSold } = stashed;
  gold += stashed.gold;

  let zoneCleared = false;
  let zoneUnlocked = null;
  if (kind === 'boss') {
    if (!zs.bossDefeated) zoneCleared = true;
    zs.bossDefeated = true;
    save.stats.bossesDefeated += 1;
    if (save.unlockedZone === z && z < ZONES.length - 1) {
      save.unlockedZone = z + 1;
      zoneUnlocked = z + 1;
    }
  } else {
    zs.kills += 1;
  }
  if (kind === 'glimmerkin') save.stats.glimmerkins += 1;
  save.stats.totalKills += 1;

  const levelBefore = save.player.level;
  const levelsGained = addXp(save, xp);
  return { xp, gold, items: kept, autoSold, levelsGained, levelBefore, newLevel: save.player.level, zoneCleared, zoneUnlocked, bossReady: kind !== 'boss' && !zs.bossDefeated && zs.kills === BAL.killsForBoss };
}

// ------------------------------------------------------------ chain milestones

const MILESTONE_BY_ID = Object.fromEntries(CHAIN_MILESTONES.map((m) => [m.id, m]));
const LAST_FIXED = Math.max(...CHAIN_MILESTONES.map((m) => m.chain));

/** Reward reached at exactly this chain, or null. */
export function chainMilestone(chain) {
  const fixed = CHAIN_MILESTONES.find((m) => m.chain === chain);
  if (fixed) return fixed;
  if (chain > LAST_FIXED && chain % 5 === 0) {
    return { ...(chain % 10 === 0 ? MILESTONE_BY_ID.vault : MILESTONE_BY_ID.gilded), chain };
  }
  return null;
}

export function nextChainMilestone(chain) {
  for (let c = chain + 1; c <= chain + 5; c++) {
    const m = chainMilestone(c);
    if (m) return m;
  }
  return null;
}

export function prevChainMilestoneAt(chain) {
  for (let c = chain; c > 0; c--) if (chainMilestone(c)) return c;
  return 0;
}

export function grantChainMilestone(save, { milestone, zoneIndex, stats, rng }) {
  save.stats.milestonesReached += 1;
  if (milestone.lure) return { items: [], autoSold: [], gold: 0, lure: true };
  const item = openChest({ rng, chestId: milestone.chest, highestZone: zoneIndex, magicFind: stats.magicFind, pity: save.stats });
  const { kept, autoSold, gold } = stashItems(save, [item]);
  return { items: kept, autoSold, gold, lure: false };
}
