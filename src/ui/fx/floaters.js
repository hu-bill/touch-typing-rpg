import { h } from '../dom.js';

const root = () => document.getElementById('floaters');

/** Floating text (damage numbers etc.) at screen coordinates. */
export function floatText(x, y, text, { color = '#fff', size = 28, crit = false, cls = '' } = {}) {
  const el = h(
    'div',
    { class: `floater ${crit ? 'crit' : ''} ${cls}`, style: { left: `${x}px`, top: `${y}px`, color, fontSize: `${size}px` } },
    text,
  );
  el.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 70)}px`);
  root().appendChild(el);
  const kill = () => el.remove();
  el.addEventListener('animationend', kill);
  setTimeout(kill, 2200);
  return el;
}

/** Big centred announcement ("FLOW STATE", "ENRAGED!", boss intros). */
export function banner(text, { color = '#ffe2a1', sub = '', size = '', duration } = {}) {
  const r = root();
  for (const old of r.querySelectorAll(`.banner${size === 'big' ? '.big' : ':not(.big)'}`)) old.remove();
  const el = h(
    'div',
    { class: `banner ${size}`, style: { color } },
    h('div', { class: 'b-main' }, text),
    sub ? h('div', { class: 'b-sub' }, sub) : null,
  );
  if (duration) el.style.animationDuration = `${duration}ms`;
  r.appendChild(el);
  const kill = () => el.remove();
  el.addEventListener('animationend', kill);
  setTimeout(kill, (duration || 3000) + 500);
  return el;
}

export function clearFloaters() {
  const r = root();
  if (r) r.innerHTML = '';
}
