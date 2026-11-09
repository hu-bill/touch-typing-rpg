// Particle effects, projectiles, lightning, drawable layers, screen shake/kick/punch, flashes and hit-stop on the overlay canvas.
import { rgba } from './color.js';

const MAX_PARTICLES = 1200;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Jagged line from `from` to `to` by midpoint displacement (5 levels → 33 points). */
function boltPoints(from, to, jitter) {
  let pts = [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
  let off = Math.hypot(to.x - from.x, to.y - from.y) * jitter;
  for (let level = 0; level < 5; level++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const o = (Math.random() * 2 - 1) * off;
      next.push({ x: (a.x + b.x) / 2 - (dy / l) * o, y: (a.y + b.y) / 2 + (dx / l) * o }, b);
    }
    pts = next;
    off /= 2;
  }
  return pts;
}

function makeBolt(b) {
  const main = boltPoints(b.from, b.to, b.jitter);
  b.paths = [main];
  const len = Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y);
  const heading = Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x);
  for (let i = 0; i < b.branches; i++) {
    const start = main[4 + Math.floor(Math.random() * (main.length - 8))];
    const ang = heading + rand(-0.9, 0.9);
    const L = len * 0.25 * rand(0.6, 1.2);
    b.paths.push(boltPoints(start, { x: start.x + Math.cos(ang) * L, y: start.y + Math.sin(ang) * L }, b.jitter * 1.3));
  }
}

export function createFx(canvas, shakeTarget) {
  const g = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  const parts = [];
  const projectiles = [];
  const tasks = [];
  let shakeT = 0;
  let shakeDur = 0;
  let shakeMag = 0;
  let shakeEnabled = true;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = 0;
  let stopT = 0;
  let flashS = null;
  let vig = 0;
  let vigTarget = 0;
  const kickS = { x: 0, y: 0, vx: 0, vy: 0 };
  const zoomS = { z: 0, v: 0 };
  let transformSet = false;
  const layers = [];
  let vigColor = '#04020c';

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function add(p) {
    if (parts.length >= MAX_PARTICLES) parts.shift();
    parts.push(p);
  }

  /** Add a raw particle: { type, x, y, ... } with sensible defaults. */
  function spawn(p) {
    add({ age: 0, vx: 0, vy: 0, gravity: 0, drag: 1, rot: 0, vr: 0, size: 3, life: 0.6, color: '#ffffff', ...p });
  }

  function burst(x, y, { count = 20, color = '#fff', speed = 240, size = 3, life = 0.7, gravity = 260, spread = Math.PI * 2, angle = -Math.PI / 2, drag = 0.92, colors = null, type = 'dot', len = 14, spin = 0, palette = null } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.3 + Math.random() * 0.9);
      add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: size * (0.5 + Math.random()),
        life: life * (0.6 + Math.random() * 0.6), age: 0, color: colors ? colors[i % colors.length] : color, gravity, drag, type,
        len, rot: Math.random() * TAU, vr: (Math.random() * 2 - 1) * spin, palette, seed: Math.random() * TAU,
      });
    }
  }

  function sparks(x, y, color, n = 5) {
    burst(x, y, { count: n, color, speed: 170, size: 2.2, life: 0.45, gravity: 300, spread: Math.PI * 1.4 });
  }

  function ring(x, y, color, maxR = 90, life = 0.55, width = 3) {
    add({ type: 'ring', x, y, color, r: 6, maxR, life, age: 0, width });
  }

  function projectile(from, to, color, ms = 280, onArrive = null, size = 9, opts = {}) {
    projectiles.push({
      from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, color, colors: opts.colors || [color, '#ffffff', color],
      kind: opts.kind || 'orb', dur: Math.max(0.05, ms / 1000), age: 0, onArrive, size,
      arc: opts.arc ?? -60 - Math.random() * 60, gold: !!opts.gold, x: from.x, y: from.y, heading: 0, acc: 0,
    });
  }

  function lightning(from, to, { color = '#ffe066', core = '#ffffff', width = 3, life = 0.22, branches = 2, jitter = 0.16 } = {}) {
    const b = { type: 'bolt', from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, color, core, width, life, age: 0, branches, jitter, regen: 0.045 };
    makeBolt(b);
    add(b);
  }

  function after(ms, fn) {
    tasks.push({ t: ms / 1000, fn });
  }

  function arcs(x, y, r, color, ms = 400) {
    for (let t = 0; t < ms; t += 45) {
      after(t, () => {
        const a1 = Math.random() * TAU;
        const a2 = a1 + rand(1, 2.6);
        lightning(
          { x: x + Math.cos(a1) * r, y: y + Math.sin(a1) * r * 0.85 },
          { x: x + Math.cos(a2) * r, y: y + Math.sin(a2) * r * 0.85 },
          { color, width: 1.5, life: 0.08, branches: 0, jitter: 0.28 },
        );
      });
    }
  }

  function flash(color, alpha, ms = 160) {
    if (!shakeEnabled || !(alpha > 0)) return;
    const a = alpha * (reduced ? 0.4 : 1);
    if (flashS) {
      const cur = flashS.alpha * (1 - flashS.age / flashS.life) ** 2;
      if (cur >= a) return;
    }
    flashS = { color, alpha: a, life: ms / 1000, age: 0 };
  }

  function setVignette(alpha, color = '#04020c') {
    vigTarget = Math.max(0, alpha || 0);
    if (vigTarget > 0) vigColor = color;
  }

  /** Add a custom drawable: { update(dt) → alive, draw(g) }. Frozen by hit-stop, drawn under the particles. */
  function addLayer(obj) {
    layers.push(obj);
    return obj;
  }

  function hitstop(ms) {
    if (ms > 0) stopT = Math.max(stopT, ms / 1000);
  }

  function kick(dx, dy = 0) {
    if (!shakeEnabled) return;
    kickS.x += dx;
    kickS.y += dy;
  }

  function punch(amount) {
    if (!shakeEnabled || reduced || !(amount > 0)) return;
    zoomS.z += amount;
  }

  function shake(intensity, ms = 260) {
    if (!shakeEnabled) return;
    shakeMag = Math.max(shakeMag * (shakeT > 0 ? 1 : 0), intensity);
    shakeDur = ms / 1000;
    shakeT = shakeDur;
  }

  function resetScreen() {
    shakeT = 0;
    kickS.x = kickS.y = kickS.vx = kickS.vy = 0;
    zoomS.z = zoomS.v = 0;
    flashS = null;
    if (shakeTarget) shakeTarget.style.transform = '';
    transformSet = false;
  }

  function setShakeEnabled(b) {
    shakeEnabled = b;
    if (!b) resetScreen();
  }

  // ------------------------------------------------------------ update

  function trail(p) {
    const c0 = p.colors[0];
    for (let i = 0; i < 3; i++) {
      add({ type: 'dot', x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, size: p.size * 0.45 * Math.random() + 1, life: 0.35, age: 0, color: c0, gravity: 0, drag: 0.9 });
    }
    if (p.gold) add({ type: 'dot', x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: rand(-30, 30), vy: rand(-30, 30), size: rand(1, 2.2), life: 0.5, age: 0, color: '#ffe066', gravity: 0, drag: 0.9 });
  }

  function updateScreen(dt) {
    if (flashS) {
      flashS.age += dt;
      if (flashS.age >= flashS.life) flashS = null;
    }
    vig += (vigTarget - vig) * Math.min(1, dt * 4);
    if (!shakeTarget) return;
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      shakeT -= dt;
      const k = Math.max(0, shakeT / shakeDur);
      const m = shakeMag * k * k;
      sx = (Math.random() - 0.5) * 2 * m;
      sy = (Math.random() - 0.5) * 2 * m;
    }
    // damped springs (k = 520, c = 26) pull kick and zoom back to rest
    kickS.vx += (-520 * kickS.x - 26 * kickS.vx) * dt;
    kickS.vy += (-520 * kickS.y - 26 * kickS.vy) * dt;
    kickS.x += kickS.vx * dt;
    kickS.y += kickS.vy * dt;
    zoomS.v += (-520 * zoomS.z - 26 * zoomS.v) * dt;
    zoomS.z += zoomS.v * dt;
    const springing = Math.abs(kickS.x) + Math.abs(kickS.y) > 0.05 || Math.abs(kickS.vx) + Math.abs(kickS.vy) > 1
      || Math.abs(zoomS.z) > 0.0003 || Math.abs(zoomS.v) > 0.01;
    if (shakeT > 0 || springing) {
      const z = Math.abs(zoomS.z) > 0.0003 ? ` scale(${(1 + zoomS.z).toFixed(4)})` : '';
      shakeTarget.style.transform = `translate(${(sx + kickS.x).toFixed(2)}px, ${(sy + kickS.y).toFixed(2)}px)${z}`;
      transformSet = true;
    } else if (transformSet) {
      kickS.x = kickS.y = kickS.vx = kickS.vy = 0;
      zoomS.z = zoomS.v = 0;
      shakeTarget.style.transform = '';
      transformSet = false;
    }
  }

  function update(dt) {
    time += dt;
    updateScreen(dt);
    if (stopT > 0) {
      stopT -= dt;
      return;
    }
    if (tasks.length) {
      const due = [];
      for (let i = tasks.length - 1; i >= 0; i--) {
        tasks[i].t -= dt;
        if (tasks[i].t <= 0) due.push(tasks.splice(i, 1)[0]);
      }
      for (let i = due.length - 1; i >= 0; i--) due[i].fn();
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!projectiles.includes(p)) continue;
      p.age += dt;
      const t = Math.min(1, p.age / p.dur);
      const mx = (p.from.x + p.to.x) / 2;
      const my = (p.from.y + p.to.y) / 2 + p.arc;
      const x = (1 - t) * (1 - t) * p.from.x + 2 * (1 - t) * t * mx + t * t * p.to.x;
      const y = (1 - t) * (1 - t) * p.from.y + 2 * (1 - t) * t * my + t * t * p.to.y;
      if (x !== p.x || y !== p.y) p.heading = Math.atan2(y - p.y, x - p.x);
      p.x = x;
      p.y = y;
      p.acc += dt * 60;
      const n = p.acc | 0;
      p.acc -= n;
      for (let f = 0; f < n; f++) trail(p);
      if (t >= 1) {
        projectiles.splice(projectiles.indexOf(p), 1);
        if (p.onArrive) p.onArrive();
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) {
        parts.splice(i, 1);
        continue;
      }
      switch (p.type) {
        case 'ring':
          p.r += (p.maxR - p.r) * Math.min(1, dt * 9);
          break;
        case 'mote': {
          p.ang += p.vang * dt;
          const k = 1 - p.age / p.life;
          p.x = p.cx + Math.cos(p.ang) * p.rad * k;
          p.y = p.cy + Math.sin(p.ang) * p.rad * k;
          break;
        }
        case 'bolt':
          p.regen -= dt;
          if (p.regen <= 0) {
            makeBolt(p);
            p.regen = 0.045;
          }
          break;
        case 'flare': case 'ray': case 'pillar':
          break;
        default: {
          const d = Math.pow(p.drag, dt * 60);
          p.vx *= d;
          p.vy = p.vy * d + p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.vr) p.rot += p.vr * dt;
          if (p.type === 'leaf') p.x += Math.sin(p.age * 6 + p.seed) * 40 * dt;
        }
      }
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!layers.includes(l)) continue;
      if (!l.update(dt)) layers.splice(layers.indexOf(l), 1);
    }
  }

  // ------------------------------------------------------------ draw

  function dot(x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, TAU);
    g.fill();
  }

  function drawPart(p) {
    const t = p.age / p.life;
    const a = 1 - t;
    switch (p.type) {
      case 'dot': case 'mote':
        g.globalAlpha = a * 0.35;
        g.fillStyle = p.color;
        dot(p.x, p.y, p.size * 2.6);
        g.globalAlpha = a;
        dot(p.x, p.y, p.size);
        break;
      case 'ring':
        g.globalAlpha = a * 0.9;
        g.strokeStyle = p.color;
        g.lineWidth = (p.width || 3) * a + 1;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, TAU);
        g.stroke();
        break;
      case 'flame': {
        const pal = p.palette || ['#ff7a3d', '#ffd166', '#ff3d2e'];
        const col = t < 0.25 ? pal[1] : t < 0.55 ? pal[0] : pal[2];
        const s = p.size * (1 + 0.8 * t);
        g.fillStyle = col;
        g.globalAlpha = a * 0.3;
        dot(p.x, p.y, s * 2);
        g.globalAlpha = a * 0.9;
        dot(p.x, p.y, s);
        break;
      }
      case 'streak': {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const tail = Math.min(p.len || 14, sp * 0.05);
        g.globalAlpha = a;
        g.strokeStyle = p.color;
        g.lineWidth = p.size;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - (p.vx / sp) * tail, p.y - (p.vy / sp) * tail);
        g.stroke();
        break;
      }
      case 'shard': {
        const s = p.size;
        const c = Math.cos(p.rot);
        const sn = Math.sin(p.rot);
        const pt = (px, py) => [p.x + px * c - py * sn, p.y + px * sn + py * c];
        g.globalAlpha = a;
        g.fillStyle = p.color;
        g.beginPath();
        g.moveTo(...pt(s, 0));
        g.lineTo(...pt(-s * 0.6, s * 0.7));
        g.lineTo(...pt(-s * 0.5, -s * 0.6));
        g.closePath();
        g.fill();
        break;
      }
      case 'flake': {
        g.globalAlpha = a;
        g.strokeStyle = p.color;
        g.lineWidth = 1.2;
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const ang = p.rot + (k * Math.PI) / 3;
          const dx = Math.cos(ang) * p.size;
          const dy = Math.sin(ang) * p.size;
          g.moveTo(p.x - dx, p.y - dy);
          g.lineTo(p.x + dx, p.y + dy);
        }
        g.stroke();
        break;
      }
      case 'leaf':
        g.globalAlpha = a;
        g.fillStyle = p.color;
        g.beginPath();
        g.ellipse(p.x, p.y, p.size, p.size * 0.45, p.rot, 0, TAU);
        g.fill();
        break;
      case 'ray': {
        const e = 1 - (1 - t) * (1 - t);
        const inner = p.r0 + (p.r1 - p.r0) * e;
        const outer = inner + p.len * (1 - t);
        const c = Math.cos(p.angle);
        const s = Math.sin(p.angle);
        g.globalAlpha = a;
        g.strokeStyle = p.color;
        g.lineWidth = (p.size || 2) * a + 0.5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x + c * inner, p.y + s * inner);
        g.lineTo(p.x + c * outer, p.y + s * outer);
        g.stroke();
        break;
      }
      case 'flare': {
        const e = 1 - (1 - t) * (1 - t);
        const r = Math.max(1, p.size * (1 + (p.grow - 1) * e));
        const al = a * a;
        const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grd.addColorStop(0, `rgba(255,255,255,${al})`);
        grd.addColorStop(0.35, rgba(p.color, 0.8 * al));
        grd.addColorStop(1, rgba(p.color, 0));
        g.globalAlpha = 1;
        g.fillStyle = grd;
        dot(p.x, p.y, r);
        break;
      }
      case 'pillar': {
        const wd = p.width * (1 - t * 0.6);
        const grd = g.createLinearGradient(p.x - wd / 2, 0, p.x + wd / 2, 0);
        grd.addColorStop(0, rgba(p.color, 0));
        grd.addColorStop(0.35, rgba(p.color, 0.7));
        grd.addColorStop(0.5, 'rgba(255,255,255,0.9)');
        grd.addColorStop(0.65, rgba(p.color, 0.7));
        grd.addColorStop(1, rgba(p.color, 0));
        g.globalAlpha = a * 0.8;
        g.fillStyle = grd;
        g.fillRect(p.x - wd / 2, 0, wd, p.y);
        break;
      }
      case 'bolt': {
        const fl = a * (0.55 + 0.45 * Math.random());
        g.lineCap = 'round';
        g.lineJoin = 'round';
        p.paths.forEach((pts, i) => {
          const wd = i === 0 ? p.width : p.width * 0.55;
          g.beginPath();
          g.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
          g.globalAlpha = fl * 0.25;
          g.strokeStyle = p.color;
          g.lineWidth = wd * 4;
          g.stroke();
          g.globalAlpha = fl;
          g.strokeStyle = p.core;
          g.lineWidth = wd;
          g.stroke();
        });
        break;
      }
      default:
        break;
    }
  }

  function drawProjectile(p) {
    const [c0, c1] = p.colors;
    const r = p.size * 3;
    const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, c0);
    grd.addColorStop(1, rgba(c0, 0));
    g.globalAlpha = 1;
    g.fillStyle = grd;
    dot(p.x, p.y, r);
    g.fillStyle = c1;
    for (let i = 0; i < 2; i++) {
      const ang = time * 14 + i * Math.PI;
      dot(p.x + Math.cos(ang) * p.size * 1.8, p.y + Math.sin(ang) * p.size * 1.8, p.size * 0.35);
    }
  }

  function draw() {
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    if (vig > 0.005) {
      const R = Math.hypot(w, h) / 2;
      const grd = g.createRadialGradient(w / 2, h / 2, R * 0.55, w / 2, h / 2, R);
      grd.addColorStop(0, rgba(vigColor, 0));
      grd.addColorStop(1, rgba(vigColor, Math.min(0.85, vig)));
      g.globalAlpha = 1;
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
    for (const p of parts) {
      if (p.type !== 'smoke' || p.age < 0) continue;
      const t = p.age / p.life;
      g.globalAlpha = 1;
      g.fillStyle = `rgba(38,34,48,${0.32 * (1 - t) * Math.min(1, t / 0.15)})`;
      dot(p.x, p.y, p.size * (1 + 1.6 * t));
    }
    g.globalCompositeOperation = 'lighter';
    for (const l of layers) {
      g.globalAlpha = 1;
      l.draw(g);
    }
    g.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (p.type === 'smoke' || p.age < 0) continue;
      drawPart(p);
    }
    for (const p of projectiles) drawProjectile(p);
    if (flashS) {
      const k = 1 - flashS.age / flashS.life;
      g.globalAlpha = flashS.alpha * k * k;
      g.fillStyle = flashS.color;
      g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function clearAll() {
    parts.length = 0;
    projectiles.length = 0;
    tasks.length = 0;
    layers.length = 0;
    flashS = null;
    vig = 0;
    vigTarget = 0;
    stopT = 0;
  }

  return {
    burst, sparks, ring, projectile, shake, setShakeEnabled, update, draw, resize, clearAll,
    spawn, lightning, arcs, flash, setVignette, hitstop, kick, punch, after, addLayer,
    get size() { return { w, h }; },
    get layerCount() { return layers.length; },
  };
}
