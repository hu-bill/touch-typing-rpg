import { median } from '../core/util.js';

export const WINDOW = 40;
export const MASTERY_NAMES = ['Novice', 'Adept', 'Master', 'Grandmaster'];
const THRESHOLDS = [
  null,
  { n: 20, acc: 0.9, ms: 450 },
  { n: 50, acc: 0.95, ms: 330 },
  { n: 100, acc: 0.98, ms: 240 },
];
const BONUS = [0, 0.1, 0.2, 0.3];

/** Record one attempt at character `ch`. ms = latency since previous key or null. */
export function recordKey(keyStats, ch, ok, ms) {
  let s = keyStats[ch];
  if (!s) {
    s = { n: 0, miss: 0, recent: [], ms: [] };
    keyStats[ch] = s;
  }
  s.n += 1;
  if (!ok) s.miss += 1;
  s.recent.push(ok ? 1 : 0);
  if (s.recent.length > WINDOW) s.recent.splice(0, s.recent.length - WINDOW);
  if (ok && typeof ms === 'number' && ms > 0 && ms <= 2000) {
    s.ms.push(Math.round(ms));
    if (s.ms.length > WINDOW) s.ms.splice(0, s.ms.length - WINDOW);
  }
  return s;
}

/**
 * recordKey + personal-best tracking. Returns the new mastery level the first time a key reaches it, else 0.
 * Old saves have no `peak`: initialise it to the current level BEFORE recording, so existing mastery is not
 * re-announced on the first keystroke after the update.
 */
export function recordKeyTracked(keyStats, ch, ok, ms) {
  const prev = keyStats[ch];
  if (prev && prev.peak == null) prev.peak = keyMastery(prev);
  const s = recordKey(keyStats, ch, ok, ms);
  if (s.peak == null) s.peak = 0;
  if (!ok) return 0;
  const lvl = keyMastery(s);
  if (lvl > s.peak) {
    s.peak = lvl;
    return lvl;
  }
  return 0;
}

export function keySummary(stat) {
  if (!stat || stat.n === 0) return { n: 0, acc: 1, medianMs: null };
  const acc = stat.recent.length ? stat.recent.reduce((a, b) => a + b, 0) / stat.recent.length : 1;
  return { n: stat.n, acc, medianMs: median(stat.ms) };
}

export function keyMastery(stat) {
  if (!stat) return 0;
  const { n, acc, medianMs } = keySummary(stat);
  let level = 0;
  for (let i = 1; i < THRESHOLDS.length; i++) {
    const t = THRESHOLDS[i];
    if (n >= t.n && acc >= t.acc && medianMs !== null && medianMs <= t.ms) level = i;
    else break;
  }
  return level;
}

/** Progress toward the next mastery level, or null at Grandmaster. */
export function masteryProgress(stat) {
  const level = keyMastery(stat);
  if (level >= THRESHOLDS.length - 1) return null;
  const next = level + 1;
  const t = THRESHOLDS[next];
  const { n, acc, medianMs } = keySummary(stat);
  const pN = Math.min(1, n / t.n);
  const pAcc = acc >= t.acc ? 1 : Math.max(0, 1 - (t.acc - acc) / 0.2);
  const pMs = medianMs == null ? 0 : medianMs <= t.ms ? 1 : t.ms / medianMs;
  const progress = Math.min(pN, pAcc, pMs);
  let need;
  if (n < t.n) need = { kind: 'presses', value: t.n - n };
  else if (acc < t.acc) need = { kind: 'accuracy', value: Math.round(t.acc * 100) };
  else need = { kind: 'speed', value: t.ms };
  return { level, next, progress, need };
}

export function masteryBonus(level) {
  return BONUS[level] || 0;
}

/** The `count` weakest characters among allowedSet that have enough samples. */
export function weakChars(keyStats, allowedSet, count = 3) {
  const scored = [];
  for (const ch of allowedSet) {
    if (ch === ' ') continue;
    const st = keyStats[ch];
    if (!st || st.n < 8) continue;
    const { acc, medianMs } = keySummary(st);
    const speed = 300 / Math.max(medianMs ?? 400, 150);
    scored.push({ ch, score: acc * speed });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.ch);
}
