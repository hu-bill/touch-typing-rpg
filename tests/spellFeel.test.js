import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHOOLS } from '../src/data/spells.js';
import { SCHOOL_FX, TIER_FX, INSTRUMENTS } from '../src/data/spellFx.js';
import { impactProfile, melodyStep, scaleSemitone, sealChord, rimSegment } from '../src/logic/spellFeel.js';

test('every school has its own sigil and song', () => {
  const instruments = new Set();
  const manifests = new Set();
  for (const id of Object.keys(SCHOOLS)) {
    const fx = SCHOOL_FX[id];
    assert.ok(fx, `missing SCHOOL_FX.${id}`);
    assert.equal(fx.colors.length, 3);
    for (const c of fx.colors) assert.match(c, /^#[0-9a-f]{6}$/i);
    assert.ok(INSTRUMENTS.includes(fx.instrument), `${id} instrument ${fx.instrument}`);
    assert.ok(fx.root >= 100 && fx.root <= 500, `${id} root ${fx.root}`);
    assert.equal(fx.scale[0], 0);
    for (let i = 1; i < fx.scale.length; i++) assert.ok(fx.scale[i] > fx.scale[i - 1] && fx.scale[i] < 12, 'scales stay inside one octave');
    assert.ok(fx.seal.length > 0);
    assert.ok(fx.manifest);
    instruments.add(fx.instrument);
    manifests.add(fx.manifest);
  }
  assert.equal(instruments.size, Object.keys(SCHOOLS).length, 'instruments must differ');
  assert.equal(manifests.size, Object.keys(SCHOOLS).length, 'manifestations must differ');
  for (const t of [1, 2, 3, 4]) {
    assert.ok(TIER_FX[t], `missing TIER_FX.${t}`);
    assert.ok(TIER_FX[t].sigilR > 0 && TIER_FX[t].span > 0);
  }
});

test('impact grows with tier', () => {
  let prev = null;
  for (const tier of [1, 2, 3, 4]) {
    const p = impactProfile({ tier, dmgFrac: 0.2 });
    if (prev) {
      assert.ok(p.intensity >= prev.intensity);
      assert.ok(p.hitstopMs >= prev.hitstopMs);
      assert.ok(p.flash >= prev.flash);
      assert.ok(p.particles >= prev.particles);
    }
    prev = p;
  }
});

test('cantrips stay snappy: no hit-stop, flash or punch', () => {
  const p = impactProfile({ tier: 1, dmgFrac: 0.4, perfect: true, comboIndex: 4 });
  assert.equal(p.hitstopMs, 0);
  assert.equal(p.flash, 0);
  assert.equal(p.punch, 0);
});

test('crits and killing blows hit harder', () => {
  for (const tier of [1, 2, 3, 4]) {
    const base = impactProfile({ tier, dmgFrac: 0.2 });
    const crit = impactProfile({ tier, dmgFrac: 0.2, crit: true });
    const lethal = impactProfile({ tier, dmgFrac: 0.2, lethal: true });
    assert.ok(crit.intensity > base.intensity);
    assert.ok(crit.hitstopMs > base.hitstopMs);
    assert.ok(crit.numberSize > base.numberSize);
    assert.ok(lethal.intensity > base.intensity);
    assert.ok(lethal.hitstopMs > base.hitstopMs);
  }
});

test('damage fraction is clamped and limits hold', () => {
  assert.deepEqual(impactProfile({ tier: 3, dmgFrac: 5 }), impactProfile({ tier: 3, dmgFrac: 1 }));
  assert.deepEqual(impactProfile({ tier: 3, dmgFrac: -2 }), impactProfile({ tier: 3, dmgFrac: 0 }));
  for (const tier of [1, 2, 3, 4]) {
    for (const crit of [false, true]) {
      for (const lethal of [false, true]) {
        for (const dmgFrac of [0, 1]) {
          const p = impactProfile({ tier, crit, lethal, dmgFrac, perfect: true, comboIndex: 4 });
          assert.ok(p.flash <= 0.32, `flash ${p.flash}`);
          assert.ok(p.hitstopMs <= 220, `hitstop ${p.hitstopMs}`);
          assert.ok(p.punch <= 0.035);
          assert.ok(p.shake >= 3 && p.shake <= 18);
          assert.ok(p.intensity >= 0.4 && p.intensity <= 2.6);
        }
      }
    }
  }
});

test('the keystroke melody climbs, dances and stays in range', () => {
  for (const tier of [1, 2, 3, 4]) {
    for (const n of [3, 12, 40, 64]) {
      const steps = Array.from({ length: n }, (_, i) => melodyStep(i, n, tier));
      assert.ok(steps[n - 1] > steps[0], `tier ${tier} n ${n} must rise`);
      for (const s of steps) assert.ok(s >= 0 && s <= TIER_FX[tier].span + 3);
      if (n >= 8) assert.ok(new Set(steps.slice(0, 8)).size >= 4, 'the melody dances instead of repeating');
    }
  }
  // highest note of every school stays within two octaves (+2 semitones) of its root
  for (const fx of Object.values(SCHOOL_FX)) {
    const top = scaleSemitone(fx.scale, TIER_FX[4].span + 3);
    assert.ok(top <= 26, `top note ${top} semitones`);
  }
});

test('scale steps wrap into octaves', () => {
  assert.equal(scaleSemitone([0, 3, 5, 7, 10], 5), 12);
  assert.equal(scaleSemitone([0, 3, 5, 7, 10], 7), 17);
  assert.equal(scaleSemitone([0, 3, 5, 7, 10], 0), 0);
});

test('seal chord is an ascending strum that grows with tier', () => {
  for (const fx of Object.values(SCHOOL_FX)) {
    for (const tier of [1, 2, 3, 4]) {
      const c = sealChord(fx.scale, tier);
      assert.equal(c.length, 2 + tier);
      assert.equal(c[0], 0);
      for (let i = 1; i < c.length; i++) assert.ok(c[i] > c[i - 1]);
    }
  }
});

test('rim segments tile the circle clockwise from 12 o\'clock', () => {
  const n = 17;
  assert.equal(rimSegment(0, n).a0, -Math.PI / 2);
  for (let i = 0; i < n - 1; i++) assert.ok(Math.abs(rimSegment(i, n).a1 - rimSegment(i + 1, n).a0) < 1e-12);
  assert.ok(Math.abs(rimSegment(n - 1, n).a1 - (Math.PI * 1.5)) < 1e-12);
});
