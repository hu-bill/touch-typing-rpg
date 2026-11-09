// All sound is synthesized with WebAudio — no audio files.
// Engine + instruments + menu/event sounds live here; the spell sounds are in sound/spellVoices.js (PLAN §15).
import { SCHOOL_FX } from '../data/spellFx.js';
import { scaleSemitone } from '../logic/spellFeel.js';
import { TEXTURES } from './sound/textures.js';
import { createSpellVoices, TEXTURE_SPECS } from './sound/spellVoices.js';

const PENTA = [0, 2, 4, 7, 9];
// climb two octaves of the pentatonic scale, then come back down: a melody that follows your combo
const MELODY = [];
for (let i = 0; i < 10; i++) MELODY.push(PENTA[i % 5] + 12 * Math.floor(i / 5));
for (let i = 8; i > 0; i--) MELODY.push(MELODY[i]);

const clampPan = (p) => Math.max(-1, Math.min(1, p));
/** Treble compensation: notes above ~700 Hz get softer so long melodies never turn piercing (PLAN §14 rule 7). */
const comp = (f) => Math.max(0.55, Math.min(1.15, (700 / f) ** 0.35));

/** `makeContext` lets tests render into an OfflineAudioContext (or a mock). */
export function createAudio({ makeContext } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let verbIn = null;
  const buses = {};
  let volume = 0.6;
  let lastKeyAt = 0;
  const ksCache = new Map();
  const texCache = new Map();
  const shaperCache = new Map();
  let duckState = { target: 1, end: 0 };
  let prewarmQueue = null;

  function makeImpulse(seconds = 2.2, decay = 3) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function unlock() {
    if (!ctx) {
      if (makeContext) ctx = makeContext();
      else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp);
      comp.connect(ctx.destination);
      for (const name of ['keys', 'spell']) {
        buses[name] = ctx.createGain();
        buses[name].gain.value = 1;
        buses[name].connect(master);
      }
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      try {
        const verb = ctx.createConvolver();
        verb.buffer = makeImpulse();
        verbIn = ctx.createGain();
        const verbOut = ctx.createGain();
        verbOut.gain.value = 0.32;
        verbIn.connect(verb);
        verb.connect(verbOut);
        verbOut.connect(master);
      } catch {
        verbIn = null;
      }
      if (!makeContext) prewarm();
    }
    if (!makeContext && ctx.state === 'suspended') ctx.resume();
  }

  const live = () => !!ctx && volume > 0;

  /** Connect a voice to its bus (or the master), optionally panned (and moving) and with a reverb send. */
  function route(node, t0, { pan = 0, panTo = null, panDur = 0.12, verb = 0, bus = null } = {}) {
    let out = node;
    if ((pan || panTo != null) && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(clampPan(pan), t0);
      if (panTo != null) p.pan.linearRampToValueAtTime(clampPan(panTo), t0 + panDur);
      node.connect(p);
      out = p;
    }
    out.connect((bus && buses[bus]) || master);
    if (verb > 0 && verbIn) {
      const s = ctx.createGain();
      s.gain.value = verb;
      out.connect(s);
      s.connect(verbIn);
    }
  }

  /** Exponential envelope: silence → peak in `attack` → silence at `dur`. */
  function envelope(param, t0, peak, attack, dur) {
    const a = Math.min(Math.max(0.001, attack), dur * 0.97);
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    param.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function shaper(drive) {
    let curve = shaperCache.get(drive);
    if (!curve) {
      curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / 512 - 1) * drive;
        curve[i] = Math.tanh(x) / Math.tanh(drive);
      }
      shaperCache.set(drive, curve);
    }
    const ws = ctx.createWaveShaper();
    ws.curve = curve;
    return ws;
  }

  function tone({ freq, type = 'sine', dur = 0.1, gain = 0.1, attack = 0.004, freqEnd = null, delay = 0, pan = 0, verb = 0, bus = null }) {
    if (!live()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    envelope(g.gain, t0, gain, attack, dur);
    osc.connect(g);
    route(g, t0, { pan, verb, bus });
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, gain = 0.1, type = 'bandpass', f0 = 1000, f1 = null, q = 1, delay = 0, attack = 0.01, drive = 0, pan = 0, panTo = null, panDur, verb = 0, bus = null }) {
    if (!live()) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f0, t0);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    flt.Q.value = q;
    const g = ctx.createGain();
    envelope(g.gain, t0, gain, attack, dur);
    src.connect(flt);
    let node = flt;
    if (drive) {
      const ws = shaper(drive);
      flt.connect(ws);
      node = ws;
    }
    node.connect(g);
    route(g, t0, { pan, panTo, panDur: panDur ?? dur, verb, bus });
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  const note = (semis, base = 392) => base * Math.pow(2, semis / 12);

  function hit(big = false) {
    tone({ freq: 170, freqEnd: 45, type: 'sine', dur: 0.24, gain: big ? 0.26 : 0.17 });
    noise({ dur: 0.14, gain: big ? 0.16 : 0.1, type: 'lowpass', f0: 1800, f1: 200 });
  }

  function crit() {
    tone({ freq: 1320, type: 'triangle', dur: 0.25, gain: 0.07 });
    tone({ freq: 1760, type: 'triangle', dur: 0.32, gain: 0.05, delay: 0.05 });
  }

  /**
   * FM voice: bells, gongs, zaps. index = modulation depth relative to the modulator frequency, falling to
   * `indexEnd` over 60 % of the note. `fFrom` → f in `glide` s (a chirp onto the note); `fTo` sweeps to the end.
   */
  function fm(f, { ratio = 3.5, index = 2, indexEnd = null, dur = 1, gain = 0.05, attack = 0.003, delay = 0, fFrom = null, glide = 0.02, fTo = null, pan = 0, verb = 0, bus = null } = {}) {
    if (!live()) return;
    const t0 = ctx.currentTime + delay;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    for (const [osc, r] of [[car, 1], [mod, ratio]]) {
      osc.frequency.setValueAtTime((fFrom || f) * r, t0);
      if (fFrom) osc.frequency.exponentialRampToValueAtTime(f * r, t0 + glide);
      if (fTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, fTo) * r, t0 + dur);
    }
    mg.gain.setValueAtTime(index * f * ratio, t0);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.01, indexEnd != null ? indexEnd * f * ratio : 0.01 * f), t0 + dur * 0.6);
    envelope(g.gain, t0, gain, attack, dur);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(g);
    route(g, t0, { pan, verb, bus });
    car.start(t0);
    mod.start(t0);
    car.stop(t0 + dur + 0.05);
    mod.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------ textures (PLAN §15.2)

  function toBuffer(data) {
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  }

  /** A fresh texture buffer. spec = [generatorName, options]. */
  function tex(spec) {
    const [name, opts] = spec;
    return toBuffer(TEXTURES[name](ctx.sampleRate, opts));
  }

  /** One of `n` cached variants of a texture, never the same one twice in a row (PLAN §15.0 rule 6). */
  function variant(key, n = 4) {
    const spec = TEXTURE_SPECS[key];
    if (!spec) throw new Error(`unknown texture ${key}`);
    let entry = texCache.get(key);
    if (!entry) {
      entry = { list: [], last: -1 };
      texCache.set(key, entry);
    }
    let i;
    if (entry.list.length < n) {
      entry.list.push(tex(spec));
      i = entry.list.length - 1;
    } else {
      i = Math.floor(Math.random() * (n - 1));
      if (i >= entry.last) i += 1;
    }
    entry.last = i;
    return entry.list[i];
  }

  /** Render the first variant of every texture in idle slices so the first big hit never stutters. */
  function prewarm() {
    if (typeof setTimeout !== 'function') return;
    prewarmQueue = Object.keys(TEXTURE_SPECS);
    const step = () => {
      const key = prewarmQueue && prewarmQueue.shift();
      if (!key || !ctx) return;
      if (!texCache.has(key)) texCache.set(key, { list: [tex(TEXTURE_SPECS[key])], last: -1 });
      setTimeout(step, 30);
    };
    setTimeout(step, 200);
  }

  /** Play a texture buffer through optional filters (each may sweep f0 → f1) and a gain envelope. */
  function buf(b, { gain = 0.1, delay = 0, rate = 1, filters = [], attack = 0.001, dur = null, drive = 0, pan = 0, panTo = null, panDur, verb = 0, bus = null } = {}) {
    if (!live() || !b) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    const len = b.duration / rate;
    const end = dur ? Math.min(dur, len) : len;
    let node = src;
    for (const f of filters) {
      const fl = ctx.createBiquadFilter();
      fl.type = f.type;
      fl.frequency.setValueAtTime(f.f0, t0);
      if (f.f1) fl.frequency.exponentialRampToValueAtTime(f.f1, t0 + (f.dur || end));
      fl.Q.value = f.q ?? (f.type === 'bandpass' ? 1 : 0.707);
      node.connect(fl);
      node = fl;
    }
    if (drive) {
      const ws = shaper(drive);
      node.connect(ws);
      node = ws;
    }
    const g = ctx.createGain();
    if (attack > 0.002) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(attack, end * 0.97));
    } else g.gain.setValueAtTime(gain, t0);
    if (dur && dur < len) g.gain.exponentialRampToValueAtTime(0.0001, t0 + end);
    node.connect(g);
    route(g, t0, { pan, panTo, panDur: panDur ?? end, verb, bus });
    src.start(t0);
    src.stop(t0 + end + 0.02);
  }

  /** Electric buzz: band-passed noise gated on/off `rate` times a second (the square wave is never heard). */
  function buzz({ dur = 0.12, rate = 100, f0 = 1500, f1 = null, q = 2, gain = 0.05, attack = 0.002, delay = 0, pan = 0, verb = 0, bus = null }) {
    if (!live()) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f0, t0);
    if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    bp.Q.value = q;
    const gate = ctx.createGain();
    gate.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(rate, t0);
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(gate.gain);
    const g = ctx.createGain();
    envelope(g.gain, t0, gain, attack, dur);
    src.connect(bp);
    bp.connect(gate);
    gate.connect(g);
    route(g, t0, { pan, verb, bus });
    src.start(t0, Math.random() * 1.5);
    lfo.start(t0);
    src.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  }

  /**
   * Duck the keystroke bus by `db` for `hold` s, recovering over `release` s (PLAN §15.0 rule 7).
   * Overlapping ducks merge: the deeper level and the later end win.
   */
  function duck(db, hold, release = 0.35) {
    if (!live() || !buses.keys) return;
    const now = ctx.currentTime;
    let target = Math.pow(10, db / 20);
    let end = now + hold;
    if (now < duckState.end) {
      target = Math.min(target, duckState.target);
      end = Math.max(end, duckState.end);
    }
    duckState = { target, end };
    const g = buses.keys.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(target, now, 0.012);
    g.setTargetAtTime(1, end, release / 3);
  }

  // ------------------------------------------------------------ instruments (PLAN §14.5, §15.3) — every voice decays by itself

  /** Karplus–Strong plucked string, rendered once per pitch and cached. */
  function ksBuffer(f) {
    const key = Math.round(f);
    let buf = ksCache.get(key);
    if (buf) return buf;
    if (ksCache.size > 64) ksCache.clear();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.8);
    buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      prev = prev * 0.65 + (Math.random() * 2 - 1) * 0.35; // soft (low-passed) pick
      ring[i] = prev;
    }
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const nx = idx + 1 === N ? 0 : idx + 1;
      const v = ring[idx];
      d[i] = v;
      ring[idx] = 0.994 * 0.5 * (v + ring[nx]);
      idx = nx;
    }
    ksCache.set(key, buf);
    return buf;
  }

  /** Play one note on an instrument. gain is relative (1 = normal); `short` = a 35 % quicker decay (keystrokes). */
  function play(name, f, { gain = 1, delay = 0, pan = 0, verb = 0, bus = null, short = false } = {}) {
    if (!live() || !(f > 0)) return;
    const k = gain * comp(f);
    const sh = short ? 0.65 : 1;
    const o = { delay, pan, verb, bus };
    switch (name) {
      case 'marimba':
        tone({ freq: f, dur: 0.4, gain: 0.085 * k, attack: 0.002, ...o });
        tone({ freq: f * 3.9, dur: 0.08, gain: 0.03 * k, attack: 0.002, ...o });
        tone({ freq: f * 9.2, dur: 0.02, gain: 0.012 * k, attack: 0.001, ...o });
        break;
      case 'bell':
        fm(f, { ratio: 3.5, index: 1.1, dur: 0.45 * sh, gain: 0.055 * k, ...o });
        if (!short) tone({ freq: f * 2, dur: 0.18, gain: 0.01 * k, ...o });
        break;
      case 'musicbox':
        tone({ freq: f, dur: 0.35, gain: 0.05 * k, attack: 0.002, ...o });
        tone({ freq: f * 2, dur: 0.25, gain: 0.012 * k, attack: 0.002, ...o });
        tone({ freq: f * 5.02, dur: 0.06, gain: 0.006 * k, attack: 0.001, ...o });
        break;
      case 'glass':
        tone({ freq: f, dur: 0.32 * sh, gain: 0.05 * k, attack: 0.001, ...o });
        tone({ freq: f * 2.32, dur: 0.12, gain: 0.016 * k, attack: 0.001, ...o });
        if (!short) tone({ freq: f * 4.25, dur: 0.05, gain: 0.006 * k, attack: 0.001, ...o });
        break;
      case 'zap':
        // a buzzy FM chirp that drops onto the note: "tzip"
        fm(f, { ratio: 0.5, index: 3, indexEnd: 0.4, fFrom: f * 1.6, glide: 0.018, dur: 0.12, gain: 0.05 * k, attack: 0.001, ...o });
        break;
      case 'flame': {
        // breath through a resonant band: a pitched "fwup"
        noise({ dur: 0.15, gain: 0.3 * k, type: 'bandpass', f0: f * 2, q: 7, attack: 0.008, ...o });
        tone({ freq: f, dur: 0.12, gain: 0.03 * k, attack: 0.004, ...o });
        break;
      }
      case 'pluck': {
        const t0 = ctx.currentTime + delay;
        const src = ctx.createBufferSource();
        src.buffer = ksBuffer(f);
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = 2500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2 * k, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        src.connect(flt);
        flt.connect(g);
        route(g, t0, o);
        src.start(t0);
        src.stop(t0 + 0.52);
        break;
      }
      case 'kalimba':
        tone({ freq: f, dur: 0.45 * sh, gain: 0.07 * k, attack: 0.002, ...o });
        tone({ freq: f * 5.95, dur: 0.05, gain: 0.02 * k, attack: 0.001, ...o });
        tone({ freq: f, type: 'triangle', dur: 0.03, gain: 0.02 * k, attack: 0.001, ...o });
        break;
      case 'vibes': {
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(f, t0);
        const env = ctx.createGain();
        envelope(env.gain, t0, 0.06 * k, 0.004, 0.45 * sh);
        const trem = ctx.createGain();
        trem.gain.value = 0.75;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lg = ctx.createGain();
        lg.gain.value = 0.25;
        lfo.connect(lg);
        lg.connect(trem.gain);
        osc.connect(env);
        env.connect(trem);
        route(trem, t0, o);
        osc.start(t0);
        lfo.start(t0);
        osc.stop(t0 + 0.45 * sh + 0.05);
        lfo.stop(t0 + 0.45 * sh + 0.05);
        tone({ freq: f * 4, dur: 0.15, gain: 0.012 * k, attack: 0.002, ...o });
        break;
      }
      default:
        tone({ freq: f, dur: 0.3, gain: 0.05 * k, ...o });
    }
  }

  const fxOf = (school) => SCHOOL_FX[school] || SCHOOL_FX.arcane;
  /** Frequency of a scale step of a school's song. */
  const noteOf = (school, step) => fxOf(school).root * Math.pow(2, scaleSemitone(fxOf(school).scale, step) / 12);

  const voices = createSpellVoices({
    get ctx() {
      return ctx;
    },
    live, tone, noise, fm, buf, buzz, tex, variant, duck, play, hit, fxOf, noteOf, comp,
  });

  return {
    unlock,
    get context() {
      return ctx;
    },
    /** QA: the `keys` and `spell` bus gain nodes. */
    get buses() {
      return buses;
    },
    setVolume(v) {
      volume = v;
      if (master) master.gain.value = v;
    },
    key(combo, tierIndex = 0) {
      const now = performance.now();
      if (now - lastKeyAt < 12) return;
      lastKeyAt = now;
      const semis = MELODY[(Math.max(1, combo) - 1) % MELODY.length];
      const f = note(semis);
      tone({ freq: f, type: 'triangle', dur: 0.11, gain: 0.07 });
      tone({ freq: f * 2, type: 'sine', dur: 0.06, gain: 0.018 });
      if (tierIndex >= 2) tone({ freq: f * 1.5, type: 'triangle', dur: 0.09, gain: 0.022 });
      if (tierIndex >= 4) tone({ freq: f * 3, type: 'sine', dur: 0.05, gain: 0.012 });
    },
    error() {
      tone({ freq: 150, freqEnd: 70, type: 'square', dur: 0.12, gain: 0.045 });
      noise({ dur: 0.08, gain: 0.04, type: 'lowpass', f0: 600 });
    },
    soft() {
      tone({ freq: 220, type: 'sine', dur: 0.06, gain: 0.03 });
    },
    castStart() {
      tone({ freq: 330, freqEnd: 660, type: 'sine', dur: 0.15, gain: 0.04 });
    },
    /** Old generic cast sound — kept as an alias of a tier II seal. */
    cast(school) {
      voices.seal(school, 2, {});
    },
    play,
    ...voices,
    hit,
    crit,
    enemyAttack() {
      tone({ freq: 110, freqEnd: 55, type: 'sawtooth', dur: 0.26, gain: 0.08 });
      noise({ dur: 0.2, gain: 0.12, type: 'lowpass', f0: 900, f1: 120 });
    },
    windup() {
      tone({ freq: 200, freqEnd: 420, type: 'square', dur: 0.35, gain: 0.025 });
    },
    fizzle() {
      noise({ dur: 0.45, gain: 0.12, type: 'highpass', f0: 3000, f1: 300 });
      tone({ freq: 440, freqEnd: 90, type: 'square', dur: 0.4, gain: 0.04 });
    },
    heal(tier = 1) {
      [0, 4, 7].forEach((s, i) => tone({ freq: note(s + 12), type: 'sine', dur: 0.3, gain: 0.05, delay: i * 0.06, verb: 0.35 }));
      if (tier >= 3) [0, 4, 7].forEach((s, i) => tone({ freq: note(s + 24), type: 'sine', dur: 0.3, gain: 0.03, delay: 0.12 + i * 0.06, verb: 0.35 }));
    },
    shield(tier = 1) {
      tone({ freq: 520, type: 'triangle', dur: 0.4, gain: 0.05, verb: 0.35 });
      tone({ freq: 780, type: 'sine', dur: 0.4, gain: 0.03, delay: 0.03, verb: 0.35 });
      if (tier >= 3) tone({ freq: 1040, type: 'triangle', dur: 0.4, gain: 0.03, delay: 0.12, verb: 0.35 });
    },
    loot(rarityIndex = 0) {
      const chord = [0, 4, 7, 12, 16, 19, 24];
      const n = 2 + rarityIndex;
      for (let i = 0; i < n; i++) tone({ freq: note(chord[i] + 5, 440), type: 'triangle', dur: 0.25, gain: 0.05, delay: i * 0.07 });
      if (rarityIndex >= 4) {
        for (let i = 0; i < 10; i++) tone({ freq: note(24 + (i % 3) * 4, 440), type: 'sine', dur: 0.12, gain: 0.025, delay: 0.35 + i * 0.05 });
      }
    },
    coin() {
      tone({ freq: 1568, type: 'square', dur: 0.06, gain: 0.025 });
      tone({ freq: 2093, type: 'square', dur: 0.12, gain: 0.025, delay: 0.06 });
    },
    levelUp() {
      [0, 4, 7, 12, 16].forEach((s, i) => tone({ freq: note(s, 523), type: 'triangle', dur: 0.35, gain: 0.06, delay: i * 0.09 }));
    },
    victory() {
      [0, 7, 12].forEach((s, i) => tone({ freq: note(s, 392), type: 'triangle', dur: 0.4, gain: 0.07, delay: i * 0.12 }));
      tone({ freq: note(16, 392), type: 'triangle', dur: 0.8, gain: 0.07, delay: 0.36 });
    },
    defeat() {
      [7, 3, 0, -5].forEach((s, i) => tone({ freq: note(s, 262), type: 'sawtooth', dur: 0.45, gain: 0.04, delay: i * 0.22 }));
    },
    banner() {
      tone({ freq: 660, freqEnd: 1320, type: 'sine', dur: 0.4, gain: 0.05 });
      noise({ dur: 0.5, gain: 0.05, type: 'bandpass', f0: 4000, f1: 8000, q: 3 });
    },
    click() {
      tone({ freq: 900, type: 'sine', dur: 0.04, gain: 0.03 });
    },
  };
}
