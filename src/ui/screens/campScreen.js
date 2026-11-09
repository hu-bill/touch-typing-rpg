import { h, clear, fill } from '../dom.js';
import { xpToNext } from '../../logic/progression.js';
import { formatNumber } from '../../core/util.js';
import { createMapTab } from './mapTab.js';
import { createCharacterTab } from './characterTab.js';
import { createMerchantTab } from './merchantTab.js';
import { createGrimoireTab } from './grimoireTab.js';
import { createSettingsTab } from './settingsTab.js';
import { createGlyphdeepTab } from './glyphdeepTab.js';

const TABS = [
  { id: 'map', label: 'Map', icon: '🗺️', create: createMapTab },
  { id: 'character', label: 'Character', icon: '🧙', create: createCharacterTab },
  { id: 'merchant', label: 'Merchant', icon: '💰', create: createMerchantTab },
  { id: 'grimoire', label: 'Grimoire', icon: '📖', create: createGrimoireTab },
  { id: 'settings', label: 'Settings', icon: '⚙️', create: createSettingsTab },
  { id: 'glyphdeep', label: 'Glyphdeep', icon: '🌀', create: createGlyphdeepTab },
];

export function createCampScreen(game) {
  let header;
  let body;
  let current = null;
  let currentId = null;

  function renderHeader() {
    if (!header) return;
    const p = game.save.player;
    const need = xpToNext(p.level);
    fill(header, 
      h('div', { class: 'camp-logo' }, 'SPELLSTROKE'),
      h(
        'div',
        { class: 'tabs' },
        TABS.map((t, i) =>
          h(
            'button',
            { class: `tab${t.id === currentId ? ' active' : ''}`, onClick: () => switchTab(t.id), type: 'button' },
            h('kbd', {}, String(i + 1)),
            h('span', {}, t.icon),
            h('span', { class: 'tab-label' }, t.label),
            t.id === 'character' && p.points > 0 ? h('span', { class: 'badge-dot', title: 'Unspent attunement points' }) : null,
            t.id === 'glyphdeep' && game.save.rogue.run ? h('span', { class: 'badge-dot', title: 'A descent is in progress' }) : null,
          ),
        ),
      ),
      h(
        'div',
        { class: 'header-right' },
        h('div', { class: 'level-badge', title: 'Level' }, p.level),
        h(
          'div',
          { class: 'xp-wrap' },
          h('div', { class: 'xp-label' }, h('span', {}, 'Experience'), h('span', {}, `${formatNumber(p.xp)} / ${formatNumber(need)}`)),
          h('div', { class: 'xp-bar' }, h('div', { class: 'xp-fill', style: { width: `${Math.min(100, (p.xp / need) * 100)}%` } })),
        ),
        h('div', { class: 'gold-chip', title: 'Gold' }, '💰', formatNumber(p.gold)),
      ),
    );
  }

  function switchTab(id) {
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    if (current && current.unmount) current.unmount();
    clear(body);
    currentId = tab.id;
    current = tab.create(game, camp);
    current.mount(body);
    renderHeader();
    game.audio.click();
  }

  const camp = {
    mount(root, params = {}) {
      header = h('div', { class: 'camp-header panel' });
      body = h('div', { class: 'camp-body' });
      root.appendChild(h('div', { class: 'camp' }, header, body));
      switchTab(params.tab || 'map');
    },
    unmount() {
      if (current && current.unmount) current.unmount();
      current = null;
    },
    update(dt, now) {
      if (current && current.update) current.update(dt, now);
    },
    onKey(e) {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT') return;
      if (/^[1-6]$/.test(e.key)) {
        switchTab(TABS[Number(e.key) - 1].id);
        return;
      }
      if (current && current.onKey) current.onKey(e);
    },
    refreshHeader: renderHeader,
    switchTab,
  };
  return camp;
}
