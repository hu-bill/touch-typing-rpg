import { BOONS, BOON_BY_ID } from '../data/boons.js';

/** Offer up to `count` distinct boons the hunt can still rank up. Owned boons are a little more likely. */
export function rollBoonOffer(rng, owned = {}, count = 3) {
  let pool = BOONS.filter((b) => (owned[b.id] || 0) < b.max);
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const b = rng.weighted(pool, (x) => x.weight * (owned[x.id] ? 1.5 : 1));
    if (!b) break;
    pool = pool.filter((x) => x !== b);
    out.push({ id: b.id, rank: (owned[b.id] || 0) + 1 });
  }
  return out;
}

export function boonText(id, rank) {
  return BOON_BY_ID[id].text(rank);
}

export function takeBoon(hunt, id) {
  const def = BOON_BY_ID[id];
  if (!def) return;
  hunt.boons[id] = Math.min(def.max, (hunt.boons[id] || 0) + 1);
}

export function boonCount(hunt) {
  return Object.values((hunt && hunt.boons) || {}).reduce((a, b) => a + b, 0);
}

/** Fight stats with the hunt's boons and temporary mods applied. Never mutates `stats`. */
export function applyHuntMods(stats, hunt) {
  const out = { ...stats, schoolPct: { ...stats.schoolPct }, uniques: new Set(stats.uniques), boons: {} };
  const add = (key, v) => {
    if (key.startsWith('schoolPct.')) {
      const sc = key.slice('schoolPct.'.length);
      out.schoolPct[sc] = (out.schoolPct[sc] || 0) + v;
    } else {
      out[key] = (out[key] || 0) + v;
    }
  };
  for (const [id, rank] of Object.entries((hunt && hunt.boons) || {})) {
    const def = BOON_BY_ID[id];
    if (!def || !rank) continue;
    out.boons[id] = rank;
    for (const [key, v] of Object.entries(def.stats)) add(key, v * rank);
  }
  for (const mod of (hunt && hunt.mods) || []) {
    for (const [key, v] of Object.entries(mod.stats || {})) add(key, v);
  }
  if (out.maxHpPct) out.maxHp = Math.round(stats.maxHp * (1 + out.maxHpPct / 100));
  out.critChance = Math.min(0.75, out.critChance);
  return out;
}
