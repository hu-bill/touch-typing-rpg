import { h, kbd, fill, charFromEvent, pulseClass } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { BAL } from '../../data/balance.js';
import { BOON_BY_ID } from '../../data/boons.js';
import { mean, clamp } from '../../core/util.js';
import { allowedChars } from '../../logic/keyboard.js';
import { weakChars, recordKeyTracked } from '../../logic/mastery.js';
import { eventText, mimicTimeLimit, traderPrice, altarMod } from '../../logic/events.js';
import { rollBoonOffer, takeBoon, boonText, boonCount } from '../../logic/boons.js';
import { rollItem, stashItems, isUpgrade } from '../../logic/loot.js';
import { chainBonus } from '../../logic/progression.js';
import { createIncantationView } from '../components/incantation.js';
import { createKeyboardView } from '../components/keyboardView.js';
import { lootCard } from '../components/itemView.js';
import { boonCard, createQuickEquip } from '../components/lootReveal.js';
import { announceMastery } from '../components/masteryToast.js';
import { banner, floatText } from '../fx/floaters.js';
import { ROGUE } from '../../data/balance.js';
import { stratumZone, temperDrill, rollRelicOffer, rollCurse } from '../../logic/rogue.js';
import { runChips, hpBar, relicCard } from '../components/rogueView.js';

const altarText = () => {
  const faster = Math.round((1 / (1 + BAL.altarTempoPct / 100) - 1) * 100);
  return `Next ${BAL.altarFights} fights: enemies attack ${faster}% faster, +${Math.round(BAL.altarGoldMult * 100)}% gold`;
};

/** A hunt event between fights: a short typing challenge or a choice. Never kills, never changes the chain. */
export function createEventScreen(game) {
  let ev;
  let zone;
  let els = null;
  let view = null;
  let keyboard = null;
  let text = '';
  let pos = 0;
  let correct = 0;
  let errors = 0;
  let combo = 0;
  let lastKeyAt = null;
  let timerStart = null;
  let limitSec = 0;
  let done = false;
  let resultAt = 0;
  let quick = null;
  let offer = [];
  let price = 0;
  let params = {};
  let ghostWpm = 0;
  let pact = null;

  const hunt = () => game.hunt;
  const maxHp = () => game.fightStats.maxHp;
  // In the Glyphdeep the "hunt" is the run: text uses the rune circle, coins replace the satchel.
  const rogue = () => !!game.run;
  const textZone = () => (rogue() ? game.run.circle : hunt().zoneIndex);
  const purse = () => (rogue() ? game.run.coins : hunt().satchel);
  const pay = (n) => {
    if (rogue()) game.run.coins += n;
    else hunt().satchel += n;
  };
  const depthNow = () => (rogue() ? game.run.depth + 1 : 0);
  /** Take a boon (the run version also heals the max-health a boon adds). */
  const takeBoonHere = (id) => {
    if (rogue()) {
      game.rogueClaim('boon', id);
      return;
    }
    const hn = hunt();
    takeBoon(hn, id);
    game.save.stats.boonsTaken += 1;
    game.save.stats.bestBoonCount = Math.max(game.save.stats.bestBoonCount, boonCount(hn));
  };

  // ------------------------------------------------------------ DOM

  function topBar() {
    const hn = hunt();
    const hp = Math.round(hn.hp ?? maxHp());
    const pct = clamp((hp / maxHp()) * 100, 0, 100);
    if (rogue()) {
      return h('div', { class: 'combat-top panel' }, h('span', { class: 'zone-tag' }, `🌀 The Glyphdeep · Circle ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][hn.circle]}`), hpBar(hp, maxHp()), runChips(game, hn));
    }
    return h(
      'div',
      { class: 'combat-top panel' },
      h('span', { class: 'zone-tag' }, `${zone.icon} ${zone.name}`),
      h('span', { class: `chip${hn.chain >= 3 ? ' hot' : ''}` }, `🔥 Chain ${hn.chain} · +${Math.round(chainBonus(hn.chain) * 100)}% loot`),
      h('span', { class: 'chip' }, `💰 Satchel ${hn.satchel}`),
      boonCount(hn) ? h('span', { class: 'chip boons' }, `✦ ${boonCount(hn)}`) : null,
      h('span', { class: 'spacer' }),
      h(
        'div',
        { class: 'bar player-hp event-hp' },
        h('div', { class: 'fill', style: { width: `${pct}%` } }),
        h('div', { class: 'bar-text' }, `${hp} / ${maxHp()}`),
      ),
    );
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

  function build(root) {
    const top = topBar();
    const icon = h('div', { class: 'event-icon' }, ev.icon);
    const body = h('div', { class: 'event-body' });
    const result = h('div', { class: 'event-result' });
    const keys = h('div', {});
    const panel = h('div', { class: 'event-panel panel' }, icon, h('h2', {}, ev.name), h('p', { class: 'event-intro' }, ev.intro), body, result, keys);
    const screen = h('div', { class: 'event-screen', style: { '--zone-accent': zone.palette.accent } }, top, panel);
    root.appendChild(screen);
    els = { screen, top, panel, body, result, keys };
  }

  // ------------------------------------------------------------ type events

  function startTyping() {
    const s = game.save;
    const weak = weakChars(s.keyStats, allowedChars(game.layoutId, textZone()), 3);
    text = ev.id === 'temper'
      ? temperDrill(params.ch, { layoutId: game.layoutId, circle: textZone(), rng: game.rng })
      : eventText(ev.id, { layoutId: game.layoutId, zoneIndex: textZone(), rng: game.rng, weakChars: weak });
    view = createIncantationView();
    view.setText(text);
    keyboard = createKeyboardView({ layoutId: game.layoutId, zoneIndex: textZone(), mode: 'guide' });
    const extra = [];
    if (ev.id === 'wisp') {
      ghostWpm = Math.max(ROGUE.wispMinWpm, (mean(s.recentWpm) || 20) * ROGUE.wispSpeed);
      els.timerLabel = h('div', { class: 'dim', style: { fontSize: '12px', textAlign: 'center' } }, `The wisp runs at ${Math.round(ghostWpm)} WPM — the race starts with your first key`);
      extra.push(els.timerLabel);
    }
    if (ev.id === 'bridge') {
      els.cracks = h('div', { class: 'bridge-panes' });
      extra.push(els.cracks);
      renderCracks();
    }
    if (ev.id === 'temper') extra.push(h('div', { class: 'faint', style: { fontSize: '12px', textAlign: 'center' } }, `Rune `, h('span', { class: 'keycap' }, params.ch), ` · ${Math.round(ROGUE.temperAcc * 100)}% accuracy tempers it (+${Math.round(ROGUE.temperBonus * 100)}% power)`));
    if (ev.id === 'mimic') {
      limitSec = mimicTimeLimit(text.length, mean(s.recentWpm) || 25);
      els.timer = h('div', { class: 'timer event-timer' }, h('div', { style: { width: '0%' } }));
      els.timerLabel = h('div', { class: 'dim', style: { fontSize: '12px', textAlign: 'center' } }, `${limitSec.toFixed(1)}s — the timer starts with your first key`);
      extra.push(els.timer, els.timerLabel);
    }
    if (ev.id === 'wayshrine') extra.push(h('div', { class: 'faint', style: { fontSize: '12px', textAlign: 'center' } }, `${Math.round(BAL.shrineAcc * 100)}% accuracy earns a blessing`));
    if (ev.id === 'runedoor') extra.push(h('div', { class: 'faint', style: { fontSize: '12px', textAlign: 'center' } }, 'A single mistake seals the door'));
    fill(els.body, h('div', { class: 'incant panel casting', style: { '--school': zone.palette.accent } }, view.el), extra, keyboard.el);
    const escText = ev.id === 'mimic' ? 'leave (after the first key: the chest bites)' : ev.id === 'bridge' ? 'leave (on the bridge: you fall)' : ev.id === 'temper' ? 'back to the fire (before your first key)' : 'leave the event';
    fill(els.keys, hints([['Esc', escText]]));
    highlightNext();
  }

  function renderCracks() {
    if (!els.cracks) return;
    fill(els.cracks, Array.from({ length: ROGUE.bridgeCracks }, (_, i) => h('span', { class: `pane${i < errors ? ' cracked' : ''}` }, i < errors ? '💥' : '🟦')));
  }

  function highlightNext() {
    const mode = game.save.settings.guide;
    const off = mode === 'off' || (rogue() && game.fightStats.blind);
    keyboard.setVisible(!off);
    keyboard.highlight(off ? null : text[pos] ?? null);
  }

  function typeChar(ch, e) {
    const now = performance.now();
    if (ch === text[pos]) {
      const up = recordKeyTracked(game.save.keyStats, ch, true, lastKeyAt != null ? now - lastKeyAt : null);
      if (up && ch !== ' ') announceMastery(game, { ch, level: up, keyboard });
      if (timerStart == null) timerStart = now;
      lastKeyAt = now;
      pos += 1;
      correct += 1;
      combo += 1;
      view.setProgress(pos);
      game.audio.key(combo);
      keyboard.press(e.code);
      const span = view.spanAt(pos - 1);
      if (span) {
        const r = span.getBoundingClientRect();
        game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, zone.palette.accent, 4);
      }
      if (pos >= text.length) finishType(true);
      else highlightNext();
    } else {
      recordKeyTracked(game.save.keyStats, text[pos], false, null);
      errors += 1;
      combo = 0;
      view.flashError(pos);
      game.audio.error();
      const span = view.spanAt(pos);
      if (span) {
        const r = span.getBoundingClientRect();
        game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, '#ff4d5e', 6);
      }
      if (ev.id === 'runedoor') finishType(false, 'The runes seal shut.');
      if (ev.id === 'bridge') {
        renderCracks();
        pulseClass(els.cracks, 'shake', 260);
        if (errors >= ROGUE.bridgeCracks) finishType(false);
      }
    }
  }

  /** Glyphdeep: a random relic as an event prize (coins if the pool is empty). */
  function grantRelic() {
    const id = rollRelicOffer(game.rng, game.run, 1)[0];
    if (!id) {
      const coins = Math.round(ROGUE.mimicCoins * 2 * (1 + 0.06 * depthNow()));
      pay(coins);
      game.audio.coin();
      return [h('div', { class: 'dim' }, `No relic left to find — you take ${coins} coins instead.`)];
    }
    game.rogueClaim('relic', id);
    game.audio.levelUp();
    return [h('div', { class: 'boon-row single' }, relicCard(id))];
  }

  function grantCoins(n) {
    pay(n);
    game.audio.coin();
    const r = els.panel.getBoundingClientRect();
    floatText(r.left + r.width / 2, r.top + 40, `+${n} 🪙`, { color: '#ffe066', size: 26 });
    return [h('div', { class: 'dim' }, `+${n} coins`)];
  }

  function grantItem({ minRarity, magicFindBonus }) {
    const s = game.save;
    const z = hunt().zoneIndex;
    const item = rollItem({ rng: game.rng, ilvl: z + 1, magicFind: game.fightStats.magicFind + magicFindBonus, minRarity, pity: s.stats });
    const eq = s.equipment;
    const stashed = stashItems(s, [item]);
    hunt().satchel += stashed.gold;
    const card = lootCard(item, 0, { compare: eq[item.slot] || null, upgrade: isUpgrade(item, eq) });
    quick = createQuickEquip(game, [{ item, card }]);
    game.audio.loot(['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(item.rarity));
    if (item.rarity === 'legendary') banner('LEGENDARY!', { color: '#fb923c', sub: item.name, size: 'small', duration: 2200 });
    return [
      h('div', { class: 'loot-row' }, card),
      quick.hint,
      stashed.autoSold.length ? h('div', { class: 'faint', style: { fontSize: '12px' } }, `Inventory full — sold for ${stashed.gold} gold (added to your satchel).`) : null,
    ];
  }

  function finishType(success, failText = '') {
    const hn = hunt();
    const mhp = maxHp();
    const acc = correct + errors ? correct / (correct + errors) : 1;
    let title;
    let content = [];
    if (ev.id === 'wayshrine') {
      const heal = Math.round(mhp * BAL.shrineHealPct);
      hn.hp = Math.min(mhp, (hn.hp ?? mhp) + heal);
      title = `The shrine restores ${heal} health.`;
      if (acc >= BAL.shrineAcc) {
        const b = rollBoonOffer(game.rng, hn.boons, 1)[0];
        if (b) {
          takeBoonHere(b.id);
          content.push(h('div', { class: 'dim' }, `${Math.round(acc * 100)}% accuracy — the shrine blesses you:`), h('div', { class: 'boon-row single' }, boonCard(b)));
          game.audio.levelUp();
        }
      } else {
        content.push(h('div', { class: 'dim' }, `${(acc * 100).toFixed(1)}% accuracy — ${Math.round(BAL.shrineAcc * 100)}% earns a blessing.`));
      }
      game.audio.heal();
    } else if (ev.id === 'spring') {
      hn.hp = mhp;
      title = 'The water restores you to full health.';
      game.audio.heal();
    } else if (ev.id === 'mimic') {
      if (success && rogue()) {
        title = 'Bound! The chest spits out its coins.';
        content = grantCoins(Math.round(ROGUE.mimicCoins * (1 + 0.06 * depthNow())));
      } else if (success) {
        title = 'Bound! The chest spits out its treasure.';
        content = grantItem({ minRarity: 'uncommon', magicFindBonus: 60 });
      } else {
        const bite = Math.round(mhp * BAL.mimicBitePct);
        hn.hp = Math.max(1, (hn.hp ?? mhp) - bite);
        title = failText || `Too slow! The chest bites for ${bite} health.`;
        game.audio.enemyAttack();
        game.fx.shake(8, 260);
      }
    } else if (ev.id === 'runedoor') {
      if (success) {
        title = 'The runes flare and the door swings open.';
        content = rogue() ? grantRelic() : grantItem({ minRarity: 'rare', magicFindBonus: 100 });
      } else {
        title = failText || 'The runes seal shut.';
        game.audio.fizzle();
      }
    }
    else if (ev.id === 'wisp') {
      if (success) {
        title = 'You cross the line before the wisp!';
        content = grantRelic();
      } else {
        title = failText || 'The wisp crosses the line first and giggles off into the dark.';
        game.audio.soft();
      }
    } else if (ev.id === 'bridge') {
      if (success) {
        const coins = ROGUE.bridgeCoins + 3 * depthNow();
        title = errors === 0 ? 'Not a single crack — the bridge sings under your feet.' : `You reach the far side with ${errors} crack${errors === 1 ? '' : 's'} behind you.`;
        content = grantCoins(coins);
        if (errors === 0) {
          const b = rollBoonOffer(game.rng, hn.boons, 1)[0];
          if (b) {
            game.rogueClaim('boon', b.id);
            content.push(h('div', { class: 'dim' }, 'A flawless crossing — a boon:'), h('div', { class: 'boon-row single' }, boonCard({ id: b.id, rank: hn.boons[b.id] })));
          }
        }
      } else {
        const fall = Math.round(mhp * ROGUE.bridgeFallPct);
        hn.hp = Math.max(1, (hn.hp ?? mhp) - fall);
        title = failText || `The glass shatters — you fall and lose ${fall} health.`;
        game.audio.enemyAttack();
        game.fx.shake(10, 300);
      }
    } else if (ev.id === 'temper') {
      const ch = params.ch;
      if (acc >= ROGUE.temperAcc) {
        const rank = Math.min(ROGUE.temperMax, (hn.tempered[ch] || 0) + 1);
        hn.tempered[ch] = rank;
        game.save.stats.runesTempered = (game.save.stats.runesTempered || 0) + 1;
        title = `Rune ${ch} is tempered${rank > 1 ? ` (rank ${rank})` : ''}!`;
        content = [h('div', { class: 'dim' }, `${(acc * 100).toFixed(1)}% accuracy — ${ch} now channels +${Math.round(rank * ROGUE.temperBonus * (1 + (game.fightStats.temperBonus || 0)) * 100)}% power for this descent.`)];
        game.audio.levelUp();
      } else {
        title = 'The rune cracks — no change.';
        content = [h('div', { class: 'dim' }, `${(acc * 100).toFixed(1)}% accuracy — ${Math.round(ROGUE.temperAcc * 100)}% tempers the rune.`)];
        game.audio.fizzle();
      }
    }
    if (view) view.setProgress(success ? text.length : pos);
    if (view) view.setGhost(-1);
    if (keyboard) keyboard.highlight(null);
    showResult({ title, content, success, completed: true });
  }

  // ------------------------------------------------------------ choice events

  function startChoice() {
    if (ev.id === 'altar') {
      const m = altarMod();
      fill(
        els.body,
        h('div', { class: 'event-choice' }, h('div', { class: 'boon-card panel' }, h('div', { class: 'bc-icon' }, m.icon), h('div', { class: 'bc-name' }, m.name), h('div', { class: 'bc-text' }, altarText()))),
      );
      fill(els.keys, hints([['1', 'accept the curse'], ['2', 'walk away'], ['Esc', 'leave']]));
    } else if (ev.id === 'trader') {
      offer = rollBoonOffer(game.rng, hunt().boons, 2);
      price = traderPrice(purse());
      fill(
        els.body,
        h('div', { class: 'dim', style: { textAlign: 'center' } }, rogue() ? `Each charm costs ${price} coins (you carry ${purse()}).` : `Each charm costs ${price} gold from your satchel (${hunt().satchel} gold).`),
        offer.length
          ? h('div', { class: 'boon-row', style: { gridTemplateColumns: `repeat(${offer.length}, 1fr)` } }, offer.map((o, i) => boonCard(o, { index: i, onClick: () => buy(i) })))
          : h('div', { class: 'faint' }, 'The trader has nothing left you could use.'),
      );
      const keys = offer.map((o, i) => [String(i + 1), `buy ${BOON_BY_ID[o.id].name}`]);
      keys.push([String(offer.length + 1), 'leave'], ['Esc', 'leave']);
      fill(els.keys, hints(keys));
    } else if (ev.id === 'pact') {
      const run = game.run;
      pact = { relic: rollRelicOffer(game.rng, run, 1)[0], curse: rollCurse(game.rng, run) };
      fill(
        els.body,
        h('div', { class: 'boon-row', style: { gridTemplateColumns: 'repeat(2, minmax(0, 240px))', justifyContent: 'center' } }, relicCard(pact.relic, { tag: 'YOU GAIN' }), relicCard(pact.curse, { tag: 'YOU BEAR' })),
      );
      fill(els.keys, hints([['1', 'accept the pact'], ['2', 'refuse'], ['Esc', 'leave']]));
    }
  }

  function acceptPact() {
    if (done || !pact) return;
    game.rogueClaim('relic', pact.relic);
    game.rogueClaim('relic', pact.curse);
    game.audio.windup();
    showResult({
      title: 'The pact is sealed in ink and blood.',
      content: [h('div', { class: 'boon-row', style: { gridTemplateColumns: 'repeat(2, minmax(0, 220px))', justifyContent: 'center' } }, relicCard(pact.relic), relicCard(pact.curse))],
      success: true,
      completed: true,
    });
  }

  function buy(i) {
    if (done || !offer[i]) return;
    const hn = hunt();
    if (purse() < price) {
      game.toast(rogue() ? 'Not enough coins' : 'Not enough gold', { icon: '💸', sub: `The charm costs ${price}`, color: '#ff5566' });
      game.audio.error();
      return;
    }
    pay(-price);
    takeBoonHere(offer[i].id);
    game.audio.coin();
    game.audio.levelUp();
    const def = BOON_BY_ID[offer[i].id];
    showResult({
      title: `You buy ${def.name} for ${price} ${rogue() ? 'coins' : 'gold'}.`,
      content: [h('div', { class: 'boon-row single' }, boonCard({ id: offer[i].id, rank: hn.boons[offer[i].id] }))],
      success: true,
      completed: true,
    });
  }

  function acceptAltar() {
    if (done) return;
    hunt().mods.push(altarMod());
    game.audio.windup();
    showResult({
      title: 'The runes drink a drop of your blood.',
      content: [h('div', { class: 'dim' }, altarText())],
      success: true,
      completed: true,
    });
  }

  // ------------------------------------------------------------ result

  function leave() {
    // the campfire drill has not started: back to the fire, the campfire is not used up
    if (ev.id === 'temper' && timerStart == null && game.run && game.run.room) {
      game.showScreen('rogueRoom', { door: game.run.room });
      return;
    }
    if (ev.id === 'mimic' && timerStart != null) {
      finishType(false, 'You turn away — the chest bites you as you go.');
      return;
    }
    if (ev.id === 'bridge' && timerStart != null) {
      finishType(false, 'You turn back on the glass — and it gives way.');
      return;
    }
    showResult({ title: 'You leave it be and walk on.', content: [], success: false, completed: false });
  }

  function showResult({ title, content, success, completed }) {
    if (done) return;
    done = true;
    resultAt = performance.now();
    if (completed) game.save.stats.eventsCompleted += 1;
    game.persist();
    if (completed) game.checkAchievements();
    els.panel.classList.add(success ? 'success' : 'failed');
    // make room for the result: drop the keyboard and timer of type events, the options of choice events
    if (ev.kind === 'type') {
      if (keyboard) keyboard.el.remove();
      if (els.timer) els.timer.remove();
      if (els.timerLabel) els.timerLabel.remove();
    } else {
      fill(els.body);
    }
    fill(els.result, h('div', { class: `er-title${success ? ' ok' : ''}` }, title), content);
    if (rogue()) fill(els.keys, hints([['Enter', 'continue the descent']]));
    else fill(els.keys, hints([...(quick ? [['E', 'equip upgrade']] : []), ['Enter', 'continue the hunt'], ['Esc', 'return to camp']]));
    refreshTop();
    pulseClass(els.panel, 'bump', 300);
  }

  // ------------------------------------------------------------ screen interface

  return {
    mount(root, p) {
      params = p || {};
      ev = params.event;
      ghostWpm = 0;
      pact = null;
      if (!hunt() || !ev) {
        game.showScreen('camp', { tab: 'map' });
        return;
      }
      zone = ZONES[rogue() ? stratumZone(game.run.depth + 1) : hunt().zoneIndex];
      pos = 0;
      correct = 0;
      errors = 0;
      combo = 0;
      lastKeyAt = null;
      timerStart = null;
      done = false;
      quick = null;
      offer = [];
      view = null;
      keyboard = null;
      game.bg.setPalette(zone.palette, zone.ambient);
      build(root);
      if (ev.kind === 'type') startTyping();
      else startChoice();
      game.audio.banner();
    },
    unmount() {
      els = null;
    },
    update(dt, now) {
      if (!els || done || timerStart == null) return;
      if (ev.id === 'wisp') {
        const at = Math.floor(((now - timerStart) / 60000) * ghostWpm * 5) + 1;
        view.setGhost(Math.min(at, text.length - 1));
        if (at >= text.length) finishType(false);
        return;
      }
      if (ev.id !== 'mimic') return;
      const elapsed = (now - timerStart) / 1000;
      els.timer.firstChild.style.width = `${clamp((elapsed / limitSec) * 100, 0, 100)}%`;
      els.timer.classList.toggle('danger', elapsed > limitSec * 0.7);
      els.timerLabel.textContent = `${Math.max(0, limitSec - elapsed).toFixed(1)}s`;
      if (elapsed > limitSec) finishType(false);
    },
    onKey(e) {
      if (!els) return;
      if (e.key === ' ' || e.key === "'" || e.key === '/') e.preventDefault();
      if (done) {
        if (performance.now() - resultAt < 450) {
          e.preventDefault();
          return;
        }
        if (rogue()) {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            game.rogueAdvance();
          }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          game.nextFight();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          game.endHunt('camp');
        } else if ((e.key === 'e' || e.key === 'E') && quick) {
          e.preventDefault();
          quick.equipBest();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        leave();
        return;
      }
      if (ev.kind === 'choice') {
        if (ev.id === 'altar') {
          if (e.key === '1') acceptAltar();
          else if (e.key === '2') showResult({ title: 'You walk away from the altar.', content: [], success: false, completed: false });
        } else if (ev.id === 'pact') {
          if (e.key === '1') acceptPact();
          else if (e.key === '2') showResult({ title: 'You refuse. The voice laughs softly and fades.', content: [], success: false, completed: false });
        } else if (ev.id === 'trader') {
          const n = Number(e.key);
          if (n >= 1 && n <= offer.length) buy(n - 1);
          else if (n === offer.length + 1) showResult({ title: 'You thank the trader and walk on.', content: [], success: false, completed: false });
        }
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        return;
      }
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      const ch = charFromEvent(e);
      if (!ch) return;
      e.preventDefault();
      typeChar(ch, e);
    },
  };
}
