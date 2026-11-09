// The Glyphdeep map: choose the next room by typing a door's word (PLAN §13.9).
import { h, kbd, charFromEvent, pulseClass, centerOf } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { DOOR_TYPES, REWARD_TYPES } from '../../data/rogue.js';
import { stratumZone, stratumOf, isGuardianDepth, nextGuardianDepth, circleLabel } from '../../logic/rogue.js';
import { recordKeyTracked, recordKey } from '../../logic/mastery.js';
import { mean } from '../../core/util.js';
import { createIncantationView } from '../components/incantation.js';
import { createModal, confirmModal } from '../components/modal.js';
import { runChips, hpBar, depthTrack, wpmSparkline } from '../components/rogueView.js';
import { createOfferModal, openChronicle } from '../components/rogueReveal.js';
import { announceMastery } from '../components/masteryToast.js';
import { mechanicText } from './mapTab.js';
import { banner } from '../fx/floaters.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const roman = (n) => ROMAN[n - 1] || String(n);
export const DOOR_COLORS = {
  fight: '#ff8a7a', elite: '#ff4d8b', guardian: '#ffe066', glimmer: '#ffd27a',
  mystery: '#b48cff', campfire: '#ff9f43', shop: '#6ee7a8', treasure: '#7df9ff',
};

export function createRogueMapScreen(game) {
  let els = null;
  let run = null;
  let doors = [];
  let doorEls = [];
  let views = [];
  let active = -1;
  let typed = 0;
  let selected = 0;
  let opening = false;
  let lastKeyAt = null;
  let combo = 0;
  let pauseModal = null;
  let token = 0;

  function doorEl(door, i) {
    const t = DOOR_TYPES[door.type];
    const foe = door.foe;
    const reward = door.reward ? REWARD_TYPES[door.reward] : null;
    const body = [];
    if (foe) {
      body.push(h('div', { class: 'door-foe' }, h('span', { class: 'df-icon' }, foe.def.icon), h('span', {}, foe.def.name)));
      if (door.type === 'guardian') {
        if (foe.def.title) body.push(h('div', { class: 'door-sub' }, foe.def.title));
        for (const m of foe.def.mechanics || []) body.push(h('div', { class: 'door-mech' }, `• ${mechanicText(m)}`));
      } else if (foe.kind === 'elite' && foe.def.mechanics && foe.def.mechanics[0]) {
        body.push(h('div', { class: 'door-mech' }, `• ${mechanicText(foe.def.mechanics[0])}`));
      } else if (foe.kind === 'glimmerkin') body.push(h('div', { class: 'door-mech' }, '• Never attacks · flees after 20s'));
    } else body.push(h('div', { class: 'door-desc' }, t.desc));
    if (reward) body.push(h('div', { class: 'door-reward' }, h('b', {}, `${reward.icon} ${reward.name}`), h('span', { class: 'faint' }, ` · ${reward.desc}`)));
    const view = createIncantationView();
    view.setText(door.word);
    view.setProgress(0);
    views[i] = view;
    return h(
      'div',
      { class: `door ${door.type}`, style: { '--door': DOOR_COLORS[door.type] || '#ffe2a1' }, onClick: () => open(i) },
      h('div', { class: 'door-arch' }, h('div', { class: 'door-icon' }, t.icon), h('div', { class: 'door-name' }, t.name), h('div', { class: 'door-body' }, body)),
      h('div', { class: 'door-word' }, view.el),
    );
  }

  function topBar() {
    const label = circleLabel(game.layoutId, run.circle);
    const max = game.fightStats.maxHp;
    return h(
      'div',
      { class: 'combat-top panel' },
      h('span', { class: 'zone-tag' }, `🌀 The Glyphdeep · Circle ${label.roman}`),
      hpBar(run.hp ?? max, max),
      runChips(game, run, { inRoom: false }),
    );
  }

  function build(root) {
    const next = run.depth + 1;
    const zone = ZONES[stratumZone(next)];
    const g = nextGuardianDepth(next);
    doors = run.doors;
    doorEls = doors.map((d, i) => doorEl(d, i));
    const avg = mean(game.save.recentWpm);
    const fights = run.stats.fights;
    const speed = fights.length
      ? h(
          'div',
          { class: 'rm-speed' },
          h('div', { class: 'section-label' }, 'Your speed this descent'),
          wpmSparkline(fights.slice(-20), { width: 220, height: 46, avg }),
          h('div', { class: 'faint' }, `last ${fights[fights.length - 1].wpm} WPM · run avg ${Math.round(mean(fights.map((f) => f.wpm)))} · usual ${Math.round(avg || 0)}`),
        )
      : h('div', { class: 'rm-speed faint' }, 'Your speed per fight will be charted here.');
    const screen = h(
      'div',
      { class: 'rogue-map', style: { '--zone-accent': zone.palette.accent } },
      topBar(),
      h(
        'div',
        { class: 'rm-head' },
        h('h1', {}, `Depth ${next}`),
        h('div', { class: 'rm-sub' }, isGuardianDepth(next) ? 'A guardian bars the way down' : 'Choose your path — type a door’s word to open it'),
        h('div', { class: 'faint' }, `${zone.icon} ${zone.name} · stratum ${roman(stratumOf(next) + 1)}${isGuardianDepth(next) ? '' : ` · guardian at depth ${g}`}`),
      ),
      h('div', { class: `doors n${doors.length}` }, doorEls),
      h('div', { class: 'rm-bottom panel' }, h('div', {}, h('div', { class: 'section-label' }, 'The way down'), depthTrack(run)), speed),
      h('div', { class: 'event-hints dim' }, 'Type a door’s word · ', kbd('←'), kbd('→'), ' + ', kbd('Enter'), ' choose · ', kbd('Esc'), ' cancel / menu'),
    );
    root.appendChild(screen);
    els = { screen, doors: screen.querySelector('.doors') };
    renderSelected();
  }

  function renderSelected() {
    doorEls.forEach((el, i) => {
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('typing', i === active);
    });
  }

  function cancelTyping() {
    if (active >= 0 && views[active]) views[active].setProgress(0);
    active = -1;
    typed = 0;
    renderSelected();
  }

  function open(i) {
    if (opening || !doors[i] || game.hasModal) return;
    opening = true;
    selected = i;
    active = i;
    renderSelected();
    if (views[i]) views[i].setProgress(doors[i].word.length);
    doorEls.forEach((el, k) => el.classList.add(k === i ? 'opening' : 'closed'));
    const c = centerOf(doorEls[i]);
    game.fx.burst(c.x, c.y, { count: 50, colors: [DOOR_COLORS[doors[i].type] || '#ffe2a1', '#ffffff'], speed: 320 });
    game.fx.ring(c.x, c.y, DOOR_COLORS[doors[i].type] || '#ffe2a1', 160);
    game.audio.banner();
    const t = ++token;
    setTimeout(() => {
      if (t !== token || !els) return;
      game.enterDoor(doors[i]);
    }, 520);
  }

  function typeChar(ch) {
    const now = performance.now();
    if (active < 0) {
      let i = doors.findIndex((d) => d.word[0] === ch);
      if (i < 0) i = doors.findIndex((d) => d.word[0] === ch.toLowerCase());
      if (i < 0) {
        pulseClass(els.doors, 'nomatch', 240);
        game.audio.soft();
        return;
      }
      active = i;
      selected = i;
      typed = 0;
      lastKeyAt = null;
      renderSelected();
    }
    const word = doors[active].word;
    const exp = word[typed];
    if (ch === exp) {
      const up = recordKeyTracked(game.save.keyStats, ch, true, lastKeyAt != null ? now - lastKeyAt : null);
      if (up && ch !== ' ') announceMastery(game, { ch, level: up });
      lastKeyAt = now;
      typed += 1;
      combo += 1;
      views[active].setProgress(typed);
      game.audio.key(combo);
      const span = views[active].spanAt(typed - 1);
      if (span) {
        const r = span.getBoundingClientRect();
        game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, DOOR_COLORS[doors[active].type], 5);
      }
      if (typed >= word.length) open(active);
    } else {
      recordKey(game.save.keyStats, exp, false, null);
      views[active].flashError(typed);
      combo = 0;
      game.audio.error();
      pulseClass(doorEls[active], 'shake', 260);
    }
  }

  function openPause() {
    if (pauseModal || game.hasModal) return;
    const close = () => {
      const m = pauseModal;
      pauseModal = null;
      if (m) game.closeModal(m);
    };
    pauseModal = createModal({
      title: 'The descent waits',
      content: h('p', { style: { textAlign: 'center' } }, 'Your descent is saved between rooms. Return to camp and continue it whenever you like — or abandon it to end the run here and collect your Ink.'),
      actions: [
        { label: 'Resume', hotkey: 'Esc', key: ['Escape', 'Enter'], primary: true, onClick: close },
        { label: 'Return to camp', hotkey: 'C', key: 'c', onClick: () => { close(); game.leaveRunToCamp(); } },
        {
          label: 'Abandon run', hotkey: 'A', key: 'a', danger: true,
          onClick: () => {
            close();
            confirmModal(game, {
              title: 'Abandon this descent?',
              text: `It ends at depth ${run.depth}. You keep the Ink you earned.`,
              confirmLabel: 'Abandon',
              danger: true,
              onConfirm: () => {
                const c = game.endRun('abandon');
                if (c) openChronicle(game, c);
              },
            });
          },
        },
      ],
    });
    pauseModal.onClose = () => {
      pauseModal = null;
    };
    game.openModal(pauseModal);
  }

  function refreshTop() {
    if (!els) return;
    const old = els.screen.querySelector('.combat-top');
    if (old) old.replaceWith(topBar());
  }

  return {
    mount(root, params = {}) {
      run = game.run;
      active = -1;
      typed = 0;
      selected = 0;
      opening = false;
      combo = 0;
      pauseModal = null;
      token += 1;
      els = null;
      if (!run) {
        game.showScreen('camp', { tab: 'glyphdeep' });
        return;
      }
      const next = run.depth + 1;
      const zone = ZONES[stratumZone(next)];
      game.bg.setPalette(zone.palette, zone.ambient);
      build(root);
      const label = circleLabel(game.layoutId, run.circle);
      if (run.room && run.room.cleared && run.room.offer && run.room.offer.choices.length) {
        // a reload left a reward unclaimed
        const m = createOfferModal(game, {
          title: 'Your reward awaits',
          offer: run.room.offer,
          onDone: () => {
            game.closeModal(m);
            game.rogueAdvance();
          },
        });
        game.openModal(m);
      } else if (run.keepsake && run.keepsake.length) {
        const m = createOfferModal(game, {
          title: '📿 Keepsake',
          sub: 'Choose one relic to carry into the dark.',
          offer: { kind: 'relic', choices: run.keepsake },
          onDone: () => {
            run.keepsake = null;
            game.persist();
            game.closeModal(m);
            refreshTop();
          },
        });
        game.openModal(m);
      }
      if (params.newRecord) {
        banner('NEW RECORD', { color: '#ffe066', sub: `Depth ${run.depth} — deeper than ever on Circle ${label.roman}`, duration: 2600 });
        game.audio.levelUp();
        const c = centerOf(els.screen.querySelector('.rm-head'));
        game.fx.burst(c.x, c.y, { count: 120, colors: ['#ffe066', '#ffffff', '#ff9f43'], speed: 460, life: 1.2 });
      } else if (params.after === 'guardian') {
        banner(`STRATUM ${roman(stratumOf(next) + 1)}`, { color: zone.palette.accent, sub: `${zone.icon} ${zone.name} — the air changes`, size: 'small', duration: 2200 });
        game.audio.banner();
      } else if (params.fresh) {
        banner('THE GLYPHDEEP', { color: '#b48cff', sub: `Circle ${label.roman} · ${label.title} — how deep can your fingers take you?`, size: 'small', duration: 2400 });
        game.audio.banner();
      }
    },
    unmount() {
      token += 1;
      els = null;
    },
    onKey(e) {
      if (!els || !game.run) return;
      if (opening) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (active >= 0) cancelTyping();
        else openPause();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        cancelTyping();
        selected = (selected + (e.key === 'ArrowRight' ? 1 : doors.length - 1)) % doors.length;
        renderSelected();
        game.audio.click();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        open(active >= 0 ? active : selected);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Tab') {
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
      typeChar(ch);
    },
  };
}
