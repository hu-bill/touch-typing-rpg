import { h } from '../dom.js';

export function toast(title, { icon = '', sub = '', color = '', life = 2600 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = h(
    'div',
    { class: 'toast', style: { '--tc': color || 'rgba(255,255,255,0.18)', '--life': `${life}ms` } },
    icon ? h('div', { class: 't-icon' }, icon) : null,
    h('div', {}, h('div', { class: 't-title' }, title), sub ? h('div', { class: 't-sub' }, sub) : null),
  );
  root.appendChild(el);
  setTimeout(() => el.remove(), life + 500);
  while (root.children.length > 5) root.firstChild.remove();
}
