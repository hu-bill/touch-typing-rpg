// How strong a spell should *feel*: pure numbers the FX and audio layers scale by.
import { TIER_FX } from '../data/spellFx.js';
import { clamp } from '../core/util.js';

/** How hard a landed spell should feel. dmgFrac = (dealt + toBarrier) / enemy max HP (250 for the dummy). */
export function impactProfile({ tier, crit = false, perfect = false, lethal = false, dmgFrac = 0, comboIndex = 0 }) {
  const t = TIER_FX[tier] || TIER_FX[1];
  const frac = clamp(dmgFrac || 0, 0, 1);
  const intensity = clamp(
    t.intensity + 0.8 * frac + (crit ? 0.35 : 0) + (perfect ? 0.1 : 0) + (lethal ? 0.4 : 0) + 0.05 * comboIndex,
    0.4,
    2.6,
  );
  return {
    intensity,
    hitstopMs: Math.round(Math.min(220, t.hitstopMs + (crit ? 40 : 0) + (lethal ? 90 : 0))),
    shake: Math.round(clamp(2 + 6 * intensity, 3, 18) * 10) / 10,
    flash: Math.min(0.32, t.flash + (crit ? 0.08 : 0) + (lethal ? 0.06 : 0)),
    punch: Math.min(0.035, t.punch + (crit ? 0.006 : 0) + (lethal ? 0.01 : 0)),
    particles: Math.round(clamp(16 + 36 * intensity, 16, 110)),
    knockPx: Math.round(clamp(8 + 22 * intensity, 8, 60)),
    numberSize: Math.round(clamp(26 + 14 * intensity + (crit ? 12 : 0), 26, 78)),
  };
}

const DANCE = [0, 2, 1, 3]; // up-down ornament so the climb never sounds like a plain ramp

/** Scale step of the i-th typed letter (0-based) of an n-letter incantation: climbs `span` steps, dancing. */
export function melodyStep(i, n, tier) {
  const span = (TIER_FX[tier] || TIER_FX[1]).span;
  const base = Math.round((clamp(i, 0, Math.max(0, n - 1)) / Math.max(1, n - 1)) * span);
  return base + DANCE[((i % 4) + 4) % 4];
}

/** Semitones above the root for a scale step; steps past the end continue in the next octave. */
export function scaleSemitone(scale, step) {
  const len = scale.length;
  return scale[((step % len) + len) % len] + 12 * Math.floor(step / len);
}

/** Release strum: scale steps 0, 2, 4, 5, 7, 9 (root, "third", "fifth", octave, …) as semitones; 2 + tier notes. */
export function sealChord(scale, tier) {
  return [0, 2, 4, 5, 7, 9].slice(0, 2 + tier).map((s) => scaleSemitone(scale, s));
}

/** Rim segment i of n, clockwise from 12 o'clock → { a0, a1, mid } in radians. */
export function rimSegment(i, n) {
  const w = (Math.PI * 2) / Math.max(1, n);
  const a0 = -Math.PI / 2 + i * w;
  return { a0, a1: a0 + w, mid: a0 + w / 2 };
}
