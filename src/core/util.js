export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round1 = (v) => Math.round(v * 10) / 10;

export function median(arr) {
  if (!arr || arr.length === 0) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

let uidCounter = 0;
export function uid(prefix = 'id') {
  uidCounter += 1;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function formatNumber(n) {
  if (n === Infinity) return '∞';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Recursively merge `loaded` over `defaults`. Arrays and primitives from loaded win. */
export function deepMerge(defaults, loaded) {
  if (!isPlainObject(defaults) || !isPlainObject(loaded)) {
    return loaded === undefined ? defaults : loaded;
  }
  const out = { ...defaults };
  for (const key of Object.keys(loaded)) {
    const d = defaults[key];
    const l = loaded[key];
    if (isPlainObject(d) && isPlainObject(l)) out[key] = deepMerge(d, l);
    else if (l !== undefined) out[key] = l;
  }
  return out;
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
