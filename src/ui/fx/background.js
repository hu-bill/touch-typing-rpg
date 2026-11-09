// Procedural parallax landscapes for each zone, drawn on #bg-canvas.
import { createRng } from '../../core/rng.js';

const DECOR = {
  fireflies: 'grass',
  spores: 'pines',
  embers: 'spikes',
  snow: 'peaks',
  bubbles: 'reeds',
  motes: 'columns',
  sparkles: 'castle',
  sparks: 'chimneys',
  void: 'shards',
};

function hashString(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

function makeScene(palette, ambient) {
  const rng = createRng(hashString(palette.skyTop + palette.skyBottom + ambient));
  const decor = DECOR[ambient] || 'grass';
  const peakMul = decor === 'peaks' ? 2.6 : decor === 'spikes' ? 1.6 : 1;
  const layers = [0, 1, 2].map((i) => ({
    color: palette.layers[i],
    base: [0.6, 0.71, 0.83][i],
    speed: [4, 9, 16][i],
    waves: [0, 1, 2].map((k) => ({
      amp: [0.05, 0.026, 0.012][k] * (i === 0 ? peakMul : i === 1 ? 1 + (peakMul - 1) * 0.5 : 1) * rng.float(0.7, 1.3),
      freq: [0.0028, 0.0071, 0.016][k] * rng.float(0.8, 1.25) * (decor === 'peaks' && i === 0 ? 0.8 : 1),
      phase: rng.float(0, Math.PI * 2),
    })),
    props: Array.from({ length: 26 }, () => ({ x: rng.float(0, 1), s: rng.float(0.6, 1.4), r: rng.next() })),
  }));
  const stars = Array.from({ length: 90 }, () => ({ x: rng.next(), y: rng.next() * 0.6, r: rng.float(0.4, 1.6), p: rng.float(0, 6.28) }));
  return { palette, ambient, decor, layers, stars };
}

function spawnAmbient(type, w, h, n = 70) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(resetAmbient({}, type, w, h, true));
  return arr;
}

function resetAmbient(p, type, w, h, initial = false) {
  p.x = Math.random() * w;
  p.y = Math.random() * h;
  p.t = Math.random() * 10;
  p.s = 0.5 + Math.random();
  switch (type) {
    case 'embers':
    case 'sparks':
      if (!initial) p.y = h + 10;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = type === 'sparks' ? -(120 + Math.random() * 140) : -(25 + Math.random() * 50);
      break;
    case 'snow':
      if (!initial) p.y = -10;
      p.vx = -10 - Math.random() * 20;
      p.vy = 20 + Math.random() * 40;
      break;
    case 'bubbles':
    case 'spores':
      if (!initial) p.y = h + 10;
      p.vx = 0;
      p.vy = -(10 + Math.random() * 25);
      break;
    case 'void':
      p.vx = 0;
      p.vy = 0;
      break;
    default:
      p.vx = (Math.random() - 0.5) * 16;
      p.vy = (Math.random() - 0.5) * 10;
  }
  return p;
}

export function createBackground(canvas) {
  const g = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  let t = 0;
  let current = null;
  let previous = null;
  let fade = 1;
  let ambient = [];

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

  function setPalette(palette, ambientType) {
    if (current && current.palette === palette) return;
    previous = current;
    current = makeScene(palette, ambientType);
    fade = previous ? 0 : 1;
    ambient = spawnAmbient(ambientType, w, h);
  }

  function hillY(scene, layer, x) {
    let y = h * layer.base;
    const scroll = t * layer.speed;
    for (const wv of layer.waves) {
      const v = Math.sin((x + scroll) * wv.freq + wv.phase);
      y += wv.amp * h * (scene.decor === 'peaks' ? 1 - Math.abs(v) * 2 : v);
    }
    return y;
  }

  function drawDecor(scene, layer, li) {
    const scroll = t * layer.speed;
    g.fillStyle = layer.color;
    const span = w + 200;
    for (const pr of layer.props) {
      const x = ((pr.x * span - scroll) % span + span) % span - 100;
      const y = hillY(scene, layer, x) + 2;
      const s = pr.s * (li === 2 ? 1.4 : li === 1 ? 1 : 0.7);
      switch (scene.decor) {
        case 'pines': {
          if (pr.r < 0.35) break;
          const th = 70 * s;
          g.beginPath();
          g.moveTo(x, y - th);
          g.lineTo(x - 16 * s, y);
          g.lineTo(x + 16 * s, y);
          g.fill();
          break;
        }
        case 'grass': {
          if (pr.r < 0.5) break;
          g.beginPath();
          g.arc(x, y, 18 * s, Math.PI, 0);
          g.fill();
          break;
        }
        case 'spikes': {
          if (pr.r < 0.55) break;
          g.beginPath();
          g.moveTo(x - 10 * s, y);
          g.lineTo(x - 2 * s, y - 50 * s);
          g.lineTo(x + 10 * s, y);
          g.fill();
          break;
        }
        case 'reeds': {
          g.fillRect(x, y - 40 * s, 2, 40 * s);
          if (pr.r > 0.5) g.fillRect(x + 6, y - 28 * s, 2, 28 * s);
          if (pr.r > 0.6) {
            g.beginPath();
            g.ellipse(x + 1, y - 40 * s, 3, 8 * s, 0, 0, Math.PI * 2);
            g.fill();
          }
          break;
        }
        case 'columns': {
          if (pr.r < 0.6) break;
          const ch = 90 * s;
          g.fillRect(x - 9 * s, y - ch, 18 * s, ch);
          g.fillRect(x - 14 * s, y - ch - 6, 28 * s, 6);
          break;
        }
        case 'castle': {
          if (li !== 0 || pr.r < 0.55) break;
          const tw = 26 * s;
          const th = 120 * s;
          g.fillRect(x - tw / 2, y - th, tw, th);
          g.beginPath();
          g.moveTo(x - tw / 2 - 4, y - th);
          g.lineTo(x, y - th - 40 * s);
          g.lineTo(x + tw / 2 + 4, y - th);
          g.fill();
          break;
        }
        case 'chimneys': {
          if (pr.r < 0.65) break;
          g.fillRect(x - 8 * s, y - 100 * s, 16 * s, 100 * s);
          break;
        }
        case 'shards': {
          if (pr.r < 0.7) break;
          const fy = y - 120 * s - Math.sin(t * 0.6 + pr.x * 10) * 12;
          g.beginPath();
          g.moveTo(x, fy - 26 * s);
          g.lineTo(x + 14 * s, fy);
          g.lineTo(x, fy + 30 * s);
          g.lineTo(x - 14 * s, fy);
          g.fill();
          break;
        }
        default:
          break;
      }
    }
  }

  function drawScene(scene, alpha) {
    const p = scene.palette;
    g.globalAlpha = alpha;
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(0.75, p.skyBottom);
    sky.addColorStop(1, p.layers[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    for (const s of scene.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.p));
      g.fillStyle = `rgba(255,255,255,${0.55 * tw * alpha})`;
      g.beginPath();
      g.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      g.fill();
    }

    const mx = w * 0.5;
    const my = h * 0.13;
    const mr = Math.min(w, h) * 0.06;
    const glow = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5);
    glow.addColorStop(0, rgba(p.moon, 0.35 * alpha));
    glow.addColorStop(1, rgba(p.moon, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = p.moon;
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();

    scene.layers.forEach((layer, li) => {
      drawDecor(scene, layer, li);
      g.fillStyle = layer.color;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) g.lineTo(x, hillY(scene, layer, x));
      g.lineTo(w, h);
      g.closePath();
      g.fill();
      // atmospheric haze between layers
      const haze = g.createLinearGradient(0, h * layer.base - h * 0.1, 0, h);
      haze.addColorStop(0, rgba(p.skyBottom, 0));
      haze.addColorStop(1, rgba(p.skyBottom, 0.08));
      g.fillStyle = haze;
      g.fillRect(0, h * layer.base - h * 0.1, w, h);
    });

    // vignette
    const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  }

  function updateAmbient(dt) {
    if (!current) return;
    const type = current.ambient;
    for (const p of ambient) {
      p.t += dt;
      if (type === 'fireflies' || type === 'motes') {
        p.vx += (Math.random() - 0.5) * 30 * dt;
        p.vy += (Math.random() - 0.5) * 30 * dt;
        p.vx *= 0.99;
        p.vy *= 0.99;
      }
      if (type === 'void') {
        const cx = w / 2;
        const cy = h * 0.4;
        p.vx += (cx - p.x) * 0.02 * dt;
        p.vy += (cy - p.y) * 0.02 * dt;
        if (Math.hypot(cx - p.x, cy - p.y) < 30) resetAmbient(p, type, w, h, true);
      }
      p.x += (p.vx + (type === 'spores' || type === 'snow' ? Math.sin(p.t * 1.3) * 12 : 0)) * dt;
      p.y += p.vy * dt;
      if (p.y < -20 || p.y > h + 20 || p.x < -20 || p.x > w + 20) resetAmbient(p, type, w, h);
    }
  }

  function drawAmbient() {
    if (!current) return;
    const type = current.ambient;
    const col = current.palette.ambientColor;
    g.globalCompositeOperation = 'lighter';
    for (const p of ambient) {
      let a = 0.6;
      let r = 1.6 * p.s;
      if (type === 'fireflies') {
        a = 0.25 + 0.75 * Math.max(0, Math.sin(p.t * 2 + p.s * 5));
        r = 2.2 * p.s;
      } else if (type === 'embers') {
        a = 0.4 + 0.6 * Math.abs(Math.sin(p.t * 7));
      } else if (type === 'sparkles') {
        a = Math.max(0, Math.sin(p.t * 1.5 + p.s * 4));
        g.strokeStyle = rgba(col, a);
        g.lineWidth = 1.2;
        const s = 5 * p.s * a;
        g.beginPath();
        g.moveTo(p.x - s, p.y);
        g.lineTo(p.x + s, p.y);
        g.moveTo(p.x, p.y - s);
        g.lineTo(p.x, p.y + s);
        g.stroke();
        continue;
      } else if (type === 'bubbles') {
        g.strokeStyle = rgba(col, 0.45);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(p.x, p.y, 3 * p.s, 0, Math.PI * 2);
        g.stroke();
        continue;
      } else if (type === 'sparks') {
        g.strokeStyle = rgba(col, 0.7);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        g.stroke();
        continue;
      } else if (type === 'motes') {
        a = 0.35;
      } else if (type === 'void') {
        a = 0.5;
        r = 1.8 * p.s;
      }
      g.fillStyle = rgba(col, a * 0.25);
      g.beginPath();
      g.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba(col, a);
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  function update(dt) {
    t += dt;
    fade = Math.min(1, fade + dt / 0.6);
    updateAmbient(dt);
  }

  function draw() {
    if (!current) {
      g.fillStyle = '#0a0c16';
      g.fillRect(0, 0, w, h);
      return;
    }
    if (previous && fade < 1) drawScene(previous, 1);
    drawScene(current, previous ? fade : 1);
    if (fade >= 1) previous = null;
    drawAmbient();
  }

  return { setPalette, update, draw, resize };
}
