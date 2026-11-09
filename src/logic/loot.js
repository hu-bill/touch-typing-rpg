import {
  SLOTS, RARITIES, RARITY_INDEX, RARITY_BY_ID, BASE_NAMES, RARITY_PREFIX, AFFIXES, AFFIX_IDS,
  UNIQUES, UNIQUE_IDS, CHESTS, SLOT_BY_ID,
} from '../data/items.js';
import { BAL } from '../data/balance.js';

let itemCounter = 0;
const nextItemId = (rng) => `i${Date.now().toString(36)}${(++itemCounter).toString(36)}${rng.int(0, 1e6).toString(36)}`;

export function rollRarity(rng, { magicFind = 0, minRarity = 'common' } = {}) {
  const minIdx = RARITY_INDEX[minRarity] ?? 0;
  const r = rng.weighted(RARITIES, (rar) => {
    const i = RARITY_INDEX[rar.id];
    if (i < minIdx) return 0;
    if (i === 1) return rar.weight * (1 + magicFind / 200);
    if (i >= 2) return rar.weight * (1 + magicFind / 100);
    return rar.weight;
  });
  return (r || RARITIES[minIdx]).id;
}

export function affixValue(affixId, ilvl, rarityId, rng) {
  const def = AFFIXES[affixId];
  if (def.fixed) return def.fixed;
  const rar = RARITY_BY_ID[rarityId];
  return Math.max(1, Math.round(def.base * (1 + 0.15 * (ilvl - 1)) * rar.mult * rng.float(0.75, 1.0)));
}

function rollAffixes(rng, count, ilvl, rarityId) {
  const rIdx = RARITY_INDEX[rarityId];
  const pool = AFFIX_IDS.filter((id) => {
    const min = AFFIXES[id].minRarity;
    return !min || rIdx >= RARITY_INDEX[min];
  });
  const chosen = rng.shuffle(pool).slice(0, count);
  return chosen.map((id) => ({ id, value: affixValue(id, ilvl, rarityId, rng) }));
}

export function itemName(item) {
  if (item.unique) return UNIQUES[item.unique].name;
  const band = Math.min(4, Math.floor((item.ilvl - 1) / 2));
  const base = BASE_NAMES[item.slot][band];
  const prefix = RARITY_PREFIX[item.rarity];
  const suffix = item.affixes.length ? AFFIXES[item.affixes[0].id].suffix : '';
  return [prefix, base, suffix].filter(Boolean).join(' ');
}

export function generateItem({ rng, ilvl, rarity, slot, uniqueId }) {
  let unique = null;
  let theSlot = slot;
  if (rarity === 'legendary') {
    const candidates = UNIQUE_IDS.filter((id) => !theSlot || UNIQUES[id].slot === theSlot);
    unique = uniqueId || rng.pick(candidates.length ? candidates : UNIQUE_IDS);
    theSlot = UNIQUES[unique].slot;
  }
  theSlot = theSlot || rng.pick(SLOTS).id;
  const count = RARITY_BY_ID[rarity].affixes;
  const item = {
    id: nextItemId(rng),
    slot: theSlot,
    rarity,
    ilvl: Math.max(1, Math.round(ilvl)),
    name: '',
    affixes: rollAffixes(rng, count, ilvl, rarity),
    unique,
  };
  item.name = itemName(item);
  return item;
}

/**
 * Roll a single item with pity handling. `pity` is an object { itemsSinceLegendary } mutated in place.
 */
export function rollItem({ rng, ilvl, magicFind = 0, minRarity = 'common', pity }) {
  let rarity = rollRarity(rng, { magicFind, minRarity });
  if (pity) {
    if ((pity.itemsSinceLegendary || 0) >= BAL.pityLegendary) rarity = 'legendary';
    pity.itemsSinceLegendary = rarity === 'legendary' ? 0 : (pity.itemsSinceLegendary || 0) + 1;
  }
  return generateItem({ rng, ilvl, rarity });
}

/** Items dropped by a defeated enemy. */
export function rollDrops({ rng, kind, zoneIndex, magicFind = 0, pity, minRarity }) {
  const ilvl = zoneIndex + 1 + (kind === 'boss' ? 1 : 0);
  const items = [];
  const roll = (extra = {}) => items.push(rollItem({ rng, ilvl, magicFind, pity, ...extra }));
  if (kind === 'mob') {
    if (rng.chance(0.3)) roll();
  } else if (kind === 'elite') {
    if (rng.chance(0.75)) roll({ minRarity: 'uncommon' });
    if (rng.chance(0.25)) roll({ minRarity: 'uncommon' });
  } else if (kind === 'boss') {
    roll({ minRarity: 'rare', magicFind: magicFind + 100 });
    roll({ minRarity: 'rare', magicFind: magicFind + 100 });
  } else if (kind === 'glimmerkin') {
    roll({ minRarity: minRarity || 'rare', magicFind: magicFind + 50 });
  }
  return items;
}

export function sellValue(item) {
  return Math.round(RARITY_BY_ID[item.rarity].sell * Math.pow(1.35, item.ilvl - 1));
}

/** Rough desirability used for ▲ upgrade marks. */
export function itemScore(item) {
  if (!item) return 0;
  return item.affixes.reduce((a, x) => a + x.value, 0) * (1 + RARITY_INDEX[item.rarity] * 0.25)
    + (item.unique ? 50 : 0) + item.ilvl * 2;
}

export function isUpgrade(item, equipment) {
  return itemScore(item) > itemScore(equipment[item.slot]);
}

/** Push items into the inventory; overflow (>= BAL.inventorySize) is auto-sold. Mutates save. */
export function stashItems(save, items) {
  const kept = [];
  const autoSold = [];
  let gold = 0;
  for (const item of items) {
    if (item.rarity === 'legendary') save.stats.legendariesFound += 1;
    if (save.inventory.length < BAL.inventorySize) {
      save.inventory.push(item);
      kept.push(item);
    } else {
      gold += sellValue(item);
      autoSold.push(item);
    }
  }
  return { kept, autoSold, gold };
}

export function chestCost(chest, highestZone) {
  return Math.round(chest.cost * Math.pow(1.4, highestZone));
}

export function openChest({ rng, chestId, highestZone, magicFind = 0, pity }) {
  const chest = CHESTS.find((c) => c.id === chestId);
  return rollItem({
    rng,
    ilvl: highestZone + 1,
    magicFind: magicFind + chest.magicFind,
    minRarity: chest.minRarity,
    pity,
  });
}

export function describeAffix(affix) {
  const def = AFFIXES[affix.id];
  if (!def) return '';
  return def.label.replace('{v}', affix.value);
}

export function slotIcon(slotId) {
  return SLOT_BY_ID[slotId]?.icon || '❔';
}

export { RARITY_BY_ID, RARITY_INDEX };
