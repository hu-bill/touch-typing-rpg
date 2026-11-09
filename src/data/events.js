// Hunt events: sometimes the next step of a hunt is a short typing challenge or a choice instead of a fight.
export const HUNT_EVENTS = [
  { id: 'wayshrine', icon: '⛩️', name: 'Wayshrine', weight: 10, kind: 'type', intro: 'A mossy shrine hums with old magic. Recite its prayer without faltering and it may bless you.' },
  { id: 'mimic', icon: '🧰', name: 'Restless Chest', weight: 8, kind: 'type', intro: 'The chest has teeth. Type the binding phrase before it bites — the timer starts with your first key.' },
  { id: 'spring', icon: '💧', name: 'Moonlit Spring', weight: 7, kind: 'type', intro: 'Still water, silver light. Speak the calming words and be restored.' },
  { id: 'runedoor', icon: '🚪', name: 'Rune-Sealed Door', weight: 6, kind: 'type', intro: 'One mistake and the runes seal forever. Behind it: treasure.' },
  { id: 'altar', icon: '🗿', name: 'Cursed Altar', weight: 7, kind: 'choice', intro: 'Blood-red runes promise riches — for a price.' },
  { id: 'trader', icon: '🧝', name: 'Wandering Trader', weight: 6, kind: 'choice', minSatchel: 40, intro: 'A hooded figure opens a coat full of glowing charms. "Gold for power, friend?"' },
];
/** Glyphdeep-only events (PLAN §13.6). */
export const ROGUE_EVENTS = [
  { id: 'wisp', icon: '🧚', name: 'Racing Wisp', weight: 9, kind: 'type', intro: 'A wisp of light challenges you to a race. It runs a little faster than your own average pace — the race starts with your first key.' },
  { id: 'bridge', icon: '🌉', name: 'Glass Bridge', weight: 8, kind: 'type', intro: 'Every mistake cracks a pane. Three cracks and you fall.' },
  { id: 'pact', icon: '🩸', name: 'Dark Pact', weight: 6, kind: 'choice', intro: 'A voice in the dark offers great power. It asks only for a small, lasting flaw.' },
];
/** The campfire drill (opened from the room screen with params { ch }). */
export const TEMPER_EVENT = { id: 'temper', icon: '🔨', name: 'Rune Tempering', kind: 'type', intro: 'Strike the rune again and again. Keep your accuracy and the rune grows stronger for this descent.' };
export const EVENT_BY_ID = Object.fromEntries([...HUNT_EVENTS, ...ROGUE_EVENTS, TEMPER_EVENT].map((e) => [e.id, e]));
export const EVENT_TEXT = {
  wayshrine: { tier: 3, school: 'arcane' },
  mimic: { tier: 2, school: 'ward' },
  spring: { tier: 2, school: 'nature' },
  runedoor: { tier: 2, school: 'arcane' },
  wisp: { tier: 3, school: 'storm' },
  bridge: { tier: 4, school: 'frost' },
};
