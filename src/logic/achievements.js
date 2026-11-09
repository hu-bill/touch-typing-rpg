import { ACHIEVEMENTS } from '../data/achievements.js';

/** Returns newly unlocked achievements and records them in the save. */
export function checkAchievements(save, ctx = {}) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    let ok = false;
    try {
      ok = a.check(save, ctx);
    } catch {
      ok = false;
    }
    if (ok) {
      save.achievements[a.id] = Date.now();
      unlocked.push(a);
    }
  }
  return unlocked;
}
