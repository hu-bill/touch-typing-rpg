// Spell sound rules (PLAN §15.7), checked against a recording mock of the WebAudio graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/ui/audio.js';
import { SCHOOLS } from '../src/data/spells.js';

class Param {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(v, t) {
    this.events.push(['set', v, t]);
    return this;
  }
  linearRampToValueAtTime(v, t) {
    this.events.push(['lin', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError(`exponential ramp to ${v}`);
    this.events.push(['exp', v, t]);
    return this;
  }
  setTargetAtTime(v, t, c) {
    this.events.push(['target', v, t, c]);
    return this;
  }
  cancelScheduledValues(t) {
    this.events.push(['cancel', 0, t]);
    return this;
  }
}

class MockNode {
  constructor(ctx, kind, params = {}) {
    this.ctx = ctx;
    this.kind = kind;
    this.outs = [];
    for (const [k, v] of Object.entries(params)) this[k] = new Param(v);
    ctx.nodes.push(this);
  }
  connect(dest) {
    this.outs.push(dest);
    return dest;
  }
  disconnect() {
    this.outs = [];
  }
}

class MockSource extends MockNode {
  start(t = this.ctx.currentTime) {
    this.startT = t;
  }
  stop(t) {
    this.stopT = t;
  }
}

class MockContext {
  constructor() {
    this.nodes = [];
    this.currentTime = 0;
    this.sampleRate = 22050;
    this.state = 'running';
    this.destination = new MockNode(this, 'destination');
  }
  createGain() {
    return new MockNode(this, 'gain', { gain: 1 });
  }
  createOscillator() {
    const o = new MockSource(this, 'osc', { frequency: 440, detune: 0 });
    o.type = 'sine';
    return o;
  }
  createBufferSource() {
    const s = new MockSource(this, 'buffer', { playbackRate: 1 });
    s.buffer = null;
    s.loop = false;
    return s;
  }
  createBiquadFilter() {
    const f = new MockNode(this, 'biquad', { frequency: 350, Q: 1, gain: 0 });
    f.type = 'lowpass';
    return f;
  }
  createStereoPanner() {
    return new MockNode(this, 'panner', { pan: 0 });
  }
  createWaveShaper() {
    return new MockNode(this, 'shaper');
  }
  createConvolver() {
    return new MockNode(this, 'convolver');
  }
  createDynamicsCompressor() {
    return new MockNode(this, 'compressor', { threshold: -24, ratio: 12, knee: 30, attack: 0.003, release: 0.25 });
  }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => data[c] };
  }
}

/** True if `node` reaches the destination through node → node connections (an AudioParam input is not "heard"). */
function audible(node, seen = new Set()) {
  if (node.kind === 'destination') return true;
  if (seen.has(node)) return false;
  seen.add(node);
  return node.outs.some((o) => o instanceof MockNode && audible(o, seen));
}

function setup() {
  const ctx = new MockContext();
  const audio = createAudio({ makeContext: () => ctx });
  audio.unlock();
  audio.setVolume(0.6);
  return { ctx, audio };
}

/** Run fn and return the nodes it created. */
function created(ctx, fn) {
  const before = ctx.nodes.length;
  fn();
  return ctx.nodes.slice(before);
}

const SCHOOL_IDS = Object.keys(SCHOOLS);
const TIERS = [1, 2, 3, 4];

function everySpellSound(audio, ctx, visit) {
  for (const s of SCHOOL_IDS) {
    for (const t of TIERS) {
      const calls = {
        note: () => audio.spellNote(s, t, 3, 12, 4),
        misnote: () => audio.spellMisnote(s, t, 3, 12),
        fizzle: () => audio.spellFizzle(s),
        seal: () => audio.seal(s, t, { perfect: true, hits: s !== 'ward' }),
        manifest: () => audio.manifest(s, t, 180),
        impact: () => audio.impact(s, t, { intensity: 2.6, crit: true, lethal: true, hitstopMs: 220 }),
      };
      for (const [name, fn] of Object.entries(calls)) {
        ctx.currentTime += 0.5; // keep the spellNote rate limit from swallowing calls
        visit(`${s} t${t} ${name}`, created(ctx, fn), name);
      }
    }
  }
  ctx.currentTime += 0.5;
  visit('bolt', created(ctx, () => audio.bolt({ intensity: 0.6, pan: 0.3 })), 'bolt');
  visit('shatter', created(ctx, () => audio.shatter()), 'shatter');
}

test('every spell sound plays for every school and tier without errors', () => {
  const { ctx, audio } = setup();
  let total = 0;
  everySpellSound(audio, ctx, (label, nodes, kind) => {
    // a ward never reaches the foe, so below tier IV it has no build-up at a target
    if (/^ward t[123] manifest/.test(label)) return;
    assert.ok(nodes.length > 0, `${label} made no sound`);
    total += nodes.length;
  });
  assert.ok(total > 1000);
});

test('no drones: every voice ends by itself, keystrokes within 0.35 s', () => {
  const { ctx, audio } = setup();
  everySpellSound(audio, ctx, (label, nodes, kind) => {
    for (const n of nodes) {
      if (!(n instanceof MockSource)) continue;
      assert.ok(n.startT != null && n.stopT != null, `${label}: a ${n.kind} source was never started and stopped`);
      const len = n.stopT - n.startT;
      assert.ok(len <= 2.5, `${label}: a ${n.kind} source runs ${len.toFixed(2)} s`);
      if (kind === 'note' || kind === 'misnote') assert.ok(len <= 0.35, `${label}: keystroke voice runs ${len.toFixed(2)} s`);
    }
  });
});

test('no raw sawtooth or square is ever heard in a spell (they may only modulate)', () => {
  const { ctx, audio } = setup();
  everySpellSound(audio, ctx, (label, nodes) => {
    for (const n of nodes) {
      if (n.kind === 'osc' && (n.type === 'sawtooth' || n.type === 'square')) {
        assert.ok(!audible(n), `${label}: an audible ${n.type} oscillator`);
      }
    }
  });
});

test('a keystroke stays cheap', () => {
  const { ctx, audio } = setup();
  for (const s of SCHOOL_IDS) {
    ctx.currentTime += 0.5;
    // worst case: tier IV heartbeat on i = 0 with the top combo layers
    const nodes = created(ctx, () => audio.spellNote(s, 4, 0, 40, 4));
    assert.ok(nodes.length <= 40, `${s}: ${nodes.length} nodes per keystroke`);
  }
});

test('ducking always returns the keystroke bus to full level', () => {
  const { ctx, audio } = setup();
  const g = audio.buses.keys.gain;
  for (const s of ['fire', 'storm', 'arcane']) {
    ctx.currentTime += 1;
    audio.manifest(s, 4, 300); // rite: deep duck
    ctx.currentTime += 0.3;
    audio.impact(s, 4, { intensity: 2 }); // impact duck lands inside it
    const targets = g.events.filter((e) => e[0] === 'target');
    const last = targets[targets.length - 1];
    assert.equal(last[1], 1, 'last automation goes back to 1');
    const deepest = Math.min(...targets.map((e) => e[1]));
    assert.ok(deepest < 0.25, 'a rite ducks the keys at least 12 dB');
  }
});
