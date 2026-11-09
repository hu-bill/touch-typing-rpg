import { BAL } from '../data/balance.js';
import { ZONES } from '../data/zones.js';
import { CHESTS } from '../data/items.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { zoneState } from '../core/save.js';
import { formatNumber } from '../core/util.js';
import { allowedChars } from './keyboard.js';
import { masteryProgress, MASTERY_NAMES } from './mastery.js';
import { bossAvailable, xpToNext } from './progression.js';
import { chestCost } from './loot.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The 2–3 things the player is closest to completing: [{ id, icon, text, progress }]. */
export function nearestGoals(save, { layoutId, zoneIndex, max = 3 }) {
  const cands = [];
  const push = (g, score = g.progress) => cands.push({ ...g, progress: clamp01(g.progress), score });

  // 1. boss of this zone
  const zone = ZONES[zoneIndex];
  if (zone) {
    const zs = zoneState(save, zone.id);
    if (!zs.bossDefeated) {
      if (bossAvailable(save, zoneIndex)) {
        push({ id: 'boss', icon: zone.boss.icon, text: `${zone.boss.name} has awakened — press B on the map`, progress: 1 }, 2);
      } else {
        const n = BAL.killsForBoss - zs.kills;
        push({ id: 'boss', icon: '👑', text: `Boss awakens in ${n} more ${n === 1 ? 'kill' : 'kills'}`, progress: zs.kills / BAL.killsForBoss });
      }
    }
  }

  // 2. next level
  const p = save.player;
  if (p.level < BAL.maxLevel) {
    const need = xpToNext(p.level);
    push({ id: 'level', icon: '⭐', text: `Level ${p.level + 1} in ${formatNumber(need - p.xp)} XP`, progress: p.xp / need });
  }

  // 3. closest rune level-up
  let best = null;
  for (const ch of allowedChars(layoutId, save.unlockedZone)) {
    if (ch === ' ') continue;
    const st = save.keyStats[ch];
    if (!st || st.n < 5) continue;
    const mp = masteryProgress(st);
    if (!mp || mp.progress >= 1) continue;
    if (!best || mp.progress > best.mp.progress) best = { ch, mp };
  }
  if (best) {
    const { ch, mp } = best;
    const needText = mp.need.kind === 'presses'
      ? `${mp.need.value} more ${mp.need.value === 1 ? 'press' : 'presses'}`
      : mp.need.kind === 'accuracy'
        ? `raise accuracy to ${mp.need.value}%`
        : `type it in under ${mp.need.value} ms`;
    push({ id: 'rune', icon: '✦', text: `Rune ${ch} → ${MASTERY_NAMES[mp.next]}: ${needText}`, progress: mp.progress });
  }

  // 4. closest achievement
  let bestA = null;
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id] || !a.progress) continue;
    let cur;
    let target;
    try {
      [cur, target] = a.progress(save);
    } catch {
      continue;
    }
    if (!target) continue;
    const ratio = Math.min(0.999, cur / target);
    if (ratio < 0.4) continue;
    if (!bestA || ratio > bestA.ratio) bestA = { a, cur, target, ratio };
  }
  if (bestA) push({ id: 'achievement', icon: bestA.a.icon, text: `${bestA.a.name}: ${bestA.cur} / ${bestA.target}`, progress: bestA.ratio });

  // 5. legendary pity
  const since = save.stats.itemsSinceLegendary || 0;
  if (since >= 75) {
    push({ id: 'pity', icon: '🌟', text: `Legendary guaranteed within ${BAL.pityLegendary - since} items`, progress: since / BAL.pityLegendary });
  }

  // 6. affordable-soon chest (banked gold only)
  const gold = p.gold;
  for (const c of CHESTS) {
    const cost = chestCost(c, save.unlockedZone);
    if (cost > gold && gold >= 0.5 * cost) {
      push({ id: 'chest', icon: c.icon, text: `${c.name} in ${cost - gold} gold`, progress: gold / cost });
      break;
    }
  }

  return cands
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.score - a.g.score || a.i - b.i)
    .slice(0, max)
    .map(({ g }) => ({ id: g.id, icon: g.icon, text: g.text, progress: g.progress }));
}
