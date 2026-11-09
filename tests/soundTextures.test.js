import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { crackle, brown, rumble, roar, grains, creak } from '../src/ui/sound/textures.js';

const SR = 22050;
const rms = (d, a, b) => {
  let e = 0;
  for (let i = a; i < b; i++) e += d[i] * d[i];
  return Math.sqrt(e / Math.max(1, b - a));
};
const CASES = {
  crackle: (rand) => crackle(SR, { dur: 0.5, rate: 800, decay: 0.15, rand }),
  brown: (rand) => brown(SR, { dur: 0.5, rand }),
  rumble: (rand) => rumble(SR, { dur: 1.2, rolls: 3, rand }),
  roar: (rand) => roar(SR, { dur: 0.8, rand }),
  grains: (rand) => grains(SR, { dur: 0.5, count: 12, fLo: 1500, fHi: 6000, rand }),
  creak: (rand) => creak(SR, { dur: 0.3, f0: 30, f1: 70, rand }),
};
const DURS = { crackle: 0.5, brown: 0.5, rumble: 1.2, roar: 0.8, grains: 0.5, creak: 0.3 };

test('textures are normalised, sized and end in silence', () => {
  for (const [name, make] of Object.entries(CASES)) {
    const d = make(createRng(7).next);
    assert.equal(d.length, Math.round(DURS[name] * SR), `${name} length`);
    let peak = 0;
    for (const v of d) {
      assert.ok(Number.isFinite(v), `${name} finite`);
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 1) < 1e-6, `${name} peak ${peak}`);
    assert.equal(d[d.length - 1], 0, `${name} ends at zero`);
    // the last 4 ms are a linear fade: the last 2 ms stay under half scale
    for (let i = d.length - Math.round(SR * 0.002); i < d.length; i++) assert.ok(Math.abs(d[i]) <= 0.5 + 1e-6, `${name} fades out`);
  }
});

test('textures are deterministic for a seeded rand and vary between seeds', () => {
  for (const [name, make] of Object.entries(CASES)) {
    const a = make(createRng(42).next);
    const b = make(createRng(42).next);
    const c = make(createRng(43).next);
    assert.deepEqual(a, b, `${name} deterministic`);
    assert.notDeepEqual(a, c, `${name} varies`);
  }
});

test('crackle thins out and decaying textures decay (no drones)', () => {
  for (const seed of [1, 2, 3]) {
    const d = crackle(SR, { dur: 1, rate: 1500, decay: 0.2, rand: createRng(seed).next });
    const q = d.length >> 2;
    assert.ok(rms(d, 0, q) > 3 * rms(d, 3 * q, d.length), 'crackle is denser at the start');
    for (const name of ['rumble', 'roar', 'grains']) {
      const t = CASES[name](createRng(seed).next);
      const h = t.length >> 1;
      assert.ok(rms(t, 3 * (t.length >> 2), t.length) < rms(t, 0, h), `${name} decays`);
    }
  }
});
