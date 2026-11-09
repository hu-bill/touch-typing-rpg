/** Tiny hyperscript helper: h('div', { class: 'x', onClick }, child1, 'text', [more]) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of [children].flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Replace all children of `el` (arrays are flattened, unlike native Element.append). */
export function fill(el, ...children) {
  return append(clear(el), children);
}

/** The typed character of a keydown event, or null (handles AltGr = Ctrl+Alt on Windows). */
export function charFromEvent(e) {
  if (e.metaKey) return null;
  if (e.ctrlKey && !e.altKey) return null;
  if (typeof e.key === 'string' && e.key.length === 1) return e.key;
  return null;
}

export function kbd(label) {
  return h('kbd', {}, label);
}

/** Button with an optional hotkey chip. */
export function button(label, { hotkey, onClick, cls = '', disabled = false, title } = {}) {
  return h(
    'button',
    { class: `btn ${cls}`, onClick: disabled ? null : onClick, disabled, title, type: 'button' },
    hotkey ? kbd(hotkey) : null,
    h('span', {}, label),
  );
}

/** Restart a CSS animation class on an element. */
export function pulseClass(el, cls, ms) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  if (ms) {
    clearTimeout(el[`_t_${cls}`]);
    el[`_t_${cls}`] = setTimeout(() => el.classList.remove(cls), ms);
  }
}

export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
