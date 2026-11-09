import { h, button, fill } from '../dom.js';
import { CHESTS, RARITIES } from '../../data/items.js';
import { BAL } from '../../data/balance.js';
import { chestCost, openChest } from '../../logic/loot.js';
import { createChestReveal } from '../components/lootReveal.js';

export function createMerchantTab(game, camp) {
  let root;

  const save = () => game.save;
  const highest = () => save().unlockedZone;

  function buy(chest) {
    const s = save();
    const cost = chestCost(chest, highest());
    if (s.player.gold < cost) {
      game.toast('Not enough gold', { icon: '💸', sub: `You need ${cost - s.player.gold} more`, color: '#ff5566' });
      game.audio.error();
      return;
    }
    if (s.inventory.length >= BAL.inventorySize) {
      game.toast('Inventory full', { icon: '🎒', sub: 'Sell something in the Character tab first', color: '#ff5566' });
      return;
    }
    s.player.gold -= cost;
    const item = openChest({ rng: game.rng, chestId: chest.id, highestZone: highest(), magicFind: game.stats.magicFind, pity: s.stats });
    if (item.rarity === 'legendary') s.stats.legendariesFound += 1;
    s.inventory.push(item);
    game.persist();
    camp.refreshHeader();
    render();
    const canAgain = () => s.player.gold >= cost && s.inventory.length < BAL.inventorySize;
    const m = createChestReveal(game, {
      chest: { ...chest, costNow: cost },
      item,
      canAgain: canAgain(),
      onClose: () => game.closeModal(m),
      onAgain: () => {
        game.closeModal(m);
        buy(chest);
      },
    });
    game.openModal(m);
    game.checkAchievements();
  }

  function render() {
    const s = save();
    const pity = s.stats.itemsSinceLegendary || 0;
    fill(root, 
      h('h3', {}, '🧝 The Wandering Merchant'),
      h('p', { class: 'dim', style: { margin: 0, textAlign: 'center', maxWidth: '620px' } }, 'Sealed chests from every corner of Qwerth. Item level follows the furthest region you have reached. Who knows what rattles inside?'),
      h(
        'div',
        { class: 'chest-row' },
        CHESTS.map((c) => {
          const cost = chestCost(c, highest());
          return h(
            'div',
            { class: 'chest-card' },
            h('div', { class: 'cc-icon' }, c.icon),
            h('div', { class: 'cc-name' }, c.name),
            h('div', { class: 'cc-odds' }, c.odds),
            button(`${cost} gold`, { cls: s.player.gold >= cost ? 'primary' : '', onClick: () => buy(c) }),
          );
        }),
      ),
      h('div', { class: 'section-label' }, 'Base rarity odds'),
      h(
        'div',
        { class: 'odds-table' },
        RARITIES.map((r) => {
          const total = RARITIES.reduce((a, x) => a + x.weight, 0);
          return h('span', { style: { color: r.color } }, `${r.name} ${((r.weight / total) * 100).toFixed(1)}%`);
        }),
      ),
      h('div', { class: 'faint', style: { fontSize: '12px' } }, `Legendary pity: ${pity} / ${BAL.pityLegendary} items — a legendary is guaranteed when the bar fills.`),
      h('div', { class: 'progress', style: { width: '320px' } }, h('div', { style: { width: `${Math.min(100, (pity / BAL.pityLegendary) * 100)}%`, background: 'linear-gradient(90deg,#fb923c,#ffe066)' } })),
    );
  }

  return {
    mount(container) {
      root = h('div', { class: 'merchant panel' });
      container.appendChild(h('div', { class: 'tab-content' }, root));
      render();
    },
    unmount() {},
  };
}
