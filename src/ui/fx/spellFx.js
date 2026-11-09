// Spell choreography, v1.4 "Sigil & Song" (PLAN §14.6): inscribe → seal → stamp → manifest → land.
// Visuals and sound only — every rule (damage, heal, shield) lives in the combat engine.
import { SCHOOL_FX, TIER_FX } from '../../data/spellFx.js';
import { impactProfile } from '../../logic/spellFeel.js';
import { pulseClass } from '../dom.js';
import { banner } from './floaters.js';
import {
  createSigil, createStreak, createEruption, createCrystals, createCollapse, createThorns, createBloom, createBastion,
} from './sigils.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const WARD_BREAK = ['#9fb4ff', '#ffffff', '#c9b8ff'];
const ECHO_COLORS = ['#e9e0ff', '#ffffff', '#b48cff'];
const STREAK_MS = 90;

/** Where the caster sigil hangs: just in front of the wizard's hand. */
function casterAt(hand, R) {
  return { x: hand.x + R + 24, y: hand.y - 4 };
}

export function createSpellFx(game) {
  let charge = null; // { school, tier, text, n, sigil }
  let releasing = null; // the sealed caster sigil, between endCharge('release') and cast()
  let burnAcc = 0;

  const F = () => game.fx;
  const add = (layer) => F().addLayer(layer);

  function rays(at, color, n, r0, len, size, life) {
    for (let i = 0; i < n; i++) {
      F().spawn({ type: 'ray', x: at.x, y: at.y, angle: (i * TAU) / n + rand(-0.15, 0.15), r0, r1: r0 + len * 0.6, len, size, life, color });
    }
  }

  // ------------------------------------------------------------ inscription (while typing)

  function beginCharge({ school, tier, text = '', hand }) {
    if (charge) charge.sigil.dissolve(120);
    if (releasing) {
      releasing.sigil.dissolve(120);
      releasing = null;
    }
    const R = TIER_FX[tier].sigilR;
    const at = casterAt(hand, R);
    const sigil = add(createSigil({ x: at.x, y: at.y, R, school, tier, text }));
    charge = { school, tier, text, n: Math.max(1, text.length), sigil };
    if (tier >= 4) F().setVignette(0.12);
  }

  /** A correct key: carve the next rim segment and play the next note of the school's song. */
  function keystroke({ index, length, comboIndex = 0 }) {
    if (!charge) return;
    charge.sigil.setTyped(index + 1);
    // the last letter is answered by the seal chord instead of a note
    if (index + 1 < length) game.audio.spellNote(charge.school, charge.tier, index, length, comboIndex);
    if (charge.tier >= 4) F().setVignette(0.12 + 0.3 * ((index + 1) / length));
  }

  /** A mistake: crack the rim and play a sour note. */
  function misstep(index) {
    if (!charge) return;
    charge.sigil.crack(index);
    game.audio.spellMisnote(charge.school, charge.tier, index, charge.n);
  }

  /** Silent catch-up (a paused cast resumes). */
  function chargeProgress(p) {
    if (charge) charge.sigil.setTyped(Math.round(p * charge.n));
  }

  function chargeJolt() {
    if (charge) charge.sigil.crack(Math.round(charge.sigil.progress * charge.n));
  }

  /** reason: 'release' | 'fizzle' | 'cancel' | 'abort'. Always safe to call. */
  function endCharge(reason = 'abort') {
    const c = charge;
    charge = null;
    if (!c) return;
    if (reason === 'release') {
      releasing = c; // cast() seals it
      return;
    }
    if (reason === 'fizzle') {
      c.sigil.fizzle();
      game.audio.spellFizzle(c.school);
    } else {
      c.sigil.dissolve(reason === 'cancel' ? 250 : 150);
    }
    F().setVignette(0);
  }

  // ------------------------------------------------------------ self spells

  function bloomSelf({ playerAt, playerH, tier, cols, sprite, text, school }) {
    const fx = F();
    const feet = { x: playerAt.x, y: playerAt.y + playerH * 0.42 };
    const R = TIER_FX[tier].sigilR * 1.1;
    const ground = add(createSigil({ x: feet.x, y: feet.y, R, school, tier, text, inscribed: true, mode: 'ground', stampIn: true }));
    fx.after(600, () => ground.dissolve(300));
    add(createBloom({ x: playerAt.x, y: playerAt.y, R: R * 0.9, colors: cols, tier }));
    fx.burst(feet.x, feet.y - 10, { count: 20 + 10 * tier, colors: [cols[0], cols[1]], speed: 80, size: 2, life: 1.1, gravity: -160, drag: 0.96, angle: -Math.PI / 2, spread: Math.PI });
    if (tier >= 4) fx.spawn({ type: 'pillar', x: playerAt.x, y: feet.y, width: 90, life: 0.9, color: cols[0] });
    if (sprite) pulseClass(sprite, 'fx-heal', 900);
  }

  function bastionSelf({ playerAt, playerH, tier, cols, text, school }) {
    const fx = F();
    const R = Math.max(50, playerH * 0.75);
    const ring = add(createSigil({ x: playerAt.x, y: playerAt.y, R, school, tier, text, inscribed: true, alpha: 0.5, stampIn: true }));
    fx.after(500, () => ring.dissolve(350));
    add(createBastion({ x: playerAt.x, y: playerAt.y, R: R * 0.95, colors: cols, tier }));
    if (tier >= 4) {
      rays(playerAt, cols[2], 12, R * 0.6, R * 0.8, 2.5, 0.6);
      const ground = add(createSigil({ x: playerAt.x, y: playerAt.y + playerH * 0.42, R: R * 1.1, school, tier, text, inscribed: true, mode: 'ground', stampIn: true }));
      fx.after(700, () => ground.dissolve(300));
    }
  }

  // ------------------------------------------------------------ impacts

  function miniLand(at, cols) {
    F().burst(at.x, at.y, { count: 10, colors: cols, speed: 220, size: 2.6, life: 0.5 });
    F().ring(at.x, at.y, cols[0], 50, 0.4, 2);
  }

  function impactFx(school, tier, at, prof, { crit, lethal, enemySprite }) {
    const fx = F();
    const I = prof.intensity;
    const sfx = SCHOOL_FX[school] || SCHOOL_FX.arcane;
    const cols = sfx.colors;
    const [c0, c1, c2] = cols;
    fx.hitstop(prof.hitstopMs);
    fx.flash(school === 'frost' && tier >= 4 ? '#bfefff' : c1, prof.flash);
    fx.shake(prof.shake, 260 + 60 * I);
    fx.kick(8 + 10 * I, -2);
    fx.punch(prof.punch);
    fx.spawn({ type: 'flare', x: at.x, y: at.y, size: 30 + 30 * I, grow: 1.8, life: 0.3, color: c0 });
    switch (school) {
      case 'fire':
        fx.burst(at.x, at.y, { type: 'flame', count: Math.round(prof.particles * 0.5), palette: cols, speed: 260 * Math.sqrt(I), size: 5, life: 0.6, gravity: -80, drag: 0.9 });
        fx.burst(at.x, at.y, { type: 'streak', count: Math.round(12 + 10 * I), color: c1, speed: 520, size: 2, len: 16, life: 0.45, gravity: 500, drag: 0.95 });
        for (let i = 0; i < Math.round(3 + 3 * I); i++) {
          fx.spawn({ type: 'smoke', x: at.x + rand(-20, 20), y: at.y + rand(-20, 10), vx: rand(-50, 50), vy: rand(-70, -20), size: rand(10, 18), life: rand(0.8, 1.3), gravity: -20, drag: 0.95 });
        }
        fx.burst(at.x, at.y, { count: Math.round(10 + 10 * I), colors: [c1, c0], speed: 200, size: 1.6, life: 1.2, gravity: -60, drag: 0.96 });
        fx.ring(at.x, at.y, c0, 70 + 40 * I, 0.5, 6);
        if (tier >= 3) fx.after(80, () => fx.ring(at.x, at.y, c2, 110 + 50 * I, 0.6, 4));
        break;
      case 'frost':
        fx.burst(at.x, at.y, { type: 'flake', count: Math.round(8 + 8 * I), color: c1, speed: 120, size: 5, life: 1.1, gravity: 30, drag: 0.96, spin: 3 });
        rays(at, c1, 8, 16, 40 + 30 * I, 2.5, 0.45);
        fx.ring(at.x, at.y, c0, 60 + 40 * I, 0.5, 4);
        break;
      case 'storm':
        fx.burst(at.x, at.y, { type: 'streak', count: Math.round(20 + 20 * I), colors: [c0, c1], speed: 500, size: 1.8, len: 18, life: 0.35, gravity: 200, drag: 0.92 });
        fx.ring(at.x, at.y, c0, 60 + 40 * I, 0.35, 2);
        fx.arcs(at.x, at.y, 50, c0, 420);
        break;
      case 'arcane':
        rays(at, c1, 14, 10, 50 + 30 * I, 2, 0.4);
        fx.burst(at.x, at.y, { count: prof.particles, colors: [c0, c1, c0], speed: 320, size: 3, life: 0.8 });
        fx.ring(at.x, at.y, c0, 60 + 40 * I, 0.55, 4);
        break;
      case 'nature':
        fx.burst(at.x, at.y, { type: 'leaf', count: 10, colors: cols, speed: 220, size: 6, life: 0.9, gravity: 40, drag: 0.94, spin: 8 });
        fx.burst(at.x, at.y, { count: 12, color: c0, speed: 200, size: 2.4, life: 0.6 });
        break;
      default:
        fx.burst(at.x, at.y, { count: prof.particles, colors: [c0, '#ffffff', c0], speed: 300, size: 3.2, life: 0.8 });
    }
    if (crit) rays(at, '#ffe066', 10, 20, 60 + 30 * I, 3, 0.5);
    if (enemySprite) pulseClass(enemySprite, sfx.tint, school === 'frost' ? 1200 : 600);
    game.audio.impact(school, tier, { intensity: I, crit, lethal, hitstopMs: prof.hitstopMs });
  }

  /** Time from the stamp to the hit, per school (the build-up sound must end exactly on the hit, PLAN §15.6). */
  function manifestMs(school, rite) {
    if (school === 'storm') return rite ? 280 : 60;
    if (school === 'arcane') return rite ? 300 : 180;
    return { fire: 140, frost: 160, nature: 100 }[school] ?? 0;
  }

  /** Send the sealed spell to the foe: streak → stamp a sigil at the school's anchor → manifest → land. */
  function deliver(school, tier, { from, enemyAt, enemyH, R, cols, text, land }) {
    const fx = F();
    const feet = { x: enemyAt.x, y: enemyAt.y + enemyH * 0.42 };
    const sky = { x: enemyAt.x, y: Math.max(80, enemyAt.y - 145) };
    const anchor = school === 'fire' || school === 'nature' ? feet : school === 'storm' ? sky : enemyAt;
    const rite = tier >= 4;
    add(createStreak({ from, to: anchor, color: cols[0], ms: STREAK_MS }));
    const stamp = (opts) => add(createSigil({ school, tier, text, inscribed: true, stampIn: true, ...opts }));
    fx.after(STREAK_MS, () => {
      game.audio.manifest(school, tier, manifestMs(school, rite));
      switch (school) {
        case 'fire': {
          const target = stamp({ x: feet.x, y: feet.y, R: R * 1.1, mode: 'ground' });
          if (rite) {
            const high = stamp({ x: sky.x, y: sky.y, R: R * 0.9, mode: 'sky' });
            fx.spawn({ type: 'pillar', x: feet.x, y: feet.y, width: 70, life: 0.7, color: cols[0] });
            fx.after(450, () => high.dissolve(300));
          }
          add(createEruption({ x: feet.x, y: feet.y, R: R * 1.1, colors: cols, tier, mult: rite ? 1.5 : 1 }));
          if (tier === 3) {
            for (const dx of [-1, 1]) {
              fx.after(60, () => add(createEruption({ x: feet.x + dx * R * 1.05, y: feet.y, R: R * 0.45, colors: cols, tier: 1, mult: 0.7 })));
            }
          }
          fx.after(140, () => land(target));
          break;
        }
        case 'frost': {
          const target = stamp({ x: enemyAt.x, y: enemyAt.y, R: R * 1.2, alpha: 0.7 });
          if (rite) fx.setVignette(0.35, '#0b2a44');
          const crystals = add(createCrystals({ fx, x: enemyAt.x, y: enemyAt.y, count: rite ? 14 : 6 + 2 * tier, len: 40 + 15 * tier, colors: cols }));
          fx.after(160, () => {
            land(target);
            fx.after(30, () => crystals.shatter());
          });
          break;
        }
        case 'storm': {
          const target = stamp({ x: sky.x, y: sky.y, R, mode: 'sky' });
          if (rite) {
            const sides = [-110, 110].map((dx) => stamp({ x: sky.x + dx, y: sky.y + 20, R: R * 0.6, mode: 'sky' }));
            const sources = [sides[0], target, sides[1]];
            for (let i = 0; i < 4; i++) {
              fx.after(i * 70, () => {
                const hitAt = { x: enemyAt.x + rand(-60, 60), y: enemyAt.y + rand(-30, 30) };
                fx.lightning(sources[i % 3].center, hitAt, { color: cols[0], width: 2.5, branches: 3, life: 0.2 });
                miniLand(hitAt, cols);
                game.audio.bolt({ intensity: 0.6, pan: 0.2 + 0.1 * i });
              });
            }
            fx.after(280, () => {
              fx.lightning(target.center, enemyAt, { color: cols[0], width: 3 + tier, branches: 4, life: 0.3 });
              fx.ring(feet.x, feet.y, cols[0], 110, 0.45, 3);
              for (const sg of sides) sg.dissolve(300);
              land(target);
            });
          } else {
            fx.after(60, () => {
              fx.lightning(target.center, enemyAt, { color: cols[0], width: 3 + tier, branches: 1 + tier, life: 0.26 });
              fx.ring(feet.x, feet.y, cols[0], 70, 0.4, 2);
              land(target);
            });
            if (tier === 3) {
              [-90, 90].forEach((dx, i) => fx.after(100 + 40 * i, () => {
                const sg = stamp({ x: sky.x + dx, y: sky.y + 20, R: R * 0.6, mode: 'sky' });
                fx.lightning(sg.center, { x: enemyAt.x + dx * 0.3, y: enemyAt.y + rand(-20, 20) }, { color: cols[2], width: 2, branches: 2 });
                game.audio.bolt({ intensity: 0.4, pan: dx < 0 ? 0.15 : 0.55 });
                fx.after(200, () => sg.dissolve(250));
              }));
            }
          }
          break;
        }
        case 'arcane': {
          const target = stamp({ x: enemyAt.x, y: enemyAt.y, R });
          if (rite) {
            fx.setVignette(0.5);
            for (let i = 0; i < 40; i++) {
              fx.spawn({ type: 'mote', cx: enemyAt.x, cy: enemyAt.y, x: enemyAt.x, y: enemyAt.y, ang: Math.random() * TAU, rad: rand(70, 170), vang: rand(4, 8), size: rand(1.5, 3), color: cols[i % 2], life: rand(0.22, 0.3) });
            }
          }
          add(createCollapse({ x: enemyAt.x, y: enemyAt.y, R, colors: cols, ms: rite ? 300 : 180, onDone: () => land(target) }));
          break;
        }
        case 'nature': {
          const target = stamp({ x: feet.x, y: feet.y, R: R * 1.1, mode: 'ground' });
          add(createThorns({ x: feet.x, y: feet.y, R: R * 1.1, colors: cols, tier }));
          fx.after(100, () => land(target));
          break;
        }
        default:
          land(null);
      }
    });
  }

  // ------------------------------------------------------------ public

  /**
   * Play a completed cast. `hits` = the spell reaches the foe; `onImpact(profile)` fires when it lands,
   * so the screen can show numbers and update the HP bar.
   */
  function cast({ card, result, hand, playerAt, enemyAt, playerSprite, enemySprite, hits, lethal = false, dmgFrac = 0, comboIndex = 0, onImpact }) {
    const fx = F();
    const school = card.school;
    const tier = card.tier;
    const sfx = SCHOOL_FX[school] || SCHOOL_FX.arcane;
    const cols = sfx.colors;
    const s = TIER_FX[tier].scale;
    const R = TIER_FX[tier].sigilR;
    const { perfect, crit } = result;

    let caster = releasing && releasing.school === school ? releasing.sigil : null;
    if (releasing && !caster) releasing.sigil.dissolve(100);
    releasing = null;
    if (!caster) {
      const at = casterAt(hand, R);
      caster = add(createSigil({ x: at.x, y: at.y, R, school, tier, text: card.text, inscribed: true }));
    }
    caster.setTyped(card.text.length);
    caster.seal();
    fx.after(160, () => caster.dissolve(260));
    const from = caster.center;

    game.audio.seal(school, tier, { perfect, hits });
    if (playerSprite) pulseClass(playerSprite, 'thrust', 280);
    fx.spawn({ type: 'flare', x: from.x, y: from.y, size: 30 * s, grow: 2, life: 0.3, color: cols[1] });
    if (perfect) rays(from, '#ffe066', 10, R * 0.9, 24 + 10 * tier, 2, 0.4);
    if (tier >= 4) {
      banner(card.name.toUpperCase(), { color: cols[0], sub: perfect ? 'Perfect Forbidden Rite' : 'Forbidden Rite', size: 'small', duration: 1300 });
    }
    const playerH = playerSprite ? playerSprite.getBoundingClientRect().height : 120;
    if (result.heal) bloomSelf({ playerAt, playerH, tier, cols, sprite: playerSprite, text: card.text, school });
    if (result.shield) bastionSelf({ playerAt, playerH, tier, cols, text: card.text, school });
    if (!hits) {
      if (tier >= 4) fx.after(500, () => fx.setVignette(0));
      return;
    }
    const enemyH = enemySprite ? enemySprite.getBoundingClientRect().height : 120;
    const land = (target) => {
      const profile = impactProfile({ tier, crit, perfect, lethal, dmgFrac, comboIndex });
      impactFx(school, tier, enemyAt, profile, { crit, lethal, enemySprite });
      if (target) {
        target.seal();
        fx.after(140, () => target.dissolve(300));
      }
      if (tier >= 4) fx.after(profile.hitstopMs + 350, () => fx.setVignette(0));
      if (onImpact) onImpact(profile);
    };
    deliver(school, tier, { from, enemyAt, enemyH, R, cols, text: card.text, land });
  }

  /** Echo (unique): a pale copy of the spell stamps the foe again at tier-I strength. */
  function echo({ from, to, onImpact }) {
    const R = TIER_FX[1].sigilR;
    add(createStreak({ from, to, color: ECHO_COLORS[0], ms: STREAK_MS }));
    F().after(STREAK_MS, () => {
      game.audio.manifest('arcane', 1, 120);
      const target = add(createSigil({ x: to.x, y: to.y, R, school: 'arcane', tier: 1, inscribed: true, stampIn: true, colors: ECHO_COLORS, alpha: 0.8 }));
      add(createCollapse({
        x: to.x, y: to.y, R, colors: ECHO_COLORS, ms: 120,
        onDone: () => {
          const fx = F();
          const profile = impactProfile({ tier: 1 });
          fx.spawn({ type: 'flare', x: to.x, y: to.y, size: 40, grow: 1.6, life: 0.25, color: ECHO_COLORS[0] });
          fx.burst(to.x, to.y, { count: profile.particles, colors: ECHO_COLORS, speed: 280, size: 2.8, life: 0.7 });
          fx.ring(to.x, to.y, ECHO_COLORS[0], 80, 0.5, 3);
          fx.shake(profile.shake, 260);
          game.audio.impact('arcane', 1, { intensity: 0.5 });
          target.seal();
          fx.after(120, () => target.dissolve(250));
          if (onImpact) onImpact(profile);
        },
      }));
    });
  }

  /** Something glassy breaks: an enemy barrier or your ward. */
  function shatter(at, colors = WARD_BREAK) {
    F().burst(at.x, at.y, { type: 'shard', count: 24, colors, speed: 320, size: 6, life: 0.8, gravity: 700, drag: 0.97, spin: 10 });
    F().ring(at.x, at.y, colors[0], 110, 0.5, 4);
    game.audio.shatter();
  }

  /** Per-frame ambient effects: flames lick a burning enemy. */
  function tick(dt, { burning = false, enemyAt = null } = {}) {
    if (!burning || !enemyAt) {
      burnAcc = 0;
      return;
    }
    burnAcc += 18 * dt;
    const cols = SCHOOL_FX.fire.colors;
    while (burnAcc >= 1) {
      burnAcc -= 1;
      F().spawn({
        type: 'flame', x: enemyAt.x + rand(-35, 35), y: enemyAt.y + rand(0, 40), vx: rand(-15, 15), vy: rand(-90, -40),
        size: rand(4, 7), life: rand(0.4, 0.7), gravity: -100, drag: 0.95, palette: cols,
      });
    }
  }

  return {
    beginCharge, keystroke, misstep, chargeProgress, chargeJolt, endCharge, cast, echo, shatter, tick,
    get charging() {
      return !!charge;
    },
  };
}
