// The nine regions of Qwerth. Each region teaches new physical keys.

const TANK = { hpMult: 1.3, atkMult: 1.15, speedMult: 1.15 };
const FAST = { hpMult: 0.8, atkMult: 0.9, speedMult: 0.85 };
const NORMAL = { hpMult: 1, atkMult: 1, speedMult: 1 };
const HITTER = { hpMult: 1, atkMult: 1.25, speedMult: 1.05 };

const BOSS = { hpMult: 3.5, atkMult: 1.15, speedMult: 1.0 };
const LATE_BOSS = { hpMult: 3.0, atkMult: 1.1, speedMult: 1.05 };
const BARRIER = { id: 'barrier', at: [0.66, 0.33], amount: 0.12, lowTierPct: 0.3 };

export const ZONES = [
  {
    id: 'meadow',
    name: 'Hearthrow Meadow',
    icon: '🌾',
    blurb: 'Where every Spellstroke begins. The home row hums beneath your fingers — feel the bumps on F and J.',
    codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
    modifiers: [],
    palette: { skyTop: '#14213d', skyBottom: '#3f6b5c', moon: '#fff3c4', layers: ['#2c5146', '#1f3d33', '#142a22'], accent: '#9be37a', ambientColor: '#e9ff8a' },
    ambient: 'fireflies',
    textModes: { 1: 'words', 2: 'words', 3: 'words', 4: 'words' },
    mobs: [
      { id: 'dewslug', name: 'Dew Slug', icon: '🐌', ...TANK },
      { id: 'fluffhorn', name: 'Fluffhorn', icon: '🐇', ...FAST },
      { id: 'buzzling', name: 'Buzzling', icon: '🐝', ...NORMAL },
      { id: 'burrowrat', name: 'Burrow Rat', icon: '🐀', ...HITTER },
    ],
    boss: {
      id: 'mossback', name: 'Mossback', title: 'the Elder Toad', icon: '🐸', ...BOSS,
      mechanics: [{ id: 'enrage', at: 0.35, mult: 0.6 }],
      intro: 'The meadow trembles. Something ancient and damp has been woken by your clatter.',
    },
  },
  {
    id: 'whisperwood',
    name: 'Whisperwood',
    icon: '🌲',
    blurb: 'A forest that repeats every word spoken in it. Your index fingers learn to stretch for G and H.',
    codes: ['KeyG', 'KeyH', 'KeyE', 'KeyI'],
    modifiers: [],
    palette: { skyTop: '#0b1a26', skyBottom: '#24434a', moon: '#cfe8ff', layers: ['#1c3a3a', '#142c2c', '#0b1f1f'], accent: '#6fd6c0', ambientColor: '#b8f5d0' },
    ambient: 'spores',
    textModes: { 1: 'words', 2: 'words', 3: 'words', 4: 'words' },
    mobs: [
      { id: 'hushowl', name: 'Hush Owl', icon: '🦉', ...FAST },
      { id: 'gloamwolf', name: 'Gloam Wolf', icon: '🐺', ...HITTER },
      { id: 'sporeling', name: 'Sporeling', icon: '🍄', ...TANK },
      { id: 'silklurker', name: 'Silk Lurker', icon: '🕷️', ...NORMAL },
    ],
    boss: {
      id: 'hollowstag', name: 'The Hollow Stag', title: 'Keeper of Echoes', icon: '🦌', ...BOSS,
      mechanics: [{ id: 'quicken', step: 0.04, min: 0.65 }, { id: 'enrage', at: 0.3, mult: 0.65 }],
      intro: 'Its antlers rattle like keys. Every strike it lands comes faster than the last.',
    },
  },
  {
    id: 'ember',
    name: 'Ember Hollow',
    icon: '🌋',
    blurb: 'Rivers of slow fire. Reach upward for R, U, T and Y — the top row begins here.',
    codes: ['KeyR', 'KeyU', 'KeyT', 'KeyY'],
    modifiers: [],
    palette: { skyTop: '#1a0a0a', skyBottom: '#6b1f12', moon: '#ffb36b', layers: ['#4a1a12', '#33110c', '#200806'], accent: '#ff7a3d', ambientColor: '#ffb35c' },
    ambient: 'embers',
    textModes: { 1: 'words', 2: 'words', 3: 'words', 4: 'words' },
    mobs: [
      { id: 'ashscorpion', name: 'Ash Scorpion', icon: '🦂', ...HITTER },
      { id: 'cinderbat', name: 'Cinderbat', icon: '🦇', ...FAST },
      { id: 'magmaboar', name: 'Magma Boar', icon: '🐗', ...TANK },
      { id: 'emberwisp', name: 'Ember Wisp', icon: '🔥', ...NORMAL },
    ],
    boss: {
      id: 'cindermaw', name: 'Cindermaw', title: 'the Salamander King', icon: '🦎', ...BOSS,
      mechanics: [{ id: 'searing', pct: 0.03 }, { id: 'enrage', at: 0.3, mult: 0.6 }],
      intro: 'The ground glows. Every mistake you make here will burn.',
    },
  },
  {
    id: 'skyreach',
    name: 'Skyreach Peaks',
    icon: '🏔️',
    blurb: 'Thin air and howling wind. Master O, W, Q and P to complete the top row.',
    codes: ['KeyO', 'KeyW', 'KeyQ', 'KeyP'],
    modifiers: [],
    palette: { skyTop: '#0e1430', skyBottom: '#4b5c99', moon: '#e8f0ff', layers: ['#3b4775', '#2a335a', '#1b2140'], accent: '#a5c8ff', ambientColor: '#ffffff' },
    ambient: 'snow',
    textModes: { 1: 'words', 2: 'words', 3: 'words', 4: 'words' },
    mobs: [
      { id: 'cliffraptor', name: 'Cliff Raptor', icon: '🦅', ...FAST },
      { id: 'squallram', name: 'Squall Ram', icon: '🐏', ...HITTER },
      { id: 'thunderhead', name: 'Thunderhead', icon: '⛈️', ...NORMAL },
      { id: 'peakgoat', name: 'Peak Goat', icon: '🐐', ...TANK },
    ],
    boss: {
      id: 'galecaller', name: 'Galecaller', title: 'Eye of the Storm', icon: '🌪️', ...BOSS,
      mechanics: [{ id: 'gust', every: 12 }, { id: 'quicken', step: 0.03, min: 0.7 }],
      intro: 'The wind tears pages from your spellbook. Do not get attached to any incantation.',
    },
  },
  {
    id: 'underbog',
    name: 'The Underbog',
    icon: '🐊',
    blurb: 'A sinking swamp under the mountains. Your fingers dive down to C, V, B, N and M.',
    codes: ['KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
    modifiers: [],
    palette: { skyTop: '#0d140f', skyBottom: '#34402a', moon: '#d7ffb0', layers: ['#2b3a26', '#1e2a1b', '#121b10'], accent: '#a3d977', ambientColor: '#c6ff9e' },
    ambient: 'bubbles',
    textModes: { 1: 'words', 2: 'words', 3: 'words', 4: 'words' },
    mobs: [
      { id: 'mirecroc', name: 'Mire Croc', icon: '🐊', ...TANK },
      { id: 'bloodgnat', name: 'Bloodgnat', icon: '🦟', ...FAST },
      { id: 'drownedone', name: 'Drowned One', icon: '🧟', ...NORMAL },
      { id: 'leechcoil', name: 'Leech Coil', icon: '🐍', ...HITTER },
    ],
    boss: {
      id: 'morra', name: 'Morra', title: 'the Mire Hag', icon: '👹', ...BOSS,
      mechanics: [{ id: 'hex', every: 9, duration: 5 }, { id: 'regen', pct: 0.003 }],
      intro: 'She mutters hexes that seal your spells shut. And the bog keeps healing her.',
    },
  },
  {
    id: 'archive',
    name: 'The Sunken Archive',
    icon: '📚',
    blurb: 'A drowned library of punctuation. X, Z, commas, periods, slashes and quotes complete the letters.',
    codes: ['KeyX', 'KeyZ', 'Comma', 'Period', 'Slash', 'Quote'],
    modifiers: [],
    palette: { skyTop: '#04111f', skyBottom: '#0f3a5a', moon: '#9ff3ff', layers: ['#0c2f47', '#082236', '#041624'], accent: '#5fd0e6', ambientColor: '#bdf7ff' },
    ambient: 'motes',
    textModes: { 1: 'words', 2: 'words', 3: 'words', 4: 'words' },
    mobs: [
      { id: 'livingscroll', name: 'Living Scroll', icon: '📜', ...NORMAL },
      { id: 'inkwraith', name: 'Ink Wraith', icon: '👻', ...FAST },
      { id: 'archivekraken', name: 'Archive Kraken', icon: '🦑', ...TANK },
      { id: 'candleimp', name: 'Candle Imp', icon: '🕯️', ...HITTER },
    ],
    boss: {
      id: 'lich', name: 'The Librarian Lich', title: 'Curator of Silence', icon: '💀', ...BOSS,
      mechanics: [{ id: 'blindfold' }, { ...BARRIER }],
      intro: 'The lights go out. Your keyboard guide is gone — trust your fingers, not your eyes.',
    },
  },
  {
    id: 'citadel',
    name: 'Capital Citadel',
    icon: '🏰',
    blurb: 'Court of the Shift Kings. Capitals and shifted symbols — always use the opposite pinky.',
    codes: [],
    modifiers: ['shift'],
    palette: { skyTop: '#160d2b', skyBottom: '#4b2a6e', moon: '#ffe7a3', layers: ['#3a2257', '#2a173f', '#1a0e28'], accent: '#f5c66b', ambientColor: '#ffe9a8' },
    ambient: 'sparkles',
    textModes: { 1: 'words', 2: 'capWords', 3: 'sentence', 4: 'sentence' },
    mobs: [
      { id: 'royalguard', name: 'Royal Guard', icon: '💂', ...TANK },
      { id: 'gildedlion', name: 'Gilded Lion', icon: '🦁', ...HITTER },
      { id: 'courtjester', name: 'Court Jester', icon: '🃏', ...FAST },
      { id: 'livingarmor', name: 'Living Armor', icon: '🛡️', ...NORMAL },
    ],
    boss: {
      id: 'shiftwright', name: 'King Shiftwright', title: 'Sovereign of Capitals', icon: '🤴', ...LATE_BOSS,
      mechanics: [{ ...BARRIER }, { id: 'armored', pct: 0.5, unless: '[A-Z]' }],
      intro: 'His armor shrugs off any spell spoken without a Capital Letter.',
    },
  },
  {
    id: 'forge',
    name: 'Numeral Forge',
    icon: '⚙️',
    blurb: 'Hammers keep count in the heat. The number row — reach without lifting your wrists.',
    codes: ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
    modifiers: [],
    palette: { skyTop: '#0f0f12', skyBottom: '#3a2a1f', moon: '#ffcf8a', layers: ['#2b221c', '#1e1814', '#120e0b'], accent: '#ff9f43', ambientColor: '#ffd27a' },
    ambient: 'sparks',
    textModes: { 1: 'words', 2: 'numbers', 3: 'numbers', 4: 'numbers' },
    mobs: [
      { id: 'clocksentry', name: 'Clockwork Sentry', icon: '🤖', ...TANK },
      { id: 'cogswarm', name: 'Cog Swarm', icon: '⚙️', ...FAST },
      { id: 'brassbeetle', name: 'Brass Beetle', icon: '🐞', ...NORMAL },
      { id: 'anvilcrab', name: 'Anvil Crab', icon: '🦀', ...HITTER },
    ],
    boss: {
      id: 'abacus', name: 'The Abacus Golem', title: 'Counter of All Things', icon: '🗿', ...LATE_BOSS,
      mechanics: [{ id: 'armored', pct: 0.5, unless: '[0-9]' }, { id: 'quicken', step: 0.03, min: 0.7 }],
      intro: 'Stone that only numbers can crack. Spells without digits barely scratch it.',
    },
  },
  {
    id: 'abyss',
    name: 'The Glyph Abyss',
    icon: '🌀',
    blurb: 'Where language breaks into code. Brackets, braces and backslashes — the rarest runes of all.',
    codes: ['BracketLeft', 'BracketRight', 'Backslash', 'IntlBackslash'],
    modifiers: ['altgr'],
    palette: { skyTop: '#020208', skyBottom: '#1a0b33', moon: '#c9a7ff', layers: ['#170a2e', '#0f0620', '#070312'], accent: '#b07cff', ambientColor: '#7df9ff' },
    ambient: 'void',
    textModes: { 1: 'words', 2: 'code', 3: 'code', 4: 'code' },
    mobs: [
      { id: 'glitch', name: 'Glitch Invader', icon: '👾', ...FAST },
      { id: 'voidocto', name: 'Void Octopus', icon: '🐙', ...TANK },
      { id: 'recursion', name: 'Recursion', icon: '🌀', ...NORMAL },
      { id: 'nullptr', name: 'Null Pointer', icon: '🕳️', ...HITTER },
    ],
    boss: {
      id: 'null', name: 'Null', title: 'the Unterminated', icon: '👁️', hpMult: 3.8, atkMult: 1.1, speedMult: 1.05,
      mechanics: [
        { id: 'gust', every: 15 },
        { id: 'hex', every: 11, duration: 4 },
        { ...BARRIER },
        { id: 'enrage', at: 0.25, mult: 0.6 },
      ],
      intro: 'It has no end. Only a perfectly closed bracket can contain it.',
    },
  },
];

export const GLIMMERKIN = {
  id: 'glimmerkin', name: 'Glimmerkin', icon: '💰', hpMult: 0.8, atkMult: 0, speedMult: 1,
  fleeAfter: 20, goldMult: 6, minRarity: 'rare',
};

export const TRAINING_DUMMY = { id: 'dummy', name: 'Training Sigil', icon: '🎯', hpMult: 1, atkMult: 0, speedMult: 1, dummy: true };

export const ELITE_TRAITS = [
  { prefix: 'Furious', aura: '#ff4d5e', mechanic: { id: 'quicken', step: 0.04, min: 0.65 } },
  { prefix: 'Ancient', aura: '#5dff9b', mechanic: { id: 'regen', pct: 0.004 } },
  { prefix: 'Blazing', aura: '#ff9f43', mechanic: { id: 'searing', pct: 0.02 } },
];

export const zoneIndexById = (id) => ZONES.findIndex((z) => z.id === id);
