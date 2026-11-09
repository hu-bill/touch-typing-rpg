// Sigil-style drawables (PLAN §14.4): inscribed magic circles and the manifestations that erupt from them.
// Every drawable is an fx layer: { update(dt) → alive, draw(g) }, drawn with additive blending.
import { SCHOOL_FX, TIER_FX } from '../../data/spellFx.js';
import { rimSegment } from '../../logic/spellFeel.js';
import { rgba } from './color.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - (1 - t) ** 3;

// ------------------------------------------------------------ geometry (unit radius)

function circlePts(r, n = 48, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i * TAU) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function polyPts(n, r, rotDeg = -90) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = rotDeg * DEG + (i * TAU) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function starPts(n, k, r) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (((i * k) % n) * TAU) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function quad(p0, c, p1, steps = 10) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

/** One seal layer spec → array of polylines. */
function shapeLines(spec) {
  const { shape, r = 0.6 } = spec;
  if (shape === 'ring') return [circlePts(r)];
  if (shape === 'poly') return [polyPts(spec.n, r, spec.rot ?? -90)];
  if (shape === 'star') return [starPts(spec.n, spec.k, r)];
  if (shape === 'spokes') {
    const lines = [];
    for (let i = 0; i < spec.n; i++) {
      const a = (spec.rot ?? -90) * DEG + (i * TAU) / spec.n;
      const d = [Math.cos(a), Math.sin(a)];
      lines.push([[d[0] * spec.r0, d[1] * spec.r0], [d[0] * spec.r1, d[1] * spec.r1]]);
      if (spec.branch) {
        const m = spec.r0 + (spec.r1 - spec.r0) * 0.6;
        const pm = [d[0] * m, d[1] * m];
        for (const s of [-0.6, 0.6]) lines.push([pm, [pm[0] + Math.cos(a + s) * 0.14, pm[1] + Math.sin(a + s) * 0.14]]);
      }
    }
    return lines;
  }
  if (shape === 'petals') {
    const lines = [];
    for (let i = 0; i < spec.n; i++) {
      const a = -Math.PI / 2 + (i * TAU) / spec.n;
      const tip = [Math.cos(a) * r, Math.sin(a) * r];
      const cl = [Math.cos(a - 0.45) * r * 0.7, Math.sin(a - 0.45) * r * 0.7];
      const cr = [Math.cos(a + 0.45) * r * 0.7, Math.sin(a + 0.45) * r * 0.7];
      lines.push([...quad([0, 0], cl, tip), ...quad(tip, cr, [0, 0]).slice(1)]);
    }
    return lines;
  }
  if (shape === 'eye') {
    const upper = quad([-r, 0], [0, -0.75 * r], [r, 0], 14);
    const lower = quad([r, 0], [0, 0.75 * r], [-r, 0], 14);
    return [[...upper, ...lower.slice(1)], circlePts(r * 0.38, 24)];
  }
  return [];
}

function measure(lines) {
  return lines.map((pts) => {
    const cum = [0];
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      cum.push(len);
    }
    return { pts, cum, len };
  });
}

const sealCache = new Map();
/** Seal geometry of a school, measured for partial stroking (cached). */
export function sealPaths(school) {
  let geo = sealCache.get(school);
  if (!geo) {
    const fx = SCHOOL_FX[school] || SCHOOL_FX.arcane;
    geo = fx.seal.map((spec) => {
      const lines = measure(shapeLines(spec));
      return { lines, total: lines.reduce((a, l) => a + l.len, 0) };
    });
    sealCache.set(school, geo);
  }
  return geo;
}

/** Add the first `frac` of a layer's total length to the current path; P maps unit coords to screen. */
function tracePartial(g, layer, frac, P) {
  if (frac <= 0) return;
  let budget = layer.total * Math.min(1, frac);
  for (const ln of layer.lines) {
    if (budget <= 0) break;
    const { pts, cum } = ln;
    g.moveTo(...P(pts[0][0], pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] <= budget) {
        g.lineTo(...P(pts[i][0], pts[i][1]));
      } else {
        const t = (budget - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
        g.lineTo(...P(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t));
        break;
      }
    }
    budget -= ln.len;
  }
}

function traceArc(g, P, r, a0, a1) {
  const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.08));
  g.moveTo(...P(Math.cos(a0) * r, Math.sin(a0) * r));
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    g.lineTo(...P(Math.cos(a) * r, Math.sin(a) * r));
  }
}

/** Glowing stroke of the current path: wide school-coloured glow, coloured line, thin hot core. */
function glowStroke(g, main, core, alpha, wGlow = 5, wCore = 1.5) {
  if (alpha <= 0) return;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = alpha * 0.28;
  g.strokeStyle = main;
  g.lineWidth = wGlow;
  g.stroke();
  g.globalAlpha = Math.min(1, alpha * 0.85);
  g.lineWidth = wCore + 0.8;
  g.stroke();
  g.globalAlpha = Math.min(1, alpha * 0.9);
  g.strokeStyle = core;
  g.lineWidth = Math.max(0.6, wCore * 0.5);
  g.stroke();
}

// ------------------------------------------------------------ the sigil

/**
 * A magic circle. Front sigils are inscribed letter by letter while the player types; stamped target
 * sigils are created `inscribed`. mode: 'front' (faces the viewer) | 'ground' | 'sky' (flattened).
 */
export function createSigil({ x, y, R, school, tier = 1, text = '', mode = 'front', inscribed = false, alpha = 1, colors = null, stampIn = false }) {
  const fx = SCHOOL_FX[school] || SCHOOL_FX.arcane;
  const [c0, c1] = colors || fx.colors;
  const n = Math.max(1, text.length || 24);
  const geo = sealPaths(school);
  const sy = mode === 'front' ? 1 : 0.34;
  const fontPx = Math.round(Math.max(7, Math.min(15, ((TAU * 0.885 * R) / n) * 1.15)));
  const born = new Float32Array(n).fill(inscribed ? -10 : -1);
  const S = {
    t: 0, typed: inscribed ? n : 0, spin: Math.random() * TAU, spinV: 0, rimRot: 0,
    flashT: 0, shakeT: 0, redT: 0, pulseT: 0, dissolveT: -1, dissolveDur: 1, fizzleT: -1, pieces: null,
  };
  const cracks = [];

  const api = {
    x, y, R, mode,
    get center() {
      return { x: api.x, y: api.y };
    },
    get progress() {
      return S.typed / n;
    },
    get dying() {
      return S.dissolveT >= 0 || S.fizzleT >= 0;
    },
    setTyped(k) {
      const to = Math.max(0, Math.min(n, k));
      for (let i = S.typed; i < to; i++) born[i] = S.t;
      S.typed = to;
    },
    crack(i) {
      const idx = Math.max(0, Math.min(n - 1, i));
      cracks.push({ i: idx, jag: [rand(-0.05, 0.05), rand(-0.07, 0.07), rand(-0.05, 0.05)] });
      S.shakeT = 0.22;
      S.redT = 0.15;
    },
    seal() {
      S.flashT = 0.3;
      S.pulseT = 0.3;
      S.spinV += 9;
    },
    dissolve(ms = 250) {
      if (S.dissolveT >= 0 || S.fizzleT >= 0) return;
      S.dissolveT = 0;
      S.dissolveDur = Math.max(0.05, ms / 1000);
    },
    fizzle() {
      if (S.fizzleT >= 0) return;
      S.fizzleT = 0;
      S.pieces = Array.from({ length: n }, () => ({ vx: rand(-80, 80), vy: rand(-60, 0), vr: rand(-4, 4) }));
    },
    update(dt) {
      S.t += dt;
      const p = S.typed / n;
      S.spinV += -S.spinV * Math.min(1, dt * 3);
      S.spin += (0.25 + 1.2 * p + S.spinV) * dt;
      S.rimRot -= 0.15 * dt;
      S.flashT = Math.max(0, S.flashT - dt);
      S.shakeT = Math.max(0, S.shakeT - dt);
      S.redT = Math.max(0, S.redT - dt);
      S.pulseT = Math.max(0, S.pulseT - dt);
      if (S.dissolveT >= 0) {
        S.dissolveT += dt;
        if (S.dissolveT >= S.dissolveDur) return false;
      }
      if (S.fizzleT >= 0) {
        S.fizzleT += dt;
        if (S.fizzleT >= 0.7) return false;
      }
      return true;
    },
    draw(g) {
      const p = S.typed / n;
      const intro = easeOut(clamp01(S.t / 0.18));
      let k = stampIn ? 1.6 - 0.6 * intro : 0.6 + 0.4 * intro;
      let a = alpha * intro;
      if (S.pulseT > 0) k *= 1 + 0.12 * Math.sin((1 - S.pulseT / 0.3) * Math.PI);
      if (S.dissolveT >= 0) {
        const d = S.dissolveT / S.dissolveDur;
        k *= 1 + 0.15 * d;
        a *= 1 - d;
      }
      if (a <= 0.01) return;
      const fz = S.fizzleT;
      const cx = api.x + (S.shakeT > 0 ? rand(-3, 3) : 0);
      const cy = api.y + (S.shakeT > 0 ? rand(-3, 3) : 0);
      const Rk = R * k;
      const flash = S.flashT / 0.3;
      const red = S.redT > 0 || fz >= 0;
      const main = red ? '#ff4d5e' : c0;
      const core = flash > 0 ? '#ffffff' : red ? '#ffb3bb' : c1;
      const P = (ux, uy) => [cx + ux * Rk, cy + uy * Rk * sy];
      const rot = (ang) => (ux, uy) => {
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        return P(ux * c - uy * s, ux * s + uy * c);
      };
      const geoA = fz >= 0 ? a * Math.max(0, 1 - fz / 0.25) : a;

      // centre glow
      if (geoA > 0) {
        const gr = Math.max(1, 0.32 * Rk);
        g.save();
        g.translate(cx, cy);
        g.scale(1, sy);
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, gr);
        grd.addColorStop(0, rgba(c1, (0.1 + 0.45 * p + 0.4 * flash) * geoA));
        grd.addColorStop(1, rgba(c0, 0));
        g.globalAlpha = 1;
        g.fillStyle = grd;
        g.beginPath();
        g.arc(0, 0, gr, 0, TAU);
        g.fill();
        g.restore();
      }

      // guide ring: the empty circle you are about to fill
      g.beginPath();
      traceArc(g, P, 1, 0, TAU);
      g.globalAlpha = a * 0.16 * (fz >= 0 ? 0 : 1);
      g.strokeStyle = c0;
      g.lineWidth = 1;
      g.stroke();

      // rim segments (fresh ones flash white)
      const fall = (i) => {
        if (fz < 0) return [0, 0];
        const pc = S.pieces[i];
        return [pc.vx * fz, pc.vy * fz + 300 * fz * fz];
      };
      const rr = S.rimRot;
      if (fz < 0) {
        g.beginPath();
        for (let i = 0; i < S.typed; i++) {
          if (S.t - born[i] < 0.15) continue;
          const sg = rimSegment(i, n);
          traceArc(g, P, 1, sg.a0 + rr, sg.a1 + rr);
        }
        glowStroke(g, main, core, a, 5 + 3 * flash, 1.6 + flash);
        g.beginPath();
        for (let i = 0; i < S.typed; i++) {
          if (S.t - born[i] >= 0.15) continue;
          const sg = rimSegment(i, n);
          traceArc(g, P, 1, sg.a0 + rr, sg.a1 + rr);
        }
        glowStroke(g, c1, '#ffffff', a, 9, 2.4);
      } else {
        const fa = a * Math.max(0, 1 - fz / 0.7);
        for (let i = 0; i < S.typed; i++) {
          const [dx, dy] = fall(i);
          const sg = rimSegment(i, n);
          g.beginPath();
          traceArc(g, (ux, uy) => { const q = P(ux, uy); return [q[0] + dx, q[1] + dy]; }, 1, sg.a0 + rr, sg.a1 + rr);
          glowStroke(g, '#ff4d5e', '#ffb3bb', fa, 4, 1.4);
        }
      }

      // letters on the rim
      if (S.typed > 0) {
        g.font = `700 ${fontPx}px "JetBrains Mono", monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = fz >= 0 ? '#ff8a96' : core;
        const la = fz >= 0 ? a * Math.max(0, 1 - fz / 0.6) : a * 0.92;
        for (let i = 0; i < S.typed; i++) {
          const sg = rimSegment(i, n);
          const ang = sg.mid + rr;
          const [dx, dy] = fall(i);
          const [px, py] = P(Math.cos(ang) * 0.885, Math.sin(ang) * 0.885);
          const ch = text[i];
          g.globalAlpha = S.t - born[i] < 0.15 ? Math.min(1, la * 1.3) : la;
          if (!ch || ch === ' ') {
            g.beginPath();
            g.arc(px + dx, py + dy, 1.5, 0, TAU);
            g.fill();
            continue;
          }
          g.save();
          g.translate(px + dx, py + dy);
          if (sy !== 1) g.scale(1, sy);
          g.rotate(ang + Math.PI / 2 + (fz >= 0 ? S.pieces[i].vr * fz : 0));
          g.fillText(ch, 0, 0);
          g.restore();
        }
      }

      if (geoA > 0) {
        // inner rim ring
        const inner = Math.min(1, 2 * p);
        if (inner > 0) {
          g.beginPath();
          traceArc(g, P, 0.78, -Math.PI / 2 - rr, -Math.PI / 2 - rr + TAU * inner);
          glowStroke(g, main, core, geoA * 0.8, 4, 1.1);
        }
        // tier frame
        if (tier >= 2) {
          const ticks = Math.floor(24 * p);
          g.beginPath();
          for (let i = 0; i < ticks; i++) {
            const ang = -Math.PI / 2 + (i * TAU) / 24 - rr * 0.5;
            g.moveTo(...P(Math.cos(ang) * 1.02, Math.sin(ang) * 1.02));
            g.lineTo(...P(Math.cos(ang) * 1.08, Math.sin(ang) * 1.08));
          }
          glowStroke(g, main, core, geoA * 0.8, 3, 1);
        }
        if (tier >= 3) {
          g.beginPath();
          for (let j = 0; j < 6; j++) {
            if (p <= j / 6) continue;
            const ang = (j * TAU) / 6 + S.t * 0.3;
            const ox = Math.cos(ang) * 1.2;
            const oy = Math.sin(ang) * 1.2;
            const pts = circlePts(0.09, 16, ox, oy);
            g.moveTo(...P(pts[0][0], pts[0][1]));
            for (let q = 1; q < pts.length; q++) g.lineTo(...P(pts[q][0], pts[q][1]));
          }
          glowStroke(g, main, core, geoA * 0.85, 4, 1.2);
        }
        if (tier >= 4) {
          g.beginPath();
          const dash = TAU / 18;
          for (let i = 0; i < 18; i++) {
            const a0 = i * dash + S.t * 0.6;
            traceArc(g, P, 1.32, a0, a0 + dash * 0.6);
          }
          glowStroke(g, main, core, geoA * p, 4, 1.2);
        }
        // seal geometry, layer by layer
        const L = geo.length;
        const spinP = rot(S.spin);
        for (let j = 0; j < L; j++) {
          const frac = clamp01((p * (L + 1) - j) / 2);
          if (frac <= 0) continue;
          g.beginPath();
          tracePartial(g, geo[j], frac, spinP);
          glowStroke(g, main, core, geoA, 5 + 3 * flash, 1.5 + flash);
        }
      }

      // cracks
      if (cracks.length && fz < 0) {
        g.beginPath();
        for (const c of cracks) {
          const ang = rimSegment(c.i, n).mid + rr;
          const tx = -Math.sin(ang);
          const ty = Math.cos(ang);
          const radii = [0.72, 0.86, 0.98, 1.1];
          radii.forEach((r, q) => {
            const off = q === 0 || q === 3 ? 0 : c.jag[q - 1];
            const pt = P(Math.cos(ang) * r + tx * off, Math.sin(ang) * r + ty * off);
            if (q === 0) g.moveTo(...pt);
            else g.lineTo(...pt);
          });
        }
        glowStroke(g, '#ff4d5e', '#ff8a96', a, 5, 2);
      }
    },
  };
  return api;
}

// ------------------------------------------------------------ transfer streak

export function createStreak({ from, to, color, core = '#ffffff', ms = 90 }) {
  const dur = ms / 1000;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      return t < dur * 1.5;
    },
    draw(g) {
      const head = clamp01(t / dur);
      const tail = clamp01((t - dur * 0.4) / dur);
      if (head <= tail) return;
      const hx = from.x + (to.x - from.x) * easeOut(head);
      const hy = from.y + (to.y - from.y) * easeOut(head);
      const tx = from.x + (to.x - from.x) * easeOut(tail);
      const ty = from.y + (to.y - from.y) * easeOut(tail);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(hx, hy);
      glowStroke(g, color, core, 1, 8, 2.2);
      if (head < 1) {
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        g.beginPath();
        g.moveTo(hx + c * 7, hy + s * 7);
        g.lineTo(hx - s * 3.5, hy + c * 3.5);
        g.lineTo(hx - c * 4, hy - s * 4);
        g.lineTo(hx + s * 3.5, hy - c * 3.5);
        g.closePath();
        g.globalAlpha = 1;
        g.fillStyle = core;
        g.fill();
      }
    },
  };
}

// ------------------------------------------------------------ manifestations

/** Fire: flame tongues standing on a ground sigil. */
export function createEruption({ x, y, R, colors, tier, mult = 1 }) {
  const [c0, c1, c2] = colors;
  const s = TIER_FX[tier].scale * mult;
  const count = Math.round((7 + 3 * tier) * Math.min(1.5, mult));
  const tongues = Array.from({ length: count }, () => ({
    dx: rand(-0.8, 0.8) * R, h: rand(60, 110) * s, w: rand(10, 18) * Math.min(1.6, s), delay: rand(0, 0.08), ph: rand(0, TAU),
  }));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      return t < 0.85;
    },
    draw(g) {
      for (const tg of tongues) {
        const lt = t - tg.delay;
        if (lt <= 0) continue;
        const rise = easeOut(clamp01(lt / 0.14));
        const fade = lt < 0.35 ? 1 : clamp01(1 - (lt - 0.35) / 0.4);
        if (fade <= 0) continue;
        const hh = tg.h * rise * (0.75 + 0.25 * fade) * (1 + 0.08 * Math.sin(lt * 30 + tg.ph));
        const bx = x + tg.dx;
        const by = y + (tg.dx / R) * 4;
        const tipX = bx + Math.sin(lt * 14 + tg.ph) * tg.w * 0.6;
        const tipY = by - hh;
        const grd = g.createLinearGradient(0, by, 0, tipY);
        grd.addColorStop(0, rgba(c1, 0.9 * fade));
        grd.addColorStop(0.45, rgba(c0, 0.7 * fade));
        grd.addColorStop(1, rgba(c2, 0));
        g.globalAlpha = 1;
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(bx - tg.w / 2, by);
        g.quadraticCurveTo(bx - tg.w * 0.6, by - hh * 0.55, tipX, tipY);
        g.quadraticCurveTo(bx + tg.w * 0.6, by - hh * 0.55, bx + tg.w / 2, by);
        g.closePath();
        g.fill();
      }
    },
  };
}

/** Frost: hexagonal ice prisms grow out of the foe, then shatter into shards. */
export function createCrystals({ fx, x, y, count, len, colors }) {
  const [c0, c1, c2] = colors;
  const crystals = Array.from({ length: count }, (_, i) => {
    const L = len * rand(0.7, 1.2);
    return { a: -Math.PI / 2 + (i / count) * TAU + rand(-0.2, 0.2), L, w: 0.22 * L };
  });
  let t = 0;
  let done = false;
  const api = {
    shatter() {
      if (done) return;
      done = true;
      for (const c of crystals) {
        for (let k = 0; k < 4; k++) {
          const d = 10 + (c.L * (k + 0.5)) / 4;
          const sp = rand(120, 300);
          fx.spawn({
            type: 'shard', x: x + Math.cos(c.a) * d, y: y + Math.sin(c.a) * d,
            vx: Math.cos(c.a) * sp + rand(-60, 60), vy: Math.sin(c.a) * sp - rand(0, 80),
            size: rand(4, 8), life: rand(0.5, 0.9), color: [c0, c1, c2][k % 3], gravity: 700, drag: 0.97, rot: rand(0, TAU), vr: rand(-10, 10),
          });
        }
      }
    },
    update(dt) {
      t += dt;
      if (!done && t >= 0.9) api.shatter();
      return !done;
    },
    draw(g) {
      const grow = easeOut(clamp01(t / 0.16));
      g.lineJoin = 'round';
      for (const c of crystals) {
        const L = c.L * grow;
        const w = c.w * Math.min(1, grow * 1.5);
        const r0 = 10;
        const cs = Math.cos(c.a);
        const sn = Math.sin(c.a);
        const pt = (u, v) => [x + cs * u - sn * v, y + sn * u + cs * v];
        g.beginPath();
        g.moveTo(...pt(r0, -w / 2));
        g.lineTo(...pt(r0 + 0.75 * L, -w / 2));
        g.lineTo(...pt(r0 + L, 0));
        g.lineTo(...pt(r0 + 0.75 * L, w / 2));
        g.lineTo(...pt(r0, w / 2));
        g.closePath();
        g.globalAlpha = 1;
        g.fillStyle = rgba(c0, 0.22);
        g.fill();
        glowStroke(g, c0, c1, 0.95, 4, 1.3);
        g.beginPath();
        g.moveTo(...pt(r0, 0));
        g.lineTo(...pt(r0 + L, 0));
        g.globalAlpha = 0.5;
        g.strokeStyle = c1;
        g.lineWidth = 1;
        g.stroke();
      }
    },
  };
  return api;
}

/** Arcane: nested polygons spin inward and collapse into the foe; onDone fires at the moment of collapse. */
export function createCollapse({ x, y, R, colors, ms = 180, onDone = null }) {
  const [c0, c1] = colors;
  const shapes = [{ n: 3, r: 1.7, v: 3 }, { n: 4, r: 1.45, v: -4 }, { n: 6, r: 1.2, v: 5 }];
  const dur = ms / 1000;
  let t = 0;
  let fired = false;
  return {
    update(dt) {
      t += dt;
      if (!fired && t >= dur) {
        fired = true;
        if (onDone) onDone();
      }
      return t < dur + 0.03;
    },
    draw(g) {
      const q = clamp01(t / dur);
      const sc = 1 - q * q;
      const a = Math.min(1, t / 0.05);
      g.beginPath();
      for (const sh of shapes) {
        const r = sh.r * R * sc;
        const rot = sh.v * t;
        for (let i = 0; i <= sh.n; i++) {
          const ang = rot + (i * TAU) / sh.n;
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
      }
      glowStroke(g, c0, c1, a, 6, 1.8);
    },
  };
}

/** Nature (damage): thorns spear up out of a ground sigil. */
export function createThorns({ x, y, R, colors, tier }) {
  const [c0, c1] = colors;
  const s = TIER_FX[tier].scale;
  const thorns = Array.from({ length: 5 + 2 * tier }, () => ({
    dx: rand(-0.85, 0.85) * R, h: rand(40, 90) * s, w: 8 * Math.min(1.4, s), lean: rand(-0.25, 0.25), delay: rand(0, 0.05),
  }));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      return t < 0.65;
    },
    draw(g) {
      for (const th of thorns) {
        const lt = t - th.delay;
        if (lt <= 0) continue;
        const rise = easeOut(clamp01(lt / 0.1));
        const sink = lt < 0.35 ? 1 : clamp01(1 - (lt - 0.35) / 0.25);
        const hh = th.h * rise * sink;
        if (hh < 1) continue;
        const bx = x + th.dx;
        const by = y + (th.dx / R) * 4;
        g.beginPath();
        g.moveTo(bx - th.w / 2, by);
        g.lineTo(bx + th.lean * hh, by - hh);
        g.lineTo(bx + th.w / 2, by);
        g.closePath();
        g.globalAlpha = 1;
        g.fillStyle = rgba(c0, 0.35 * sink);
        g.fill();
        glowStroke(g, c0, c1, sink, 4, 1.2);
      }
    },
  };
}

/** Nature (heal): petals unfold around the caster and drift upward. */
export function createBloom({ x, y, R, colors, tier }) {
  const [c0, c1, c2] = colors;
  const n = 6 + 2 * tier;
  const petals = [];
  for (let i = 0; i < n; i++) petals.push({ a: -Math.PI / 2 + (i * TAU) / n, L: 0.9 * R, col: c0 });
  if (tier >= 3) for (let i = 0; i < n; i++) petals.push({ a: -Math.PI / 2 + ((i + 0.5) * TAU) / n, L: 0.55 * R, col: c2 });
  let t = 0;
  return {
    update(dt) {
      t += dt;
      return t < 1.1;
    },
    draw(g) {
      const open = easeOut(clamp01(t / 0.3));
      const rise = clamp01((t - 0.3) / 0.8);
      const alpha = t < 0.5 ? 1 : 1 - clamp01((t - 0.5) / 0.6);
      const cy = y - 30 * rise;
      for (const pt of petals) {
        const ang = pt.a - 0.6 * (1 - open);
        const L = pt.L * (0.3 + 0.7 * open);
        const tip = [x + Math.cos(ang) * L, cy + Math.sin(ang) * L];
        g.beginPath();
        g.moveTo(x, cy);
        g.quadraticCurveTo(x + Math.cos(ang - 0.35) * L * 0.7, cy + Math.sin(ang - 0.35) * L * 0.7, tip[0], tip[1]);
        g.quadraticCurveTo(x + Math.cos(ang + 0.35) * L * 0.7, cy + Math.sin(ang + 0.35) * L * 0.7, x, cy);
        g.globalAlpha = 1;
        g.fillStyle = rgba(pt.col, 0.28 * alpha);
        g.fill();
        glowStroke(g, pt.col, c1, 0.85 * alpha, 4, 1.2);
      }
    },
  };
}

/** Ward: rune plates orbit the caster and lock into a shield ring. */
export function createBastion({ x, y, R, colors, tier }) {
  const [c0, c1] = colors;
  const rings = [{ r: R, n: tier >= 3 ? 8 : 6, v: 2 }];
  if (tier >= 3) rings.push({ r: R * 1.2, n: 8, v: -1.5 });
  let t = 0;
  return {
    update(dt) {
      t += dt;
      return t < 1.0;
    },
    draw(g) {
      const intro = easeOut(clamp01(t / 0.2));
      const fade = t < 0.7 ? 1 : clamp01(1 - (t - 0.7) / 0.3);
      for (const ring of rings) {
        g.beginPath();
        g.arc(x, y, ring.r * intro, 0, TAU);
        glowStroke(g, c0, c1, 0.5 * fade, 4, 1);
        const pr = 0.16 * R * intro;
        g.beginPath();
        for (let j = 0; j < ring.n; j++) {
          const ang = (j * TAU) / ring.n + ring.v * t * (1 - 0.4 * t);
          const px = x + Math.cos(ang) * ring.r * intro;
          const py = y + Math.sin(ang) * ring.r * intro;
          for (let i = 0; i <= 6; i++) {
            const ha = ang + (i * TAU) / 6;
            const hx = px + Math.cos(ha) * pr;
            const hy = py + Math.sin(ha) * pr;
            if (i === 0) g.moveTo(hx, hy);
            else g.lineTo(hx, hy);
          }
          // a little rune stroke inside each plate
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          g.moveTo(px - sa * pr * 0.55, py + ca * pr * 0.55);
          g.lineTo(px + sa * pr * 0.55, py - ca * pr * 0.55);
          g.moveTo(px + sa * pr * 0.1, py - ca * pr * 0.1);
          g.lineTo(px + ca * pr * 0.45 + sa * pr * 0.4, py + sa * pr * 0.45 - ca * pr * 0.4);
        }
        glowStroke(g, c0, c1, fade, 4, 1.2);
      }
    },
  };
}
