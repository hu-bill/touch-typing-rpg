import { h, clear } from '../dom.js';
import { RARITY_BY_ID, SLOT_BY_ID, UNIQUES, AFFIXES } from '../../data/items.js';
import { describeAffix, sellValue, slotIcon } from '../../logic/loot.js';

const tooltip = () => document.getElementById('tooltip');

export function rarityColor(item) {
  return RARITY_BY_ID[item.rarity]?.color || '#fff';
}

function affixMap(item) {
  const m = {};
  if (!item) return m;
  for (const a of item.affixes) m[a.id] = (m[a.id] || 0) + a.value;
  return m;
}

/** Comparison lines between `item` and the currently equipped `other`. */
function compareLines(item, other) {
  const a = affixMap(item);
  const b = affixMap(other);
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  const lines = [];
  for (const id of ids) {
    const d = (a[id] || 0) - (b[id] || 0);
    if (d === 0) continue;
    let label = AFFIXES[id].label.replace('{v}', Math.abs(d));
    if (d < 0 && label.startsWith('+')) label = `−${label.slice(1)}`;
    lines.push(h('div', { class: d > 0 ? 'tt-up' : 'tt-down' }, `${d > 0 ? '▲' : '▼'} ${label}`));
  }
  if (item.unique !== (other && other.unique)) {
    if (item.unique) lines.push(h('div', { class: 'tt-up' }, `▲ Gain: ${UNIQUES[item.unique].name}`));
    if (other && other.unique) lines.push(h('div', { class: 'tt-down' }, `▼ Lose: ${UNIQUES[other.unique].name}`));
  }
  return lines;
}

/** compare: undefined = no comparison, null = empty slot, item = compare against it */
export function itemTooltipContent(item, { compare, hint = '' } = {}) {
  const rar = RARITY_BY_ID[item.rarity];
  return h(
    'div',
    {},
    h('div', { class: 'tt-name', style: { color: rar.color } }, item.name),
    h('div', { class: 'tt-sub' }, `${rar.name} ${SLOT_BY_ID[item.slot].name} · Item level ${item.ilvl}`),
    item.affixes.map((a) => h('div', { class: 'tt-affix' }, describeAffix(a))),
    item.unique ? h('div', { class: 'tt-unique' }, `★ ${UNIQUES[item.unique].text}`) : null,
    compare !== undefined && compare !== null
      ? [h('div', { class: 'tt-sep' }), h('div', { class: 'faint', style: { fontSize: '11px' } }, `Compared to ${compare.name}`), compareLines(item, compare)]
      : compare === null
        ? [h('div', { class: 'tt-sep' }), h('div', { class: 'tt-up' }, 'Empty slot — pure upgrade')]
        : null,
    h('div', { class: 'tt-hint' }, `Sells for ${sellValue(item)} gold${hint ? ` · ${hint}` : ''}`),
  );
}

export function showTooltip(content, x, y) {
  const t = tooltip();
  if (!t) return;
  clear(t).appendChild(content);
  t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 18;
  let top = y + 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 18;
  if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}

export function hideTooltip() {
  const t = tooltip();
  if (t) t.hidden = true;
}

/** Item tile with tooltip on hover. */
export function itemTile(item, { onClick, compare, hint = '', upgrade = false } = {}) {
  if (!item) return h('div', { class: 'tile empty' }, '·');
  const el = h(
    'div',
    {
      class: `tile ${item.rarity}${upgrade ? ' upgrade' : ''}`,
      style: { '--rc': rarityColor(item) },
      onClick: (e) => {
        hideTooltip();
        onClick && onClick(e);
      },
    },
    slotIcon(item.slot),
    h('span', { class: 'ilvl' }, item.ilvl),
  );
  const show = (e) => showTooltip(itemTooltipContent(item, { compare, hint }), e.clientX, e.clientY);
  el.addEventListener('mouseenter', show);
  el.addEventListener('mousemove', show);
  el.addEventListener('mouseleave', hideTooltip);
  return el;
}

/** Large loot card for reveals. compare: undefined = no comparison in the tooltip. */
export function lootCard(item, delayMs = 0, { compare, upgrade = false, tag = '' } = {}) {
  const el = h(
    'div',
    { class: `loot-card ${item.rarity}${upgrade ? ' upgrade' : ''}`, style: { '--rc': rarityColor(item), animationDelay: `${delayMs}ms` } },
    tag ? h('div', { class: 'lc-tag' }, tag) : null,
    h('div', { class: 'lc-icon' }, slotIcon(item.slot)),
    h('div', { class: 'lc-name' }, item.name),
    h('div', { class: 'lc-rar' }, `${RARITY_BY_ID[item.rarity].name} · iLvl ${item.ilvl}`),
    upgrade ? h('div', { class: 'lc-up' }, '▲ Upgrade') : null,
  );
  const show = (e) => showTooltip(itemTooltipContent(item, compare !== undefined ? { compare } : {}), e.clientX, e.clientY);
  el.addEventListener('mouseenter', show);
  el.addEventListener('mousemove', show);
  el.addEventListener('mouseleave', hideTooltip);
  return el;
}

/** Mark a loot card as equipped (after quick-equip). */
export function markEquipped(cardEl) {
  cardEl.classList.add('equipped');
  cardEl.classList.remove('upgrade');
  let up = cardEl.querySelector('.lc-up');
  if (!up) {
    up = h('div', { class: 'lc-up' });
    cardEl.appendChild(up);
  }
  up.textContent = '✓ Equipped';
}
