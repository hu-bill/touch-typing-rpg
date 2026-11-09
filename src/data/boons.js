// Hunt boons: picked after each hunt victory, stack in ranks, last until the hunt ends.
// Every boon is a set of per-rank additive stat changes (see logic/boons.js applyHuntMods).
const s = (r) => (r === 1 ? '' : 's');

export const BOONS = [
  { id: 'kindling', icon: '🔥', name: 'Kindling', max: 3, weight: 10, text: (r) => `Fire spells burn for +${50 * r}% more`, stats: { burnBonus: 0.5 } },
  { id: 'rime', icon: '❄️', name: 'Rime', max: 3, weight: 10, text: (r) => `Frost spells push the attack back an extra ${10 * r}%`, stats: { freezeBonus: 0.1 } },
  { id: 'charge', icon: '⚡', name: 'Static Charge', max: 3, weight: 10, text: (r) => `Storm spells gain +${10 * r}% critical chance`, stats: { stormCrit: 0.1 } },
  { id: 'arcana', icon: '✨', name: 'Deep Arcana', max: 3, weight: 10, text: (r) => `Arcane spells deal +${20 * r}% damage`, stats: { 'schoolPct.arcane': 20 } },
  { id: 'steady', icon: '🪶', name: 'Steady Hand', max: 2, weight: 9, text: (r) => `+${r} mistake${s(r)} allowed in every spell`, stats: { tolerance: 1 } },
  { id: 'swift', icon: '💨', name: 'Swift Quill', max: 3, weight: 10, text: (r) => `+${20 * r}% speed bonus`, stats: { swiftness: 20 } },
  { id: 'bloodink', icon: '🩸', name: 'Blood Ink', max: 3, weight: 9, text: (r) => `Heal ${4 * r}% of damage dealt`, stats: { leechPct: 4 } },
  { id: 'bulwark', icon: '🛡️', name: 'Bulwark', max: 3, weight: 9, text: (r) => `Ward shields are ${30 * r}% stronger`, stats: { shieldMult: 0.3 } },
  { id: 'bloom', icon: '🌿', name: 'Wild Bloom', max: 3, weight: 9, text: (r) => `Nature heals ${30 * r}% more`, stats: { healMult: 0.3 } },
  { id: 'heart', icon: '❤️', name: 'Second Heart', max: 3, weight: 9, text: (r) => `+${15 * r}% maximum health`, stats: { maxHpPct: 15 } },
  { id: 'keen', icon: '🎯', name: 'Keen Eye', max: 3, weight: 10, text: (r) => `+${5 * r}% critical chance`, stats: { critChance: 0.05 } },
  { id: 'ruin', icon: '💥', name: 'Ruin', max: 3, weight: 10, text: (r) => `Critical hits deal +${25 * r}% damage`, stats: { critMult: 0.25 } },
  { id: 'wellspring', icon: '🌊', name: 'Wellspring', max: 3, weight: 9, text: (r) => `+${25 * r}% Flow gain`, stats: { flowGainMult: 0.25 } },
  { id: 'patience', icon: '⏳', name: 'Patience', max: 3, weight: 9, text: (r) => `Enemies attack ${8 * r}% slower`, stats: { tempoPct: 8 } },
  { id: 'greed', icon: '💰', name: 'Greed', max: 3, weight: 6, text: (r) => `+${20 * r}% gold found`, stats: { goldMult: 0.2 } },
  { id: 'luckystar', icon: '🍀', name: 'Lucky Star', max: 3, weight: 6, text: (r) => `+${25 * r} item rarity`, stats: { magicFind: 25 } },
  { id: 'cantor', icon: '🎵', name: 'Cantor', max: 3, weight: 9, text: (r) => `Cantrips deal +${35 * r}% damage`, stats: { cantripPct: 35 } },
  { id: 'echoing', icon: '🔁', name: 'Echoing Voice', max: 3, weight: 8, text: (r) => `${8 * r}% chance a damage spell is cast twice`, stats: { echoChance: 0.08 } },
  { id: 'grace', icon: '🕊️', name: 'Grace', max: 1, weight: 7, text: () => 'The first mistake in each spell is forgiven', stats: { grace: 1 } },
  { id: 'momentum', icon: '🌀', name: 'Momentum', max: 1, weight: 7, text: () => 'Mistakes halve your combo instead of breaking it', stats: { momentum: 1 } },
  { id: 'riteborn', icon: '📜', name: 'Riteborn', max: 2, weight: 8, text: (r) => `Start every fight with ${30 * r}% Flow`, stats: { startFlow: 30 } },
  { id: 'dawnward', icon: '🌅', name: 'Dawn Ward', max: 3, weight: 8, text: (r) => `Start every fight with a shield of ${10 * r}% max health`, stats: { startShieldPct: 0.1 } },
  { id: 'executioner', icon: '🪓', name: 'Executioner', max: 3, weight: 8, text: (r) => `+${25 * r}% damage to foes below 30% health`, stats: { executePct: 0.25 } },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));
