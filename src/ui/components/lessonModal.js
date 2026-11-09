import { h, charFromEvent } from '../dom.js';
import { createModal } from './modal.js';
import { createIncantationView } from './incantation.js';
import { createKeyboardView } from './keyboardView.js';
import { ZONES } from '../../data/zones.js';
import { FINGERS } from '../../data/layouts.js';
import { newCharsForZone, charInfo } from '../../logic/keyboard.js';
import { generateLessonDrill } from '../../logic/textGen.js';
import { recordKey, recordKeyTracked } from '../../logic/mastery.js';
import { announceMastery } from './masteryToast.js';
import { banner } from '../fx/floaters.js';

const TIPS = {
  meadow: 'Rest your left fingers on A S D F and your right fingers on J K L and the key right of L. Feel the little bumps on F and J — always return there. Thumbs rest on Space.',
  whisperwood: 'G and H are reached by your index fingers stretching inward. E and I sit just above your middle fingers.',
  ember: 'Reach up and slightly left with your index fingers for R, T, U and Y. Snap back to home row after each key.',
  skyreach: 'Ring and pinky fingers reach up for W, O, Q and P. Keep your wrists still — only the finger moves.',
  underbog: 'Curl down for the bottom row. C is your left middle finger, V and B the left index, N and M the right index.',
  archive: 'X and Z belong to the left ring and pinky. Comma, period and slash belong to the right middle, ring and pinky.',
  citadel: 'Capitals: hold Shift with the pinky of the OPPOSITE hand, then press the letter. A capital A uses the right Shift.',
  forge: 'The number row is a long reach. Keep your other fingers anchored on the home row and stretch only the one you need.',
  abyss: 'Brackets and braces live at the far right. On QWERTZ, AltGr (right thumb) unlocks { [ ] } \\ | @ and ~.',
};

/** Lesson that introduces a zone's new keys. onDone(completed:boolean) */
export function createLessonModal(game, zoneIndex, onDone) {
  const layoutId = game.layoutId;
  const zone = ZONES[zoneIndex];
  const fresh = [...newCharsForZone(layoutId, zoneIndex)].filter((c) => c !== ' ');
  const lines = generateLessonDrill({ layoutId, zoneIndex, rng: game.rng });
  const views = lines.map((text, i) => {
    const v = createIncantationView();
    v.setText(text);
    if (i > 0) v.setProgress(-1);
    return v;
  });
  const lineEls = views.map((v) => h('div', { class: 'lesson-line' }, v.el));
  const keyboard = createKeyboardView({ layoutId, zoneIndex, mode: 'guide', showLegend: window.innerHeight > 820 });

  // one keycap per physical key (e.g. "1 !" together), max 14
  const groups = new Map();
  for (const c of fresh) {
    const info = charInfo(layoutId, c);
    if (!info) continue;
    if (/[A-Z]/.test(c) && fresh.length > 14) continue; // capitals are summarised below
    const g = groups.get(info.code) || { chars: [], info };
    g.chars.push(c);
    if (!info.shift && !info.altgr) g.info = info;
    groups.set(info.code, g);
  }
  const keycaps = [...groups.values()].slice(0, 14).map(({ chars, info }) => {
    const finger = FINGERS[info.finger];
    return h(
      'div',
      { class: 'lesson-key', style: { '--finger': finger.color } },
      h('div', { class: 'keycap' }, chars.join(' ')),
      h('div', { class: 'lk-finger' }, finger.name),
    );
  });
  if (fresh.some((c) => /[A-Z]/.test(c)) && fresh.length > 14) {
    keycaps.unshift(
      h('div', { class: 'lesson-key', style: { '--finger': FINGERS.lp.color } }, h('div', { class: 'keycap' }, 'Shift + A–Z'), h('div', { class: 'lk-finger' }, 'Opposite pinky')),
    );
  }

  let lineIdx = 0;
  let pos = 0;
  let combo = 0;
  let lastKeyAt = null;
  let done = false;

  const progressEl = h('div', { class: 'faint', style: { textAlign: 'center', fontSize: '12px' } }, '');
  const updateProgress = () => {
    progressEl.textContent = `Line ${Math.min(lineIdx + 1, lines.length)} of ${lines.length} · Esc to skip`;
    lineEls.forEach((el, i) => el.classList.toggle('done', i < lineIdx));
    keyboard.highlight(lines[lineIdx] ? lines[lineIdx][pos] : null);
  };

  const finish = (completed) => {
    if (done) return;
    done = true;
    game.closeModal(m);
    if (completed) {
      banner('RUNES LEARNED', { color: zone.palette.accent, sub: 'Your fingers remember. +5 XP' });
      game.audio.levelUp();
    }
    onDone(completed);
  };

  const m = createModal({
    title: `New runes awaken`,
    cls: 'lesson',
    content: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('div', { class: 'zone-sub', style: { textAlign: 'center' } }, `${zone.icon} ${zone.name}`),
      h('p', { style: { textAlign: 'center' } }, TIPS[zone.id] || ''),
      h('div', { class: 'lesson-keys' }, keycaps),
      keyboard.el,
      lineEls,
      progressEl,
    ),
    onKey: (e) => {
      if (e.key === 'Escape') {
        finish(false);
        return true;
      }
      const ch = charFromEvent(e);
      if (!ch) return true;
      e.preventDefault();
      const text = lines[lineIdx];
      if (!text) return true;
      const now = performance.now();
      if (ch === text[pos]) {
        const up = recordKeyTracked(game.save.keyStats, ch, true, lastKeyAt != null ? now - lastKeyAt : null);
        if (up && ch !== ' ') announceMastery(game, { ch, level: up, keyboard });
        lastKeyAt = now;
        pos += 1;
        combo += 1;
        views[lineIdx].setProgress(pos);
        if (pos === 1) lineEls[lineIdx].scrollIntoView({ block: 'nearest' });
        game.audio.key(combo);
        const span = views[lineIdx].spanAt(pos - 1);
        if (span) {
          const r = span.getBoundingClientRect();
          game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, zone.palette.accent, 4);
        }
        if (pos >= text.length) {
          lineIdx += 1;
          pos = 0;
          lastKeyAt = null;
          if (views[lineIdx]) views[lineIdx].setProgress(0);
          if (lineIdx >= lines.length) {
            finish(true);
            return true;
          }
        }
      } else {
        recordKey(game.save.keyStats, text[pos], false, null);
        views[lineIdx].flashError(pos);
        game.audio.error();
        combo = 0;
      }
      updateProgress();
      return true;
    },
  });
  m.onOpen = updateProgress;
  return m;
}
