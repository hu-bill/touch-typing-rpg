import { h, clear, kbd, charFromEvent, pulseClass, centerOf, fill } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { SCHOOLS, TIERS, SCHOOL_EFFECT_TEXT } from '../../data/spells.js';
import { CombatEngine, tempoMultiplier, summarizeFight, comboTier } from '../../logic/combat.js';
import { allowedChars } from '../../logic/keyboard.js';
import { weakChars } from '../../logic/mastery.js';
import { estimateCard } from '../../logic/spellResolve.js';
import { chainBonus, addXp, nextChainMilestone } from '../../logic/progression.js';
import { boonText } from '../../logic/boons.js';
import { BOON_BY_ID } from '../../data/boons.js';
import { mean, clamp } from '../../core/util.js';
import { COMBO_TIERS } from '../../data/balance.js';
import { createIncantationView } from '../components/incantation.js';
import { createKeyboardView } from '../components/keyboardView.js';
import { createModal } from '../components/modal.js';
import { createVictoryPanel, createDefeatPanel, createEscapedPanel } from '../components/lootReveal.js';
import { floatText, banner } from '../fx/floaters.js';
import { announceMastery } from '../components/masteryToast.js';
import { createSpellFx } from '../fx/spellFx.js';
import { ROGUE } from '../../data/balance.js';
import { removeRelic } from '../../logic/rogue.js';
import { runChips, charMarks, markedCardText } from '../components/rogueView.js';
import { createRogueVictoryPanel, createRogueEscapedPanel, openChronicle } from '../components/rogueReveal.js';
import { confirmModal } from '../components/modal.js';

const COMBO_MILESTONES = [150, 300, 500];
const RELEASE_HOLD_MS = 340;

/** Where spells leave the wizard: the staff hand on the right side of the (mirrored) sprite. */
function handOf(sprite) {
  const r = sprite.getBoundingClientRect();
  return { x: r.left + r.width * 0.78, y: r.top + r.height * 0.42 };
}

function makeBar(cls) {
  const ghost = h('div', { class: 'ghost' });
  const fill = h('div', { class: 'fill' });
  const shield = h('div', { class: 'shield-fill' });
  const text = h('div', { class: 'bar-text' });
  const el = h('div', { class: `bar ${cls}` }, ghost, fill, shield, text);
  let last = '';
  return {
    el,
    set(cur, max, shieldAmt = 0) {
      const key = `${Math.ceil(cur)}|${max}|${Math.round(shieldAmt)}`;
      if (key === last) return;
      last = key;
      const pct = max === Infinity ? 100 : clamp((cur / max) * 100, 0, 100);
      fill.style.width = `${pct}%`;
      ghost.style.width = `${pct}%`;
      shield.style.width = max === Infinity ? '0%' : `${clamp((shieldAmt / max) * 100, 0, 100)}%`;
      text.textContent = max === Infinity ? '∞' : `${Math.max(0, Math.ceil(cur))} / ${Math.round(max)}${shieldAmt > 0 ? `  +${Math.round(shieldAmt)}🛡` : ''}`;
    },
  };
}

export function createCombatScreen(game) {
  let engine;
  let params;
  let zone;
  let els;
  let incView;
  let keyboard;
  let playerBar;
  let enemyBar;
  let barrierBar;
  let cardEls = new Map();
  let knownCardIds = new Set();
  let pendingHits = 0;
  let shownEnemyHp = 0;
  let lastProgressAt = 0;
  let highlighted = null;
  let finishAt = null;
  let finishKind = null;
  let victoryPending = false;
  let resultShown = false;
  let pauseModal = null;
  let capsWarned = false;
  let reachedMilestones = new Set();
  let weak = [];
  let holdUntil = 0;
  let holdToken = 0;
  let impactHoldUntil = 0;
  let freezeT = null;
  let wardKey = '';
  let comboTierShown = 0;
  let rogue = false; // a Glyphdeep fight (PLAN §13.9)
  let markOpts = null;
  let liveGolden = 0;
  const spell = createSpellFx(game);
  /** Combo used for tiers (Combo Crown doubles it). */
  const tierOf = (combo) => comboTier(combo * ((engine && engine.stats.comboRate) || 1));

  const save = () => game.save;

  // ------------------------------------------------------------ DOM

  function nameplate(name, sub, kindTag, extra = null) {
    return h(
      'div',
      { class: 'nameplate' },
      h('span', {}, name),
      sub ? h('span', { class: 'np-title' }, sub) : null,
      kindTag ? h('span', { class: `np-kind ${kindTag}` }, kindTag) : null,
      extra,
    );
  }

  function buildTop() {
    const hunt = game.hunt;
    const chips = [];
    if (rogue && hunt) {
      chips.push(...runChips(game, hunt, { coins: hunt.coins + liveGolden * ROGUE.goldenCoins, compact: true }));
      if (hunt.bane) chips.push(h('span', { class: 'chip bane', title: 'This foe\'s bane: every bane letter in your spells channels extra power' }, `☠ Bane ${hunt.bane}`));
    } else if (params.mode === 'hunt' && hunt) {
      const next = nextChainMilestone(hunt.chain);
      const nextText = next ? ` · ${next.icon} in ${next.chain - hunt.chain}` : '';
      chips.push(h('span', { class: `chip${hunt.chain >= 3 ? ' hot' : ''}`, title: `Consecutive victories: more gold and better loot${next ? `\nNext reward: ${next.name} at chain ${next.chain}` : ''}` }, `🔥 Chain ${hunt.chain} · +${Math.round(chainBonus(hunt.chain) * 100)}% loot${nextText}`));
      chips.push(h('span', { class: 'chip', title: 'Gold is banked when you return to camp. Dying loses half.' }, `💰 Satchel ${hunt.satchel}`));
      if (params.heat > 0) chips.push(h('span', { class: 'chip', title: 'Foes grow stronger the longer you hunt' }, `🌡️ Heat +${Math.round(params.heat * 100)}%`));
      const owned = Object.entries(hunt.boons || {});
      if (owned.length) {
        const total = owned.reduce((a, [, r]) => a + r, 0);
        const title = owned.map(([id, rank]) => `${BOON_BY_ID[id].name} (${rank}) — ${boonText(id, rank)}`).join('\n');
        chips.push(h('span', { class: 'chip boons', title }, `✦ ${total}`));
      }
      for (const mod of hunt.mods || []) {
        chips.push(h('span', { class: 'chip hot', title: `${mod.name}: ${mod.fightsLeft} fight${mod.fightsLeft === 1 ? '' : 's'} left` }, `${mod.icon} ${mod.fightsLeft}`));
      }
    } else if (params.mode === 'boss') {
      chips.push(h('span', { class: 'chip hot' }, '👑 Boss fight'));
    } else if (params.mode === 'practice') {
      chips.push(h('span', { class: 'chip' }, '🎯 Practice Shrine — no danger'));
    }
    const diff = game.difficulty;
    chips.push(h('span', { class: 'chip', title: `${diff.name}\n${diff.perks.join('\n')}` }, rogue ? diff.icon : `${diff.icon} ${diff.name}`));
    if (weak.length && !rogue) chips.push(h('span', { class: 'chip', title: 'Your weakest keys — incantations will feature them more often' }, `🎯 Focus runes: ${weak.join(' ')}`));
    return h(
      'div',
      { class: 'combat-top panel' },
      h('span', { class: 'zone-tag' }, rogue ? `🌀 ${zone.icon} ${zone.name}` : `${zone.icon} ${zone.name}`),
      chips,
      h('span', { class: 'spacer' }),
      h('span', { class: 'dim' }, kbd('Esc'), ' cancel spell · pause'),
    );
  }

  function refreshTop() {
    if (!els) return;
    const t = buildTop();
    els.top.replaceWith(t);
    els.top = t;
  }

  function build(root) {
    const e = engine.enemy;
    const p = engine.player;
    playerBar = makeBar('player-hp');
    enemyBar = makeBar('enemy-hp');
    barrierBar = makeBar('barrier');
    incView = createIncantationView();
    keyboard = createKeyboardView({ layoutId: game.layoutId, zoneIndex: params.zoneIndex, mode: 'guide' });

    const wardDome = h('div', { class: 'ward-dome' });
    const playerSprite = h('div', { class: 'sprite' }, h('span', { class: 'sprite-inner' }, '🧙'), wardDome);
    const enemySprite = h('div', { class: 'sprite' }, h('span', { class: 'sprite-inner' }, e.icon));
    const playerStatus = h('div', { class: 'status-row' });
    const enemyStatus = h('div', { class: 'status-row' });
    const timer = h('div', { class: 'timer' }, h('div', { style: { width: '0%' } }));
    const timerLabel = h('div', { class: 'timer-label' }, h('span', {}, ''), h('span', {}, ''));
    const kindTag = params.kind === 'mob' || params.kind === 'dummy' ? null : params.kind;
    const enemySub = params.kind === 'boss' ? engine.def.title : null;

    // the spell being cast shows its own typing progress: incView lives inside the active card
    const cards = h('div', { class: 'cards' });
    const flowFill = h('div', { style: { width: '0%' } });
    const flowBar = h('div', { class: 'flow-bar', title: 'Flow fills with correct keystrokes. When full, a Forbidden Rite appears.' }, flowFill);
    const wpmLive = h('div', { class: 'wpm-live' });
    const combo = h('div', { class: 'combo zero' }, '0', h('small', {}, 'combo'));

    const enemyFighter = h(
      'div',
      { class: `fighter enemy ${params.kind}`, style: { '--aura': e.aura || 'transparent', '--zone-accent': zone.palette.accent } },
      nameplate(
        e.name,
        enemySub,
        kindTag,
        rogue && game.run && game.run.bane
          ? h('span', { class: 'np-bane', title: `Bane rune: every ${game.run.bane} in your spells channels ×${baneMultText()} power` }, '☠ Bane ', h('b', {}, game.run.bane), ` ×${baneMultText()}`)
          : null,
      ),
      enemyBar.el,
      barrierBar.el,
      timer,
      timerLabel,
      enemyStatus,
      enemySprite,
      h('div', { class: 'shadow-ellipse' }),
    );
    const playerFighter = h(
      'div',
      { class: 'fighter player' },
      nameplate('You', `Level ${save().player.level}`),
      playerBar.el,
      playerStatus,
      playerSprite,
      h('div', { class: 'shadow-ellipse' }),
    );
    const top = buildTop();
    const arena = h('div', { class: 'arena' }, playerFighter, enemyFighter);
    const screen = h(
      'div',
      { class: 'combat' },
      top,
      arena,
      cards,
      rogue ? runeLegend() : null,
      h('div', { class: 'flow-row' }, h('div', { class: 'flow-label' }, 'Flow'), flowBar, wpmLive, combo),
      keyboard.el,
    );
    root.appendChild(screen);
    if (rogue && game.run.bane) keyboard.mark(game.run.bane, 'bane');
    els = { screen, top, arena, wardDome, playerSprite, enemySprite, playerStatus, enemyStatus, timer, timerLabel, cards, flowBar, flowFill, wpmLive, combo };
    if (engine.dummy) {
      timer.style.display = 'none';
      timerLabel.style.display = 'none';
    }
    shownEnemyHp = e.hp;
    playerBar.set(p.hp, p.maxHp, p.shield);
    enemyBar.set(e.hp, e.maxHp);
    renderCards();
    idleIncant();
  }

  /** Glyphdeep: a one-line key to the marked letters in the spells. */
  function runeLegend() {
    const bane = game.run.bane;
    return h(
      'div',
      { class: 'rune-legend' },
      bane
        ? h('span', { class: 'rl-item', title: 'Bane rune: this foe is weak to one of your weakest keys' }, h('span', { class: 'rl-sample bane' }, bane), ` bane letter — ×${baneMultText()} power`)
        : null,
      h('span', { class: 'rl-item', title: 'Golden runes pay coins for the Ink Merchant — but only if you hit them without a mistake' }, h('span', { class: 'rl-sample golden' }, 'a'), ` golden letter — type it cleanly for +${ROGUE.goldenCoins}🪙`),
    );
  }

  // ------------------------------------------------------------ cards & incantation

  /** A card's resting text: the glowing trigger letter, then the rest of the incantation. */
  function staticText(c) {
    return markOpts ? markedCardText(c, charMarks(c, markOpts)) : [h('span', { class: 'trigger' }, c.text[0]), c.text.slice(1)];
  }

  /** Power multiplier of this fight's bane letter, formatted ("2", "2.5"). */
  const baneMultText = () => (engine.stats.runeMult[game.run.bane] || ROGUE.bane).toFixed(1).replace(/\.0$/, '');

  const activeCardEl = () => (engine.cast ? cardEls.get(engine.cast.cardId) || null : null);

  function renderCards() {
    clear(els.cards);
    cardEls = new Map();
    const now = performance.now();
    const avgWpm = mean(save().recentWpm) || 25;
    for (const c of engine.cards) {
      const school = SCHOOLS[c.school];
      const tier = TIERS[c.tier];
      const tol = engine.toleranceFor(c);
      const est = estimateCard(c, engine.stats, avgWpm, game.layoutId, save().keyStats);
      const estText = est.kind === 'heal' ? `✚ ${est.value} heal` : est.kind === 'shield' ? `🛡 ${est.value} shield` : `⚔ ~${est.value}`;
      const isNew = !knownCardIds.has(c.id);
      knownCardIds.add(c.id);
      const silenced = c.silencedUntil && c.silencedUntil > now;
      const el = h(
        'div',
        {
          class: `card${c.tier === 4 ? ' rite' : isNew ? ' fresh' : ''}${silenced ? ' silenced' : ''}`,
          style: { '--school': school.color },
          title: `${tier.name} · ${school.name}: ${SCHOOL_EFFECT_TEXT[c.school]} · ${tol} mistakes allowed${tier.backfire ? ` · fizzling backfires for ${Math.round(tier.backfire * 100)}% HP` : ''}`,
        },
        h(
          'div',
          { class: 'card-head' },
          h('span', { class: 'card-icon' }, school.icon),
          h('span', { class: 'card-title' }, h('span', { class: 'card-name' }, c.name), h('span', { class: 'card-tier-name' }, tier.name)),
          h('span', { class: 'card-tier' }, tier.roman),
        ),
        h('div', { class: 'card-text' }, staticText(c)),
        h(
          'div',
          { class: 'card-foot' },
          h('span', { class: 'card-est' }, estText),
          h('span', { class: 'tol', title: `${tol} mistakes allowed` }, Array.from({ length: tol }, () => h('i'))),
        ),
      );
      cardEls.set(c.id, el);
      els.cards.appendChild(el);
    }
    if (engine.cast && engine.activeCard) mountIncant(engine.activeCard);
    else idleIncant();
  }

  /** Mistakes so far break the active card's tolerance diamonds, left to right. */
  function renderStability() {
    const el = activeCardEl();
    if (!el || !engine.cast) return;
    el.querySelectorAll('.tol i').forEach((pip, i) => pip.classList.toggle('broken', i < engine.cast.errors));
    el.classList.toggle('forgiven', !!engine.cast.forgiven);
  }

  function setChargeVar(p) {
    const v = p.toFixed(3);
    const el = activeCardEl();
    if (el) el.style.setProperty('--charge', v);
    els.playerSprite.style.setProperty('--charge', v);
  }

  /** Put the typing line (incView) into the active card, keeping its progress. */
  function mountIncant(card) {
    const el = cardEls.get(card.id);
    if (!el) return;
    for (const [id, other] of cardEls) other.classList.toggle('active', id === card.id);
    els.cards.classList.add('casting');
    fill(el.querySelector('.card-text'), incView.el);
    setChargeVar(engine.cast.typed / card.text.length);
    renderStability();
  }

  function showIncant(card) {
    holdUntil = 0;
    const school = SCHOOLS[card.school];
    incView.setText(card.text, markOpts ? charMarks(card, markOpts) : null);
    incView.setProgress(engine.cast ? engine.cast.typed : 0);
    mountIncant(card);
    els.playerSprite.classList.add('casting');
    els.playerSprite.style.setProperty('--school', school.color);
  }

  function idleIncant(force = false) {
    if (!els) return;
    for (const [id, el] of cardEls) {
      if (!el.classList.contains('active')) continue;
      el.classList.remove('active', 'forgiven');
      const c = engine.cards.find((x) => x.id === id);
      if (c) fill(el.querySelector('.card-text'), staticText(c)); // a cancelled cast: back to the resting text
      el.querySelectorAll('.tol i.broken').forEach((pip) => pip.classList.remove('broken'));
    }
    els.cards.classList.remove('casting');
    if (!force && performance.now() < holdUntil) return;
    els.playerSprite.classList.remove('casting');
  }

  /**
   * The cast card is replaced the moment it resolves, so a fixed-position copy of it plays the
   * release / fizzle animation on top of the incoming card.
   */
  function ghostCard(cardId, cls) {
    const el = cardEls.get(cardId);
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    const g = el.cloneNode(true);
    g.classList.remove('fresh', 'active');
    g.classList.add('ghost', cls);
    Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 560);
  }

  // ------------------------------------------------------------ effects

  /** Hold the white hit frame: pause sprite animations while the FX layer is in hit-stop. */
  function freeze(ms) {
    const arena = els.arena;
    arena.classList.add('frozen');
    clearTimeout(freezeT);
    freezeT = setTimeout(() => arena.classList.remove('frozen'), ms);
  }

  /** Numbers, knockback and HP-bar feedback when a spell lands (particles and sound come from spellFx). */
  function impact({ amount, color, crit, resisted, toBarrier, profile, tier = 1, lethal = false }) {
    const to = centerOf(els.enemySprite);
    els.enemySprite.style.setProperty('--knock', `${profile.knockPx}px`);
    pulseClass(els.enemySprite, 'hit', 240 + profile.hitstopMs);
    if (profile.hitstopMs > 0) freeze(profile.hitstopMs);
    pulseClass(enemyBar.el, 'struck', 320);
    if (amount > 0) {
      floatText(to.x + (Math.random() - 0.5) * 40, to.y - 50, crit ? `${amount}!` : `${amount}`, {
        color: crit ? '#ffe066' : color, size: profile.numberSize, crit, cls: tier >= 4 || lethal ? 'slam' : '',
      });
    }
    if (crit) floatText(to.x, to.y - 110, 'CRITICAL', { color: '#ffe066', size: 18, cls: 'small' });
    if (resisted) floatText(to.x + 50, to.y - 20, 'resisted', { color: '#9aa0b8', size: 14, cls: 'small' });
    if (toBarrier) floatText(to.x - 50, to.y - 10, `🛡 −${toBarrier}`, { color: '#cfdcff', size: 18, cls: 'small' });
  }

  function handleEvent(ev, now) {
    const audio = game.audio;
    switch (ev.type) {
      case 'castStart': {
        const card = engine.activeCard;
        if (!card) break;
        lastProgressAt = now;
        showIncant(card);
        spell.beginCharge({ school: card.school, tier: card.tier, text: card.text, hand: handOf(els.playerSprite) });
        break;
      }
      case 'keyCorrect': {
        lastProgressAt = now;
        const card = engine.activeCard;
        if (card) {
          incView.setProgress(ev.index + 1);
          const p = (ev.index + 1) / card.text.length;
          // the spell plays its own note: each school is an instrument (PLAN §14)
          spell.keystroke({ index: ev.index, length: card.text.length, comboIndex: tierOf(ev.combo).index });
          setChargeVar(p);
          const span = incView.spanAt(ev.index);
          if (span) {
            const r = span.getBoundingClientRect();
            game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, SCHOOLS[card.school].color, 4);
            if (span.classList.contains('bane')) {
              game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, '#ff4d6a', 8);
              floatText(r.left + r.width / 2, r.top - 6, `☠×${baneMultText()}`, { color: '#ff5a6e', size: 15, cls: 'small' });
            }
          }
        }
        updateCombo(ev.combo, true);
        break;
      }
      case 'golden': {
        liveGolden += 1;
        incView.addClass(ev.index, 'got');
        const span = incView.spanAt(ev.index);
        if (span) {
          const r = span.getBoundingClientRect();
          floatText(r.left + r.width / 2, r.top - 8, `+${ROGUE.goldenCoins}🪙`, { color: '#ffe066', size: 18, cls: 'small' });
          game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, '#ffe066', 10);
        }
        audio.coin();
        refreshTop();
        break;
      }
      case 'masteryUp':
        announceMastery(game, { ch: ev.ch, level: ev.level, keyboard });
        break;
      case 'grace': {
        const ip = (activeCardEl() || els.cards).getBoundingClientRect();
        floatText(ip.left + ip.width / 2, ip.top - 10, 'Grace', { color: '#e9e0ff', size: 18, cls: 'small' });
        audio.soft();
        break;
      }
      case 'keyError': {
        incView.flashError(ev.index);
        pulseClass(incView.el, 'shake', 260);
        const span = incView.spanAt(ev.index);
        if (span) {
          const r = span.getBoundingClientRect();
          game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, '#ff4d5e', 6);
          // a slip on a golden rune forfeits its coins: show it at once rather than silently
          if (span.classList.contains('golden') && !span.classList.contains('lost')) {
            span.classList.add('lost');
            floatText(r.left + r.width / 2, r.top - 8, 'coin lost', { color: '#b9a66a', size: 14, cls: 'small' });
          }
        }
        spell.misstep(ev.index);
        renderStability();
        updateCombo(ev.combo ?? 0, false);
        break;
      }
      case 'noMatch':
        pulseClass(els.cards, 'nomatch', 240);
        audio.soft();
        break;
      case 'cancel':
        spell.endCharge('cancel');
        idleIncant(true);
        break;
      case 'castComplete':
        onCastComplete(ev);
        break;
      case 'echo': {
        pendingHits += 1;
        const from = handOf(els.playerSprite);
        const to = centerOf(els.enemySprite);
        game.fx.after(140, () => spell.echo({
          from,
          to,
          onImpact: (profile) => {
            pendingHits -= 1;
            if (!els) return;
            impact({ amount: ev.dealt, color: '#e9e0ff', crit: false, profile, tier: 1 });
            floatText(to.x, to.y - 130, 'ECHO', { color: '#e9e0ff', size: 18, cls: 'small' });
          },
        }));
        break;
      }
      case 'fizzle': {
        spell.endCharge('fizzle');
        holdUntil = now + 450;
        ghostCard(ev.card.id, 'fizzled');
        banner('FIZZLE', { color: '#ff6b7a', size: 'small', sub: ev.backfire ? `The magic backfires! −${ev.backfire} HP` : 'Too many mistakes — the spell collapses', duration: 1300 });
        const token = ++holdToken;
        game.fx.after(460, () => {
          if (els && !engine.cast && token === holdToken) idleIncant(true);
        });
        break;
      }
      case 'secondWind':
        floatText(centerOf(els.playerSprite).x, centerOf(els.playerSprite).y - 120, 'Second Chance!', { color: '#fb923c', size: 22, cls: 'small' });
        renderStability();
        break;
      case 'cardsChanged':
        renderCards();
        break;
      case 'flowFull':
        banner('FLOW STATE', { color: '#7df9ff', sub: 'A Forbidden Rite has appeared', size: 'small', duration: 1600 });
        audio.banner();
        break;
      case 'windup':
        els.enemySprite.classList.add('windup');
        audio.windup();
        break;
      case 'enemyAttack':
        els.enemySprite.classList.remove('windup');
        pulseClass(els.enemySprite, 'attack', 360);
        audio.enemyAttack();
        break;
      case 'playerHurt': {
        const p = centerOf(els.playerSprite);
        if (ev.damage > 0) {
          floatText(p.x + (Math.random() - 0.5) * 30, p.y - 60, `−${ev.damage}`, { color: '#ff5d6c', size: ev.source === 'attack' ? 34 : 24 });
          pulseClass(els.playerSprite, 'hurt', 380);
          game.fx.burst(p.x, p.y, { count: 16, color: '#ff4d5e', speed: 180 });
          game.fx.shake(ev.source === 'attack' ? 9 : 4, 260);
        }
        if (ev.absorbed > 0) {
          floatText(p.x - 40, p.y - 30, `🛡 ${ev.absorbed}`, { color: '#9fb4ff', size: 20, cls: 'small' });
          game.fx.ring(p.x, p.y, '#9fb4ff', 80);
          pulseClass(els.wardDome, 'hit', 350);
          if (engine.player.shield <= 0) spell.shatter(p);
        }
        if (ev.source === 'searing') floatText(p.x + 40, p.y - 100, 'seared', { color: '#ff9f43', size: 14, cls: 'small' });
        if (ev.source === 'glass') floatText(p.x + 40, p.y - 100, 'glass cut', { color: '#cfe8ff', size: 14, cls: 'small' });
        break;
      }
      case 'burnTick': {
        if (ev.amount < 0.5) break;
        const to = centerOf(els.enemySprite);
        floatText(to.x + 40 + Math.random() * 30, to.y - 20, `${Math.round(ev.amount)}`, { color: '#ffb35c', size: 18, cls: 'small' });
        game.fx.sparks(to.x, to.y + 20, '#ff7a3d', 4);
        break;
      }
      case 'heal': {
        const p = centerOf(els.playerSprite);
        floatText(p.x, p.y - 80, `+${ev.amount}`, { color: '#7dffa1', size: 28 });
        break;
      }
      case 'mechanic': {
        const colors = { enrage: '#ff4d5e', gust: '#cfe8ff', hex: '#d9b3ff', barrier: '#9fb4ff' };
        banner(ev.text, { color: colors[ev.id] || '#ffe2a1', size: 'small', duration: 1300 });
        audio.banner();
        if (ev.id === 'gust') game.fx.shake(6, 300);
        break;
      }
      case 'barrierBroken': {
        const to = centerOf(els.enemySprite);
        game.fx.burst(to.x, to.y, { count: 60, colors: ['#cfdcff', '#ffffff'], speed: 380 });
        spell.shatter(to, ['#cfdcff', '#ffffff', '#9fb4ff']);
        floatText(to.x, to.y - 140, 'BARRIER SHATTERED', { color: '#cfdcff', size: 20, cls: 'small' });
        game.fx.shake(10, 300);
        break;
      }
      case 'phoenix':
        banner('PHOENIX REBIRTH', { color: '#fb923c', size: 'small', sub: rogue && game.run && game.run.relics.includes('phoenix') ? 'The feather burns away' : 'The ember refuses to let you fall' });
        audio.heal();
        if (rogue && game.run && removeRelic(game.run, 'phoenix')) {
          game.persist();
          refreshTop();
        }
        break;
      case 'victory':
        spell.endCharge('abort');
        victoryPending = true;
        break;
      case 'defeat':
        spell.endCharge('abort');
        els.playerSprite.classList.add('dying');
        audio.defeat();
        finishAt = now + 1300;
        finishKind = 'defeat';
        break;
      case 'escaped': {
        els.enemySprite.classList.add('fleeing');
        const to = centerOf(els.enemySprite);
        floatText(to.x, to.y - 80, 'It got away!', { color: '#ffe066', size: 26 });
        finishAt = now + 1100;
        finishKind = 'escaped';
        break;
      }
      default:
        break;
    }
  }

  function onCastComplete(ev) {
    const { card, result, dealt, toBarrier, resisted, wpm, errors } = ev;
    game.recordCast(wpm);
    const school = SCHOOLS[card.school];
    spell.endCharge('release');
    const ip = (cardEls.get(card.id) || els.cards).getBoundingClientRect();
    floatText(ip.left + ip.width / 2, ip.top - 6, `${Math.round(wpm)} WPM · ×${result.speedMult.toFixed(2)} speed${errors ? ` · ${errors} mistake${errors > 1 ? 's' : ''}` : ' · perfect'}${result.paceMult !== 1 ? ` · pace ${result.paceMult > 1 ? '+' : '−'}${Math.round(Math.abs(result.paceMult - 1) * 100)}%` : ''}${result.comboMult > 1 ? ` · ${tierOf(engine.combo).name || 'combo'} +${Math.round((result.comboMult - 1) * 100)}%` : ''}${result.extraMult > 1 ? ` · rhythm +${Math.round((result.extraMult - 1) * 100)}%` : ''}${result.executed ? ' · EXECUTE' : ''}`, { color: result.perfect ? '#ffe2a1' : '#cfe8ff', size: 15, cls: 'small' });
    if (result.perfect && card.tier >= 2 && card.tier < 4) banner('PERFECT', { color: school.color, size: 'small', duration: 800 });

    // keep the finished line on screen for a moment while the sigil seals
    holdUntil = performance.now() + RELEASE_HOLD_MS;
    const token = ++holdToken;
    ghostCard(card.id, 'released');
    game.fx.after(RELEASE_HOLD_MS + 20, () => {
      if (els && !engine.cast && token === holdToken) idleIncant(true);
    });

    const playerAt = centerOf(els.playerSprite);
    const enemyAt = centerOf(els.enemySprite);
    const total = dealt + toBarrier;
    const hits = total > 0 || (result.kind === 'damage' && engine.dummy);
    const lethal = !engine.dummy && engine.enemy.hp <= 0.5;
    const ref = Number.isFinite(engine.enemy.maxHp) ? engine.enemy.maxHp : 250;
    const shown = engine.dummy ? result.damage : dealt;
    if (hits) pendingHits += 1;
    spell.cast({
      card,
      result,
      hand: handOf(els.playerSprite),
      playerAt,
      enemyAt,
      playerSprite: els.playerSprite,
      enemySprite: els.enemySprite,
      hits,
      lethal,
      dmgFrac: (engine.dummy ? result.damage : total) / ref,
      comboIndex: tierOf(engine.combo).index,
      onImpact: (profile) => {
        pendingHits -= 1;
        if (!els) return;
        if (lethal) impactHoldUntil = performance.now() + profile.hitstopMs + 140;
        impact({ amount: shown, color: school.color, crit: result.crit, resisted, toBarrier, profile, tier: card.tier, lethal });
      },
    });
    if (result.shield) floatText(playerAt.x, playerAt.y - 90, `🛡 +${result.shield}`, { color: '#9fb4ff', size: 26 });
  }

  function updateCombo(combo, up) {
    const el = els.combo;
    el.firstChild.textContent = String(combo);
    el.classList.toggle('zero', combo === 0);
    if (up) pulseClass(el, 'bump', 140);
    const tier = tierOf(combo);
    const rate = engine.stats.comboRate || 1;
    el.lastChild.textContent = tier.name || 'combo';
    el.dataset.tier = tier.index;
    els.screen.dataset.comboTier = tier.index;
    els.screen.style.setProperty('--combo-color', tier.color || 'transparent');
    if (tier.index > comboTierShown) {
      const pct = Math.round((tier.mult - 1) * 100);
      banner(tier.name.toUpperCase(), { color: tier.color, sub: `${Math.ceil(tier.at / rate)} combo · +${pct}% spell power`, size: 'small', duration: 1200 });
      game.audio.banner();
    } else if (tier.index < comboTierShown) {
      const lost = COMBO_TIERS[comboTierShown].name;
      const c = centerOf(el);
      floatText(c.x, c.y - 30, `${lost} lost`, { color: '#9aa0b8', size: 16, cls: 'small' });
      game.audio.soft();
    }
    comboTierShown = tier.index;
    for (const m of [...reachedMilestones]) if (m > combo) reachedMilestones.delete(m);
    for (const m of COMBO_MILESTONES) {
      if (combo >= m && !reachedMilestones.has(m)) {
        reachedMilestones.add(m);
        if (combo === m) {
          banner(`${m} COMBO`, { color: '#ffe2a1', size: 'small', duration: 1000 });
          game.audio.banner();
        }
      }
    }
  }

  function updateHud(now) {
    if (pendingHits === 0) shownEnemyHp = engine.enemy.hp;
    const p = engine.player;
    const e = engine.enemy;
    playerBar.set(p.hp, p.maxHp, p.shield);
    enemyBar.set(shownEnemyHp, e.maxHp);
    barrierBar.el.classList.toggle('on', e.barrier > 0);
    const ward = p.shield > 0 ? clamp(0.35 + p.shield / p.maxHp, 0.35, 0.9).toFixed(2) : '';
    if (ward !== wardKey) {
      wardKey = ward;
      els.wardDome.classList.toggle('on', !!ward);
      if (ward) els.wardDome.style.setProperty('--ward', ward);
    }
    if (e.barrier > 0) barrierBar.set(e.barrier, e.barrierMax);

    if (!engine.dummy) {
      const t = engine.def.fleeAfter ? clamp(engine.elapsed / engine.def.fleeAfter, 0, 1) : clamp(e.attackTimer / engine.interval, 0, 1);
      els.timer.firstChild.style.width = `${t * 100}%`;
      els.timer.classList.toggle('danger', !engine.def.fleeAfter && e.windupSent);
      const [l, r] = els.timerLabel.children;
      if (engine.def.fleeAfter) {
        l.textContent = 'Flees in';
        r.textContent = `${Math.max(0, engine.def.fleeAfter - engine.elapsed).toFixed(1)}s`;
      } else {
        l.textContent = e.windupSent ? '⚠ Attacking!' : 'Next attack';
        r.textContent = `${Math.max(0, engine.interval - e.attackTimer).toFixed(1)}s`;
      }
    }

    const statusKey = `${e.burn.remaining > 0}|${e.intervalMult < 0.999 ? e.intervalMult.toFixed(2) : ''}|${Math.round(p.shield)}`;
    if (els.statusKey !== statusKey) {
      els.statusKey = statusKey;
      clear(els.enemyStatus);
      if (e.burn.remaining > 0) els.enemyStatus.appendChild(h('span', { class: 'status burn' }, '🔥 Burning'));
      if (e.intervalMult < 0.999) els.enemyStatus.appendChild(h('span', { class: 'status' }, `⏩ ${Math.round((1 / e.intervalMult) * 100)}% speed`));
      clear(els.playerStatus);
      if (p.shield > 0) els.playerStatus.appendChild(h('span', { class: 'status shield' }, `🛡 ${Math.round(p.shield)}`));
    }

    els.flowFill.style.width = `${engine.flow}%`;
    els.flowBar.classList.toggle('full', engine.flowLocked);

    const cast = engine.cast;
    if (cast && engine.stats.paceRune) {
      incView.setGhost(Math.floor(((now - cast.startTime) / 60000) * engine.paceRef * 5) + 1);
    }
    if (cast && cast.typed > 1) {
      const live = ((cast.typed - 1) / 5) / Math.max(0.005, (cast.lastKeyTime - cast.startTime) / 60000);
      els.wpmLive.textContent = `${Math.round(live)} wpm`;
    } else {
      const avg = mean(save().recentWpm);
      els.wpmLive.textContent = avg ? `avg ${Math.round(avg)} wpm` : '';
    }

    // keyboard guide
    const mode = save().settings.guide;
    const hidden = mode === 'off' || engine.blindfold;
    keyboard.setVisible(!hidden);
    if (hidden) return;
    const card = engine.activeCard;
    let target = null;
    if (card && cast) {
      const next = card.text[cast.typed];
      if (mode === 'always' || now - lastProgressAt > 1200) target = next;
    }
    if (target !== highlighted) {
      highlighted = target;
      keyboard.highlight(target);
    }
  }

  // ------------------------------------------------------------ end of fight

  function showRogueResult(kind, summary) {
    game.rogueRecordFight(summary);
    if (kind === 'victory') {
      const rewards = game.rogueVictory({ kind: params.kind, summary, hpLeft: engine.player.hp });
      game.checkAchievements({ fight: summary });
      const panel = createRogueVictoryPanel(game, {
        rewards,
        summary,
        kind: params.kind,
        depth: params.depth,
        onDone: () => {
          game.closeModal(panel);
          game.rogueAdvance();
        },
      });
      game.openModal(panel);
    } else if (kind === 'defeat') {
      const chronicle = game.endRun('defeat', engine.enemy.name);
      if (chronicle) openChronicle(game, chronicle);
    } else if (kind === 'escaped') {
      const run = game.run;
      run.hp = engine.player.hp;
      run.room = { ...(run.room || {}), cleared: true, offer: null };
      game.persist();
      const panel = createRogueEscapedPanel(game, {
        onDone: () => {
          game.closeModal(panel);
          game.rogueAdvance();
        },
      });
      game.openModal(panel);
    }
  }

  function showResult(kind) {
    if (resultShown) return;
    resultShown = true;
    const summary = summarizeFight(engine);
    game.recordFight(summary, params.zoneIndex);
    if (rogue) {
      showRogueResult(kind, summary);
      return;
    }
    if (kind === 'victory') {
      const rewards = game.applyVictory({ zoneIndex: params.zoneIndex, kind: params.kind, enemyDef: params.enemyDef });
      if (rewards.levelsGained) game.audio.levelUp();
      game.checkAchievements({ fight: summary });
      const panel = createVictoryPanel(game, {
        rewards,
        summary,
        kind: params.kind,
        zoneIndex: params.zoneIndex,
        mode: params.mode,
        onContinue: (boonId = null) => {
          game.closeModal(panel);
          game.continueHunt(engine.player.hp, boonId);
        },
        onCamp: () => {
          game.closeModal(panel);
          game.endHunt('camp');
        },
      });
      game.openModal(panel);
    } else if (kind === 'defeat') {
      game.checkAchievements({ fight: summary });
      const lost = game.satchelLoss('defeat');
      const hunt = game.hunt;
      const zoneIndex = params.zoneIndex;
      const mode = params.mode;
      const panel = createDefeatPanel(game, {
        summary,
        lost,
        mode,
        zoneIndex,
        enemy: { name: engine.enemy.name, hpPct: engine.enemy.maxHp ? engine.enemy.hp / engine.enemy.maxHp : 0 },
        chain: hunt ? hunt.chain : 0,
        nextMilestone: hunt && mode === 'hunt' ? nextChainMilestone(hunt.chain) : null,
        boons: hunt ? { ...hunt.boons } : {},
        onRetry: () => {
          game.closeModal(panel);
          game.endHunt('defeat', { toCamp: false });
          if (mode === 'boss') game.startBoss(zoneIndex);
          else game.startHunt(zoneIndex);
        },
        onCamp: () => {
          game.closeModal(panel);
          game.endHunt('defeat');
        },
      });
      game.openModal(panel);
    } else if (kind === 'escaped') {
      const panel = createEscapedPanel(game, {
        summary,
        onContinue: () => {
          game.closeModal(panel);
          game.continueHunt(engine.player.hp, null);
        },
        onCamp: () => {
          game.closeModal(panel);
          game.endHunt('camp');
        },
      });
      game.openModal(panel);
    }
  }

  function leavePractice() {
    const summary = summarizeFight(engine);
    game.recordFight(summary, params.zoneIndex);
    const xp = Math.floor(summary.correct / 10);
    const levels = addXp(game.save, xp);
    game.refreshStats();
    game.persist();
    game.endHunt('camp');
    if (summary.casts > 0) {
      game.toast(`Training complete · +${xp} XP`, {
        icon: '🎯',
        sub: `${summary.casts} casts · ${Math.round(summary.avgWpm)} WPM · ${(summary.accuracy * 100).toFixed(1)}% accuracy`,
        color: '#7df9ff',
        life: 4000,
      });
    }
    if (levels) {
      game.audio.levelUp();
      game.toast(`Level ${game.save.player.level}!`, { icon: '⭐', sub: 'New attunement point available', color: '#9fe8ff' });
    }
    game.checkAchievements({ fight: summary });
  }

  function rogueLeave(abandon) {
    const m = pauseModal;
    pauseModal = null;
    if (m) {
      m.onClose = null;
      game.closeModal(m);
    }
    const summary = summarizeFight(engine);
    const finish = () => {
      resultShown = true;
      game.recordFight(summary, params.zoneIndex);
      game.rogueRecordFight(summary);
      if (abandon) {
        const chronicle = game.endRun('abandon', null);
        if (chronicle) openChronicle(game, chronicle);
      } else {
        game.run.hp = engine.player.hp; // leaving never heals: the fight restarts with the health you leave with
        game.leaveRunToCamp();
      }
    };
    if (!abandon) {
      finish();
      return;
    }
    confirmModal(game, {
      title: 'Abandon this descent?',
      text: `It ends at depth ${game.run.depth}. You keep the Ink you earned.`,
      confirmLabel: 'Abandon',
      danger: true,
      onConfirm: finish,
    });
  }

  function openPause() {
    if (pauseModal || engine.phase !== 'fighting') return;
    engine.setPaused(true, performance.now());
    spell.endCharge('abort');
    if (rogue) {
      const resume = () => game.closeModal(pauseModal);
      pauseModal = createModal({
        title: 'Paused',
        content: h('p', { style: { textAlign: 'center' } }, 'Rest your hands. Returning to camp saves the descent — this fight starts over when you come back, with the health you have now.'),
        actions: [
          { label: 'Resume', hotkey: 'Esc', key: ['Escape', 'Enter'], primary: true, onClick: resume },
          { label: 'Return to camp', hotkey: 'C', key: 'c', onClick: () => rogueLeave(false) },
          { label: 'Abandon run', hotkey: 'A', key: 'a', danger: true, onClick: () => rogueLeave(true) },
        ],
      });
      pauseModal.onClose = () => {
        pauseModal = null;
        engine.setPaused(false, performance.now());
        lastProgressAt = performance.now();
        const card = engine.activeCard;
        if (engine.cast && card && els) {
          spell.beginCharge({ school: card.school, tier: card.tier, text: card.text, hand: handOf(els.playerSprite) });
          spell.chargeProgress(engine.cast.typed / card.text.length);
        }
      };
      game.openModal(pauseModal);
      return;
    }
    const practice = params.mode === 'practice';
    const loss = game.satchelLoss('flee');
    const resume = () => game.closeModal(pauseModal);
    const flee = () => {
      const m = pauseModal;
      pauseModal = null;
      m.onClose = null;
      game.closeModal(m);
      resultShown = true;
      if (practice) {
        leavePractice();
      } else {
        game.recordFight(summarizeFight(engine), params.zoneIndex);
        game.endHunt('flee');
      }
    };
    pauseModal = createModal({
      title: 'Paused',
      content: h(
        'p',
        { style: { textAlign: 'center' } },
        practice ? 'Rest your hands. Leaving the shrine grants XP for every 10 correct keystrokes.' : `Fleeing returns you to camp${loss ? ` but drops ${loss} gold from your satchel` : ''}.`,
      ),
      actions: [
        { label: 'Resume', hotkey: 'Esc', key: ['Escape', 'Enter'], primary: true, onClick: resume },
        { label: practice ? 'Leave the shrine' : 'Flee to camp', hotkey: 'F', key: 'f', onClick: flee },
      ],
    });
    pauseModal.onClose = () => {
      pauseModal = null;
      engine.setPaused(false, performance.now());
      lastProgressAt = performance.now();
      const card = engine.activeCard;
      if (engine.cast && card && els) {
        spell.beginCharge({ school: card.school, tier: card.tier, text: card.text, hand: handOf(els.playerSprite) });
        spell.chargeProgress(engine.cast.typed / card.text.length);
      }
    };
    game.openModal(pauseModal);
  }

  function onVisibility() {
    if (document.hidden && engine && engine.phase === 'fighting' && !resultShown) openPause();
  }

  // ------------------------------------------------------------ screen interface

  return {
    /** The running engine (debugging / browser QA). */
    get engine() {
      return engine;
    },
    mount(root, p) {
      params = p;
      rogue = p.mode === 'rogue' && !!game.run;
      zone = ZONES[p.visualZone ?? p.zoneIndex];
      liveGolden = 0;
      game.refreshStats();
      const s = save();
      const fstats = game.fightStats;
      weak = weakChars(s.keyStats, allowedChars(game.layoutId, p.zoneIndex), 3);
      if (rogue && game.run.bane) weak = [game.run.bane, ...weak.filter((c) => c.toLowerCase() !== game.run.bane)].slice(0, 3);
      markOpts = rogue ? { bane: game.run.bane, blots: !!fstats.blots } : null;
      const tempo = tempoMultiplier(s.recentWpm, fstats.tempoPct);
      engine = new CombatEngine({
        zoneIndex: p.zoneIndex,
        kind: p.kind,
        enemyDef: p.enemyDef,
        stats: fstats,
        heat: p.heat || 0,
        layoutId: game.layoutId,
        keyStats: s.keyStats,
        rng: game.rng,
        now: performance.now(),
        carryHp: p.carryHp,
        tempoMult: tempo,
        weakChars: weak,
        difficulty: game.difficulty,
        paceRef: mean(s.recentWpm) || 25,
        enemyOverride: p.enemyStats || null,
      });
      pendingHits = 0;
      finishAt = null;
      finishKind = null;
      victoryPending = false;
      resultShown = false;
      pauseModal = null;
      capsWarned = false;
      highlighted = null;
      knownCardIds = new Set(engine.cards.map((c) => c.id));
      reachedMilestones = new Set();
      comboTierShown = 0;
      holdUntil = 0;
      impactHoldUntil = 0;
      wardKey = '';
      lastProgressAt = performance.now();
      game.bg.setPalette(zone.palette, zone.ambient);
      build(root);
      els.screen.dataset.comboTier = 0;
      if (p.kind === 'boss') {
        banner(engine.def.name, { color: zone.palette.accent, sub: `${engine.def.title} — ${engine.def.intro}`, size: 'big', duration: 3200 });
        game.audio.banner();
      } else if (p.kind === 'glimmerkin') {
        banner('A GLIMMERKIN!', { color: '#ffe066', sub: 'Pockets full of gold. Catch it before it flees!', duration: 2200 });
        game.audio.coin();
      } else if (p.kind === 'elite') {
        banner(engine.enemy.name, { color: engine.enemy.aura || '#ff4d5e', sub: rogue ? 'An elite foe guards a relic' : 'An elite foe — tougher, deadlier, richer', size: 'small', duration: 1800 });
      } else if (rogue && game.run.depth === 0) {
        banner(`☠ Bane rune: ${game.run.bane}`, { color: '#ff6b9a', sub: 'Bane letters glow red and hit harder · golden letters typed cleanly pay coins', size: 'small', duration: 2600 });
      }
      if (rogue && p.toll) {
        const pc = centerOf(els.playerSprite);
        floatText(pc.x, pc.y - 90, `Blood Toll −${p.toll}`, { color: '#ff5d6c', size: 20, cls: 'small' });
      }
      document.addEventListener('visibilitychange', onVisibility);
    },
    unmount() {
      document.removeEventListener('visibilitychange', onVisibility);
      spell.endCharge('abort');
      clearTimeout(freezeT);
      els = null;
    },
    update(dt, now) {
      if (!els) return;
      engine.update(now);
      for (const ev of engine.drainEvents()) {
        handleEvent(ev, now);
        if (!els) return;
      }
      if (!engine.cast && spell.charging) spell.endCharge('abort');
      const burning = engine.phase === 'fighting' && engine.enemy.burn.remaining > 0;
      spell.tick(dt, { burning, enemyAt: burning ? centerOf(els.enemySprite) : null });
      if (victoryPending && pendingHits === 0 && now >= impactHoldUntil) {
        victoryPending = false;
        els.enemySprite.classList.remove('windup', 'hit');
        els.enemySprite.classList.add('dying');
        const c = centerOf(els.enemySprite);
        game.fx.burst(c.x, c.y, { count: 90, colors: ['#ffe066', '#ffffff', zone.palette.accent], speed: 420, life: 1.1 });
        game.fx.ring(c.x, c.y, '#ffe066', 180, 0.8);
        game.fx.shake(12, 400);
        game.audio.victory();
        finishAt = now + 1100;
        finishKind = 'victory';
      }
      updateHud(now);
      if (finishAt && now >= finishAt) {
        const k = finishKind;
        finishAt = null;
        showResult(k);
      }
    },
    onKey(e) {
      if (!engine || resultShown || finishAt || victoryPending) {
        if (e.key === ' ' || e.key === "'" || e.key === '/') e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!engine.cancelCast()) openPause();
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
      if (!capsWarned && e.getModifierState && e.getModifierState('CapsLock')) {
        capsWarned = true;
        game.toast('Caps Lock is on', { icon: '⇪', sub: 'Turn it off — use Shift for capitals', color: '#ff5566' });
      }
      keyboard.press(e.code);
      engine.handleChar(ch, performance.now());
    },
  };
}
