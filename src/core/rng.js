// Seeded pseudo random number generator (mulberry32) with game helpers.
// All randomness in src/logic must go through one of these objects.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed = (Date.now() ^ (Math.floor(Math.random() * 1e9))) >>> 0) {
  const next = mulberry32(seed);
  const rng = {
    seed,
    next,
    /** float in [min, max) */
    float(min = 0, max = 1) {
      return min + next() * (max - min);
    },
    /** integer in [min, max] inclusive */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(next() * arr.length)];
    },
    /** pick an item using weightFn(item) >= 0; returns undefined if all weights are 0 */
    weighted(items, weightFn) {
      let total = 0;
      const weights = items.map((it) => {
        const w = Math.max(0, weightFn(it) || 0);
        total += w;
        return w;
      });
      if (total <= 0) return undefined;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r < 0) return items[i];
      }
      // floating point safety: return last positive weight
      for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i];
      return undefined;
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return rng;
}
