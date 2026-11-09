export const SLOTS = [
  { id: 'staff', name: 'Staff', icon: '🪄' },
  { id: 'robe', name: 'Robe', icon: '🧥' },
  { id: 'amulet', name: 'Amulet', icon: '📿' },
  { id: 'ring', name: 'Ring', icon: '💍' },
  { id: 'tome', name: 'Tome', icon: '📖' },
];
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#c9cdd6', weight: 600, affixes: 1, mult: 1.0, sell: 3 },
  { id: 'uncommon', name: 'Uncommon', color: '#4ade80', weight: 260, affixes: 2, mult: 1.15, sell: 8 },
  { id: 'rare', name: 'Rare', color: '#60a5fa', weight: 105, affixes: 3, mult: 1.3, sell: 20 },
  { id: 'epic', name: 'Epic', color: '#c084fc', weight: 30, affixes: 4, mult: 1.5, sell: 50 },
  { id: 'legendary', name: 'Legendary', color: '#fb923c', weight: 5, affixes: 3, mult: 1.7, sell: 150 },
];
export const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map((r) => [r.id, r]));

export const BASE_NAMES = {
  staff: ['Twig Wand', 'Birch Staff', 'Runed Rod', 'Starwood Staff', 'Voidglass Scepter'],
  robe: ['Linen Robe', 'Wool Cloak', 'Silk Vestment', 'Runewoven Robe', 'Astral Mantle'],
  amulet: ['Bone Charm', 'Copper Locket', 'Jade Amulet', 'Sunstone Pendant', 'Eclipse Talisman'],
  ring: ['Tin Band', 'Silver Ring', 'Opal Ring', 'Dragonbone Loop', 'Infinity Signet'],
  tome: ['Tattered Primer', 'Apprentice Spellbook', "Scholar's Codex", "Sage's Grimoire", 'Elder Codex'],
};

export const RARITY_PREFIX = { common: '', uncommon: 'Fine', rare: 'Gleaming', epic: 'Exalted', legendary: '' };

export const AFFIXES = {
  power: { label: '+{v}% spell damage', base: 4, stat: 'powerPct', suffix: 'of Might' },
  crit: { label: '+{v}% critical chance', base: 2, stat: 'critPct', suffix: 'of Precision' },
  critDmg: { label: '+{v}% critical damage', base: 10, stat: 'critDmgPct', suffix: 'of Ruin' },
  vitality: { label: '+{v} maximum health', base: 8, stat: 'maxHp', suffix: 'of the Bear' },
  flow: { label: '+{v}% flow gain', base: 6, stat: 'flowPct', suffix: 'of Flow' },
  gold: { label: '+{v}% gold found', base: 6, stat: 'goldPct', suffix: 'of Greed' },
  luck: { label: '+{v}% item rarity', base: 5, stat: 'magicFind', suffix: 'of Fortune' },
  fire: { label: '+{v}% fire damage', base: 8, stat: 'school.fire', suffix: 'of Embers' },
  frost: { label: '+{v}% frost damage', base: 8, stat: 'school.frost', suffix: 'of Winter' },
  storm: { label: '+{v}% storm damage', base: 8, stat: 'school.storm', suffix: 'of Storms' },
  arcane: { label: '+{v}% arcane damage', base: 8, stat: 'school.arcane', suffix: 'of the Arcane' },
  healing: { label: '+{v}% healing', base: 8, stat: 'healPct', suffix: 'of Mending' },
  warding: { label: '+{v}% shield strength', base: 8, stat: 'shieldPct', suffix: 'of Warding' },
  patience: { label: 'Enemies attack {v}% slower', base: 2, stat: 'tempoPct', suffix: 'of Patience' },
  perfection: { label: '+{v}% damage on perfect casts', base: 6, stat: 'perfectBonus', suffix: 'of Perfection' },
  swiftness: { label: '+{v}% speed bonus', base: 5, stat: 'swiftness', suffix: 'of Haste' },
  leech: { label: 'Heal {v}% of damage dealt', base: 1, stat: 'leechPct', suffix: 'of the Leech' },
  steady: { label: '+1 mistake allowed before fizzling', base: 1, fixed: 1, stat: 'tolerance', suffix: 'of Composure', minRarity: 'rare' },
};
export const AFFIX_IDS = Object.keys(AFFIXES);

export const UNIQUES = {
  echo: { id: 'echo', slot: 'staff', name: 'Quill of Echoes', text: '15% chance a damage spell is cast twice.' },
  avalanche: { id: 'avalanche', slot: 'staff', name: 'Avalanche Rod', text: 'Each cast within 2.5s of the last adds +10% damage (max +50%).' },
  hearth: { id: 'hearth', slot: 'robe', name: 'Mantle of the Hearth', text: 'Home row keys channel double power.' },
  phoenix: { id: 'phoenix', slot: 'amulet', name: 'Phoenix Ember', text: 'Once per fight, survive a lethal blow with 30% health.' },
  secondWind: { id: 'secondWind', slot: 'ring', name: 'Band of Second Chances', text: 'The first spell that would fizzle each fight holds together.' },
  glyphwright: { id: 'glyphwright', slot: 'ring', name: 'Signet of the Glyphwright', text: 'Capitals, digits and symbols channel +50% power.' },
  perfectionist: { id: 'perfectionist', slot: 'tome', name: 'Codex of the Perfectionist', text: 'Perfect casts deal +60% damage, but mistakes cost double.' },
  tempest: { id: 'tempest', slot: 'tome', name: 'Tempest Primer', text: "Critical hits push the enemy's attack back by 25%." },
};
export const UNIQUE_IDS = Object.keys(UNIQUES);

export const CHESTS = [
  { id: 'weathered', name: 'Weathered Chest', icon: '🧰', cost: 50, minRarity: 'common', magicFind: 0, odds: 'Any rarity' },
  { id: 'gilded', name: 'Gilded Chest', icon: '🎁', cost: 220, minRarity: 'uncommon', magicFind: 60, odds: 'Uncommon or better, boosted odds' },
  { id: 'astral', name: 'Astral Coffer', icon: '💎', cost: 900, minRarity: 'rare', magicFind: 200, odds: 'Rare or better, greatly boosted odds' },
];
