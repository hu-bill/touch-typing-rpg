// Every tunable number of the game lives here.
export const BAL = {
  enemyHpBase: 50,
  enemyHpGrowth: 1.24,
  enemyAtkBase: 8,
  enemyAtkGrowth: 1.16,
  // incantations are ~1.5× longer than v1.3 (TIERS in spells.js); every enemy hit is scaled to match
  enemyDamageMult: 0.8,
  attackSecBase: 7.5,
  attackSecPerZone: 0.3,
  minAttackSec: 3.5,
  windupSec: 1.2,

  xpBase: 15,
  xpGrowth: 1.35,
  goldGrowth: 1.4,
  killsForBoss: 6,
  maxLevel: 60,
  hpPerLevel: 12,
  powerPerLevel: 0.05,

  eliteChance: 0.12,
  eliteChancePerChain: 0.02,
  glimmerChance: 0.05,

  chainBonusPer: 0.1,
  chainBonusMax: 1.0,
  chainHeal: 0.3,
  deathGoldLoss: 0.5,
  fleeGoldLoss: 0.25,

  flowPerKey: 1.25,
  flowPerError: 15,
  flowCritThreshold: 50,
  flowCritBonus: 0.05,

  errorPenalty: 0.12,
  minAccMult: 0.25,
  perfectMult: 1.15,
  shieldCapPct: 0.6,

  skipAheadLevel: 8, // level granted when an experienced typist skips the letter regions

  inventorySize: 30,
  pityLegendary: 150,

  tempoRef: 25,
  tempoMin: 0.75,
  tempoMax: 1.5,

  huntHeatPer: 0.02, // M22 balance pass: 0.03 killed 29% of simulated hunts (target ≤ 25%)
  huntHeatMax: 0.45,

  eventChance: 0.2,
  eventMinChain: 2,
  mimicTimeFactor: 1.6,
  mimicMinSec: 4,
  mimicMaxSec: 20,
  mimicBitePct: 0.15,
  shrineAcc: 0.95,
  shrineHealPct: 0.2,
  altarFights: 3,
  altarTempoPct: -20,
  altarGoldMult: 0.75,
  traderPricePct: 0.3,
  traderMinPrice: 20,
};

/** Combo power tiers: the combo multiplies spell power. */
export const COMBO_TIERS = [
  { at: 0, name: '', mult: 1.0, color: '' },
  { at: 25, name: 'Kindled', mult: 1.05, color: '#ffd27a' },
  { at: 50, name: 'Blazing', mult: 1.1, color: '#ff9f43' },
  { at: 100, name: 'Radiant', mult: 1.15, color: '#7df9ff' },
  { at: 200, name: 'Transcendent', mult: 1.2, color: '#d9b3ff' },
];

/** Discrete rewards for long hunts. After chain 10 every 5th win repeats: multiples of 10 → vault, other multiples of 5 → gilded. */
export const CHAIN_MILESTONES = [
  { chain: 3, id: 'cache', icon: '🧰', name: "Hunter's Cache", chest: 'weathered', desc: 'A free Weathered Chest' },
  { chain: 5, id: 'gilded', icon: '🎁', name: 'Gilded Cache', chest: 'gilded', desc: 'A free Gilded Chest' },
  { chain: 7, id: 'lure', icon: '✨', name: 'Glimmer Lure', lure: true, desc: 'Your next foe is a Glimmerkin' },
  { chain: 10, id: 'vault', icon: '💎', name: 'Treasure Vault', chest: 'astral', desc: 'A free Astral Coffer' },
];

/**
 * Difficulty presets, chosen when a journey starts (changeable in Settings).
 * enemySpeed multiplies the enemy attack interval (>1 = slower enemies).
 */
export const DIFFICULTIES = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice',
    icon: '🌱',
    tagline: 'New to touch typing',
    enemySpeed: 1.4,
    enemyDamage: 0.65,
    enemyHp: 0.85,
    tolerance: 1,
    backfire: 0,
    rewardMult: 1,
    pace: false,
    guide: 'always',
    perks: [
      'Enemies attack 40% slower and hit 35% softer',
      'One extra mistake allowed in every spell',
      'Fizzled spells never backfire',
      'The keyboard guide always lights the next key',
    ],
  },
  adept: {
    id: 'adept',
    name: 'Adept',
    icon: '🔮',
    tagline: 'You know where the keys are',
    enemySpeed: 1,
    enemyDamage: 1,
    enemyHp: 1,
    tolerance: 0,
    backfire: 1,
    rewardMult: 1,
    pace: false,
    guide: 'hints',
    perks: [
      'The intended balance',
      'The keyboard guide appears only when you hesitate',
      'Enemies adapt to your typing speed',
    ],
  },
  archmage: {
    id: 'archmage',
    name: 'Archmage',
    icon: '⚡',
    tagline: 'You touch type and want to get faster',
    enemySpeed: 0.8,
    enemyDamage: 1.25,
    enemyHp: 1.1,
    tolerance: -1,
    backfire: 1.5,
    rewardMult: 1.35,
    pace: true,
    guide: 'off',
    perks: [
      'Pace rune: out-type your own average speed for up to +40% damage — fall behind and lose up to 30%',
      'Faster, tougher enemies and one fewer mistake allowed',
      '+35% gold and XP',
      'No keyboard guide — eyes on the incantation',
    ],
  },
};
export const DIFFICULTY_IDS = ['apprentice', 'adept', 'archmage'];
/** Archmage pace multiplier = clamp(castWpm / averageWpm, min, max). */
export const PACE = { min: 0.7, max: 1.4 };

/** The Glyphdeep — endless roguelike mode (PLAN §13). Depth d is 1-based. */
export const ROGUE = {
  guardianEvery: 5,
  // enemies
  hpBase: 46,
  hpGrowth: 1.1,
  atkBase: 7,
  atkGrowth: 1.075,
  attackSecBase: 7.6,
  attackSecPerDepth: 0.08,
  minAttackSec: 3.6,
  eliteHp: 1.9,
  eliteAtk: 1.25,
  guardianHp: 0.65, // M35 balance pass: 0.8 stopped 20 WPM runs at the first guardian (median depth 4)
  guardianAtk: 0.85,
  // player
  baseHp: 100,
  victoryHeal: 0.15,
  guardianHeal: 0.3,
  campfireHeal: 0.35,
  vitalHeal: 0.3,
  vitalHpPct: 6,
  startRerolls: 1,
  // coins
  coinMin: 6,
  coinMax: 10,
  coinPerDepth: 0.06,
  coinsDoorMult: 3,
  coinKind: { mob: 1, elite: 2, boss: 4, glimmerkin: 6 },
  goldenRate: 0.035,
  goldenCoins: 2,
  // bane & tempering
  bane: 2,
  temperBonus: 0.5,
  temperMax: 3,
  temperAcc: 0.9,
  temperLen: 34,
  // shop: price = round(base × (1 + shopScalePerDepth × depth))
  shopScalePerDepth: 0.03,
  prices: { relic: 70, boon: 38, heal: 28, cleanse: 55, reroll: 24 },
  shopHeal: 0.35,
  // events
  wispSpeed: 1.12,
  wispMinWpm: 12,
  bridgeCracks: 3,
  bridgeFallPct: 0.15,
  mimicCoins: 18,
  bridgeCoins: 30,
  // doors
  doorWeights: { fight: 46, elite: 14, mystery: 18, campfire: 9, shop: 7, treasure: 3, glimmer: 3 },
  fightRewardWeights: { boon: 62, coins: 22, vital: 16 },
  // meta
  inkPerDepth: 2,
  inkPerGuardian: 6,
  inkPerGolden: 0.34,
  keepRuns: 12,
};
