import { h } from '../dom.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { mean, formatNumber } from '../../core/util.js';
import { allowedChars } from '../../logic/keyboard.js';
import { weakChars, keySummary, keyMastery, MASTERY_NAMES } from '../../logic/mastery.js';
import { createKeyboardView, MASTERY_COLORS } from '../components/keyboardView.js';

function drawChart(canvas, history) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const ht = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = ht * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, ht);
  const pad = { l: 36, r: 40, t: 12, b: 22 };
  const data = history.slice(-60);
  g.font = '11px Inter, system-ui, sans-serif';
  if (data.length < 2) {
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.textAlign = 'center';
    g.fillText('Fight a few battles to see your progress chart.', w / 2, ht / 2);
    return;
  }
  const maxW = Math.max(30, Math.ceil(Math.max(...data.map((d) => d.wpm)) / 10) * 10);
  const x = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const yW = (v) => pad.t + (1 - v / maxW) * (ht - pad.t - pad.b);
  const yA = (v) => pad.t + (1 - (v - 0.7) / 0.3) * (ht - pad.t - pad.b);
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * (ht - pad.t - pad.b);
    g.beginPath();
    g.moveTo(pad.l, yy);
    g.lineTo(w - pad.r, yy);
    g.stroke();
    g.fillStyle = '#7df9ff';
    g.textAlign = 'right';
    g.fillText(String(Math.round(maxW * (1 - i / 4))), pad.l - 6, yy + 4);
    g.fillStyle = '#f5c66b';
    g.textAlign = 'left';
    g.fillText(`${Math.round((1 - (i / 4) * 0.3) * 100)}%`, w - pad.r + 6, yy + 4);
  }
  const line = (fn, color, fill) => {
    g.beginPath();
    data.forEach((d, i) => (i ? g.lineTo(x(i), fn(d)) : g.moveTo(x(i), fn(d))));
    g.strokeStyle = color;
    g.lineWidth = 2.2;
    g.shadowColor = color;
    g.shadowBlur = 8;
    g.stroke();
    g.shadowBlur = 0;
    if (fill) {
      g.lineTo(x(data.length - 1), ht - pad.b);
      g.lineTo(x(0), ht - pad.b);
      g.closePath();
      const grd = g.createLinearGradient(0, pad.t, 0, ht - pad.b);
      grd.addColorStop(0, 'rgba(125,249,255,0.25)');
      grd.addColorStop(1, 'rgba(125,249,255,0)');
      g.fillStyle = grd;
      g.fill();
    }
  };
  line((d) => yW(d.wpm), '#7df9ff', true);
  line((d) => yA(Math.max(0.7, d.acc)), '#f5c66b', false);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.textAlign = 'center';
  g.fillText(`Last ${data.length} fights — WPM (cyan) & accuracy (gold)`, w / 2, ht - 4);
}

export function createGrimoireTab(game) {
  let canvas;
  let onResize;

  return {
    mount(container) {
      const s = game.save;
      const st = s.stats;
      const recent = s.history.slice(-20);
      const avgWpm = mean(s.recentWpm) || 0;
      const acc = recent.length ? mean(recent.map((r) => r.acc)) : null;
      const tile = (v, l) => h('div', { class: 'stat panel' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
      const allowed = allowedChars(game.layoutId, s.unlockedZone);
      const weak = weakChars(s.keyStats, allowed, 6);
      const keyboard = createKeyboardView({ layoutId: game.layoutId, zoneIndex: s.unlockedZone, mode: 'heat', keyStats: s.keyStats });
      keyboard.el.classList.remove('panel');
      const mastered = [...allowed].filter((c) => c !== ' ' && keyMastery(s.keyStats[c]) >= 2).length;
      canvas = h('canvas');
      const minutes = Math.round(st.playSeconds / 60);

      container.appendChild(
        h(
          'div',
          { class: 'tab-content' },
          h(
            'div',
            { class: 'grim' },
            h(
              'div',
              { class: 'tiles' },
              tile(st.bestWpm || '—', 'Best cast WPM'),
              tile(avgWpm ? Math.round(avgWpm) : '—', 'Avg WPM (30 casts)'),
              tile(acc != null ? `${(acc * 100).toFixed(1)}%` : '—', 'Accuracy (20 fights)'),
              tile(formatNumber(st.charsTyped), 'Correct keystrokes'),
              tile(st.totalKills, 'Foes defeated'),
              tile(`${mastered}`, 'Runes mastered'),
            ),
            h('div', { class: 'panel' }, h('h3', {}, 'Progress'), h('div', { class: 'chart-wrap' }, canvas), h('div', { class: 'faint', style: { fontSize: '12px', marginTop: '6px' } }, `${st.totalCasts} casts · ${st.perfectCasts} perfect · ${st.fizzles} fizzles · best combo ${st.bestCombo} · ${minutes} min played`)),
            h(
              'div',
              { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
              h('h3', {}, 'Rune Mastery'),
              h('div', { class: 'dim', style: { fontSize: '13px' } }, 'Mastered keys channel more power in every spell (+10% Adept, +20% Master, +30% Grandmaster). Hover a key for details.'),
              keyboard.el,
              h(
                'div',
                { class: 'mastery-legend' },
                h('span', {}, h('i', { style: { background: '#3b3f57' } }), 'Untrained'),
                h('span', {}, h('i', { style: { background: 'linear-gradient(90deg,#ff505a,#ffbe32)' } }), 'Novice (by accuracy)'),
                MASTERY_NAMES.slice(1).map((n, i) => h('span', {}, h('i', { style: { background: MASTERY_COLORS[i + 1] } }), n)),
              ),
              h('div', { class: 'section-label' }, 'Weakest runes — the game will test these more'),
              h(
                'div',
                { class: 'weak-list' },
                weak.length
                  ? weak.map((c) => {
                      const ks = keySummary(s.keyStats[c]);
                      return h('span', { class: 'keycap', title: `${(ks.acc * 100).toFixed(0)}% · ${ks.medianMs ? Math.round(ks.medianMs) : '—'}ms` }, c);
                    })
                  : h('span', { class: 'faint' }, 'Not enough data yet.'),
              ),
            ),
            h(
              'div',
              { class: 'panel', style: { gridColumn: '1 / -1' } },
              h('h3', {}, `Achievements (${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length})`),
              h(
                'div',
                { class: 'ach-grid', style: { marginTop: '10px' } },
                ACHIEVEMENTS.map((a) =>
                  h(
                    'div',
                    { class: `ach${s.achievements[a.id] ? '' : ' locked'}`, title: a.desc },
                    h('div', { class: 'a-icon' }, a.icon),
                    h('div', {}, h('div', { class: 'a-name' }, a.name), h('div', { class: 'faint' }, a.desc)),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      requestAnimationFrame(() => drawChart(canvas, s.history));
      onResize = () => drawChart(canvas, s.history);
      window.addEventListener('resize', onResize);
    },
    unmount() {
      window.removeEventListener('resize', onResize);
    },
  };
}
