import { h, button, fill } from '../dom.js';
import { SLOTS, UNIQUES } from '../../data/items.js';
import { BAL } from '../../data/balance.js';
import { ATTUNEMENTS } from '../../logic/stats.js';
import { sellValue, itemScore } from '../../logic/loot.js';
import { itemTile, hideTooltip } from '../components/itemView.js';
import { confirmModal } from '../components/modal.js';

const pct = (v) => `${Math.round(v * 100)}%`;


export function createCharacterTab(game, camp) {
  let root;
  let equipCol;
  let statsCol;
  let invCol;

  const save = () => game.save;

  function afterChange() {
    hideTooltip();
    game.refreshStats();
    game.persist();
    render();
    camp.refreshHeader();
  }

  function equip(item) {
    if (game.equipItem(item)) {
      game.audio.shield();
      afterChange();
    }
  }

  function unequip(slot) {
    const s = save();
    const item = s.equipment[slot];
    if (!item) return;
    if (s.inventory.length >= BAL.inventorySize) {
      game.toast('Inventory full', { icon: '🎒', sub: 'Sell something first', color: '#ff5566' });
      return;
    }
    s.equipment[slot] = null;
    s.inventory.push(item);
    game.audio.click();
    afterChange();
  }

  function sell(item) {
    const s = save();
    const idx = s.inventory.findIndex((i) => i.id === item.id);
    if (idx < 0) return;
    s.inventory.splice(idx, 1);
    const v = sellValue(item);
    s.player.gold += v;
    game.audio.coin();
    game.toast(`Sold ${item.name}`, { icon: '💰', sub: `+${v} gold`, color: '#f5c66b', life: 1600 });
    afterChange();
  }

  function sellAllOf(rarity) {
    const s = save();
    const list = s.inventory.filter((i) => i.rarity === rarity);
    if (!list.length) return;
    const total = list.reduce((a, i) => a + sellValue(i), 0);
    confirmModal(game, {
      title: `Sell ${list.length} ${rarity} item${list.length > 1 ? 's' : ''}?`,
      text: `You will receive ${total} gold.`,
      confirmLabel: 'Sell',
      onConfirm: () => {
        s.inventory = s.inventory.filter((i) => i.rarity !== rarity);
        s.player.gold += total;
        game.audio.coin();
        afterChange();
      },
    });
  }

  function renderEquip() {
    fill(equipCol, h('div', { class: 'section-label' }, 'Equipment'));
    for (const slot of SLOTS) {
      const item = save().equipment[slot.id];
      equipCol.appendChild(
        h(
          'div',
          { class: 'equip-slot' },
          item ? itemTile(item, { onClick: () => unequip(slot.id), hint: 'click to unequip' }) : h('div', { class: 'tile empty' }, slot.icon),
          h(
            'div',
            {},
            h('div', { class: 'es-label' }, slot.name),
            h('div', { class: 'es-name', style: { color: item ? `var(--r-${item.rarity})` : 'var(--text-faint)' } }, item ? item.name : 'Empty'),
          ),
        ),
      );
    }
    const uniques = [...game.stats.uniques];
    if (uniques.length) {
      equipCol.appendChild(h('div', { class: 'section-label', style: { marginTop: '6px' } }, 'Legendary powers'));
      for (const u of uniques) equipCol.appendChild(h('div', { class: 'unique-line' }, `★ ${UNIQUES[u].name}: ${UNIQUES[u].text}`));
    }
  }

  function renderStats() {
    const st = game.stats;
    const p = save().player;
    const rows = [
      ['Maximum health', st.maxHp],
      ['Spell power', pct(st.powerMult)],
      ['Critical chance', pct(st.critChance)],
      ['Critical damage', pct(st.critMult)],
      ['Flow gain', pct(st.flowGainMult)],
      ['Gold find', pct(st.goldMult)],
      ['Item rarity bonus', `+${Math.round(st.magicFind)}%`],
      ['Extra mistakes allowed', `+${st.tolerance}`],
    ];
    if (st.tempoPct) rows.push(['Enemy attack delay', `+${st.tempoPct}%`]);
    if (st.healMult > 1) rows.push(['Healing', pct(st.healMult)]);
    if (st.shieldMult > 1) rows.push(['Shield strength', pct(st.shieldMult)]);
    for (const [k, v] of Object.entries(st.schoolPct)) if (v) rows.push([`${k[0].toUpperCase()}${k.slice(1)} damage`, `+${v}%`]);
    if (st.perfectBonus) rows.push(['Perfect cast bonus', `+${st.perfectBonus}%`]);
    if (st.swiftness) rows.push(['Speed bonus', `+${st.swiftness}%`]);
    if (st.leechPct) rows.push(['Spell leech', `${st.leechPct}%`]);

    fill(statsCol, 
      h('div', { class: 'section-label' }, `Level ${p.level} Spellstroke`),
      h('div', { class: 'stat-list' }, rows.flatMap(([k, v]) => [h('div', { class: 'dim' }, k), h('div', { class: 'sv' }, v)])),
      h(
        'div',
        { class: 'section-label', style: { marginTop: '10px', display: 'flex', justifyContent: 'space-between' } },
        h('span', {}, 'Attunements'),
        h('span', { style: { color: p.points ? 'var(--gold)' : 'var(--text-faint)' } }, `${p.points} point${p.points === 1 ? '' : 's'} available`),
      ),
      ATTUNEMENTS.map((a) =>
        h(
          'div',
          { class: 'attune-row' },
          h('div', { class: 'ar-icon' }, a.icon),
          h('div', { class: 'ar-text' }, h('div', { class: 'ar-name' }, a.name), h('div', { class: 'ar-desc' }, `${a.desc} per point`)),
          h('div', { class: 'ar-val' }, p.attune[a.id]),
          button('+', {
            cls: 'small',
            disabled: p.points <= 0,
            onClick: () => {
              p.attune[a.id] += 1;
              p.points -= 1;
              game.audio.levelUp();
              afterChange();
            },
          }),
        ),
      ),
      button('Reset attunements (free)', {
        cls: 'small ghost',
        onClick: () => {
          const spent = Object.values(p.attune).reduce((x, y) => x + y, 0);
          if (!spent) return;
          for (const k of Object.keys(p.attune)) p.attune[k] = 0;
          p.points += spent;
          afterChange();
        },
      }),
    );
  }

  function renderInv() {
    const s = save();
    const grid = h('div', { class: 'inv-grid' });
    for (let i = 0; i < BAL.inventorySize; i++) {
      const item = s.inventory[i];
      if (!item) {
        grid.appendChild(h('div', { class: 'inv-slot-empty' }));
        continue;
      }
      const eq = s.equipment[item.slot];
      grid.appendChild(
        itemTile(item, {
          compare: eq || null,
          upgrade: itemScore(item) > itemScore(eq),
          hint: 'click: equip · shift+click: sell',
          onClick: (e) => (e.shiftKey ? sell(item) : equip(item)),
        }),
      );
    }
    fill(invCol, 
      h('div', { class: 'section-label', style: { display: 'flex', justifyContent: 'space-between' } }, h('span', {}, 'Inventory'), h('span', {}, `${s.inventory.length} / ${BAL.inventorySize}`)),
      grid,
      h('div', { class: 'faint', style: { fontSize: '12px' } }, 'Click to equip · Shift+click to sell · ▲ marks likely upgrades'),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        button('Sell all Common', { cls: 'small', onClick: () => sellAllOf('common') }),
        button('Sell all Uncommon', { cls: 'small', onClick: () => sellAllOf('uncommon') }),
      ),
    );
  }

  function render() {
    renderEquip();
    renderStats();
    renderInv();
  }

  return {
    mount(container) {
      equipCol = h('div', { class: 'char-col equip-col panel' });
      statsCol = h('div', { class: 'char-col stats-col panel' });
      invCol = h('div', { class: 'char-col inv-col panel' });
      root = h('div', { class: 'tab-content' }, equipCol, statsCol, invCol);
      container.appendChild(root);
      render();
    },
    unmount() {
      hideTooltip();
    },
  };
}
