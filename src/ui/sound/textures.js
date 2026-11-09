// Procedural sound textures (PLAN §15.2): pure functions → Float32Array, normalised to peak 1, last 4 ms faded out.
// No WebAudio here, so they run (and are tested) in Node. `rand` lets tests pass a seeded generator.

function finish(d, sr) {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < d.length; i++) d[i] /= peak;
  const fade = Math.min(d.length, Math.round(sr * 0.004));
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  d[d.length - 1] = 0; // never -0
  return d;
}

const len = (sr, dur) => Math.max(1, Math.round(dur * sr));

/**
 * Poisson clicks whose rate decays: sparks, embers, ice crunch, thunder rip, rustling leaves.
 * `first` puts a full-scale click at the very start (a guaranteed transient). Click amplitudes are `u^skew`:
 * 3 = many faint clicks and a few loud ones (embers), ~1 = evenly loud (a dense tearing rip).
 */
export function crackle(sr, { dur, rate, decay = dur, minMs = 0.3, maxMs = 2.5, first = false, skew = 3, rand = Math.random }) {
  const n = len(sr, dur);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const forced = first && i === 0;
    if (!forced && rand() >= (rate * Math.exp(-i / sr / decay)) / sr) continue;
    const L = Math.max(2, Math.round((sr * (minMs + rand() * (maxMs - minMs))) / 1000));
    const a = forced ? 1 : rand() ** skew * (rand() < 0.5 ? -1 : 1);
    for (let k = 0; k < L && i + k < n; k++) d[i + k] += a * (rand() * 2 - 1) * Math.exp((-5 * k) / L);
  }
  return finish(d, sr);
}

function brownInto(d, rand) {
  let y = 0;
  for (let i = 0; i < d.length; i++) {
    y = 0.985 * y + 0.12 * (rand() * 2 - 1);
    d[i] = y;
  }
  return d;
}

/** Leaky-integrated white noise: deep, soft noise for rumbles and roars. */
export function brown(sr, { dur, rand = Math.random }) {
  return finish(brownInto(new Float32Array(len(sr, dur)), rand), sr);
}

/** Smoothed random walk between targets picked every `lo`–`hi` seconds, in [min, max]. */
function flutter(n, sr, rand, { lo, hi, min, max }) {
  const out = new Float32Array(n);
  let v = (min + max) / 2;
  let target = min + rand() * (max - min);
  let next = 0;
  const k = 1 - Math.exp(-1 / (sr * lo * 0.5));
  for (let i = 0; i < n; i++) {
    if (i >= next) {
      target = min + rand() * (max - min);
      next = i + Math.round(sr * (lo + rand() * (hi - lo)));
    }
    v += (target - v) * k;
    out[i] = v;
  }
  return out;
}

/** Thunder / earthquake: brown noise shaped by a few rolling swells, fading to nothing at `dur`. */
export function rumble(sr, { dur, rolls = 3, rand = Math.random }) {
  const n = len(sr, dur);
  const d = brownInto(new Float32Array(n), rand);
  const bumps = [];
  for (let r = 0; r < rolls; r++) {
    bumps.push({
      at: r === 0 ? 0 : dur * (0.12 + rand() * 0.48),
      amp: r === 0 ? 1 : 0.35 + rand() * 0.45,
      atk: 0.04 + rand() * 0.08,
      tau: dur * (0.18 + rand() * 0.27),
    });
  }
  const fl = flutter(n, sr, rand, { lo: 0.04, hi: 0.12, min: 0.85, max: 1.15 });
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let e = 0;
    for (const b of bumps) {
      const u = t - b.at;
      if (u < 0) continue;
      e += b.amp * (u < b.atk ? u / b.atk : Math.exp(-(u - b.atk) / b.tau));
    }
    d[i] *= e * fl[i] * (1 - t / dur);
  }
  return finish(d, sr);
}

/** Fire body: mostly brown noise with a flickering level, attack 25 ms then a decay. */
export function roar(sr, { dur, rand = Math.random }) {
  const n = len(sr, dur);
  const d = brownInto(new Float32Array(n), rand);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  const fl = flutter(n, sr, rand, { lo: 0.025, hi: 0.06, min: 0.45, max: 1 });
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // attack 25 ms, exponential decay, and a final taper so the tail fades out instead of being cut
    const env = (t < 0.025 ? t / 0.025 : Math.exp(-(t - 0.025) / (0.4 * dur))) * (1 - t / dur) ** 2;
    d[i] = (0.75 * (d[i] / (peak || 1)) + 0.25 * (rand() * 2 - 1)) * fl[i] * env;
  }
  return finish(d, sr);
}

/** Sine grains with a glassy 2.76× partial: ice shards, arcane dust, crystals. Treble-compensated. */
export function grains(sr, { dur, count, fLo, fHi, dLo = 0.03, dHi = 0.15, rand = Math.random }) {
  const n = len(sr, dur);
  const d = new Float32Array(n);
  const atk = Math.round(sr * 0.001);
  for (let g = 0; g < count; g++) {
    const f = fLo * (fHi / fLo) ** rand();
    const start = Math.floor(n * rand() ** 1.6);
    const decay = dLo + rand() * (dHi - dLo);
    // later grains are quieter: a cascade that fades instead of a steady glitter
    const amp = (0.35 + 0.65 * rand()) * Math.sqrt(1000 / f) * (1 - 0.85 * (start / n));
    const w1 = (2 * Math.PI * f) / sr;
    const w2 = w1 * 2.76;
    const ph = rand() * Math.PI * 2;
    const L = Math.min(n - start, Math.round(sr * decay * 6));
    for (let k = 0; k < L; k++) {
      const env = (k < atk ? k / atk : 1) * Math.exp(-k / sr / decay);
      d[start + k] += amp * env * (Math.sin(ph + w1 * k) + 0.25 * Math.sin(w2 * k) * Math.exp(-k / sr / (decay * 0.4)));
    }
  }
  return finish(d, sr);
}

/** Click train gliding from f0 to f1 clicks/s under a sine arch: wood creak, ice groan. */
export function creak(sr, { dur, f0, f1, rand = Math.random }) {
  const n = len(sr, dur);
  const d = new Float32Array(n);
  const L = Math.max(2, Math.round(sr * 0.001));
  let i = 0;
  while (i < n) {
    const t = i / n;
    const arch = Math.sin(Math.PI * t);
    const a = arch * (0.7 + 0.3 * rand());
    for (let k = 0; k < L && i + k < n; k++) d[i + k] += a * (rand() * 2 - 1) * Math.exp((-5 * k) / L);
    const rate = f0 + (f1 - f0) * t;
    i += Math.max(L, Math.round((sr / rate) * (0.85 + 0.3 * rand())));
  }
  return finish(d, sr);
}

export const TEXTURES = { crackle, brown, rumble, roar, grains, creak };
