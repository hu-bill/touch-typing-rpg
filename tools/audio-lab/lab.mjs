// Audio lab (PLAN §15.9): render Spellstroke sounds offline in headless Chromium, write WAVs, measure them and
// draw sox spectrograms. Needs `npx vite --port 5199` running, playwright-core and a Chromium (env PLAYWRIGHT_DIR,
// CHROME, URL override the defaults) and `sox` on the PATH.
// usage: node tools/audio-lab/lab.mjs tools/audio-lab/scenes.mjs <outdir> [name-filter-regex]
// Writes <name>.wav (game level), <name>.norm.wav (normalised), <name>.png (spectrogram) and metrics.json.
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { resolve, join } from 'path';

const require = createRequire(process.env.PLAYWRIGHT_DIR || '/home/billh/.npm/_npx/9b9809298fe40d2c/node_modules/');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME || '/home/billh/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const SR = 44100;

const [, , scenesPath, outDir, filter] = process.argv;
const { SCENES, MODULE = '/src/ui/audio.js' } = await import(pathToFileURL(resolve(scenesPath)).href);
const scenes = SCENES.filter((s) => !filter || new RegExp(filter).test(s.name));
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- render in the page
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto((process.env.URL || 'http://localhost:5199/'));
await page.waitForTimeout(400);
const rendered = await page.evaluate(async ({ scenes, sr, mod }) => {
  const { createAudio } = await import(`${mod}?t=${Date.now()}`);
  const out = {};
  const b64 = (f32) => {
    const u8 = new Uint8Array(f32.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  for (const sc of scenes) {
    let off;
    const a = createAudio({ makeContext: () => (off = new OfflineAudioContext(2, Math.ceil(sr * sc.secs), sr)) });
    a.unlock();
    a.setVolume(0.6);
    const byT = new Map();
    for (const [t, method, ...args] of sc.events) {
      const q = (Math.max(1, Math.round((t * sr) / 128)) * 128) / sr;
      if (!byT.has(q)) byT.set(q, []);
      byT.get(q).push([method, args]);
    }
    const errs = [];
    for (const [q, calls] of byT) {
      off.suspend(q).then(() => {
        for (const [m, args] of calls) {
          try {
            if (typeof a[m] !== 'function') throw new Error(`no method ${m}`);
            a[m](...args);
          } catch (e) {
            errs.push(`${m}: ${e.message}`);
          }
        }
        off.resume();
      });
    }
    const buf = await off.startRendering();
    out[sc.name] = { L: b64(buf.getChannelData(0)), R: b64(buf.getChannelData(1)), errs };
  }
  return out;
}, { scenes, sr: SR, mod: MODULE });
await browser.close();

// ---------------------------------------------------------------- analysis
const f32 = (s) => new Float32Array(Buffer.from(s, 'base64').buffer.slice(0));
const db = (v) => (v > 1e-9 ? 20 * Math.log10(v) : -180);

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const BANDS = [['sub', 0, 80], ['bass', 80, 250], ['lowmid', 250, 1000], ['mid', 1000, 2500], ['harsh', 2500, 5000], ['high', 5000, 9000], ['air', 9000, 22050]];

const aWeight = (f) => {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return (ra * 10 ** (2 / 20)) ** 2; // power gain
};
const AW = new Float64Array(1024).map((_, k) => (k ? aWeight((k * SR) / 2048) : 0));

/** Spectral summary of mono x between sample a and b. */
function spectrum(x, a = 0, b = x.length) {
  const N = 2048, hop = 512;
  const aFrames = [];
  const aBand = [0, 0, 0];
  const aAcc = new Float64Array(N / 2);
  const regF = [0, 0, 0], regE = [0, 0, 0];
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const acc = new Float64Array(N / 2);
  let frames = 0, flatSum = 0, flatW = 0;
  for (let s = a; s + N <= b; s += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * win[i]; e += re[i] * re[i]; }
    if (e < 1e-10) { aFrames.push(0); continue; }
    fft(re, im);
    const pw = new Float64Array(N / 2);
    let ae = 0;
    for (let k = 1; k < N / 2; k++) {
      pw[k] = re[k] * re[k] + im[k] * im[k];
      acc[k] += pw[k];
      const w = pw[k] * AW[k];
      aAcc[k] += w;
      ae += w;
      const f = (k * SR) / N;
      aBand[f < 250 ? 0 : f < 2500 ? 1 : 2] += w;
    }
    aFrames.push(ae);
    // local flatness: geometric/arithmetic mean inside each octave (125 Hz … 8 kHz), weighted by octave energy.
    // Immune to spectral tilt, so low-passed noise still reads as noise and a chord still reads as tones.
    let fw = 0, fe = 0;
    for (let lo = 125; lo < 8000; lo *= 2) {
      const k0 = Math.ceil((lo * N) / SR), k1 = Math.floor((2 * lo * N) / SR);
      let lg = 0, ar = 0;
      for (let k = k0; k < k1; k++) { lg += Math.log(pw[k] + 1e-20); ar += pw[k]; }
      const cnt = k1 - k0;
      if (ar <= 0) continue;
      const fl = Math.exp(lg / cnt) / (ar / cnt);
      fw += fl * ar;
      fe += ar;
      const r = lo < 500 ? 0 : lo < 2000 ? 1 : 2;
      regF[r] += fl * ar;
      regE[r] += ar;
    }
    if (fe > 0) { flatSum += (fw / fe) * e; flatW += e; }
    frames++;
  }
  let tot = 0, cen = 0;
  for (let k = 1; k < N / 2; k++) { tot += acc[k]; cen += acc[k] * (k * SR / N); }
  const bands = {};
  for (const [name, lo, hi] of BANDS) {
    let e = 0;
    for (let k = 1; k < N / 2; k++) { const f = k * SR / N; if (f >= lo && f < hi) e += acc[k]; }
    bands[name] = tot > 0 ? e / tot : 0;
  }
  // A-weighted loudness of the loudest ~300 ms (26 frames), dB relative to a full-scale 1 kHz sine
  let bestA = 0;
  for (let i = 0; i < aFrames.length; i++) {
    let s2 = 0;
    for (let j = i; j < Math.min(aFrames.length, i + 26); j++) s2 += aFrames[j];
    bestA = Math.max(bestA, s2 / 26);
  }
  const ref = (N * 3) / 8 * (N / 8); // ≈ Hann-windowed full-scale sine power per frame
  const at = aBand[0] + aBand[1] + aBand[2] || 1;
  // perceptual (A-weighted) band shares and centroid — what the distinctness check compares
  const aBands = {};
  let aCen = 0;
  for (let k = 1; k < N / 2; k++) aCen += aAcc[k] * ((k * SR) / N);
  for (const [name, lo, hi] of BANDS) {
    let e = 0;
    for (let k = 1; k < N / 2; k++) { const f = (k * SR) / N; if (f >= lo && f < hi) e += aAcc[k]; }
    aBands[name] = e / at;
  }
  return { centroid: tot > 0 ? cen / tot : 0, bands, flatness: flatW > 0 ? flatSum / flatW : 0, frames,
    aLoud: 10 * Math.log10(bestA / ref + 1e-20), aShare: aBand.map((v) => v / at), aBands, aCen: aCen / at,
    regFlat: regF.map((v, i) => (regE[i] > 0 ? v / regE[i] : 0)) };
}

function analyse(L, R, sc) {
  const n = L.length;
  const m = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) { m[i] = 0.5 * (L[i] + R[i]); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  // 5 ms RMS envelope
  const w = Math.round(SR * 0.005);
  const env = [];
  for (let s = 0; s + w <= n; s += w) { let e = 0; for (let i = s; i < s + w; i++) e += m[i] * m[i]; env.push(Math.sqrt(e / w)); }
  let pk = 0, pkAt = 0;
  env.forEach((v, i) => { if (v > pk) { pk = v; pkAt = i; } });
  let onset = env.findIndex((v) => v > pk * 0.01);
  if (onset < 0) onset = 0;
  let tailEnd = pkAt;
  for (let i = env.length - 1; i >= pkAt; i--) if (env[i] > pk * 0.01) { tailEnd = i; break; }
  // texture: modulation spectrum of the 1 ms RMS envelope over the active part (crackle, creak, buzz, flicker, tone)
  const w1 = Math.round(SR * 0.001);
  const e1 = [];
  for (let s0 = onset * w; s0 + w1 <= Math.min(n, (tailEnd + 1) * w); s0 += w1) { let e = 0; for (let i = s0; i < s0 + w1; i++) e += m[i] * m[i]; e1.push(Math.sqrt(e / w1)); }
  let NM = 256; while (NM < e1.length && NM < 4096) NM *= 2;
  const mre = new Float64Array(NM), mim = new Float64Array(NM);
  const mean = e1.reduce((x, y) => x + y, 0) / Math.max(1, e1.length);
  let sd = 0;
  for (let i = 0; i < Math.min(NM, e1.length); i++) { const v = e1[i] - mean; sd += v * v; mre[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (Math.min(NM, e1.length) - 1))); }
  fft(mre, mim);
  const MB = [[2, 12], [12, 40], [40, 160], [160, 500]];
  const mod = MB.map(([lo, hi]) => { let e = 0; for (let k = 1; k < NM / 2; k++) { const f = (k * 1000) / NM; if (f >= lo && f < hi) e += mre[k] * mre[k] + mim[k] * mim[k]; } return e; });
  const mt = mod.reduce((x, y) => x + y, 0) || 1;
  const modShares = mod.map((v) => v / mt);
  const modDepth = mean > 0 ? Math.sqrt(sd / Math.max(1, e1.length)) / mean : 0;
  // loudest 300 ms
  const win = Math.floor(SR * 0.3);
  let best = 0;
  for (let s = 0; s + win < n; s += win >> 2) { let e = 0; for (let i = s; i < s + win; i++) e += m[i] * m[i]; best = Math.max(best, Math.sqrt(e / win)); }
  // stereo position: energy balance R vs L
  let eL = 0, eR = 0;
  for (let i = 0; i < n; i++) { eL += L[i] * L[i]; eR += R[i] * R[i]; }
  // crest: peak vs RMS of the loudest 300 ms — crackly/spiky sounds are high, smooth roars and tones low
  const res = {
    modShares,
    modDepth,
    crest: db(peak) - db(best),
    peak: db(peak),
    loud300: db(best),
    attackMs: (pkAt - onset) * 5,
    ringMs: (tailEnd - pkAt) * 5,
    pan: (eR - eL) / (eR + eL + 1e-20),
    ...spectrum(m),
    head: spectrum(m, Math.max(0, onset * w - 256), Math.min(n, onset * w + Math.round(SR * 0.06))),
  };
  // keystroke sequences: level right before each key vs the peak after it
  if (sc.keys && sc.keys.length > 1) {
    const before = [], drops = [];
    for (let k = 1; k < sc.keys.length; k++) {
      const t = sc.keys[k];
      const idx = Math.floor((t * SR) / w) - 2;
      const prevPk = Math.max(...env.slice(Math.floor((sc.keys[k - 1] * SR) / w), idx));
      before.push(db(env[idx]));
      drops.push(db(prevPk) - db(env[idx]));
    }
    before.sort((x, y) => x - y);
    drops.sort((x, y) => x - y);
    res.floor = before[before.length >> 1];
    res.minDrop = drops[0];
    res.medDrop = drops[drops.length >> 1];
  }
  return res;
}

function writeWav(path, L, R, gain = 1) {
  const len = L.length;
  const bytes = Buffer.alloc(44 + len * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + len * 4, 4); bytes.write('WAVE', 8); bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(len * 4, 40);
  for (let i = 0; i < len; i++) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
  }
  writeFileSync(path, bytes);
}

const pct = (v) => String(Math.round(v * 100)).padStart(3);
const rows = [];
for (const sc of scenes) {
  const r = rendered[sc.name];
  const L = f32(r.L), Rr = f32(r.R);
  const a = analyse(L, Rr, sc);
  rows.push({ name: sc.name, group: sc.group, a, errs: r.errs });
  const safe = sc.name.replace(/[^a-z0-9]+/gi, '_');
  // raw = game level; the spectrogram is drawn from a normalised copy so quiet sounds are readable
  writeWav(join(outDir, `${safe}.wav`), L, Rr, 1);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
  const norm = join(outDir, `${safe}.norm.wav`);
  writeWav(norm, L, Rr, Math.min(30, 0.89 / Math.max(peak, 1e-6)));
  if (sc.spectro !== false) {
    execFileSync('sox', [norm, '-n', 'remix', '1,2', 'rate', '22050', 'spectrogram', '-x', String(sc.px || 700), '-y', '257', '-z', '80', '-t', sc.name, '-o', join(outDir, `${safe}.png`)]);
  }
}

console.log('name'.padEnd(34), 'peak  loud300  aLoud  atk  ring  cen   headCen flat crst pan | sub bass lmid mid hrsh high air | A:low mid high | floor minDrop');
for (const { name, a, errs } of rows) {
  const b = a.bands;
  console.log(
    name.padEnd(34),
    a.peak.toFixed(1).padStart(5), a.loud300.toFixed(1).padStart(7), a.aLoud.toFixed(1).padStart(6),
    String(a.attackMs).padStart(4), String(a.ringMs).padStart(5),
    String(Math.round(a.centroid)).padStart(5), String(Math.round(a.head.centroid)).padStart(6),
    a.flatness.toFixed(2).padStart(5), a.crest.toFixed(0).padStart(3), a.pan.toFixed(2).padStart(5), '|',
    pct(b.sub), pct(b.bass), pct(b.lowmid), pct(b.mid), pct(b.harsh), pct(b.high), pct(b.air), '|',
    pct(a.aShare[0]), pct(a.aShare[1]), pct(a.aShare[2]), '|',
    a.floor != null ? `${a.floor.toFixed(1)} ${a.minDrop.toFixed(1)}` : '',
    errs.length ? `ERR ${errs.join('; ')}` : '',
  );
}

// distinctness within each group: feature distance between every pair
const feat = (a) => [
  ...BANDS.map(([n]) => Math.log10(a.aBands[n] + 1e-4)),
  Math.log2(a.aCen + 1) * 1.5,
  a.flatness * 4,
  a.crest / 8,
  ...a.regFlat.map((v) => v * 3),
  ...a.modShares.map((v) => Math.log10(v + 1e-3)),
  Math.min(3, a.modDepth),
];
const groups = {};
for (const r of rows) if (r.group) (groups[r.group] ||= []).push(r);
for (const [g, list] of Object.entries(groups)) {
  let min = Infinity, pair = '';
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const fa = feat(list[i].a), fb = feat(list[j].a);
    const d = Math.sqrt(fa.reduce((s, v, k) => s + (v - fb[k]) ** 2, 0));
    if (d < min) { min = d; pair = `${list[i].name} ~ ${list[j].name}`; }
  }
  if (list.length > 1) console.log(`distinctness ${g}: min pair distance ${min.toFixed(2)} (${pair})`);
}
writeFileSync(join(outDir, 'metrics.json'), JSON.stringify(rows.map(({ name, group, a }) => ({ name, group, ...a })), null, 1));
console.log('page errors:', errors.length ? errors : 'none');
