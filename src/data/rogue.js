// The Glyphdeep — endless roguelike mode (PLAN §13): doors, relics, curses and Scriptorium upgrades.
import { ROGUE } from './balance.js';

const s = (n) => (n === 1 ? '' : 's');

export const DOOR_TYPES = {
  fight: { id: 'fight', icon: '⚔️', name: 'Battle', desc: 'A foe of this stratum' },
  elite: { id: 'elite', icon: '💀', name: 'Elite', desc: 'A deadly foe guarding a relic' },
  guardian: { id: 'guardian', icon: '👑', name: 'Guardian', desc: 'The lord of this stratum' },
  glimmer: { id: 'glimmer', icon: '💰', name: 'Glimmerkin', desc: 'Catch it before it flees' },
  mystery: { id: 'mystery', icon: '❓', name: 'Mystery', desc: 'Anything can wait in the dark' },
  campfire: { id: 'campfire', icon: '🔥', name: 'Campfire', desc: 'Rest, or temper a rune' },
  shop: { id: 'shop', icon: '🛒', name: 'Ink Merchant', desc: 'Spend your coins' },
  treasure: { id: 'treasure', icon: '💎', name: 'Treasure', desc: 'An unguarded relic' },
};
export const FIGHT_TYPES = ['fight', 'elite', 'guardian', 'glimmer'];

export const REWARD_TYPES = {
  boon: { id: 'boon', icon: '✦', name: 'Boon', desc: 'Choose a boon' },
  coins: { id: 'coins', icon: '🪙', name: 'Coin hoard', desc: 'Triple coins' },
  vital: { id: 'vital', icon: '❤️', name: 'Vital spark', desc: `Heal ${Math.round(ROGUE.vitalHeal * 100)}% and +${ROGUE.vitalHpPct}% max health` },
  relic: { id: 'relic', icon: '🔮', name: 'Relic', desc: 'Choose a relic' },
};

/**
 * Relics last for the whole run. Numeric stats are ADDED to the fight stats (same keys as boons);
 * `uniques` are added to stats.uniques and `fingerMult` is multiplied into stats.fingerMult.
 */
export const RELICS = [
  { id: 'metronome', icon: '🎼', name: 'Metronome', weight: 10, text: 'Keep a steady beat: spells typed with an even rhythm deal up to +35% damage', stats: { rhythm: 0.35 } },
  { id: 'pinky', icon: '🤙', name: 'Pinky Promise', weight: 10, text: 'Keys under your pinkies channel triple power', stats: { fingerMult: { lp: 3, rp: 3 } } },
  { id: 'ringbearer', icon: '💍', name: 'Ringbearer', weight: 10, text: 'Keys under your ring fingers channel double power', stats: { fingerMult: { lr: 2, rr: 2 } } },
  { id: 'wisp', icon: '🧚', name: 'Racing Wisp', weight: 10, text: 'A wisp races every incantation at your average speed. Beat it for up to +40% damage — trail it and lose up to 30%', stats: { paceRune: 1 } },
  { id: 'blindoath', icon: '🙈', name: 'Blind Oath', weight: 10, text: 'The keyboard guide is sealed for this run. Your spells deal +30% damage', stats: { blind: 1, powerMult: 0.3 } },
  { id: 'midas', icon: '✨', name: 'Midas Quill', weight: 10, text: 'Golden runes appear twice as often, and a spell with a golden rune always crits', stats: { goldenRate: ROGUE.goldenRate, goldenCrit: 1 } },
  { id: 'glass', icon: '🪞', name: 'Glass Quill', weight: 10, text: '+50% spell damage, but every mistake cuts you for 4% of your max health', stats: { powerMult: 0.5, glassPct: 0.04 } },
  { id: 'spacer', icon: '🌌', name: 'Space Between', weight: 10, text: 'Every space you type adds a shield of 1.5% max health', stats: { spaceShieldPct: 0.015 } },
  { id: 'crown', icon: '👑', name: 'Combo Crown', weight: 10, text: 'Combo tiers come twice as fast', stats: { comboRate: 1 } },
  { id: 'ledger', icon: '📒', name: "Scribe's Ledger", weight: 10, text: '+8 coins for every 100 correct keystrokes', stats: { ledger: 8 } },
  { id: 'hearth', icon: '🏠', name: 'Hearthstone', weight: 10, text: 'Home row keys channel double power', stats: { uniques: ['hearth'] } },
  { id: 'glyph', icon: '🔣', name: "Glyphwright's Signet", weight: 10, minCircle: 5, text: 'Capitals, digits and symbols channel +50% power', stats: { uniques: ['glyphwright'] } },
  { id: 'phoenix', icon: '🪶', name: 'Phoenix Feather', weight: 10, consumable: true, text: 'Once, survive a lethal blow with 30% health — then the feather burns away', stats: { uniques: ['phoenix'] } },
  { id: 'chime', icon: '🎐', name: 'Wind Chime', weight: 10, text: 'The first spell that would fizzle in each fight holds together', stats: { uniques: ['secondWind'] } },
  { id: 'lens', icon: '💎', name: 'Flawless Lens', weight: 10, text: 'Perfect casts deal +40% more', stats: { perfectBonus: 40 } },
  { id: 'hourglass', icon: '⏳', name: 'Slow Hourglass', weight: 10, text: 'Enemies attack 15% slower', stats: { tempoPct: 15 } },
  { id: 'heartstone', icon: '💗', name: 'Heartstone', weight: 10, text: '+25% maximum health', stats: { maxHpPct: 25 } },
  { id: 'clover', icon: '🍀', name: 'Four-Leaf Clover', weight: 6, text: 'Every boon and relic reward offers one more choice', stats: { extraChoice: 1 } },
  { id: 'dice', icon: '🎲', name: 'Loaded Dice', weight: 10, text: 'Gain 2 rerolls now and 1 after every guardian', stats: { rerollPerGuardian: 1 } },
  { id: 'banebrand', icon: '🗡️', name: 'Banebrand', weight: 10, text: 'Bane runes channel ×3 power instead of ×2', stats: { baneBonus: 1 } },
  { id: 'whetstone', icon: '🪨', name: 'Whetstone', weight: 6, text: 'Tempered runes gain twice the power', stats: { temperBonus: 1 } },
  { id: 'echoshell', icon: '🔁', name: 'Echo Shell', weight: 10, text: '15% chance a damage spell is cast twice', stats: { uniques: ['echo'] } },
  { id: 'avalanche', icon: '🏔️', name: 'Avalanche Stone', weight: 10, text: 'Each cast within 2.5s of the last adds +10% damage (max +50%)', stats: { uniques: ['avalanche'] } },
  { id: 'tempest', icon: '🌩️', name: 'Storm Primer', weight: 6, text: "Critical hits push the enemy's attack back by 25%", stats: { uniques: ['tempest'] } },
  // curses: never offered as rewards; taken in Dark Pacts, cleansed at the Ink Merchant
  { id: 'blots', icon: '🫥', name: 'Ink Blots', weight: 10, curse: true, text: 'Some letters are blotted out — you must know the word', stats: { blots: 1 } },
  { id: 'brittle', icon: '🥀', name: 'Brittle Spells', weight: 10, curse: true, text: 'One fewer mistake allowed in every spell', stats: { tolerance: -1 } },
  { id: 'haste', icon: '⏩', name: 'Hasted Foes', weight: 10, curse: true, text: 'Enemies attack 25% faster', stats: { tempoPct: -20 } },
  { id: 'frail', icon: '🩹', name: 'Frailty', weight: 10, curse: true, text: '−20% maximum health', stats: { maxHpPct: -20 } },
  { id: 'sealed', icon: '🕶️', name: 'Sealed Sight', weight: 10, curse: true, text: 'The keyboard guide is sealed', stats: { blind: 1 } },
  { id: 'toll', icon: '🩸', name: 'Blood Toll', weight: 10, curse: true, text: 'Every fight starts with a cut of 6% max health', stats: { bloodToll: 0.06 } },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));
export const CURSE_IDS = RELICS.filter((r) => r.curse).map((r) => r.id);

/** Scriptorium: permanent upgrades bought with Ink. cost(r) = price of the next rank when r ranks are owned. */
export const META_UPGRADES = [
  { id: 'vigor', icon: '❤️', name: 'Hardy Hands', max: 5, cost: (r) => 20 + 10 * r, text: (r) => `+${8 * r} maximum health in every run` },
  { id: 'purse', icon: '🪙', name: 'Inheritance', max: 3, cost: (r) => 25 + 15 * r, text: (r) => `Start every run with ${20 * r} coins` },
  { id: 'bones', icon: '🎲', name: 'Lucky Bones', max: 2, cost: (r) => 35 + 25 * r, text: (r) => `Start every run with ${r} extra reroll${s(r)}` },
  { id: 'gild', icon: '✨', name: 'Gilded Script', max: 3, cost: (r) => 30 + 15 * r, text: (r) => `Golden runes appear ${25 * r}% more often` },
  { id: 'embers', icon: '🔥', name: 'Warm Embers', max: 2, cost: (r) => 30 + 20 * r, text: (r) => `Campfires heal ${10 * r}% more` },
  { id: 'keepsake', icon: '📿', name: 'Keepsake', max: 1, cost: () => 90, text: () => 'Begin every run by choosing 1 of 3 relics' },
];
export const META_BY_ID = Object.fromEntries(META_UPGRADES.map((u) => [u.id, u]));

/** Short names of the nine rune circles (cumulative key sets of campaign regions I–IX). */
export const CIRCLE_TITLES = ['Home row', 'Index stretch', 'Upper reach', 'Top row', 'All letters', 'Punctuation', 'Capitals', 'Numbers', 'Full keyboard'];
