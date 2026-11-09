const bossesBeaten = (s) => Object.values(s.zones).filter((z) => z.bossDefeated).length;

export const ACHIEVEMENTS = [
  { id: 'firstBlood', icon: '🗡️', name: 'First Blood', desc: 'Defeat your first foe.', check: (s) => s.stats.totalKills >= 1 },
  { id: 'flawless', icon: '💎', name: 'Flawless', desc: 'Complete an Incantation or Rite with no mistakes.', check: (s) => s.stats.perfectHighTier >= 1 },
  { id: 'combo50', icon: '🔗', name: 'In the Flow', desc: 'Reach a 50 combo.', check: (s) => s.stats.bestCombo >= 50, progress: (s) => [s.stats.bestCombo, 50] },
  { id: 'combo150', icon: '⛓️', name: 'Unbroken', desc: 'Reach a 150 combo.', check: (s) => s.stats.bestCombo >= 150, progress: (s) => [s.stats.bestCombo, 150] },
  { id: 'wpm60', icon: '💨', name: 'Swift Tongue', desc: 'Cast a spell at 60+ WPM.', check: (s) => s.stats.bestWpm >= 60, progress: (s) => [s.stats.bestWpm, 60] },
  { id: 'wpm100', icon: '⚡', name: 'Lightning Fingers', desc: 'Cast a spell at 100+ WPM.', check: (s) => s.stats.bestWpm >= 100, progress: (s) => [s.stats.bestWpm, 100] },
  { id: 'legendary', icon: '🌟', name: 'Legend Touched', desc: 'Find a legendary item.', check: (s) => s.stats.legendariesFound >= 1 },
  { id: 'chain10', icon: '🔥', name: 'Relentless', desc: 'Win 10 fights in a single hunt.', check: (s) => s.stats.bestChain >= 10, progress: (s) => [s.stats.bestChain, 10] },
  { id: 'rite', icon: '📜', name: 'Forbidden Knowledge', desc: 'Complete a Forbidden Rite.', check: (s) => s.stats.ritesCast >= 1 },
  { id: 'glimmer', icon: '💰', name: 'Finders Keepers', desc: 'Catch a Glimmerkin before it flees.', check: (s) => s.stats.glimmerkins >= 1 },
  { id: 'boss5', icon: '👑', name: 'Halfway Hero', desc: 'Defeat 5 different bosses.', check: (s) => bossesBeaten(s) >= 5, progress: (s) => [bossesBeaten(s), 5] },
  { id: 'realmBreaker', icon: '🌀', name: 'Realm Breaker', desc: 'Defeat Null, the Unterminated.', check: (s) => !!(s.zones.abyss && s.zones.abyss.bossDefeated) },
  { id: 'grandRune', icon: '🌟', name: 'Grandmaster Rune', desc: 'Raise any rune to Grandmaster.', check: (s) => Object.values(s.keyStats).some((st) => st.peak === 3) },
  { id: 'architect', icon: '✦', name: 'Architect', desc: 'Hold 6 boon ranks in a single hunt.', check: (s) => s.stats.bestBoonCount >= 6, progress: (s) => [s.stats.bestBoonCount, 6] },
  { id: 'wanderer', icon: '🧭', name: 'Wanderer', desc: 'Complete 10 hunt events.', check: (s) => s.stats.eventsCompleted >= 10, progress: (s) => [s.stats.eventsCompleted, 10] },
  { id: 'deep10', icon: '🕳️', name: 'Into the Deep', desc: 'Reach depth 10 in the Glyphdeep.', check: (s) => s.stats.bestDepth >= 10, progress: (s) => [s.stats.bestDepth, 10] },
  { id: 'deep25', icon: '🌌', name: 'Abyssal Diver', desc: 'Reach depth 25 in the Glyphdeep.', check: (s) => s.stats.bestDepth >= 25, progress: (s) => [s.stats.bestDepth, 25] },
  { id: 'curator', icon: '🏺', name: 'Curator', desc: 'Hold 6 relics in one descent.', check: (s) => s.stats.bestRelics >= 6, progress: (s) => [s.stats.bestRelics, 6] },
  { id: 'runesmith', icon: '🔨', name: 'Runesmith', desc: 'Temper 5 runes at Glyphdeep campfires.', check: (s) => s.stats.runesTempered >= 5, progress: (s) => [s.stats.runesTempered, 5] },
];
