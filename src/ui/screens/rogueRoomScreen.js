// Glyphdeep rooms without a fight: campfire (rest / temper), the Ink Merchant, treasure (PLAN §13.9).
import { h, kbd, fill, pulseClass } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { ROGUE } from '../../data/balance.js';
import { DOOR_TYPES, RELIC_BY_ID } from '../../data/rogue.js';
import { BOON_BY_ID } from '../../data/boons.js';
import { TEMPER_EVENT } from '../../data/events.js';
import { stratumZone, circleLabel, rollShop, rollRelicOffer, temperCandidates, runCurses, removeRelic, fightCoins } from '../../logic/rogue.js';
import { keySummary } from '../../logic/mastery.js';
import { runChips, hpBar, relicCard } from '../components/rogueView.js';
import { boonCard } from '../components/lootReveal.js';
import { DOOR_COLORS } from './rogueMapScreen.js';

export function createRogueRoomScreen(game) {
  let els = null;
  let door = null;
  let run = null;
  let state = 'choose'; // campfire: choose | temper | done · shop: shop · treasure: choose | done
  let resultAt = 0;

  const maxHp = () => game.fightStats.maxHp;

  function topBar() {
    const label = circleLabel(game.layoutId, run.circle);
    const max = maxHp();
    return h('div', { class: 'combat-top panel' }, h('span', { class: 'zone-tag' }, `🌀 The Glyphdeep · Circle ${label.roman}`), hpBar(run.hp ?? max, max), runChips(game, run));
  }

  function refreshTop() {
    if (!els) return;
    const t = topBar();
    els.top.replaceWith(t);
    els.top = t;
  }

  function hints(list) {
    return h('div', { class: 'event-hints dim' }, list.map(([k, label], i) => [i ? ' · ' : '', kbd(k), ` ${label}`]));
  }

  function build(root, intro) {
    const t = DOOR_TYPES[door.type];
    const zone = ZONES[stratumZone(run.depth + 1)];
    const top = topBar();
    const body = h('div', { class: 'event-body' });
    const result = h('div', { class: 'event-result' });
    const keys = h('div', {});
    const panel = h('div', { class: `event-panel panel room-${door.type}` }, h('div', { class: 'event-icon' }, t.icon), h('h2', {}, t.name), h('p', { class: 'event-intro' }, intro), body, result, keys);
    const screen = h('div', { class: 'event-screen', style: { '--zone-accent': DOOR_COLORS[door.type] || zone.palette.accent } }, top, panel);
    root.appendChild(screen);
    els = { screen, top, panel, body, result, keys };
  }

  function finish(title, content = [], ok = true) {
    state = 'done';
    resultAt = performance.now();
    fill(els.body);
    fill(els.result, h('div', { class: `er-title${ok ? ' ok' : ''}` }, title), content);
    fill(els.keys, hints([['Enter', 'continue the descent']]));
    els.panel.classList.add(ok ? 'success' : 'failed');
    pulseClass(els.panel, 'bump', 300);
    refreshTop();
    game.persist();
  }

  function heal(pct) {
    const max = maxHp();
    const before = run.hp ?? max;
    run.hp = Math.min(max, before + Math.round(max * pct));
    return Math.round(run.hp - before);
  }

  // ------------------------------------------------------------ campfire

  function campfire() {
    const pct = ROGUE.campfireHeal + (game.fightStats.campfireBonus || 0);
    const option = (key, icon, name, text) => h('div', { class: 'boon-card panel room-option', onClick: () => (key === '1' ? rest() : chooseTemper()) }, h('div', { class: 'bc-key' }, kbd(key)), h('div', { class: 'bc-icon' }, icon), h('div', { class: 'bc-name' }, name), h('div', { class: 'bc-text' }, text));
    fill(
      els.body,
      h(
        'div',
        { class: 'boon-row', style: { gridTemplateColumns: 'repeat(2, minmax(0, 260px))', justifyContent: 'center' } },
        option('1', '💤', 'Rest', `Heal ${Math.round(pct * 100)}% of your health (${Math.round(maxHp() * pct)})`),
        option('2', '🔨', 'Temper a rune', `Drill one of your weakest keys. ${Math.round(ROGUE.temperAcc * 100)}% accuracy: +${Math.round(ROGUE.temperBonus * 100)}% power on that key for this descent`),
      ),
    );
    fill(els.keys, hints([['1', 'rest'], ['2', 'temper a rune']]));
    state = 'choose';
  }

  function rest() {
    if (state !== 'choose') return;
    const healed = heal(ROGUE.campfireHeal + (game.fightStats.campfireBonus || 0));
    game.audio.heal();
    finish(`You rest by the fire and recover ${healed} health.`);
  }

  function chooseTemper() {
    if (state !== 'choose') return;
    if (!door.candidates) door.candidates = temperCandidates(game.save.keyStats, game.layoutId, run.circle, run, game.rng);
    if (!door.candidates.length) {
      game.toast('Every rune is fully tempered', { icon: '🔨' });
      return;
    }
    state = 'temper';
    game.persist();
    fill(
      els.body,
      h('div', { class: 'section-label' }, 'Which rune will you temper?'),
      h(
        'div',
        { class: 'boon-row', style: { gridTemplateColumns: `repeat(${door.candidates.length}, minmax(0, 200px))`, justifyContent: 'center' } },
        door.candidates.map((ch, i) => {
          const st = game.save.keyStats[ch];
          const sum = keySummary(st);
          const rank = run.tempered[ch] || 0;
          return h(
            'div',
            { class: 'boon-card panel room-option', onClick: () => temper(i) },
            h('div', { class: 'bc-key' }, kbd(String(i + 1))),
            h('div', { class: 'bc-icon temper-key' }, h('span', { class: 'keycap' }, ch)),
            h('div', { class: 'bc-rank' }, rank ? `TEMPERED ${'I'.repeat(rank)} → ${'I'.repeat(rank + 1)}` : 'UNTEMPERED'),
            h('div', { class: 'bc-text' }, st && st.n ? `${Math.round(sum.acc * 100)}% accuracy · ${sum.medianMs != null ? `${Math.round(sum.medianMs)} ms` : '– ms'}` : 'Not practised yet'),
          );
        }),
      ),
    );
    fill(els.keys, hints([['1–3', 'temper that rune'], ['Esc', 'back']]));
  }

  function temper(i) {
    const ch = door.candidates && door.candidates[i];
    if (state !== 'temper' || !ch) return;
    game.showScreen('event', { event: TEMPER_EVENT, ch });
  }

  // ------------------------------------------------------------ shop

  function shop() {
    if (!door.stock) {
      door.stock = rollShop(game.rng, run);
      game.persist();
    }
    state = 'shop';
    renderShop();
  }

  function itemView(it) {
    const price = it.sold ? 'SOLD' : `🪙 ${it.price}`;
    const poor = !it.sold && run.coins < it.price;
    const wrap = (inner) => {
      inner.classList.toggle('sold', it.sold);
      inner.classList.toggle('poor', poor);
      inner.addEventListener('click', () => buy(it.key));
      return inner;
    };
    if (it.kind === 'relic') return wrap(relicCard(it.id, { index: Number(it.key) - 1, price: it.price, sold: it.sold }));
    let icon;
    let name;
    let text;
    if (it.kind === 'boon') {
      const card = boonCard({ id: it.id, rank: it.rank }, { index: Number(it.key) - 1 });
      card.appendChild(h('div', { class: 'bc-price' }, price));
      return wrap(card);
    }
    if (it.kind === 'heal') [icon, name, text] = ['🧪', 'Mending Draught', `Heal ${Math.round(ROGUE.shopHeal * 100)}% of your health`];
    else if (it.kind === 'reroll') [icon, name, text] = ['🎲', 'Reroll Token', 'Press R on a reward to roll new choices'];
    else {
      const c = runCurses(run)[0];
      [icon, name, text] = ['🕯️', 'Cleansing Candle', c ? `Lift the curse ${RELIC_BY_ID[c].name}` : 'No curse to lift'];
    }
    return wrap(h('div', { class: 'boon-card panel' }, h('div', { class: 'bc-key' }, kbd(it.key)), h('div', { class: 'bc-icon' }, icon), h('div', { class: 'bc-name' }, name), h('div', { class: 'bc-rank' }, it.kind.toUpperCase()), h('div', { class: 'bc-text' }, text), h('div', { class: 'bc-price' }, price)));
  }

  function renderShop() {
    fill(
      els.body,
      h('div', { class: 'dim' }, `You carry 🪙 ${run.coins} coins.`),
      h('div', { class: 'shop-grid' }, door.stock.map(itemView)),
    );
    fill(els.keys, hints([[`1–${door.stock.length}`, 'buy'], ['Enter', 'leave and descend']]));
  }

  function buy(key) {
    if (state !== 'shop') return;
    const it = door.stock.find((x) => x.key === key);
    if (!it || it.sold) return;
    if (run.coins < it.price) {
      game.toast('Not enough coins', { icon: '🪙', sub: `It costs ${it.price}`, color: '#ff5566' });
      game.audio.error();
      return;
    }
    if (it.kind === 'cleanse' && !runCurses(run).length) return;
    if (it.kind === 'heal' && (run.hp ?? maxHp()) >= maxHp()) {
      game.toast('Already at full health', { icon: '🧪', sub: 'Save the draught for when you need it', color: '#9fb4ff' });
      game.audio.soft();
      return;
    }
    run.coins -= it.price;
    it.sold = true;
    let msg;
    if (it.kind === 'relic') {
      game.rogueClaim('relic', it.id);
      msg = RELIC_BY_ID[it.id].name;
    } else if (it.kind === 'boon') {
      game.rogueClaim('boon', it.id);
      msg = BOON_BY_ID[it.id].name;
    } else if (it.kind === 'heal') {
      msg = `+${heal(ROGUE.shopHeal)} health`;
      game.audio.heal();
    } else if (it.kind === 'reroll') {
      run.rerolls += 1;
      msg = '+1 reroll';
    } else {
      const c = runCurses(run)[0];
      removeRelic(run, c);
      msg = `${RELIC_BY_ID[c].name} lifted`;
    }
    game.audio.coin();
    game.toast(`Bought: ${msg}`, { icon: '🛒', color: '#6ee7a8', life: 2000 });
    game.persist();
    refreshTop();
    renderShop();
  }

  // ------------------------------------------------------------ treasure

  function treasure() {
    if (!door.offer) {
      door.offer = rollRelicOffer(game.rng, run, 3);
      door.coins = fightCoins(game.rng, run, { kind: 'elite', door: { reward: 'coins' }, stats: game.fightStats });
      game.persist();
    }
    state = 'choose';
    const n = door.offer.length;
    fill(
      els.body,
      n ? h('div', { class: 'boon-row', style: { gridTemplateColumns: `repeat(${n}, 1fr)` } }, door.offer.map((id, i) => relicCard(id, { index: i, onClick: () => takeTreasure(i) }))) : null,
      h('div', { class: 'dim' }, `…or scoop up 🪙 ${door.coins} coins instead.`),
    );
    fill(els.keys, hints([...(n ? [[`1–${n}`, 'take a relic']] : []), [String(n + 1), `take ${door.coins} coins`]]));
  }

  function takeTreasure(i) {
    if (state !== 'choose') return;
    if (i < door.offer.length) {
      const id = door.offer[i];
      game.rogueClaim('relic', id);
      game.audio.levelUp();
      finish(`You claim the ${RELIC_BY_ID[id].name}.`, [h('div', { class: 'boon-row single' }, relicCard(id))]);
    } else {
      run.coins += door.coins;
      game.audio.coin();
      finish(`You pocket ${door.coins} coins.`);
    }
  }

  // ------------------------------------------------------------ screen interface

  return {
    mount(root, params) {
      run = game.run;
      door = params.door;
      els = null;
      if (!run || !door) {
        game.showScreen('camp', { tab: 'glyphdeep' });
        return;
      }
      const zone = ZONES[stratumZone(run.depth + 1)];
      game.bg.setPalette(zone.palette, zone.ambient);
      const intro = {
        campfire: 'The fire crackles in the dark. Rest your fingers — or sharpen one of your weakest runes.',
        shop: 'A hooded scribe unrolls a cloth of glowing wares. "Coins for craft, traveller."',
        treasure: 'An unguarded reliquary. Nobody will notice one missing relic.',
      }[door.type] || '';
      build(root, intro);
      if (door.type === 'campfire') campfire();
      else if (door.type === 'shop') shop();
      else treasure();
      game.audio.banner();
    },
    unmount() {
      els = null;
    },
    onKey(e) {
      if (!els) return;
      if (e.key === ' ') e.preventDefault();
      if (state === 'done') {
        if (performance.now() - resultAt < 350) return;
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          game.rogueAdvance();
        }
        return;
      }
      if (door.type === 'campfire') {
        if (state === 'choose') {
          if (e.key === '1') rest();
          else if (e.key === '2') chooseTemper();
        } else if (state === 'temper') {
          if (/^[1-3]$/.test(e.key)) temper(Number(e.key) - 1);
          else if (e.key === 'Escape') campfire();
        }
      } else if (door.type === 'shop') {
        if (/^[1-9]$/.test(e.key)) buy(e.key);
        else if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          game.rogueAdvance();
        }
      } else if (door.type === 'treasure') {
        const n = Number(e.key);
        if (n >= 1 && n <= door.offer.length + 1) takeTreasure(n - 1);
      }
    },
  };
}
