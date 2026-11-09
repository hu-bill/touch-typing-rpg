// Look and sound of each school, and the scale of each tier (PLAN §14). UI reads these; tests check them.
// colors = [main, highlight (near white), deep].
// seal = sigil geometry layers in unit radius, drawn in order. shapes: poly{n,r,rot°} · star{n,k,r} (n/k star polygon)
//   · spokes{n,r0,r1,rot°,branch} · petals{n,r} · eye{r} · ring{r}
// instrument/root/scale = the song a cast plays: one note per keystroke, climbing the scale (the pitched core
//   under each element's sound, PLAN §15).
export const SCHOOL_FX = {
  arcane: {
    colors: ['#b48cff', '#efe4ff', '#7b4dff'], tint: 'fx-arcane', manifest: 'collapse',
    seal: [{ shape: 'star', n: 7, k: 3, r: 0.66 }, { shape: 'eye', r: 0.34 }, { shape: 'ring', r: 0.12 }],
    instrument: 'bell', root: 293.66, scale: [0, 2, 3, 7, 8], // D4 · hirajoshi
  },
  fire: {
    colors: ['#ff7a3d', '#ffd166', '#ff3d2e'], tint: 'fx-burn', manifest: 'eruption',
    seal: [{ shape: 'poly', n: 3, r: 0.66, rot: -90 }, { shape: 'poly', n: 3, r: 0.4, rot: 90 }, { shape: 'spokes', n: 3, r0: 0.12, r1: 0.66, rot: -90 }],
    instrument: 'flame', root: 130.81, scale: [0, 3, 5, 7, 10], // C3 · minor pentatonic
  },
  frost: {
    colors: ['#7fd8ff', '#effbff', '#3fa9ff'], tint: 'fx-frost', manifest: 'crystallize',
    seal: [{ shape: 'poly', n: 6, r: 0.64, rot: -90 }, { shape: 'spokes', n: 6, r0: 0.1, r1: 0.64, rot: -90, branch: true }, { shape: 'poly', n: 6, r: 0.3, rot: 0 }],
    instrument: 'glass', root: 440, scale: [0, 4, 6, 7, 11], // A4 · lydian colours
  },
  storm: {
    colors: ['#ffe066', '#ffffff', '#8fd3ff'], tint: 'fx-shock', manifest: 'judgement',
    seal: [{ shape: 'star', n: 8, k: 3, r: 0.66 }, { shape: 'poly', n: 4, r: 0.3, rot: 45 }, { shape: 'spokes', n: 4, r0: 0.3, r1: 0.48, rot: 0 }],
    instrument: 'zap', root: 220, scale: [0, 2, 3, 7, 9], // A3 · kumoi
  },
  nature: {
    colors: ['#7dffa1', '#e2ffc4', '#ff9ad5'], tint: 'fx-heal', manifest: 'bloom',
    seal: [{ shape: 'petals', n: 5, r: 0.62 }, { shape: 'star', n: 5, k: 2, r: 0.36 }, { shape: 'ring', r: 0.12 }],
    instrument: 'kalimba', root: 329.63, scale: [0, 2, 4, 7, 9], // E4 · major pentatonic
  },
  ward: {
    colors: ['#9fb4ff', '#ffffff', '#c9b8ff'], tint: 'fx-ward', manifest: 'bastion',
    seal: [{ shape: 'poly', n: 4, r: 0.66, rot: 0 }, { shape: 'poly', n: 4, r: 0.66, rot: 45 }, { shape: 'ring', r: 0.4 }, { shape: 'poly', n: 4, r: 0.28, rot: 45 }],
    instrument: 'vibes', root: 174.61, scale: [0, 2, 4, 7, 11], // F3 · major 9 / maj7 colours
  },
};

// pitched cores of the keystroke melody (PLAN §15.3); the element layers live in ui/sound/spellVoices.js
export const INSTRUMENTS = ['bell', 'flame', 'glass', 'zap', 'kalimba', 'vibes'];

// scale: size multiplier · intensity: base impact strength · extra: decorative extras · sound: gain multiplier
// sigilR: caster sigil radius (px) · span: scale steps the keystroke melody climbs over a whole incantation
export const TIER_FX = {
  1: { scale: 1.0, intensity: 0.5, hitstopMs: 0, flash: 0, punch: 0, extra: 0, sound: 0.75, sigilR: 40, span: 5 },
  2: { scale: 1.25, intensity: 0.8, hitstopMs: 45, flash: 0.08, punch: 0.006, extra: 0, sound: 1.0, sigilR: 52, span: 6 },
  3: { scale: 1.6, intensity: 1.1, hitstopMs: 70, flash: 0.14, punch: 0.012, extra: 2, sound: 1.2, sigilR: 64, span: 7 },
  4: { scale: 2.1, intensity: 1.5, hitstopMs: 110, flash: 0.22, punch: 0.022, extra: 0, sound: 1.45, sigilR: 80, span: 7 },
};
