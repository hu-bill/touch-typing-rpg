import { h, pulseClass } from '../dom.js';
import { LAYOUTS, FINGERS, CODE_FINGER } from '../../data/layouts.js';
import { charInfo, codesUnlocked, modifiersUnlocked } from '../../logic/keyboard.js';
import { ZONES } from '../../data/zones.js';
import { keySummary, keyMastery, MASTERY_NAMES } from '../../logic/mastery.js';

export const MASTERY_COLORS = ['#3b3f57', '#4dabf7', '#b07cff', '#f5c66b'];

function heatColor(stat) {
  if (!stat || stat.n === 0) return '#3b3f57';
  const lvl = keyMastery(stat);
  if (lvl > 0) return MASTERY_COLORS[lvl];
  const { acc } = keySummary(stat);
  // novice: red (bad) → orange (ok)
  const t = Math.max(0, Math.min(1, (acc - 0.75) / 0.2));
  const r = 255;
  const g = Math.round(80 + 110 * t);
  const b = Math.round(90 - 40 * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * On-screen keyboard. mode 'guide' (finger colours, highlight next key) or 'heat' (mastery heatmap).
 */
export function createKeyboardView({ layoutId, zoneIndex, mode = 'guide', keyStats = {}, showLegend = false, freshCodes = null }) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.qwerty;
  const el = h('div', { class: `keyboard panel ${mode === 'heat' ? 'heat' : ''}` });
  const keyEls = new Map();
  const unlocked = codesUnlocked(zoneIndex);
  const mods = modifiersUnlocked(zoneIndex);
  const freshSet = new Set(freshCodes || (zoneIndex >= 0 ? ZONES[zoneIndex].codes : []));
  let targets = [];

  for (const row of layout.rows) {
    const rowEl = h('div', { class: 'kb-row' });
    for (const key of row) {
      const finger = CODE_FINGER[key.code] || 'th';
      const color = FINGERS[finger].color;
      let locked;
      if (key.special) {
        locked = (key.code.startsWith('Shift') && !mods.shift) || (key.code === 'AltRight' && !mods.altgr);
        if (key.code === 'Space') locked = false;
        if (!key.code.startsWith('Shift') && key.code !== 'Space' && key.code !== 'AltRight') locked = true;
      } else locked = !unlocked.has(key.code);
      const label = key.special ? key.label : /[a-zäöü]/i.test(key.base) && key.base.length === 1 && key.shift === key.base.toUpperCase() ? key.base.toUpperCase() : key.base;
      const showShift = !key.special && key.shift && key.shift !== key.base.toUpperCase();
      const k = h(
        'div',
        {
          class: `key${key.special ? ' special' : ''}${locked ? ' locked' : ''}${key.bump ? ' bump' : ''}${!locked && freshSet.has(key.code) && mode === 'guide' ? ' fresh' : ''}`,
          style: { '--w': key.w || 1, '--finger': color },
        },
        showShift ? h('span', { class: 'k-shift' }, key.shift) : null,
        h('span', {}, label),
        key.altgr ? h('span', { class: 'k-alt' }, key.altgr) : null,
      );
      if (mode === 'heat' && !key.special) {
        const chars = [key.base, key.shift, key.altgr].filter(Boolean);
        const stats = chars.map((c) => keyStats[c]).filter(Boolean);
        const primary = keyStats[key.base] || stats[0];
        if (locked) k.style.background = '#22253a';
        else {
          const c = heatColor(primary);
          k.style.background = c;
          if (keyMastery(primary) === 3) k.style.boxShadow = '0 0 14px #f5c66b';
        }
        const lines = chars.map((c) => {
          const s = keySummary(keyStats[c]);
          if (!s.n) return `${c}: untrained`;
          return `${c}: ${MASTERY_NAMES[keyMastery(keyStats[c])]} · ${(s.acc * 100).toFixed(0)}% · ${s.medianMs ? `${Math.round(s.medianMs)}ms` : '—'} · ${s.n} presses`;
        });
        k.title = locked ? 'Locked rune' : lines.join('\n');
      }
      keyEls.set(key.code, k);
      rowEl.appendChild(k);
    }
    el.appendChild(rowEl);
  }

  if (showLegend) {
    el.appendChild(
      h(
        'div',
        { class: 'kb-legend' },
        Object.entries(FINGERS)
          .filter(([id]) => id !== 'th')
          .map(([, f]) => h('span', { style: { '--finger': f.color } }, h('i'), f.name)),
      ),
    );
  }

  function clearHighlight() {
    for (const t of targets) t.classList.remove('target');
    targets = [];
  }

  function highlight(ch) {
    clearHighlight();
    if (ch == null) return;
    const info = charInfo(layout.id, ch);
    if (!info) return;
    const codes = [info.code];
    if (info.shift) codes.push(info.finger.startsWith('l') ? 'ShiftRight' : 'ShiftLeft');
    if (info.altgr) codes.push('AltRight');
    for (const c of codes) {
      const k = keyEls.get(c);
      if (k) {
        k.classList.add('target');
        targets.push(k);
      }
    }
  }

  /** Persistently tag the key(s) that type `ch` (e.g. the Glyphdeep bane letter). */
  function mark(ch, cls) {
    const info = charInfo(layout.id, ch);
    const k = info && keyEls.get(info.code);
    if (k) k.classList.add(cls);
  }

  function press(code) {
    const k = keyEls.get(code);
    if (!k) return;
    k.classList.add('pressed');
    setTimeout(() => k.classList.remove('pressed'), 90);
  }

  function celebrate(code, color) {
    const k = keyEls.get(code);
    if (!k) return;
    k.style.setProperty('--celebrate', color);
    pulseClass(k, 'celebrate', 1400);
  }

  function setVisible(v) {
    el.classList.toggle('hidden', !v);
  }

  return { el, highlight, clearHighlight, mark, press, setVisible, celebrate };
}
