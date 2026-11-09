// Themed vocabulary so every incantation sounds like the spell it casts.
// All words are lowercase letters only; textGen filters them by the keys the player has unlocked,
// so early regions use the few themed words they can, later regions get the full vocabulary.
//
// Slots used by templates:
//   {verb}   imperative verb            ("burn")
//   {noun}   singular noun              ("ember")
//   {pl}     plural noun                ("embers")
//   {adj}    adjective                  ("molten")
//   {target} who/what the spell hits    ("the foe" / "my wounds")
//   {place}  capitalised proper noun    ("Ashgrove") — only usable once Shift is unlocked
//   {d} {dd} {ddd} {year} {time}        numbers (Numeral Forge)

export const SCHOOL_LEXICON = {
  fire: {
    verbs: [
      'burn', 'ignite', 'sear', 'scorch', 'blaze', 'kindle', 'flare', 'char', 'singe', 'smite', 'rage',
      'erupt', 'consume', 'devour', 'raze', 'torch', 'melt', 'flash', 'smolder', 'combust', 'roar', 'spread',
      'hiss', 'crackle', 'incinerate', 'boil',
    ],
    nouns: [
      'fire', 'flame', 'ember', 'ash', 'blaze', 'cinder', 'pyre', 'spark', 'sun', 'heat', 'coal', 'torch',
      'smoke', 'inferno', 'magma', 'lava', 'furnace', 'forge', 'wildfire', 'dragon', 'phoenix', 'fury',
      'flash', 'brimstone', 'hearth', 'flare',
    ],
    plurals: ['flames', 'embers', 'ashes', 'cinders', 'sparks', 'coals', 'fires', 'pyres', 'torches', 'suns', 'dragons', 'flares'],
    adjs: [
      'red', 'hot', 'fiery', 'molten', 'searing', 'burning', 'scarlet', 'crimson', 'golden', 'wild', 'bright',
      'blazing', 'raging', 'white', 'glowing', 'ashen', 'infernal', 'hungry', 'fierce',
    ],
    targets: [
      'foe', 'the foe', 'the beast', 'the dark', 'the night', 'this shadow', 'them', 'all evil', 'the wicked',
      'the fiend', 'flesh', 'its flesh', 'their bones',
    ],
  },
  frost: {
    verbs: [
      'freeze', 'chill', 'frost', 'still', 'halt', 'numb', 'shatter', 'bind', 'lock', 'harden', 'crack',
      'hush', 'slow', 'grip', 'encase', 'entomb', 'glaze', 'seal', 'bite', 'snap', 'quell', 'quench', 'stop', 'calm',
    ],
    nouns: [
      'ice', 'frost', 'snow', 'hail', 'sleet', 'rime', 'winter', 'glacier', 'cold', 'chill', 'blizzard', 'shard',
      'icicle', 'tundra', 'north', 'crystal', 'glass', 'stillness', 'avalanche', 'fjord', 'floe', 'storm',
    ],
    plurals: ['shards', 'icicles', 'snows', 'flakes', 'crystals', 'glaciers', 'hailstones', 'floes', 'winters'],
    adjs: [
      'cold', 'frozen', 'icy', 'pale', 'white', 'still', 'bitter', 'silent', 'blue', 'glacial', 'frigid', 'polar',
      'numb', 'sharp', 'deep', 'frosted', 'glassy', 'endless', 'quiet',
    ],
    targets: [
      'foe', 'the foe', 'its blood', 'their blood', 'the beast', 'the river', 'its heart', 'them', 'the air',
      'their breath', 'the field', 'all who stand', 'the hills',
    ],
  },
  storm: {
    verbs: [
      'strike', 'shock', 'crash', 'roar', 'thunder', 'split', 'rend', 'charge', 'jolt', 'surge', 'howl', 'blast',
      'crack', 'smite', 'rumble', 'rage', 'break', 'scatter', 'flash', 'sweep', 'lash', 'whirl', 'quake', 'zap',
    ],
    nouns: [
      'storm', 'thunder', 'lightning', 'bolt', 'spark', 'gale', 'wind', 'tempest', 'sky', 'cloud', 'rain', 'squall',
      'hail', 'surge', 'current', 'static', 'volt', 'gust', 'typhoon', 'cyclone', 'flash', 'vortex', 'zephyr',
    ],
    plurals: ['bolts', 'sparks', 'winds', 'skies', 'clouds', 'storms', 'gusts', 'gales', 'currents', 'volts'],
    adjs: [
      'wild', 'loud', 'bright', 'sudden', 'raging', 'howling', 'dark', 'electric', 'swift', 'fierce', 'roaring',
      'white', 'violent', 'high', 'black', 'charged', 'restless', 'quick',
    ],
    targets: [
      'foe', 'the foe', 'the earth', 'the ground', 'the beast', 'the tower', 'them', 'the wicked', 'all',
      'the hills', 'the field', 'its armor',
    ],
  },
  arcane: {
    verbs: [
      'weave', 'bind', 'summon', 'conjure', 'unravel', 'invoke', 'channel', 'shape', 'twist', 'bend', 'focus',
      'awaken', 'reveal', 'banish', 'warp', 'fold', 'seal', 'open', 'break', 'cast', 'unmake', 'echo', 'dissolve',
      'shift', 'seek', 'hex',
    ],
    nouns: [
      'rune', 'sigil', 'star', 'void', 'mana', 'orb', 'aether', 'glyph', 'magic', 'spell', 'sign', 'truth', 'word',
      'secret', 'mystery', 'moon', 'power', 'cosmos', 'light', 'spirit', 'will', 'mind', 'essence', 'nexus', 'veil',
      'idea', 'sage', 'flask', 'skald', 'flux', 'prism',
    ],
    plurals: ['runes', 'sigils', 'stars', 'glyphs', 'spells', 'signs', 'words', 'secrets', 'moons', 'worlds', 'ideas'],
    adjs: [
      'arcane', 'ancient', 'astral', 'hidden', 'violet', 'silver', 'secret', 'endless', 'eldritch', 'mystic', 'deep',
      'true', 'old', 'pure', 'strange', 'starlit', 'unseen',
    ],
    targets: [
      'foe', 'the foe', 'the void', 'the veil', 'the dark', 'fate', 'its mind', 'them', 'the world', 'the night',
      'all things', 'reality',
    ],
  },
  nature: {
    verbs: [
      'heal', 'mend', 'grow', 'bloom', 'restore', 'renew', 'soothe', 'nourish', 'sprout', 'root', 'cleanse',
      'revive', 'flourish', 'breathe', 'ease', 'gather', 'shelter', 'rise', 'blossom', 'rest',
    ],
    nouns: [
      'leaf', 'root', 'bloom', 'seed', 'life', 'sap', 'moss', 'fern', 'oak', 'vine', 'petal', 'rain', 'spring',
      'earth', 'grove', 'herb', 'sage', 'dew', 'willow', 'lotus', 'blossom', 'meadow', 'sunlight', 'river', 'field',
      'dahlia', 'fig', 'alfalfa', 'heather', 'aloe',
    ],
    plurals: ['leaves', 'roots', 'seeds', 'blooms', 'vines', 'petals', 'herbs', 'flowers', 'trees', 'ferns', 'lilies', 'figs', 'fields'],
    adjs: [
      'green', 'living', 'gentle', 'fresh', 'verdant', 'wild', 'soft', 'sweet', 'healing', 'deep', 'old', 'golden',
      'young', 'wise', 'mild', 'lush', 'sacred',
    ],
    targets: ['me', 'us', 'my wounds', 'my body', 'my heart', 'my soul', 'this flesh', 'flesh', 'the wound', 'all life', 'life', 'this life'],
  },
  ward: {
    verbs: [
      'guard', 'shield', 'ward', 'hold', 'protect', 'defend', 'shelter', 'brace', 'block', 'keep', 'stand', 'endure',
      'harden', 'seal', 'bar', 'cover', 'hide', 'resist', 'deflect', 'repel', 'abide',
    ],
    nouns: [
      'shield', 'wall', 'ward', 'aegis', 'bulwark', 'bastion', 'barrier', 'guard', 'fortress', 'gate', 'stone',
      'iron', 'oath', 'armor', 'dome', 'rampart', 'keep', 'steel', 'mountain', 'shell', 'hedge', 'onyx', 'bronze',
    ],
    plurals: ['walls', 'shields', 'wards', 'stones', 'gates', 'oaths', 'towers', 'shells'],
    adjs: [
      'iron', 'stone', 'steady', 'still', 'golden', 'sacred', 'unbroken', 'mighty', 'solid', 'silver', 'holy',
      'strong', 'true', 'firm', 'faithful', 'endless', 'safe', 'bronze',
    ],
    targets: ['me', 'us', 'my heart', 'my life', 'the line', 'the gate', 'all', 'my soul', 'my allies', 'this place', 'self'],
  },
};

/** Neutral "magic words" used when a school has no unlocked word for a slot. */
export const GENERIC_LEXICON = {
  verbs: ['rise', 'awaken', 'answer', 'heed', 'hear', 'obey', 'come', 'begin', 'gather', 'strike', 'call', 'break'],
  nouns: ['power', 'will', 'word', 'light', 'soul', 'spirit', 'blood', 'bone', 'sky', 'heart', 'magic', 'spell', 'force', 'might'],
  plurals: ['powers', 'words', 'spirits', 'bones', 'skies', 'hearts', 'spells'],
  adjs: ['old', 'deep', 'true', 'great', 'ancient', 'dark', 'bright', 'wild', 'high', 'sacred'],
  targets: ['foe', 'the foe', 'them', 'it', 'all', 'the dark'],
};

export const PLACES = [
  'Qwerth', 'Ashgrove', 'Dawnhold', 'Morrow', 'Sable', 'Vex', 'Elandra', 'Halden', 'Thorne', 'Orin', 'Lyra', 'Kael',
];

// Punctuation tokens (, ; : ! .) are dropped or substituted while the key is still locked.
// Literal words (of, and, let, by, ...) make a template unusable until their letters are unlocked.
export const INCANTATION_TEMPLATES = {
  1: [
    '{verb}',
    '{noun}',
    '{adj} {noun}',
    '{verb} {target}',
    '{noun} , {verb} !',
    '{verb} {pl}',
    '{adj} {pl}',
  ],
  2: [
    '{adj} {noun} , {verb} !',
    '{verb} {target}',
    '{verb} and {verb}',
    '{noun} of {noun}',
    '{pl} , {verb} !',
    '{verb} , {adj} {noun}',
    '{verb} {verb} {verb}',
    '{adj} {pl} , {verb} {target}',
    'let {pl} {verb}',
    '{noun} , {verb} {target} !',
  ],
  3: [
    '{noun} of {noun} , {verb} {target} !',
    '{verb} , {adj} {noun} ; {verb} {target}',
    'let the {adj} {pl} {verb} {target}',
    '{adj} {noun} and {adj} {noun} , {verb} !',
    'by {noun} and {noun} , {verb} {target}',
    '{noun} {noun} {noun} , {verb} {target}',
    '{adj} {noun} , {adj} {noun} , {verb} {target}',
    '{verb} {target} with {adj} {pl}',
    '{noun} , {verb} ; {noun} , {verb} !',
    'hear me , {noun} of {place} !',
  ],
  4: [
    '{noun} of the {adj} {noun} , {verb} and {verb} {target} !',
    'by {noun} , by {noun} , by {adj} {noun} : {verb} {target} !',
    'let {pl} {verb} , let {pl} {verb} ; {verb} {target} now',
    '{verb} , {verb} , {verb} ! {adj} {noun} , {verb} {target} !',
    '{adj} {noun} , {adj} {noun} , {adj} {noun} ; {verb} {target}',
    'from the {adj} {noun} I call {pl} to {verb} {target}',
    'hear me , {adj} {noun} of {place} ; {verb} {target} !',
    '{noun} and {noun} and {noun} , {verb} {target} with {adj} {pl}',
  ],
};

/** Numeral Forge incantations (tier 1 uses the normal templates). */
export const NUMBER_INCANTATIONS = {
  2: [
    '{verb} {dd} {pl}',
    '{ddd} {adj} {pl}',
    '{dd} {pl} , {verb} !',
    '{verb} {d} {pl} now',
    'rune {ddd} , {verb} !',
    '{verb} {target} {d} times',
  ],
  3: [
    '{verb} {dd} {pl} at {time} !',
    '{ddd} {pl} and {d} {pl} , {verb} {target}',
    'by rune {dd} , {verb} {target} !',
    'let {ddd} {adj} {pl} {verb} {target}',
    '{verb} {target} {d} times , then {verb} !',
  ],
  4: [
    '{verb} {dd} {pl} , {verb} {ddd} {pl} , then {verb} {target} at {time} !',
    'in the year {year} , {ddd} {adj} {pl} {verb} {target}',
    'count {d} , {d} , {d} : let {dd} {pl} {verb} {target} !',
    'at {time} , {dd} {pl} of the {adj} {noun} {verb} {target} !',
    'by the {ddd} {pl} of {place} , {verb} {target} !',
  ],
};

/** Glyph Abyss incantations: lines of code that do what the spell does. */
export const SCHOOL_CODE_LINES = {
  fire: [
    'burn(foe);',
    'fire.cast(foe);',
    'heat += 9;',
    'ignite(foe, 3)',
    'if (foe.hp) burn(foe);',
    'embers.push(new Spark());',
    'const flame = forge.heat(99);',
    'foe.hp -= fire.power * 2;',
    'for (const e of embers) e.ignite(foe);',
    'flames.forEach(f => f.spread({ to: foe }));',
    'while (foe.hp > 0) { burn(foe); heat++; }',
    'def inferno(foe): return [burn(foe) for _ in range(3)]',
  ],
  frost: [
    'freeze(foe);',
    'foe.speed /= 2;',
    'ice = [foe];',
    'chill(foe, -40)',
    'if (foe.warm) chill(foe);',
    'const shard = ice.split(3);',
    'foe.frozen = true;',
    'shards.map(s => s.pierce(foe));',
    'while (temp > -273) temp -= 10;',
    'for (const s of shards) { s.hurl(foe); }',
    'frost.spread({ radius: 9, slow: 0.5 });',
    'def blizzard(foes): return [freeze(f) for f in foes]',
  ],
  storm: [
    'strike(foe);',
    'bolt.fire();',
    'volts *= 10;',
    'storm.charge++;',
    'if (sky.dark) strike(foe);',
    'sky.on("thunder", strike);',
    'const bolt = new Bolt(9000);',
    'foe.hp -= volts / 100;',
    'clouds.filter(c => c.charged).map(zap);',
    'for (let i = 0; i < 3; i++) chain(foes[i]);',
    'while (storm.alive) { flash(); boom(); }',
    'storm.on("peak", () => strike(foe, { crit: true }));',
  ],
  arcane: [
    'cast(rune);',
    'mana -= 10;',
    'orb.glow();',
    'rune.cast(foe);',
    'sigils.push("void");',
    'const orb = new Orb(42);',
    'if (mana > cost) cast(spell);',
    'foe.hp -= spell.power * mana;',
    'const spell = runes.join("") + "!";',
    'runes.reduce((a, r) => a + r.power, 0);',
    'export const nova = (mana) => mana * Math.PI;',
    'for (const s of sigils) s.bind(foe, { forever: true });',
  ],
  nature: [
    'heal(self);',
    'self.hp += 25;',
    'roots.grow(3);',
    'seed.plant();',
    'if (hurt) heal(self, 30);',
    'const bloom = new Flower(7);',
    'leaves.forEach(l => l.mend());',
    'self.hp = min(self.hp + 40, 99)',
    'while (self.hp < max) self.hp++;',
    'garden.plant([seed, seed, seed]);',
    'for (const w of wounds) { w.close(); }',
    'def regrow(tree): return tree.grow(rings=3) or tree',
  ],
  ward: [
    'block(hit);',
    'shield.up();',
    'armor += 5;',
    'ward = { hp: 50 };',
    'if (hit) block(hit);',
    'shield.raise({ dome: 1 });',
    'const wall = new Ward(80);',
    'self.armor = max(armor, 99);',
    'walls.forEach(w => w.hold());',
    'while (danger) { shield.hp += 10; }',
    'try { attack(); } catch { block(); }',
    'if (foe.attacks) { self.shield = wall.raise(60); }',
  ],
};
