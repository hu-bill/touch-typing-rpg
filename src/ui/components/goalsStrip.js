import { h } from '../dom.js';

/** "Within reach" list of the nearest goals, or null when there are none. */
export function goalsStrip(goals, { title = 'Within reach' } = {}) {
  if (!goals || !goals.length) return null;
  return h(
    'div',
    { class: 'goals' },
    h('div', { class: 'section-label' }, title),
    goals.map((g) =>
      h(
        'div',
        { class: 'goal' },
        h('span', { class: 'g-icon' }, g.icon),
        h('span', { class: 'g-text' }, g.text),
        h('div', { class: 'g-bar' }, h('div', { style: { width: `${Math.round(g.progress * 100)}%` } })),
      ),
    ),
  );
}
