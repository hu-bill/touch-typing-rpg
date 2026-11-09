import { h, button } from '../dom.js';

/**
 * Generic modal. actions: [{ label, hotkey, key, onClick, primary, danger }]
 * `key` is the KeyboardEvent.key that triggers the action (e.g. 'Enter', 'Escape', 'f').
 */
export function createModal({ title, content, actions = [], cls = '', onKey = null, titleCls = '' }) {
  const modal = { el: null, closed: false, close: null };
  const body = h(
    'div',
    { class: `modal panel ${cls}` },
    title ? h('h2', { class: titleCls }, title) : null,
    content,
    actions.length
      ? h(
          'div',
          { class: 'modal-actions' },
          actions.map((a) =>
            button(a.label, {
              hotkey: a.hotkey,
              cls: a.primary ? 'primary' : a.danger ? 'danger' : '',
              onClick: () => a.onClick && a.onClick(),
              disabled: a.disabled,
            }),
          ),
        )
      : null,
  );
  modal.el = h('div', { class: 'modal-backdrop' }, body);
  modal.body = body;
  modal.onKey = (e) => {
    if (onKey && onKey(e) === true) return;
    for (const a of actions) {
      if (a.disabled) continue;
      const keys = Array.isArray(a.key) ? a.key : [a.key];
      if (keys.some((k) => k && (e.key === k || e.key.toLowerCase() === String(k).toLowerCase()))) {
        e.preventDefault();
        a.onClick && a.onClick();
        return;
      }
    }
  };
  return modal;
}

/** Confirmation dialog helper. */
export function confirmModal(game, { title, text, confirmLabel = 'Confirm', onConfirm, danger = false }) {
  const m = createModal({
    title,
    content: h('p', {}, text),
    actions: [
      { label: 'Cancel', hotkey: 'Esc', key: 'Escape', onClick: () => game.closeModal(m) },
      { label: confirmLabel, hotkey: 'Enter', key: 'Enter', primary: !danger, danger, onClick: () => { game.closeModal(m); onConfirm(); } },
    ],
  });
  game.openModal(m);
  return m;
}
