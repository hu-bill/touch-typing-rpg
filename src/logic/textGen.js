import { WORDS } from '../data/words.js';
import { SENTENCES, PROPER_NOUNS } from '../data/sentences.js';
import { CODE_LINES } from '../data/codeLines.js';
import { NUMBER_TEMPLATES, NUMBER_NOUNS, NUMBER_VERBS } from '../data/numberTemplates.js';
import {
  SCHOOL_LEXICON, GENERIC_LEXICON, PLACES, INCANTATION_TEMPLATES, NUMBER_INCANTATIONS, SCHOOL_CODE_LINES,
} from '../data/spellLexicon.js';
import { TIERS } from '../data/spells.js';
import { ZONES } from '../data/zones.js';
import { allowedChars, newCharsForZone, isTextAllowed } from './keyboard.js';
import { capitalize, clamp } from '../core/util.js';

const poolCache = new Map();

/** Words typeable in this zone (memoized). */
export function wordPool(layoutId, zoneIndex) {
  const key = `${layoutId}:${zoneIndex}`;
  if (poolCache.has(key)) return poolCache.get(key);
  const allowed = allowedChars(layoutId, zoneIndex);
  const pool = WORDS.filter((w) => isTextAllowed(w, allowed));
  poolCache.set(key, pool);
  return pool;
}

function hasAny(str, set) {
  if (!set || set.size === 0) return false;
  for (const ch of str) if (set.has(ch)) return true;
  return false;
}

/** Fast weighted picker using cumulative sums + binary search. */
function makePicker(items, weightFn, rng) {
  const cum = new Float64Array(items.length);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += Math.max(0, weightFn(items[i]));
    cum[i] = total;
  }
  return () => {
    if (total <= 0 || items.length === 0) return undefined;
    const r = rng.next() * total;
    let lo = 0;
    let hi = items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    return items[lo];
  };
}

export function wordWeight(word, tier, fresh, weak) {
  let w = 1;
  if (hasAny(word, fresh)) w += 2.5;
  if (hasAny(word, weak)) w += 1.5;
  if (tier === 1) {
    if (word.length <= 5) w *= 2;
    else if (word.length > 6) w *= 0.4;
  }
  if (tier >= 3 && word.length >= 5) w *= 1.6;
  return w;
}

function pickWords(ctx, minLen) {
  const words = [];
  let len = 0;
  while (len < minLen && words.length < 24) {
    let w;
    for (let i = 0; i < 5; i++) {
      w = ctx.pickWord();
      if (!words.includes(w)) break;
    }
    if (!w) break;
    len += (words.length ? 1 : 0) + w.length;
    words.push(w);
  }
  return words;
}

function joinWords(words, ctx, tier = ctx.tier) {
  if (words.length === 0) return '';
  const { allowed, rng } = ctx;
  const gaps = new Array(words.length - 1).fill(' ');
  if (gaps.length > 0) {
    if (allowed.has(';') && tier >= 3 && rng.chance(0.35)) {
      gaps[rng.int(0, gaps.length - 1)] = '; ';
    }
    if (allowed.has(',') && tier >= 2) {
      let commas = 0;
      for (let i = 0; i < gaps.length - 1; i++) {
        if (gaps[i] === ' ' && commas < 2 && rng.chance(0.18)) {
          gaps[i] = ', ';
          commas++;
        }
      }
    }
    if (allowed.has('/') && tier >= 2 && rng.chance(0.08)) {
      const i = rng.int(0, gaps.length - 1);
      if (gaps[i] === ' ') gaps[i] = '/';
    }
  }
  let s = words[0];
  for (let i = 0; i < gaps.length; i++) s += gaps[i] + words[i + 1];
  if (allowed.has('.') && tier >= 3) s += '.';
  return s;
}

function buildWords(ctx) {
  return joinWords(pickWords(ctx, TIERS[ctx.tier].piece.min), ctx);
}

function buildCapWords(ctx) {
  const { rng, allowed } = ctx;
  const words = pickWords(ctx, TIERS[ctx.tier].piece.min);
  if (words.length === 0) return '';
  if (words.length > 1 && rng.chance(0.5)) {
    const nouns = PROPER_NOUNS.filter((n) => isTextAllowed(n, allowed));
    if (nouns.length) words[rng.int(1, words.length - 1)] = rng.pick(nouns);
  }
  words[0] = capitalize(words[0]);
  let s = joinWords(words, ctx, Math.max(ctx.tier, 2));
  if (allowed.has('.') && !s.endsWith('.')) s += '.';
  return s;
}

/** Bounds of a whole incantation (`TIERS[tier]`) or of one phrase (`TIERS[tier].piece`). */
function lengthOk(text, bounds) {
  return text.length >= Math.floor(bounds.min * 0.7) && text.length <= bounds.max;
}

function pickFromList(ctx, list) {
  const filtered = list.filter((s) => lengthOk(s, TIERS[ctx.tier].piece) && isTextAllowed(s, ctx.allowed));
  if (filtered.length === 0) return null;
  const pick = makePicker(
    filtered,
    (s) => 1 + (hasAny(s, ctx.fresh) ? 2 : 0) + (hasAny(s, ctx.weak) ? 1.5 : 0),
    ctx.rng,
  );
  return pick();
}

function buildSentence(ctx) {
  return pickFromList(ctx, SENTENCES) || buildCapWords(ctx);
}

function numberSlot(key, rng) {
  switch (key) {
    case 'd': return String(rng.int(1, 9));
    case 'dd': return String(rng.int(10, 99));
    case 'ddd': return String(rng.int(100, 999));
    case 'year': return String(rng.int(1000, 2099));
    case 'time': return `${rng.int(1, 12)}:${String(rng.int(0, 59)).padStart(2, '0')}`;
    default: return null;
  }
}

export function fillTemplate(tpl, rng) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const n = numberSlot(key, rng);
    if (n !== null) return n;
    if (key === 'noun') return rng.pick(NUMBER_NOUNS);
    if (key === 'verb') return rng.pick(NUMBER_VERBS);
    return key;
  });
}

function buildNumbers(ctx) {
  if (ctx.tier === 1) return buildWords(ctx);
  const list = NUMBER_TEMPLATES[ctx.tier] || NUMBER_TEMPLATES[2];
  return fillTemplate(ctx.rng.pick(list), ctx.rng);
}

function buildCode(ctx) {
  if (ctx.tier === 1) return buildWords(ctx);
  return pickFromList(ctx, CODE_LINES) || buildWords(ctx);
}

// ------------------------------------------------------------------ themed incantations

const SLOT_LIST = { verb: 'verbs', noun: 'nouns', pl: 'plurals', adj: 'adjs', target: 'targets' };
// a locked punctuation key falls back to the next unlocked option, or is dropped
const PUNCT = { '!': ['!', '.'], '.': ['.'], ',': [','], ';': [';', ','], ':': [':', ',', ';'] };

/** Unlocked, unused words for a slot: the school's own words first, then neutral magic words. */
function slotCandidates(ctx, slot, used) {
  const ok = (w) => !used.has(w) && isTextAllowed(w, ctx.allowed);
  if (slot === 'place') return PLACES.filter(ok);
  const key = SLOT_LIST[slot];
  if (!key) return [];
  const school = SCHOOL_LEXICON[ctx.school] || {};
  for (const list of [school[key], GENERIC_LEXICON[key]]) {
    const c = (list || []).filter(ok);
    if (c.length) return c;
  }
  return [];
}

function pickSlot(ctx, slot, used) {
  const cands = slotCandidates(ctx, slot, used);
  if (cands.length) {
    return ctx.rng.weighted(cands, (w) => 1 + (hasAny(w, ctx.fresh) ? 2.5 : 0) + (hasAny(w, ctx.weak) ? 1.5 : 0));
  }
  if (slot === 'place') return null;
  // home row & early regions: not enough themed words yet — borrow any typeable word
  for (let i = 0; i < 6; i++) {
    const w = ctx.pickWord();
    if (w && !used.has(w)) return w;
  }
  return null;
}

/**
 * Render a template such as '{adj} {noun} , {verb} {target} !' with the context's school.
 * Returns null when the template needs a word or key the player has not unlocked yet.
 * caps: capitalise the first letter, nouns and places (Capital Citadel onwards).
 */
export function renderTemplate(tpl, ctx, { caps = false, capFirst = false } = {}) {
  const canCap = ctx.allowed.has('A');
  const doCaps = caps && canCap;
  const used = new Set();
  const parts = [];
  for (const tok of tpl.split(' ')) {
    if (PUNCT[tok]) {
      const p = PUNCT[tok].find((c) => ctx.allowed.has(c));
      if (p && parts.length && !/[,;:!.]$/.test(parts[parts.length - 1])) parts[parts.length - 1] += p;
      continue;
    }
    let word;
    const m = /^\{(\w+)\}$/.exec(tok);
    if (m) {
      word = numberSlot(m[1], ctx.rng);
      if (word === null) {
        word = pickSlot(ctx, m[1], used);
        if (!word) return null;
        used.add(word);
        if (doCaps && (m[1] === 'noun' || m[1] === 'place')) word = capitalize(word);
      }
    } else {
      word = tok;
    }
    if (!isTextAllowed(word, ctx.allowed)) return null;
    parts.push(word);
  }
  let text = parts.join(' ').replace(/[,;:]$/, '');
  if (!text) return null;
  if (doCaps || (capFirst && canCap)) {
    text = capitalize(text);
    if (doCaps) text = text.replace(/([.!?] )([a-z])/g, (_, a, b) => a + b.toUpperCase());
  }
  return text;
}

function buildThemed(ctx, opts = {}) {
  return renderTemplate(ctx.rng.pick(INCANTATION_TEMPLATES[ctx.tier]), ctx, opts);
}

function buildThemedNumbers(ctx) {
  if (ctx.tier === 1) return buildThemed(ctx);
  return renderTemplate(ctx.rng.pick(NUMBER_INCANTATIONS[ctx.tier]), ctx, { capFirst: ctx.tier >= 3 });
}

function buildThemedCode(ctx) {
  if (ctx.tier === 1) return buildThemed(ctx);
  return pickFromList(ctx, SCHOOL_CODE_LINES[ctx.school] || []) || pickFromList(ctx, CODE_LINES) || buildThemed(ctx);
}

const THEMED_BUILDERS = {
  words: (ctx) => buildThemed(ctx),
  capWords: (ctx) => buildThemed(ctx, { caps: true }),
  sentence: (ctx) => buildThemed(ctx, { caps: true }),
  numbers: buildThemedNumbers,
  code: buildThemedCode,
};

const BUILDERS = {
  words: buildWords,
  capWords: buildCapWords,
  sentence: buildSentence,
  numbers: buildNumbers,
  code: buildCode,
};

function makeContext({ layoutId, zoneIndex, tier, rng, weakChars = [], school = null }) {
  const z = clamp(zoneIndex, 0, ZONES.length - 1);
  const allowed = allowedChars(layoutId, z);
  const fresh = newCharsForZone(layoutId, z);
  const weak = new Set(weakChars);
  const pool = wordPool(layoutId, z);
  const ctx = { layoutId, zoneIndex: z, tier, rng, allowed, fresh, weak, pool, school };
  ctx.pickWord = makePicker(pool, (w) => wordWeight(w, tier, fresh, weak), rng);
  return ctx;
}

const isCode = (mode) => mode === 'code';

/** Join two phrases with whatever punctuation the player has unlocked. */
function joinPieces(a, b, ctx, mode) {
  if (isCode(mode)) return `${a} ${b}`;
  const { allowed, rng } = ctx;
  const capsStyle = /^[A-Z]/.test(a) && allowed.has('A');
  if (/[.!?]$/.test(a)) return `${a} ${capsStyle ? capitalize(b) : b}`;
  if (/^[A-Z]/.test(b) && allowed.has('.')) return `${a}. ${b}`;
  if (ctx.tier >= 3 && allowed.has(';') && rng.chance(0.4)) return `${a}; ${b}`;
  if (allowed.has(',')) return `${a}, ${b}`;
  return `${a} ${b}`;
}

/**
 * Chain further phrases onto `text` until the incantation is as long as its tier asks.
 * Themed phrases first; plain words only when the school's templates keep failing (early regions).
 */
function extendToLength(text, ctx, builder, mode) {
  const { min, max } = TIERS[ctx.tier];
  const seen = new Set([text]);
  for (let i = 0; i < 20 && text.length < min; i++) {
    const next = (i < 12 && builder(ctx)) || (i >= 12 ? buildWords(ctx) : null);
    if (!next || seen.has(next) || !isTextAllowed(next, ctx.allowed)) continue;
    const joined = joinPieces(text, next, ctx, mode);
    if (joined.length > max || !isTextAllowed(joined, ctx.allowed)) continue;
    seen.add(next);
    text = joined;
  }
  return text;
}

/**
 * Generate one incantation for a spell card. With `school` the words match the spell
 * (fire spells talk about flames, wards about walls and shields...).
 * @returns {string}
 */
export function generateIncantation({ layoutId, zoneIndex, tier, rng, weakChars = [], avoidFirst = [], school = null, short = false }) {
  const ctx = makeContext({ layoutId, zoneIndex, tier, rng, weakChars, school });
  const zone = ZONES[ctx.zoneIndex];
  const mode = zone.textModes[tier];
  const themed = !!(school && SCHOOL_LEXICON[school]);
  const builder = themed ? THEMED_BUILDERS[mode] || THEMED_BUILDERS.words : BUILDERS[mode] || buildWords;
  const avoid = new Set(avoidFirst.filter(Boolean).map((c) => c.toLowerCase()));
  // short: a single phrase (lesson drills, hunt events) instead of a full-length incantation
  const bounds = short ? TIERS[tier].piece : TIERS[tier];
  const maxLen = bounds.max;
  let fallback = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    let text = builder(ctx);
    if (!text || !isTextAllowed(text, ctx.allowed)) {
      if (themed) continue; // try another template; most need words the player unlocks later
      text = buildWords(ctx);
      if (!text || !isTextAllowed(text, ctx.allowed)) continue;
    }
    const firstOk = !avoid.has(text[0].toLowerCase());
    if (!firstOk) continue;
    if (!short) text = extendToLength(text, ctx, builder, mode);
    if (lengthOk(text, bounds)) return text;
    if (!fallback || (fallback.length > maxLen && text.length < fallback.length)) {
      fallback = text;
    }
  }
  if (fallback) return fallback;
  // last resort: plain words, still honouring the distinct-first-letter rule
  let any = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const text = buildWords(ctx);
    if (!text) continue;
    any = any || text;
    if (!avoid.has(text[0].toLowerCase())) return short ? text : extendToLength(text, ctx, buildWords, 'words');
  }
  return any || buildWords(ctx);
}

function charPriority(c) {
  if (/^[a-z0-9]$/i.test(c)) return 0;
  if (c.charCodeAt(0) < 128) return 1;
  return 2;
}

/** Two drill lines that introduce the zone's new characters. */
export function generateLessonDrill({ layoutId, zoneIndex, rng }) {
  const fresh = [...newCharsForZone(layoutId, zoneIndex)].filter((c) => c !== ' ');
  const isUpper = (c) => c.toLowerCase() !== c;
  const upper = fresh.filter(isUpper);
  const other = rng.shuffle(fresh.filter((c) => !isUpper(c))).sort((a, b) => charPriority(a) - charPriority(b));
  const parts = [];
  if (upper.length >= 6) {
    const asciiUpper = upper.filter((c) => /[A-Z]/.test(c));
    for (const c of rng.shuffle(asciiUpper.length ? asciiUpper : upper).slice(0, 6)) parts.push(`${c}${c.toLowerCase()}`);
    for (const c of other.filter((c) => charPriority(c) < 2).slice(0, 2)) parts.push(c.repeat(3));
  } else {
    for (const c of other.slice(0, 8)) parts.push(c.repeat(3));
    for (const c of upper.slice(0, Math.max(0, 8 - parts.length))) parts.push(`${c}${c.toLowerCase()}`);
  }
  const allowed = allowedChars(layoutId, zoneIndex);
  const line1 = parts.filter((p) => isTextAllowed(p, allowed)).join(' ');
  const line2 = generateIncantation({ layoutId, zoneIndex, tier: 2, rng, weakChars: fresh, short: true });
  return [line1 || line2, line2].filter((l, i, arr) => l && arr.indexOf(l) === i);
}
