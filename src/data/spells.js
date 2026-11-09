/**
 * min/max: length of a whole incantation. piece: length of one generated phrase; phrases are
 * chained ("…, …" / "…! …") until the incantation reaches min. Longer spells hit harder (power is
 * the sum of the typed characters), so enemy damage is scaled down by BAL.enemyDamageMult.
 */
export const TIERS = {
  1: { id: 1, name: 'Cantrip', roman: 'I', mult: 1.0, tolerance: 2, min: 6, max: 20, piece: { min: 3, max: 12 }, backfire: 0 },
  2: { id: 2, name: 'Spell', roman: 'II', mult: 1.2, tolerance: 3, min: 16, max: 34, piece: { min: 10, max: 22 }, backfire: 0 },
  3: { id: 3, name: 'Incantation', roman: 'III', mult: 1.45, tolerance: 4, min: 30, max: 58, piece: { min: 20, max: 40 }, backfire: 0.1 },
  4: { id: 4, name: 'Forbidden Rite', roman: 'IV', mult: 1.9, tolerance: 5, min: 50, max: 90, piece: { min: 34, max: 64 }, backfire: 0.2 },
};

export const SCHOOLS = {
  arcane: { id: 'arcane', name: 'Arcane', icon: '✨', color: '#b48cff', kind: 'damage', dmg: 1.15 },
  fire: { id: 'fire', name: 'Fire', icon: '🔥', color: '#ff7a3d', kind: 'damage', dmg: 1.0, burnPct: 0.3, burnSec: 3 },
  frost: { id: 'frost', name: 'Frost', icon: '❄️', color: '#7fd8ff', kind: 'damage', dmg: 0.85, freezePct: 0.3 },
  storm: { id: 'storm', name: 'Storm', icon: '⚡', color: '#ffe066', kind: 'damage', dmg: 0.9, critBonus: 0.2 },
  nature: { id: 'nature', name: 'Nature', icon: '🌿', color: '#7dffa1', kind: 'heal', dmg: 0.25, healPct: 0.8 },
  ward: { id: 'ward', name: 'Ward', icon: '🛡️', color: '#9fb4ff', kind: 'shield', dmg: 0, shieldPct: 1.2 },
};

export const SCHOOL_WEIGHTS = { arcane: 18, fire: 20, frost: 16, storm: 16, nature: 15, ward: 15 };

export const DAMAGE_SCHOOLS = ['arcane', 'fire', 'frost', 'storm'];

export const SCHOOL_EFFECT_TEXT = {
  arcane: 'Pure damage',
  fire: 'Burns for 30% over 3s',
  frost: 'Pushes enemy attack back 30%',
  storm: '+20% critical chance',
  nature: 'Heals you',
  ward: 'Shields you',
};

export const SPELL_NAMES = {
  arcane: ['Arcane Spark', 'Arcane Missile', 'Arcane Torrent', 'Singularity'],
  fire: ['Ember', 'Fireball', 'Inferno', 'Sunfall'],
  frost: ['Chill', 'Frost Lance', 'Blizzard', 'Absolute Zero'],
  storm: ['Static', 'Lightning Bolt', 'Chain Storm', 'Wrath of the Skies'],
  nature: ['Mend', 'Rejuvenate', 'Verdant Bloom', 'World Tree'],
  ward: ['Guard', 'Barrier', 'Aegis', 'Bastion of Ages'],
};
