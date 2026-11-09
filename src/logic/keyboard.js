import { LAYOUTS, CODE_FINGER } from '../data/layouts.js';
import { ZONES } from '../data/zones.js';

const ROW_WEIGHT = [1.8, 1.25, 1.0, 1.4, 0.5];
const charMapCache = new Map();
const allowedCache = new Map();

function getLayout(layoutId) {
  return LAYOUTS[layoutId] || LAYOUTS.qwerty;
}

/** Map<char, {code,row,finger,shift,altgr}> — first producer wins (base before shift before altgr). */
export function buildCharMap(layoutId) {
  const id = getLayout(layoutId).id;
  if (charMapCache.has(id)) return charMapCache.get(id);
  const map = new Map();
  const rows = getLayout(id).rows;
  const passes = [
    ['base', { shift: false, altgr: false }],
    ['shift', { shift: true, altgr: false }],
    ['altgr', { shift: false, altgr: true }],
  ];
  for (const [field, mods] of passes) {
    rows.forEach((row, rowIndex) => {
      for (const key of row) {
        if (key.special) continue;
        const ch = key[field];
        if (!ch || (key.dead && key.dead.includes(field))) continue;
        if (map.has(ch)) continue;
        map.set(ch, { code: key.code, row: rowIndex, finger: CODE_FINGER[key.code] || 'rp', ...mods });
      }
    });
  }
  map.set(' ', { code: 'Space', row: 4, finger: 'th', shift: false, altgr: false });
  charMapCache.set(id, map);
  return map;
}

export function charInfo(layoutId, ch) {
  return buildCharMap(layoutId).get(ch) || null;
}

export function codesUnlocked(zoneIndex) {
  const set = new Set(['Space']);
  for (let i = 0; i <= zoneIndex && i < ZONES.length; i++) {
    for (const c of ZONES[i].codes) set.add(c);
  }
  return set;
}

export function modifiersUnlocked(zoneIndex) {
  const mods = { shift: false, altgr: false };
  for (let i = 0; i <= zoneIndex && i < ZONES.length; i++) {
    for (const m of ZONES[i].modifiers) mods[m] = true;
  }
  return mods;
}

/** The set of characters the player may be asked to type in zone `zoneIndex`. */
export function allowedChars(layoutId, zoneIndex) {
  const id = getLayout(layoutId).id;
  const cacheKey = `${id}:${zoneIndex}`;
  if (allowedCache.has(cacheKey)) return allowedCache.get(cacheKey);
  const codes = codesUnlocked(zoneIndex);
  const mods = modifiersUnlocked(zoneIndex);
  const set = new Set([' ']);
  for (const row of getLayout(id).rows) {
    for (const key of row) {
      if (key.special || !codes.has(key.code)) continue;
      const dead = key.dead || [];
      if (key.base && !dead.includes('base')) set.add(key.base);
      if (mods.shift && key.shift && !dead.includes('shift')) set.add(key.shift);
      if (mods.altgr && key.altgr && !dead.includes('altgr')) set.add(key.altgr);
    }
  }
  allowedCache.set(cacheKey, set);
  return set;
}

/** Characters that become available in this zone (the zone's "new runes"). */
export function newCharsForZone(layoutId, zoneIndex) {
  const now = allowedChars(layoutId, zoneIndex);
  const before = zoneIndex > 0 ? allowedChars(layoutId, zoneIndex - 1) : new Set([' ']);
  const out = new Set();
  for (const ch of now) if (!before.has(ch)) out.add(ch);
  return out;
}

/** Difficulty weight of one character — the core of spell power. */
export function charWeight(layoutId, ch) {
  const info = charInfo(layoutId, ch);
  if (!info) return 1;
  let w = ROW_WEIGHT[info.row] ?? 1;
  if (info.code === 'KeyG' || info.code === 'KeyH') w += 0.1;
  if (info.finger === 'lp' || info.finger === 'rp') w += 0.15;
  if (info.shift) w += 0.6;
  if (info.altgr) w += 1.0;
  return w;
}

export function isTextAllowed(text, allowedSet) {
  if (!text) return false;
  for (const ch of text) if (!allowedSet.has(ch)) return false;
  return true;
}

/** Which shift key a touch typist should use for a shifted char (opposite hand). */
export function shiftKeyFor(layoutId, ch) {
  const info = charInfo(layoutId, ch);
  if (!info || !info.shift) return null;
  return info.finger.startsWith('l') ? 'ShiftRight' : 'ShiftLeft';
}

export function isHomeRow(layoutId, ch) {
  const info = charInfo(layoutId, ch);
  return !!info && info.row === 2;
}
