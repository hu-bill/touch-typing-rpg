// Spell sounds, v1.5 "Elemental Voices" (PLAN §15): every school is built from the sound of its element.
// A cast plays four beats in sync with the visuals: charge (keystrokes) → seal (release + travel) →
// manifest (build-up at the target) → impact (+ tail). The melody note of v1.4 stays as a pitched core.
import { TIER_FX } from '../../data/spellFx.js';
import { melodyStep, sealChord } from '../../logic/spellFeel.js';

const PC = -0.35; // the wizard
const PT = 0.35; // the foe

/** Texture recipes (PLAN §15.2): key → [generator, options]. Cached as variants; pre-rendered after unlock. */
export const TEXTURE_SPECS = {
  // keystroke foley (tiny)
  spark: ['crackle', { dur: 0.06, rate: 900, decay: 0.015, minMs: 0.2, maxMs: 1.2, first: true, skew: 2 }],
  ember: ['crackle', { dur: 0.04, rate: 160, decay: 0.02, minMs: 0.3, maxMs: 1.6, first: true }],
  iceTick: ['crackle', { dur: 0.025, rate: 500, decay: 0.008, minMs: 0.2, maxMs: 0.6, first: true }],
  dust: ['grains', { dur: 0.12, count: 4, fLo: 2000, fHi: 4500, dLo: 0.02, dHi: 0.05 }],
  rustle: ['crackle', { dur: 0.07, rate: 700, decay: 0.04, minMs: 0.5, maxMs: 3, skew: 2 }],
  // mistakes and fizzles
  crunch: ['crackle', { dur: 0.05, rate: 1500, decay: 0.02, minMs: 0.5, maxMs: 2, first: true }],
  snap: ['crackle', { dur: 0.025, rate: 4000, decay: 0.006, minMs: 0.3, maxMs: 1.5, first: true, skew: 1.5 }],
  sputter: ['crackle', { dur: 0.45, rate: 260, decay: 0.15, minMs: 0.2, maxMs: 1.5, first: true }],
  crumble: ['crackle', { dur: 0.35, rate: 500, decay: 0.12, minMs: 0.4, maxMs: 2.5, first: true }],
  dying: ['crackle', { dur: 0.5, rate: 40, decay: 0.2, first: true }],
  wilt: ['creak', { dur: 0.3, f0: 45, f1: 25 }],
  // releases and build-ups
  crack: ['crackle', { dur: 0.03, rate: 3000, decay: 0.01, minMs: 0.2, maxMs: 1, first: true }],
  roarShort: ['roar', { dur: 0.35 }],
  embers: ['crackle', { dur: 0.9, rate: 45, decay: 0.4, minMs: 0.3, maxMs: 1.8, first: true }],
  crystals: ['grains', { dur: 0.3, count: 10, fLo: 1500, fHi: 4500, dLo: 0.04, dHi: 0.15 }],
  creakWood: ['creak', { dur: 0.25, f0: 40, f1: 70 }],
  rustleLong: ['crackle', { dur: 0.4, rate: 500, decay: 0.2, minMs: 0.5, maxMs: 3, first: true, skew: 2 }],
  growth: ['creak', { dur: 0.2, f0: 50, f1: 140 }],
  // impacts
  rip: ['crackle', { dur: 0.34, rate: 3000, decay: 0.14, minMs: 0.4, maxMs: 4, skew: 1.3 }],
  sizzle: ['crackle', { dur: 0.6, rate: 70, decay: 0.25, minMs: 0.2, maxMs: 1 }],
  tinkles: ['crackle', { dur: 0.6, rate: 60, decay: 0.3, minMs: 0.2, maxMs: 0.8, first: true }],
  dustLong: ['grains', { dur: 0.7, count: 18, fLo: 2000, fHi: 5500, dLo: 0.03, dHi: 0.12 }],
  creakThorn: ['creak', { dur: 0.3, f0: 30, f1: 60 }],
  boltRip: ['crackle', { dur: 0.16, rate: 3000, decay: 0.05, minMs: 0.4, maxMs: 3, skew: 1.3 }],
  boltRumble: ['rumble', { dur: 0.6, rolls: 1 }],
  // rites
  bigRoar: ['roar', { dur: 1.6 }],
  groan: ['creak', { dur: 0.7, f0: 18, f1: 9 }],
  quake: ['rumble', { dur: 1.4, rolls: 3 }],
};
for (const t of [1, 2, 3, 4]) {
  TEXTURE_SPECS[`thunder${t}`] = ['rumble', { dur: 0.9 + 0.25 * t, rolls: t >= 3 ? 4 : 2 }];
  TEXTURE_SPECS[`roar${t}`] = ['roar', { dur: 0.7 + 0.15 * t }];
  TEXTURE_SPECS[`shards${t}`] = ['grains', { dur: 0.5, count: 14 + 4 * t, fLo: 1200, fHi: 5000, dLo: 0.05, dHi: 0.22 }];
}

/** How loud the pitched core plays under the element (PLAN §15.0 rule 1: element first, music second). */
const CORE = { storm: 0.9, fire: 1.4, frost: 0.8, arcane: 0.42, nature: 0.42, ward: 0.6 };

/** Travel whoosh filter per school: [type, f0, f1, q, gain]. */
const TRAVEL = {
  storm: ['highpass', 3000, 1500, 0.7, 0.05],
  fire: ['lowpass', 600, 2400, 1, 0.08],
  frost: ['highpass', 5000, 2500, 0.7, 0.04],
  arcane: ['bandpass', 1500, 3000, 2, 0.08],
  nature: ['bandpass', 900, 3200, 2, 0.08],
};

/** `kit` = the engine primitives from audio.js. */
export function createSpellVoices(kit) {
  const { live, tone, noise, fm, buf, buzz, variant, duck, play, hit, fxOf, noteOf } = kit;
  let lastNoteT = -1;

  // variation (PLAN §15.0 rule 6)
  const gj = () => Math.pow(10, ((Math.random() * 2 - 1) * 1.5) / 20);
  const rj = () => 1 + (Math.random() * 2 - 1) * 0.08;
  const pj = (p, a = 0.06) => p + (Math.random() * 2 - 1) * a;
  const S = 'spell';
  const K = 'keys';

  // ------------------------------------------------------------ the six elements
  // key(p, f): keystroke foley, p = charge 0…1 · choke(f): mistake · fizzle() · release(k, tier) ·
  // build(d, tier): swell lasting d s that ends on the hit · impact(k, tier, shatterAt) · rite(k)
  const EL = {
    storm: {
      key(p) {
        buf(variant('spark'), { gain: 0.12 * (0.6 + 0.4 * p) * gj(), rate: rj(), filters: [{ type: 'highpass', f0: 2000 * (0.75 + 0.5 * p) }], pan: pj(PC), verb: 0.05, bus: K });
      },
      choke() {
        // short circuit: a spark and a dirty buzz
        buf(variant('spark'), { gain: 0.2, filters: [{ type: 'highpass', f0: 1500 }], pan: PC, bus: K });
        buzz({ dur: 0.1, rate: 60, f0: 1100, q: 2, gain: 0.2, pan: PC, bus: K });
      },
      fizzle() {
        buf(variant('sputter'), { gain: 0.2, filters: [{ type: 'highpass', f0: 2000 }], pan: PC, verb: 0.15, bus: S });
        buzz({ dur: 0.35, rate: 70, f0: 900, f1: 150, q: 2, gain: 0.04, pan: PC, bus: S });
      },
      release(k, tier) {
        buf(variant('crack'), { gain: 0.1 * k, filters: [{ type: 'highpass', f0: 1500 }], pan: PC, verb: 0.15, bus: S });
        buzz({ dur: 0.14 + 0.03 * tier, rate: 95, f0: 1800, f1: 900, q: 2.5, gain: 0.4 * k, pan: PC, verb: 0.2, bus: S });
        fm(1800, { ratio: 0.5, index: 3, indexEnd: 0.5, fTo: 220, dur: 0.12, gain: 0.1 * k, attack: 0.001, pan: PC, verb: 0.2, bus: S });
      },
      build(d) {
        buzz({ dur: d, rate: 120, f0: 2500, q: 1.5, gain: 0.03, attack: d * 0.9, pan: PT, bus: S });
        buf(variant('spark'), { gain: 0.12, delay: d * 0.5, filters: [{ type: 'highpass', f0: 2500 }], pan: pj(PT, 0.2), bus: S });
      },
      impact(k, tier) {
        // crack → tearing rip → arc buzz, then the thunder rolls in under the static
        noise({ dur: 0.035, gain: 0.3 * k, type: 'highpass', f0: 700, attack: 0.001, pan: PT, bus: S });
        buf(variant('rip'), { gain: 0.45 * k, dur: 0.24 + 0.04 * tier, filters: [{ type: 'highpass', f0: 500 }, { type: 'lowpass', f0: 7000 }], pan: PT, verb: 0.2, bus: S });
        buzz({ dur: 0.14, rate: 110, f0: 1400, q: 2, gain: 0.08 * k, pan: PT, bus: S });
        tone({ freq: 85, freqEnd: 32, dur: 0.35, gain: 0.11 * k, attack: 0.002, pan: PT, bus: S });
        // a driven body so the boom still reads on laptop speakers that can't play the sub
        noise({ dur: 0.14, gain: 0.12 * k, type: 'lowpass', f0: 700, f1: 160, attack: 0.002, drive: 2, pan: PT, bus: S });
        buf(variant(`thunder${tier}`), { gain: 0.13 * k, delay: 0.09, filters: [{ type: 'lowpass', f0: 650 }], pan: PT * 0.5, verb: 0.35, bus: S });
        for (let i = 0; i < 2; i++) {
          buf(variant('sizzle'), { gain: 0.16, delay: 0.05 + i * 0.1, filters: [{ type: 'highpass', f0: 3500 }], pan: pj(PT, 0.35), verb: 0.2, bus: S });
        }
      },
      rite(k) {
        // the sky keeps tearing: a second, brighter rip and a storm of static before the far thunder
        buf(variant('rip'), { gain: 0.4 * k, delay: 0.12, filters: [{ type: 'bandpass', f0: 3000, q: 0.6 }], pan: PT * 0.3, verb: 0.3, bus: S });
        for (let i = 0; i < 3; i++) {
          buf(variant('sizzle'), { gain: 0.3, delay: 0.2 + i * 0.12, filters: [{ type: 'highpass', f0: 3000 }], pan: pj(0, 0.7), verb: 0.3, bus: S });
        }
        buf(variant('thunder4'), { gain: 0.16 * k, delay: 0.45, filters: [{ type: 'lowpass', f0: 500 }], pan: -0.2, verb: 0.5, bus: S });
      },
    },

    fire: {
      key(p) {
        buf(variant('ember'), { gain: 0.28 * (0.6 + 0.4 * p) * gj(), rate: rj(), delay: Math.random() * 0.025, filters: [{ type: 'bandpass', f0: 2400 * (0.75 + 0.5 * p), q: 0.8 }], pan: pj(PC), bus: K });
      },
      choke() {
        noise({ dur: 0.06, gain: 0.16, type: 'lowpass', f0: 900, attack: 0.004, pan: PC, bus: K });
        noise({ dur: 0.06, gain: 0.11, type: 'lowpass', f0: 700, attack: 0.004, delay: 0.05, pan: PC, bus: K });
      },
      fizzle() {
        noise({ dur: 0.45, gain: 0.09, type: 'bandpass', f0: 2500, f1: 1200, q: 0.8, attack: 0.02, pan: PC, verb: 0.1, bus: S });
        buf(variant('dying'), { gain: 0.25, filters: [{ type: 'bandpass', f0: 2500, q: 0.8 }], pan: PC, bus: S });
      },
      release(k) {
        tone({ freq: 110, freqEnd: 50, dur: 0.18, gain: 0.12 * k, attack: 0.003, pan: PC, bus: S });
        noise({ dur: 0.28, gain: 0.2 * k, type: 'lowpass', f0: 400, f1: 3200, q: 1, attack: 0.12, pan: PC, verb: 0.15, bus: S });
        buf(variant('roarShort'), { gain: 0.16 * k, filters: [{ type: 'lowpass', f0: 1400 }], pan: PC, verb: 0.15, bus: S });
        buf(variant('embers'), { gain: 0.1, dur: 0.5, filters: [{ type: 'bandpass', f0: 2500, q: 0.8 }], pan: pj(PC, 0.2), bus: S });
      },
      build(d) {
        noise({ dur: d, gain: 0.08, type: 'lowpass', f0: 150, f1: 600, attack: d * 0.9, pan: PT, bus: S });
      },
      impact(k, tier) {
        tone({ freq: 140, freqEnd: 40, dur: 0.32, gain: 0.2 * k, attack: 0.002, pan: PT, bus: S });
        noise({ dur: 0.3, gain: 0.2 * k, type: 'lowpass', f0: 5000, f1: 250, attack: 0.002, drive: 3, pan: PT, verb: 0.15, bus: S });
        buf(variant(`roar${tier}`), { gain: 0.22 * k, attack: 0.04, filters: [{ type: 'lowpass', f0: 1100 }], pan: PT, verb: 0.25, bus: S });
        buf(variant('embers'), { gain: 0.16, delay: 0.05, filters: [{ type: 'bandpass', f0: 2600, q: 0.8 }], pan: pj(PT, 0.3), verb: 0.2, bus: S });
        buf(variant('embers'), { gain: 0.12, delay: 0.15, filters: [{ type: 'bandpass', f0: 2600, q: 0.8 }], pan: pj(PT, 0.4), verb: 0.2, bus: S });
      },
      rite(k) {
        tone({ freq: 55, freqEnd: 22, dur: 1.0, gain: 0.12, pan: PT * 0.3, bus: S });
        buf(variant('embers'), { gain: 0.3, delay: 0.1, filters: [{ type: 'bandpass', f0: 2200, q: 0.8 }], pan: pj(0, 0.6), verb: 0.3, bus: S });
        buf(variant('bigRoar'), { gain: 0.4 * k, filters: [{ type: 'lowpass', f0: 900 }], pan: 0.1, verb: 0.5, bus: S });
        noise({ dur: 1.3, gain: 0.09, type: 'lowpass', f0: 1500, f1: 60, attack: 0.01, verb: 0.6, bus: S });
      },
    },

    frost: {
      key(p) {
        buf(variant('iceTick'), { gain: 0.1 * (0.6 + 0.4 * p) * gj(), rate: rj(), filters: [{ type: 'highpass', f0: 4500 * (0.75 + 0.5 * p) }], pan: pj(PC), verb: 0.1, bus: K });
      },
      choke() {
        buf(variant('crunch'), { gain: 0.3, filters: [{ type: 'lowpass', f0: 2500 }], pan: PC, bus: K });
      },
      fizzle() {
        buf(variant('crumble'), { gain: 0.22, filters: [{ type: 'lowpass', f0: 3000 }], pan: PC, verb: 0.15, bus: S });
      },
      release(k) {
        noise({ dur: 0.22, gain: 0.045 * k, type: 'highpass', f0: 7000, f1: 2500, attack: 0.08, pan: PC, verb: 0.3, bus: S });
        buf(variant('crystals'), { gain: 0.035 * k, pan: PC, verb: 0.35, bus: S });
        buf(variant('iceTick'), { gain: 0.05, filters: [{ type: 'highpass', f0: 4000 }], pan: PC, bus: S });
      },
      build(d) {
        buf(variant('growth'), { gain: 0.12, dur: d, filters: [{ type: 'bandpass', f0: 3000, q: 2 }], pan: PT, bus: S });
        noise({ dur: d, gain: 0.03, type: 'bandpass', f0: 2500, f1: 6000, q: 3, attack: d * 0.9, pan: PT, bus: S });
      },
      impact(k, tier, shatterAt) {
        buf(variant('crack'), { gain: 0.35 * k, rate: 1.2, filters: [{ type: 'highpass', f0: 3000 }], pan: PT, verb: 0.2, bus: S });
        tone({ freq: 160, freqEnd: 60, dur: 0.2, gain: 0.22 * k, attack: 0.002, pan: PT, bus: S });
        noise({ dur: 0.12, gain: 0.05 * k, type: 'bandpass', f0: 2500, f1: 7000, q: 2, attack: 0.07, pan: PT, bus: S });
        // the crystals shatter after the hit-stop, like the visuals
        buf(variant(`shards${tier}`), { gain: 0.09 * k, delay: shatterAt, pan: PT, verb: 0.35, bus: S });
        noise({ dur: 0.06, gain: 0.08 * k, type: 'highpass', f0: 4000, attack: 0.001, delay: shatterAt, pan: PT, bus: S });
        buf(variant('tinkles'), { gain: 0.08, delay: shatterAt + 0.1, filters: [{ type: 'highpass', f0: 5000 }], pan: pj(PT, 0.35), verb: 0.3, bus: S });
      },
      rite(k) {
        buf(variant('groan'), { gain: 0.25 * k, filters: [{ type: 'bandpass', f0: 400, q: 2 }], pan: PT * 0.5, verb: 0.4, bus: S });
        // a glacier cracking: the ice crack pitched an octave down, then the groan and the crumble
        buf(variant('crack'), { gain: 0.45 * k, rate: 0.5, filters: [{ type: 'lowpass', f0: 1800 }], pan: PT * 0.5, verb: 0.4, bus: S });
        // everything freezes at once: a dense sheet of ice crackle racing across the field
        buf(variant('rip'), { gain: 0.3 * k, rate: 1.4, filters: [{ type: 'highpass', f0: 2500 }], pan: pj(0.1, 0.3), verb: 0.4, bus: S });
        buf(variant('crumble'), { gain: 0.3, delay: 0.25, filters: [{ type: 'lowpass', f0: 1500 }], verb: 0.4, bus: S });
      },
    },

    arcane: {
      key(p) {
        buf(variant('dust'), { gain: 0.035 * (0.6 + 0.4 * p) * gj(), rate: rj(), pan: pj(PC), verb: 0.3, bus: K });
        noise({ dur: 0.08, gain: 0.012 * (0.6 + 0.4 * p), type: 'bandpass', f0: 1200, f1: 2400, q: 4, attack: 0.06, pan: PC, bus: K });
      },
      choke(f) {
        fm(f, { ratio: 3.5, index: 1.1, fTo: f * 0.94, dur: 0.25, gain: 0.07, pan: PC, bus: K });
      },
      fizzle(root) {
        fm(root, { ratio: 3.5, index: 1.5, fTo: root / 2, dur: 0.5, gain: 0.05, pan: PC, verb: 0.3, bus: S });
      },
      release(k) {
        tone({ freq: 900, freqEnd: 350, dur: 0.08, gain: 0.08 * k, attack: 0.002, pan: PC, bus: S });
        noise({ dur: 0.3, gain: 0.1 * k, type: 'bandpass', f0: 1800, f1: 700, q: 5, attack: 0.03, pan: PC, verb: 0.35, bus: S });
        buf(variant('dust'), { gain: 0.06 * k, pan: PC, verb: 0.4, bus: S });
      },
      build(d) {
        noise({ dur: d, gain: 0.07, type: 'bandpass', f0: 3000, f1: 400, q: 3, attack: d * 0.9, pan: PT, bus: S });
        tone({ freq: 900, freqEnd: 120, dur: d, gain: 0.03, attack: d * 0.8, pan: PT, bus: S });
      },
      impact(k, tier, _s, root) {
        tone({ freq: 1400, freqEnd: 110, dur: 0.18, gain: 0.06 * k, attack: 0.002, pan: PT - 0.1, bus: S });
        tone({ freq: 1405, freqEnd: 111, dur: 0.18, gain: 0.06 * k, attack: 0.002, pan: PT + 0.1, bus: S });
        tone({ freq: 150, freqEnd: 40, dur: 0.35, gain: 0.2 * k, attack: 0.002, pan: PT, bus: S });
        fm(root / 2, { ratio: 1.4, index: 3, dur: 1.1, gain: 0.08 * k, pan: PT, verb: 0.4, bus: S });
        noise({ dur: 0.25, gain: 0.08 * k, type: 'bandpass', f0: 2400, f1: 300, q: 5, attack: 0.004, pan: PT, verb: 0.3, bus: S });
        buf(variant('dustLong'), { gain: 0.07, delay: 0.05, pan: pj(PT, 0.3), verb: 0.5, bus: S });
      },
      rite(k, root) {
        tone({ freq: 45, freqEnd: 20, dur: 1.2, gain: 0.14, bus: S });
        // the singularity swallows everything: a chorused sweep from high to nothing
        tone({ freq: 2200, freqEnd: 60, dur: 0.45, gain: 0.05, attack: 0.003, pan: -0.15, verb: 0.4, bus: S });
        tone({ freq: 2213, freqEnd: 61, dur: 0.45, gain: 0.05, attack: 0.003, pan: 0.15, verb: 0.4, bus: S });
        fm(root / 4, { ratio: 1.4, index: 4, dur: 1.6, gain: 0.08 * k, verb: 0.5, bus: S });
        buf(variant('dustLong'), { gain: 0.15, delay: 0.3, verb: 0.6, bus: S });
      },
    },

    nature: {
      key(p) {
        buf(variant('rustle'), { gain: 0.22 * (0.6 + 0.4 * p) * gj(), rate: rj(), filters: [{ type: 'bandpass', f0: 3500 * (0.75 + 0.5 * p), q: 0.6 }], pan: pj(PC), bus: K });
      },
      choke() {
        buf(variant('snap'), { gain: 0.7, filters: [{ type: 'bandpass', f0: 1200, q: 3 }], pan: PC, bus: K });
      },
      fizzle() {
        buf(variant('wilt'), { gain: 0.2, filters: [{ type: 'bandpass', f0: 800, q: 2.5 }], pan: PC, verb: 0.2, bus: S });
        buf(variant('rustleLong'), { gain: 0.1, filters: [{ type: 'bandpass', f0: 3000, q: 0.6 }], pan: PC, bus: S });
      },
      release(k) {
        noise({ dur: 0.16, gain: 0.16 * k, type: 'bandpass', f0: 900, f1: 3200, q: 2, attack: 0.11, pan: PC, bus: S });
        buf(variant('creakWood'), { gain: 0.35 * k, filters: [{ type: 'bandpass', f0: 900, q: 3 }], pan: PC, verb: 0.2, bus: S });
        buf(variant('rustleLong'), { gain: 0.22, filters: [{ type: 'bandpass', f0: 3500, q: 0.6 }], pan: pj(PC, 0.2), bus: S });
        // the heal bloom: a rising airy shimmer
        noise({ dur: 0.5, gain: 0.025, type: 'bandpass', f0: 2000, f1: 4500, q: 3, attack: 0.3, pan: PC, verb: 0.5, bus: S });
      },
      build(d) {
        buf(variant('creakThorn'), { gain: 0.15, dur: d + 0.05, filters: [{ type: 'bandpass', f0: 700, q: 2.5 }], pan: PT, bus: S });
        buf(variant('rustle'), { gain: 0.1, delay: d * 0.4, filters: [{ type: 'bandpass', f0: 3000, q: 0.6 }], pan: PT, bus: S });
      },
      impact(k) {
        [0, 0.025, 0.055].forEach((t, i) => {
          buf(variant('snap'), { gain: (1.2 - i * 0.25) * k, delay: t, rate: rj(), filters: [{ type: 'bandpass', f0: 1600, q: 1.2 }], pan: pj(PT, 0.15), bus: S });
        });
        for (let i = 0; i < 4; i++) {
          noise({ dur: 0.03, gain: 0.16 * k, type: 'highpass', f0: 2500, attack: 0.002, delay: Math.random() * 0.08, pan: pj(PT, 0.2), bus: S });
        }
        noise({ dur: 0.12, gain: 0.22 * k, type: 'bandpass', f0: 1000, f1: 2600, q: 1.5, attack: 0.01, pan: PT, bus: S }); // thorns burst up
        tone({ freq: 120, freqEnd: 48, dur: 0.25, gain: 0.22 * k, attack: 0.002, pan: PT, bus: S });
        noise({ dur: 0.15, gain: 0.07 * k, type: 'lowpass', f0: 700, attack: 0.002, pan: PT, bus: S });
        buf(variant('creakThorn'), { gain: 0.3, delay: 0.05, filters: [{ type: 'bandpass', f0: 700, q: 2.5 }], pan: PT, verb: 0.2, bus: S });
        buf(variant('rustleLong'), { gain: 0.35, delay: 0.08, filters: [{ type: 'bandpass', f0: 3000, q: 0.6 }], pan: pj(PT, 0.3), verb: 0.2, bus: S });
      },
      rite(k) {
        buf(variant('quake'), { gain: 0.35 * k, filters: [{ type: 'lowpass', f0: 180 }], verb: 0.4, bus: S });
        for (let i = 0; i < 5; i++) {
          buf(variant('snap'), { gain: 0.3, delay: 0.1 + i * 0.07 + Math.random() * 0.03, rate: rj(), filters: [{ type: 'bandpass', f0: 1400, q: 1.2 }], pan: pj(0, 0.6), verb: 0.3, bus: S });
        }
      },
    },

    ward: {
      key(p, f) {
        fm(Math.min(f * 3, 2500), { ratio: 1.41, index: 0.9, dur: 0.07, gain: 0.035 * (0.6 + 0.4 * p) * gj(), attack: 0.001, pan: pj(PC), bus: K });
      },
      choke() {
        fm(220, { ratio: 1, index: 3, dur: 0.08, gain: 0.1, attack: 0.001, pan: PC, bus: K });
      },
      fizzle() {
        buf(variant('crack'), { gain: 0.2, filters: [{ type: 'highpass', f0: 3000 }], pan: PC, bus: S });
      },
      release(k, _tier, root) {
        tone({ freq: 75, freqEnd: 52, dur: 0.5, gain: 0.16 * k, attack: 0.015, pan: PC, bus: S });
        noise({ dur: 0.2, gain: 0.06 * k, type: 'lowpass', f0: 350, attack: 0.01, pan: PC, bus: S });
        fm(root * 2, { ratio: 1.41, index: 1.6, dur: 0.9, gain: 0.05 * k, pan: PC, verb: 0.5, bus: S });
        fm(Math.min(root * 2 * 2.76, 2500), { ratio: 1.41, index: 0.8, dur: 0.5, gain: 0.015 * k, pan: PC, verb: 0.5, bus: S });
        noise({ dur: 0.35, gain: 0.035 * k, type: 'bandpass', f0: 1800, f1: 6000, q: 4, attack: 0.24, pan: PC, verb: 0.4, bus: S });
      },
      build() {},
      impact() {
        hit(false);
      },
      rite() {},
    },
  };
  const el = (school) => EL[school] || EL.arcane;

  // ------------------------------------------------------------ public voices

  /** One keystroke of an incantation: the element charging, around the next note of the school's melody. */
  function spellNote(school, tier, i, n, comboIndex = 0) {
    if (!live()) return;
    const ctx = kit.ctx;
    if (ctx.currentTime - lastNoteT < 0.012) return;
    lastNoteT = ctx.currentTime;
    const fx = fxOf(school);
    const p = (i + 1) / Math.max(1, n);
    const step = melodyStep(i, n, tier);
    const f = noteOf(school, step);
    const core = CORE[school] ?? 0.8;
    play(fx.instrument, f, { gain: core, pan: PC * 0.85, verb: 0.08, bus: K, short: true });
    if (comboIndex >= 2) play(fx.instrument, noteOf(school, step + 2), { gain: 0.35 * core, pan: PC, bus: K, short: true });
    if (comboIndex >= 4) play('glass', Math.min(f * 2, 1800), { gain: 0.22, verb: 0.25, bus: K, short: true });
    if (tier >= 3 && i % 4 === 0) play(fx.instrument, fx.root / 2, { gain: 0.3, pan: PC, bus: K, short: true });
    el(school).key(p, f);
  }

  /** A mistake: the would-be note a semitone flat, the universal thud, and the element choking. */
  function spellMisnote(school, tier, i, n) {
    if (!live()) return;
    const fx = fxOf(school);
    const f = noteOf(school, melodyStep(i, n, tier)) * Math.pow(2, -1 / 12);
    play(fx.instrument, f, { gain: 0.6, pan: PC, bus: K, short: true });
    tone({ freq: 120, freqEnd: 60, dur: 0.12, gain: 0.05, bus: K });
    el(school).choke(f);
  }

  /** The spell falls apart: three flat notes tumbling down and the element dying out. */
  function spellFizzle(school) {
    if (!live()) return;
    const fx = fxOf(school);
    [4, 2, 0].forEach((s, k) => play(fx.instrument, noteOf(school, s) * 0.97, { gain: 0.5, delay: k * 0.07, pan: PC, verb: 0.2, bus: S }));
    noise({ dur: 0.3, gain: 0.04, type: 'lowpass', f0: 800, f1: 200, attack: 0.02, bus: S });
    el(school).fizzle(fx.root);
  }

  /** Release: the element bursts from the sigil, the chord strums under it, and the spell flies to the foe. */
  function seal(school, tier = 2, { perfect = false, hits = true } = {}) {
    if (!live()) return;
    const fx = fxOf(school);
    const k = (TIER_FX[tier] || TIER_FX[2]).sound;
    const base = fx.root * (fx.root < 250 ? 2 : 1);
    const chord = sealChord(fx.scale, tier);
    const core = (CORE[school] ?? 0.8) * k;
    chord.forEach((s, j) => play(fx.instrument, base * Math.pow(2, s / 12), { gain: 0.55 * core, delay: j * 0.03, pan: PC + j * 0.08, verb: 0.3, bus: S }));
    play(fx.instrument, fx.root, { gain: 0.4 * core, pan: PC, verb: 0.2, bus: S });
    // the release sits ~2.5 dB above the keystrokes and below the impact (PLAN §15.0 rule 7)
    const kr = k * 1.33;
    el(school).release(kr, tier, fx.root);
    const tr = TRAVEL[school];
    if (hits && tr) {
      noise({ dur: 0.14, gain: tr[4] * kr, type: tr[0], f0: tr[1], f1: tr[2], q: tr[3], attack: 0.07, delay: 0.02, pan: PC, panTo: PT, panDur: 0.12, verb: 0.1, bus: S });
    }
    if (perfect) {
      let top = base * Math.pow(2, chord[chord.length - 1] / 12) * 2;
      while (top > 1800) top /= 2;
      play('glass', top, { gain: 0.6, delay: 0.12, verb: 0.4, bus: S });
      play('glass', top * 1.5, { gain: 0.5, delay: 0.16, verb: 0.4, bus: S });
    }
  }

  /** Build-up at the target, from the stamp until the hit `ms` later (PLAN §15.6). */
  function manifest(school, tier = 2, ms = 150) {
    if (!live()) return;
    const d = Math.max(0.04, ms / 1000);
    el(school).build(d, tier);
    if (tier >= 4) {
      // the breath before a Forbidden Rite: a reverse swell into the hit, everything else held back
      noise({ dur: d, gain: 0.1, type: 'lowpass', f0: 300, f1: 4000, q: 1, attack: d * 0.92, pan: PT * 0.5, verb: 0.3, bus: S });
      tone({ freq: 40, freqEnd: 60, dur: d, gain: 0.05, attack: d * 0.9, bus: S });
      duck(-14, d + 0.4, 0.4);
    }
  }

  /** The hit. `hitstopMs` delays frost's shatter until the freeze-frame ends, like the crystals. */
  function impact(school, tier = 2, { intensity = 1, crit = false, lethal = false, hitstopMs = 0 } = {}) {
    if (!live()) return;
    const fx = fxOf(school);
    const k = Math.min(1.5, 0.6 + 0.45 * intensity);
    if (tier >= 2) duck(-8, 0.25, 0.35);
    el(school).impact(k, tier, hitstopMs / 1000 + 0.03, fx.root);
    if (crit) {
      // universal "shing": same pitch in every school so it is learned once
      fm(1568, { ratio: 3.5, index: 1.5, dur: 0.6, gain: 0.035, pan: PT, verb: 0.4, bus: S });
      noise({ dur: 0.12, gain: 0.04, type: 'bandpass', f0: 5000, q: 6, attack: 0.002, pan: PT, verb: 0.3, bus: S });
      play('glass', 2093, { gain: 0.4, delay: 0.04, pan: PT, verb: 0.4, bus: S });
    }
    if (tier >= 4) el(school).rite(k, fx.root);
    if (lethal) {
      // the song resolves: a tonic cadence on the school's pitched core
      [0, 2, 4, 5].forEach((s, j) => play(fx.instrument, noteOf(school, s), { gain: 0.8, delay: 0.06 * j, verb: 0.5, bus: S }));
      tone({ freq: 60, freqEnd: 28, dur: 0.9, gain: 0.1, bus: S });
    }
  }

  /** An extra lightning bolt (storm tier III side bolts, the rite's volley): a small thunderclap. */
  function bolt({ intensity = 0.6, pan = PT } = {}) {
    if (!live()) return;
    const k = 0.5 + 0.5 * intensity;
    noise({ dur: 0.025, gain: 0.25 * k, type: 'highpass', f0: 1000, attack: 0.001, pan, bus: S });
    buf(variant('boltRip'), { gain: 0.4 * k, filters: [{ type: 'bandpass', f0: 2400, q: 0.6 }], pan, verb: 0.2, bus: S });
    buf(variant('boltRumble'), { gain: 0.25 * k, delay: 0.03, filters: [{ type: 'lowpass', f0: 300 }], pan: pan * 0.5, verb: 0.3, bus: S });
  }

  /** Something glassy breaks: an enemy barrier or your ward. */
  function shatter() {
    if (!live()) return;
    buf(variant('crack'), { gain: 0.16, rate: 1.2, filters: [{ type: 'highpass', f0: 3500 }], verb: 0.2, bus: S });
    tone({ freq: 140, freqEnd: 60, dur: 0.16, gain: 0.1, attack: 0.002, bus: S });
    buf(variant('shards2'), { gain: 0.06, delay: 0.01, verb: 0.4, bus: S });
    buf(variant('tinkles'), { gain: 0.12, delay: 0.1, filters: [{ type: 'highpass', f0: 5000 }], pan: pj(0, 0.4), verb: 0.4, bus: S });
  }

  return { spellNote, spellMisnote, spellFizzle, seal, manifest, impact, bolt, shatter };
}
