// Lab scenes (PLAN §15.9): isolated spell sounds for measurement + full casts timed like ui/fx/spellFx.js.
export const SCHOOLS = ['fire', 'frost', 'storm', 'arcane', 'nature', 'ward'];
export const M = { fire: 140, frost: 160, storm: 60, arcane: 180, nature: 100 };
export const M_RITE = { fire: 140, frost: 160, storm: 280, arcane: 300, nature: 100 };
export const HITSTOP = { 1: 0, 2: 45, 3: 70, 4: 110 };
const KEY = 0.15; // 80 WPM
const STREAK = 0.09;

/** A full cast like the game plays it: n letters at `key` s, seal, stamp + manifest, land. */
export function castEvents(s, tier, { t = 0.05, n = 12, key = KEY, combo = 0, perfect = false, crit = false, lethal = false, intensity, misAt = -1 } = {}) {
  const ev = [];
  for (let i = 0; i < n - 1; i++) {
    if (i === misAt) ev.push([t + i * key, 'spellMisnote', s, tier, i, n]);
    else ev.push([t + i * key, 'spellNote', s, tier, i, n, combo]);
  }
  const tEnd = t + (n - 1) * key;
  const hits = s !== 'ward';
  ev.push([tEnd, 'seal', s, tier, { perfect, hits }]);
  if (!hits) return { ev, end: tEnd + 1.0 };
  const m = (tier >= 4 ? M_RITE : M)[s] / 1000;
  const stamp = tEnd + STREAK;
  ev.push([stamp, 'manifest', s, tier, m * 1000]);
  if (s === 'storm' && tier >= 4) for (let i = 0; i < 4; i++) ev.push([stamp + i * 0.07, 'bolt', { intensity: 0.6, pan: 0.2 + 0.1 * i }]);
  if (s === 'storm' && tier === 3) [0.1, 0.14].forEach((d, i) => ev.push([stamp + d, 'bolt', { intensity: 0.4, pan: i ? 0.55 : 0.15 }]));
  const I = intensity ?? { 1: 0.6, 2: 1, 3: 1.4, 4: 2 }[tier];
  const hs = HITSTOP[tier] + (crit ? 40 : 0) + (lethal ? 90 : 0);
  ev.push([stamp + m, 'impact', s, tier, { intensity: I, crit, lethal, hitstopMs: hs }]);
  return { ev, end: stamp + m + (tier >= 4 ? 2.4 : 1.6) };
}

export const SCENES = [];
for (const s of SCHOOLS) {
  const keys = Array.from({ length: 11 }, (_, i) => 0.05 + i * KEY);
  SCENES.push({ name: `keys ${s}`, group: 'keys', secs: 2.2, keys, events: keys.map((t, i) => [t, 'spellNote', s, 2, i, 12, 0]) });
  SCENES.push({ name: `seal ${s} t2`, group: 'seal', secs: 1.6, events: [[0.02, 'seal', s, 2, { hits: s !== 'ward' }]] });
  SCENES.push({ name: `misnote ${s}`, group: 'misnote', secs: 0.8, events: [[0.02, 'spellMisnote', s, 2, 5, 12]] });
  SCENES.push({ name: `fizzle ${s}`, group: 'fizzle', secs: 1.2, events: [[0.02, 'spellFizzle', s]] });
  if (s !== 'ward') {
    SCENES.push({ name: `impact ${s} t2`, group: 'impact', secs: 2.2, events: [[0.02, 'impact', s, 2, { intensity: 1, hitstopMs: 45 }]] });
    SCENES.push({ name: `impact ${s} t1`, group: 'impact1', secs: 2.0, events: [[0.02, 'impact', s, 1, { intensity: 0.6 }]] });
    const m = M_RITE[s] / 1000;
    SCENES.push({ name: `rite ${s}`, group: 'rite', secs: 3.2, events: [[0.02, 'manifest', s, 4, m * 1000], [0.02 + m, 'impact', s, 4, { intensity: 2.6, crit: true, lethal: true, hitstopMs: 220 }]] });
  }
  const c = castEvents(s, 2);
  SCENES.push({ name: `cast ${s} t2`, group: 'cast', secs: c.end, events: c.ev, spectro: true, px: 1100 });
}
SCENES.push({ name: 'bolt', secs: 1.0, events: [[0.02, 'bolt', { intensity: 0.6 }]] });
SCENES.push({ name: 'shatter', secs: 1.2, events: [[0.02, 'shatter']] });
SCENES.push({ name: 'OLD hit(big)', secs: 1.0, events: [[0.02, 'hit', true]] });
