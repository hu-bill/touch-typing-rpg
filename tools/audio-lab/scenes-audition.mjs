// Audition renders for the user: a tour of the six schools and the four tiers of a lightning spell.
import { castEvents } from './scenes.mjs';

function chain(parts, gap = 0.7) {
  const ev = [];
  let t = 0.3;
  for (const p of parts) {
    const c = p(t);
    ev.push(...c.ev);
    t = c.end + gap;
  }
  return { ev, end: t };
}
const fizzleAt = (s) => (t) => {
  const ev = [];
  for (let i = 0; i < 4; i++) ev.push([t + i * 0.15, 'spellNote', s, 2, i, 12, 0]);
  for (let i = 0; i < 3; i++) ev.push([t + 0.6 + i * 0.12, 'spellMisnote', s, 2, 4, 12]);
  ev.push([t + 1.0, 'spellFizzle', s]);
  return { ev, end: t + 1.8 };
};

const tour = chain([
  (t) => castEvents('fire', 2, { t, misAt: 6 }),
  (t) => castEvents('frost', 2, { t }),
  (t) => castEvents('storm', 2, { t, misAt: 4 }),
  (t) => castEvents('arcane', 2, { t }),
  (t) => castEvents('nature', 2, { t, misAt: 7 }),
  (t) => castEvents('ward', 2, { t, perfect: true }),
  fizzleAt('fire'),
  (t) => castEvents('frost', 4, { t, n: 34, key: 0.11, combo: 3, perfect: true, lethal: true }),
  (t) => castEvents('fire', 4, { t, n: 34, key: 0.11, combo: 3, crit: true, lethal: true }),
]);
const lightning = chain([
  (t) => castEvents('storm', 1, { t, n: 6 }),
  (t) => castEvents('storm', 2, { t, n: 12 }),
  (t) => castEvents('storm', 3, { t, n: 24, key: 0.13, combo: 2 }),
  (t) => castEvents('storm', 4, { t, n: 40, key: 0.11, combo: 4, crit: true, lethal: true }),
], 0.9);
const stormV15 = castEvents('storm', 2, { t: 0.3, n: 12 });

export const SCENES = [
  { name: 'tour', secs: tour.end + 0.5, events: tour.ev, px: 2400 },
  { name: 'lightning', secs: lightning.end + 0.5, events: lightning.ev, px: 2000 },
  { name: 'storm-new', secs: stormV15.end, events: stormV15.ev, px: 1100 },
];
