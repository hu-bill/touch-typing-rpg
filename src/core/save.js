import { deepMerge } from './util.js';

export const SAVE_KEY = 'spellstroke.save.v1';

export function createNewSave() {
  return {
    version: 1,
    createdAt: Date.now(),
    player: { level: 1, xp: 0, gold: 0, points: 0, attune: { might: 0, focus: 0, vigor: 0, fortune: 0 } },
    equipment: { staff: null, robe: null, amulet: null, ring: null, tome: null },
    inventory: [],
    unlockedZone: 0,
    zones: {},
    keyStats: {},
    recentWpm: [],
    history: [],
    achievements: {},
    stats: {
      totalKills: 0, totalCasts: 0, perfectCasts: 0, perfectHighTier: 0, fizzles: 0, bestWpm: 0,
      bestCombo: 0, bestChain: 0, ritesCast: 0, legendariesFound: 0, glimmerkins: 0,
      itemsSinceLegendary: 0, charsTyped: 0, bossesDefeated: 0, deaths: 0, playSeconds: 0,
      milestonesReached: 0, boonsTaken: 0, bestBoonCount: 0, eventsCompleted: 0,
      bestDepth: 0, bestRelics: 0, runesTempered: 0, guardiansSlain: 0, goldenRunes: 0,
    },
    // The Glyphdeep (PLAN §13). best: { [circle]: depth }, runs: newest first, run: the descent in progress
    rogue: { ink: 0, upgrades: {}, best: {}, runs: [], totalRuns: 0, lastCircle: null, run: null },
    settings: { layout: 'qwerty', guide: 'hints', difficulty: 'adept', difficultyChosen: false, volume: 0.6, shake: true },
  };
}

export function zoneState(save, zoneId) {
  if (!save.zones[zoneId]) save.zones[zoneId] = { kills: 0, bossDefeated: false, lessonSeen: false };
  return save.zones[zoneId];
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return deepMerge(createNewSave(), parsed);
  } catch {
    return null;
  }
}

export function writeSave(save, storage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage) {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
