import { h, clear } from '../dom.js';

/** Renders a typing line as per-character spans: typed / current / pending. */
export function createIncantationView() {
  const el = h('div', { class: 'itext' });
  let spans = [];
  let progress = 0;
  let ghost = -1;

  /** marks[i] (optional): extra classes for character i — Glyphdeep golden / bane / blot letters. */
  function setText(text, marks = null) {
    clear(el);
    ghost = -1;
    spans = [...text].map((ch, i) => h('span', { class: `ch${ch === ' ' ? ' space' : ''}${marks && marks[i] ? ` ${marks[i]}` : ''}` }, ch));
    for (const s of spans) el.appendChild(s);
    progress = -1;
    setProgress(0);
  }

  function setProgress(i) {
    if (i === progress) return;
    const from = Math.max(0, Math.min(i, progress) - 1);
    const to = Math.min(spans.length, Math.max(i, progress) + 1);
    for (let k = from; k < to; k++) {
      const s = spans[k];
      s.classList.toggle('typed', k < i);
      s.classList.toggle('current', k === i);
    }
    if (progress < 0) {
      for (let k = 0; k < spans.length; k++) {
        spans[k].classList.toggle('typed', k < i);
        spans[k].classList.toggle('current', k === i);
      }
    }
    progress = i;
  }

  function flashError(i) {
    const s = spans[i];
    if (!s) return;
    s.classList.add('err');
    clearTimeout(s._errT);
    s._errT = setTimeout(() => s.classList.remove('err'), 260);
  }

  /** Racing Wisp: mark where a ghost typing at the player's average pace would be (-1 hides it). */
  function setGhost(i) {
    const n = i >= spans.length ? spans.length - 1 : i;
    if (n === ghost) return;
    if (spans[ghost]) spans[ghost].classList.remove('ghost');
    ghost = n;
    if (spans[ghost]) spans[ghost].classList.add('ghost');
  }

  /** Mark a character (e.g. 'got' when its golden rune was earned). */
  function addClass(i, cls) {
    if (spans[i]) spans[i].classList.add(cls);
  }

  function spanAt(i) {
    return spans[Math.max(0, Math.min(spans.length - 1, i))] || null;
  }

  return { el, setText, setProgress, flashError, spanAt, setGhost, addClass, get length() { return spans.length; } };
}
