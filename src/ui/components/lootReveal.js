import { h, centerOf, kbd, fill } from '../dom.js';
import { createModal } from './modal.js';
import { lootCard, rarityColor, markEquipped, hideTooltip } from './itemView.js';
import { goalsStrip } from './goalsStrip.js';
import { RARITY_INDEX } from '../../data/items.js';
import { ZONES } from '../../data/zones.js';
import { BOON_BY_ID } from '../../data/boons.js';
import { chainBonus, xpToNext, prevChainMilestoneAt } from '../../logic/progression.js';
import { isUpgrade, itemScore, slotIcon } from '../../logic/loot.js';
import { boonText } from '../../logic/boons.js';
import { nearestGoals } from '../../logic/goals.js';
import { newCharsForZone } from '../../logic/keyboard.js';
import { banner } from '../fx/floaters.js';

function statRow(summary) {
  const mins = Math.floor(summary.duration / 60);
  const secs = Math.round(summary.duration % 60);
  const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
  return h(
    'div',
    { class: 'stat-row' },
    stat(Math.round(summary.avgWpm), 'Avg WPM'),
    stat(`${(summary.accuracy * 100).toFixed(1)}%`, 'Accuracy'),
    stat(summary.maxCombo, 'Best combo'),
    stat(`${mins}:${String(secs).padStart(2, '0')}`, 'Time'),
  );
}

function countUp(el, to, ms = 700, prefix = '', suffix = '') {
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / ms);
    el.textContent = `${prefix}${Math.round(to * (1 - Math.pow(1 - k, 3)))}${suffix}`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Wrap modal key handling so stray keystrokes right after a fight don't skip the screen. */
function guardKeys(m, ms = 450) {
  const opened = performance.now();
  const inner = m.onKey;
  m.onKey = (e) => {
    if (performance.now() - opened < ms) {
      e.preventDefault();
      return;
    }
    inner(e);
  };
}

function revealItems(game, cards, items, baseDelay) {
  items.forEach((item, i) => {
    setTimeout(() => {
      const el = cards[i];
      if (!el || !el.isConnected) return;
      const ri = RARITY_INDEX[item.rarity];
      game.audio.loot(ri);
      const c = centerOf(el);
      game.fx.burst(c.x, c.y, { count: 16 + ri * 16, colors: [rarityColor(item), '#ffffff'], speed: 220 + ri * 60 });
      if (ri >= 3) game.fx.ring(c.x, c.y, rarityColor(item), 140);
      if (item.rarity === 'legendary') {
        banner('LEGENDARY!', { color: '#fb923c', sub: item.name, size: 'small', duration: 2200 });
        game.fx.shake(10, 400);
      }
    }, baseDelay + i * 380 + 120);
  });
}

const sup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** "🔥² 🛡️ 🕊️" */
export function boonIcons(boons = {}) {
  return Object.entries(boons)
    .filter(([id, r]) => r > 0 && BOON_BY_ID[id])
    .map(([id, r]) => `${BOON_BY_ID[id].icon}${r > 1 ? sup(r) : ''}`)
    .join(' ');
}

export function boonCard(offer, { index = null, onClick = null } = {}) {
  const def = BOON_BY_ID[offer.id];
  const rankTag = offer.rank === 1 ? 'NEW' : `${ROMAN[offer.rank - 1]} → ${ROMAN[offer.rank]}`;
  return h(
    'div',
    { class: `boon-card panel${offer.rank > 1 ? ' upgrade' : ''}`, onClick },
    index != null ? h('div', { class: 'bc-key' }, kbd(String(index + 1))) : null,
    h('div', { class: 'bc-icon' }, def.icon),
    h('div', { class: 'bc-name' }, def.name),
    h('div', { class: 'bc-rank' }, rankTag),
    h('div', { class: 'bc-text' }, boonText(offer.id, offer.rank)),
  );
}

/**
 * Quick-equip for loot cards: keeps the ▲ marks current and equips the best pending upgrade on E.
 * entries: [{ item, card }]
 */
export function createQuickEquip(game, entries) {
  const hint = h('div', { class: 'quick-equip' });
  const isPending = (e) => !e.card.classList.contains('equipped')
    && game.save.inventory.some((i) => i.id === e.item.id)
    && isUpgrade(e.item, game.save.equipment);
  const pending = () => entries
    .filter(isPending)
    .map((e) => ({ e, gain: itemScore(e.item) - itemScore(game.save.equipment[e.item.slot]) }))
    .sort((a, b) => b.gain - a.gain)
    .map((x) => x.e);

  function refresh() {
    for (const e of entries) {
      if (e.card.classList.contains('equipped')) continue;
      const up = isPending(e);
      e.card.classList.toggle('upgrade', up);
      const label = e.card.querySelector('.lc-up');
      if (up && !label) e.card.appendChild(h('div', { class: 'lc-up' }, '▲ Upgrade'));
      if (!up && label) label.remove();
    }
    const first = pending()[0];
    hint.style.visibility = first ? 'visible' : 'hidden';
    fill(hint, first ? [kbd('E'), ' Equip ', h('b', { style: { color: rarityColor(first.item) } }, first.item.name)] : '');
  }

  function equip(e) {
    if (!e || !isPending(e)) return false;
    if (!game.equipItem(e.item)) return false;
    markEquipped(e.card);
    game.audio.shield();
    game.toast(`Equipped ${e.item.name}`, { icon: slotIcon(e.item.slot), color: rarityColor(e.item), life: 2000 });
    refresh();
    return true;
  }

  for (const e of entries) {
    e.card.addEventListener('click', () => {
      hideTooltip();
      equip(e);
    });
    e.card.style.cursor = 'pointer';
  }
  refresh();
  return { hint, refresh, equipBest: () => equip(pending()[0]) };
}

function nextMilestoneRow(next, chainAfter) {
  const prev = prevChainMilestoneAt(chainAfter);
  const total = next.chain - prev;
  const done = chainAfter - prev;
  const n = next.chain - chainAfter;
  return h(
    'div',
    { class: 'next-milestone' },
    h('div', { class: 'pips' }, Array.from({ length: total }, (_, i) => h('i', { class: i < done ? 'on' : '' }))),
    h('span', {}, `Next: ${next.icon} ${next.name} at chain ${next.chain} — ${n} more ${n === 1 ? 'win' : 'wins'}`),
  );
}

export function createVictoryPanel(game, { rewards, summary, kind, zoneIndex, mode, onContinue, onCamp }) {
  const boss = kind === 'boss';
  const title = boss ? (rewards.zoneCleared ? 'REGION CLEARED' : 'BOSS DEFEATED') : kind === 'glimmerkin' ? 'JACKPOT!' : 'VICTORY';
  const xpEl = h('span', { class: 'xp' }, '+0 XP');
  const goldEl = h('span', { class: 'gold' }, '+0 gold');
  const eq = game.save.equipment;
  const ms = rewards.milestone || null;
  const msItems = ms ? ms.items : [];
  const items = [...rewards.items, ...msItems];
  const cards = items.map((it, i) =>
    lootCard(it, 300 + i * 380, {
      compare: eq[it.slot] || null,
      upgrade: isUpgrade(it, eq),
      tag: i >= rewards.items.length ? 'Chain reward' : '',
    }),
  );
  const quick = createQuickEquip(game, items.map((item, i) => ({ item, card: cards[i] })));
  const p = game.save.player;

  const extras = [];
  if (rewards.levelsGained) {
    extras.push(h('div', { class: 'levelup' }, `LEVEL UP! You are now level ${rewards.newLevel}`));
    extras.push(h('div', { class: 'dim', style: { textAlign: 'center', fontSize: '13px' } }, `+${rewards.levelsGained} attunement point${rewards.levelsGained > 1 ? 's' : ''} — spend them in the Character tab`));
  }
  if (rewards.zoneUnlocked != null) {
    const nz = ZONES[rewards.zoneUnlocked];
    const fresh = [...newCharsForZone(game.layoutId, rewards.zoneUnlocked)].filter((c) => c !== ' ');
    const runeText = nz.modifiers.includes('shift') ? 'Shift + capitals' : fresh.slice(0, 14).join(' ');
    extras.push(
      h(
        'div',
        { class: 'unlock-box' },
        h('div', { class: 'section-label' }, 'New region unlocked'),
        h('div', { style: { fontFamily: 'var(--font-title)', fontSize: '22px', margin: '4px 0' } }, `${nz.icon} ${nz.name}`),
        h('div', { class: 'dim' }, `New runes: ${runeText}`),
      ),
    );
  }
  if (rewards.bossReady) extras.push(h('div', { class: 'unlock-box' }, `${ZONES[zoneIndex].boss.icon} The boss of this region has awakened! Challenge it from the map.`));
  const autoSold = rewards.autoSold.length + (ms ? ms.autoSold.length : 0);
  if (autoSold) extras.push(h('div', { class: 'dim', style: { textAlign: 'center', fontSize: '12px' } }, `Inventory full — auto-sold ${autoSold} item(s).`));

  const hunting = mode === 'hunt' && !boss;
  const offer = hunting ? rewards.boonOffer || [] : [];
  let selected = 0;
  const pickContinue = (i = selected) => onContinue(offer[i] ? offer[i].id : null);
  const boonCards = offer.map((o, i) => boonCard(o, { index: i, onClick: () => pickContinue(i) }));
  const renderSelected = () => boonCards.forEach((c, i) => c.classList.toggle('selected', i === selected));
  renderSelected();
  const owned = game.hunt ? boonIcons(game.hunt.boons) : '';
  const boonSection = offer.length
    ? h(
        'div',
        { class: 'boon-pick' },
        h('div', { class: 'section-label' }, 'Choose a boon — it lasts until you return to camp'),
        h('div', { class: 'boon-row' }, boonCards),
        h('div', { class: 'faint boon-hint' }, '1–3 pick & continue · ←/→ select · Enter takes the highlighted boon'),
        owned ? h('div', { class: 'boon-owned' }, `Your boons: ${owned}`) : null,
      )
    : null;

  const goals = nearestGoals(game.save, { layoutId: game.layoutId, zoneIndex, max: 4 })
    .filter((g) => !(rewards.bossReady && g.id === 'boss'))
    .slice(0, 3);

  const nextBonus = Math.round(chainBonus(rewards.chainAfter) * 100);
  const actions = !hunting
    ? [{ label: 'Return to camp', hotkey: 'Enter', key: ['Enter', 'Escape'], primary: true, onClick: onCamp }]
    : [
        { label: `Continue the hunt (chain ${rewards.chainAfter} · +${nextBonus}% loot)`, hotkey: 'Enter', key: 'Enter', primary: true, onClick: () => pickContinue() },
        { label: 'Return to camp & bank gold', hotkey: 'Esc', key: 'Escape', onClick: onCamp },
      ];

  const satchelNote = mode === 'hunt' && game.hunt ? `Satchel: ${game.hunt.satchel} gold — banked when you return to camp` : '';
  const head = [
    h('h1', { class: 'result-title victory' }, title),
    statRow(summary),
    h('div', { class: 'reward-row' }, xpEl, goldEl),
    satchelNote ? h('div', { class: 'faint', style: { textAlign: 'center', fontSize: '12px', marginTop: '-8px' } }, satchelNote) : null,
    h('div', { class: 'xp-bar', style: { height: '6px' } }, h('div', { class: 'xp-fill', style: { width: `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%` } })),
  ];
  const lootBlock = [
    ms
      ? h(
          'div',
          { class: 'milestone-box' },
          h('div', { class: 'mb-title' }, `${ms.def.icon} Chain ${rewards.chainAfter} — ${ms.def.name}`),
          h('div', { class: 'dim' }, ms.def.desc),
        )
      : null,
    items.length ? h('div', { class: 'loot-row' }, cards) : h('div', { class: 'faint', style: { textAlign: 'center' } }, 'No items dropped this time.'),
    items.length ? quick.hint : null,
    hunting && rewards.nextMilestone ? nextMilestoneRow(rewards.nextMilestone, rewards.chainAfter) : null,
    extras,
  ];
  const goalsEl = goalsStrip(goals);
  // With a boon choice the panel gets two columns so everything fits without scrolling.
  const body = boonSection
    ? [head, h('div', { class: 'victory-cols' }, h('div', { class: 'vc-col' }, lootBlock), h('div', { class: 'vc-col' }, goalsEl, boonSection))]
    : [head, goalsEl, lootBlock];
  const m = createModal({
    title: null,
    cls: `victory${boonSection ? ' wide' : ''}`,
    content: h('div', { class: 'victory-body' }, body),
    actions,
    onKey: (e) => {
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        quick.equipBest();
        return true;
      }
      if (offer.length) {
        if (/^[1-3]$/.test(e.key) && offer[Number(e.key) - 1]) {
          e.preventDefault();
          pickContinue(Number(e.key) - 1);
          return true;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          selected = (selected + (e.key === 'ArrowRight' ? 1 : offer.length - 1)) % offer.length;
          renderSelected();
          game.audio.click();
          return true;
        }
      }
      return false;
    },
  });
  m.onOpen = () => {
    countUp(xpEl, rewards.xp, 700, '+', ' XP');
    countUp(goldEl, rewards.gold, 900, '+', ' gold');
    game.audio.coin();
    revealItems(game, cards, items, 300);
    if (rewards.zoneUnlocked != null) setTimeout(() => game.audio.levelUp(), 900);
    if (ms) {
      setTimeout(() => {
        if (!m.el.isConnected) return;
        banner(`CHAIN ${rewards.chainAfter}`, { sub: `${ms.def.icon} ${ms.def.name}`, color: '#ffb35c', size: 'small' });
        game.audio.banner();
      }, 250);
    }
  };
  guardKeys(m);
  return m;
}

function defeatTip(summary) {
  if (summary.fizzles >= 2) return 'Fizzles cost twice: lost damage and backfire. Take a Cantrip when a big spell feels shaky.';
  if (summary.accuracy < 0.92) return "Accuracy beats speed — each mistake costs 12% of a spell's power. Ease off a little.";
  return 'Ward and Nature spells buy time. Cast one when the enemy winds up.';
}

export function createDefeatPanel(game, { summary, lost, enemy, mode, zoneIndex, nextMilestone, chain = 0, boons = {}, onRetry, onCamp }) {
  const pct = Math.max(1, Math.round((enemy ? enemy.hpPct : 1) * 100));
  const hot = enemy && enemy.hpPct <= 0.25;
  const n = nextMilestone ? nextMilestone.chain - chain : Infinity;
  const fading = boonIcons(boons);
  const goals = nearestGoals(game.save, { layoutId: game.layoutId, zoneIndex, max: 2 });
  const m = createModal({
    title: null,
    content: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('h1', { class: 'result-title defeat' }, 'YOU HAVE FALLEN'),
      statRow(summary),
      enemy ? h('div', { class: `so-close${hot ? ' hot' : ''}` }, hot ? `So close! ${enemy.name} had only ${pct}% health left.` : `${enemy.name} had ${pct}% health left.`) : null,
      mode === 'hunt' && nextMilestone && n <= 2
        ? h('div', { class: 'dim', style: { textAlign: 'center' } }, `You were ${n} ${n === 1 ? 'win' : 'wins'} from ${nextMilestone.icon} ${nextMilestone.name}.`)
        : null,
      h('p', { style: { textAlign: 'center' } }, lost ? `You drop ${lost} gold from your satchel as you flee. Your items are safe.` : 'Your items are safe. Rest, re-equip and try again.'),
      fading ? h('div', { class: 'faint', style: { textAlign: 'center', fontSize: '13px' } }, `Your boons fade: ${fading}`) : null,
      h('p', { style: { textAlign: 'center', fontSize: '13px' } }, `Tip: ${defeatTip(summary)}`),
      goalsStrip(goals),
    ),
    actions: [
      { label: mode === 'boss' ? `Rematch ${enemy ? enemy.name : 'the boss'}` : 'Hunt again', hotkey: 'Enter', key: 'Enter', primary: true, onClick: onRetry },
      { label: 'Return to camp', hotkey: 'Esc', key: 'Escape', onClick: onCamp },
    ],
  });
  guardKeys(m, 700);
  return m;
}

export function createEscapedPanel(game, { summary, onContinue, onCamp }) {
  const m = createModal({
    title: null,
    content: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      h('h1', { class: 'result-title', style: { color: '#ffe066' } }, 'IT GOT AWAY'),
      statRow(summary),
      h('p', { style: { textAlign: 'center' } }, 'The Glimmerkin vanished with its gold. Be quicker next time — high-tier spells end it fast.'),
    ),
    actions: [
      { label: 'Continue the hunt', hotkey: 'Enter', key: 'Enter', primary: true, onClick: onContinue },
      { label: 'Return to camp', hotkey: 'Esc', key: 'Escape', onClick: onCamp },
    ],
  });
  guardKeys(m);
  return m;
}

/** Chest opening: shake → flash → item. */
export function createChestReveal(game, { chest, item, onClose, onAgain, canAgain }) {
  const icon = h('div', { class: 'chest-icon shaking' }, chest.icon);
  const stage = h('div', { class: 'chest-stage' }, icon);
  const actions = [{ label: 'Close', hotkey: 'Esc', key: ['Escape', 'Enter'], onClick: onClose }];
  if (canAgain) actions.push({ label: `Open another (${chest.costNow}g)`, hotkey: 'Space', key: ' ', primary: true, onClick: onAgain });
  const eq = game.save.equipment;
  let quick = null;
  const m = createModal({
    title: chest.name,
    content: stage,
    actions,
    onKey: (e) => {
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (quick) quick.equipBest();
        return true;
      }
      return false;
    },
  });
  m.onOpen = () => {
    game.audio.windup();
    setTimeout(() => {
      if (!stage.isConnected) return;
      const rc = rarityColor(item);
      stage.innerHTML = '';
      stage.style.setProperty('--rc', rc);
      const card = lootCard(item, 0, { compare: eq[item.slot] || null, upgrade: isUpgrade(item, eq) });
      quick = createQuickEquip(game, [{ item, card }]);
      stage.append(h('div', { class: 'chest-flash' }), card, quick.hint);
      const c = centerOf(stage);
      const ri = RARITY_INDEX[item.rarity];
      game.fx.burst(c.x, c.y, { count: 40 + ri * 25, colors: [rc, '#ffffff'], speed: 320 + ri * 60, life: 1 });
      game.fx.ring(c.x, c.y, rc, 160);
      game.fx.shake(4 + ri * 2, 300);
      game.audio.loot(ri);
      if (item.rarity === 'legendary') banner('LEGENDARY!', { color: '#fb923c', sub: item.name, size: 'small', duration: 2200 });
    }, 900);
  };
  guardKeys(m, 950);
  return m;
}
