// Templates for the Numeral Forge. Placeholders: {d} 1-9, {dd} 10-99, {ddd} 100-999,
// {year} 1000-2099, {time} h:mm, {noun} plural noun, {verb} verb.
export const NUMBER_TEMPLATES = {
  2: [
    '{verb} {dd} {noun}',
    '{verb} {d} {noun}',
    '{d} {noun} at {time}',
    'gate {ddd} opens',
    'room {dd} of {dd}',
    '{ddd} gold coins',
    'the year {year}',
    'level {dd} mage',
    '{dd} or {dd} {noun}',
    'wave {d} of {d}',
  ],
  3: [
    'Summon {dd} {noun} at {time}.',
    'Pay {ddd} coins for {d} {noun}.',
    'In {year}, {ddd} knights rode west.',
    'Gate {d} opens at {time} sharp.',
    'Chant {d} times, then strike {dd} {noun}.',
    'The forge burns at {ddd} degrees.',
    'Only {d} of {dd} {noun} returned.',
    'Floor {dd}, room {ddd}, door {d}.',
    'We need {dd} {noun} by {time}.',
    'The golem weighs {ddd} stone.',
  ],
  4: [
    'On day {dd} of {year}, {ddd} {noun} marched {dd} leagues north.',
    'At {time}, ring {d} bells, light {dd} candles and {verb} {d} {noun}.',
    'The vault holds {ddd} gems, {dd} crowns and exactly {d} {noun}.',
    'From {year} to {year}, the forge made {ddd} blades and {dd} shields.',
    'Recipe {dd}: {d} feathers, {dd} embers, {ddd} drops of moonwater.',
    'Room {ddd} has {d} doors; take door {d} at {time} or lose {dd} gold.',
    'Wave {d}: {dd} {noun}. Wave {d}: {ddd} {noun}. Hold until {time}.',
  ],
};

export const NUMBER_NOUNS = [
  'wolves', 'ravens', 'stars', 'blades', 'runes', 'embers', 'shards', 'knights', 'spirits',
  'moons', 'bells', 'gates', 'towers', 'coins', 'scrolls', 'golems', 'gears', 'candles',
  'arrows', 'crowns', 'dragons', 'potions',
];

export const NUMBER_VERBS = [
  'summon', 'banish', 'gather', 'strike', 'burn', 'freeze', 'raise', 'seal', 'bind', 'call',
  'forge', 'count',
];
