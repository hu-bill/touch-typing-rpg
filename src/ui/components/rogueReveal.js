// Glyphdeep panels: fight rewards, relic/boon picks and the Chronicle (PLAN §13.9).
import { h, kbd, fill } from '../dom.js';
import { createModal } from './modal.js';
import { boonCard } from './lootReveal.js';
import { relicCard, wpmSparkline } from './rogueView.js';
import { RELIC_BY_ID } from '../../data/rogue.js';
import { BOON_BY_ID } from '../../data/boons.js';
import { circleLabel } from '../../logic/rogue.js';
import { mean } from '../../core/util.js';
import { banner } from '../fx/floaters.js';

function statRow(cells) {
  return h('div', { class: 'stat-row' }, cells.map(([v, l]) => h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l))));
}

/** Ignore keys for a moment so a player still typing doesn't skip the panel. */
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

/**
 * A choice of boons or relics: 1–n pick, ←/→ select, Enter takes the highlighted one, R rerolls.
 * onPick(id) is called once.
 */
export function createOfferPicker(game, offer, { onPick, label = null } = {}) {
  let current = offer;
  let selected = 0;
  let picked = false;
  const row = h('div', { class: 'boon-row' });
  const hint = h('div', { class: 'faint boon-hint' });
  const el = h('div', { class: 'boon-pick' }, label ? h('div', { class: 'section-label' }, label) : null, row, hint);

  function render() {
    const n = current.choices.length;
    row.style.gridTemplateColumns = `repeat(${Math.max(1, n)}, 1fr)`;
    fill(
      row,
      current.choices.map((c, i) =>
        current.kind === 'relic'
          ? relicCard(c, { index: i, onClick: () => pick(i) })
          : boonCard(c, { index: i, onClick: () => pick(i) }),
      ),
    );
    [...row.children].forEach((c, i) => c.classList.toggle('selected', i === selected));
    const run = game.run;
    fill(hint, `1–${n} pick · ←/→ select · Enter takes the highlighted one`, run && run.rerolls > 0 ? [' · ', kbd('R'), ` reroll (🎲 ${run.rerolls})`] : '');
  }

  function pick(i = selected) {
    if (picked || !current.choices[i]) return;
    picked = true;
    const c = current.choices[i];
    const id = current.kind === 'relic' ? c : c.id;
    game.rogueClaim(current.kind, id);
    game.audio.levelUp();
    const def = current.kind === 'relic' ? RELIC_BY_ID[id] : BOON_BY_ID[id];
    game.toast(`${def.name}`, { icon: def.icon, sub: current.kind === 'relic' ? def.text : 'Boon taken', color: '#f5c66b', life: 2400 });
    onPick(id);
  }

  function reroll() {
    const next = game.rogueReroll(current);
    if (!next || !next.choices.length) {
      game.audio.error();
      return;
    }
    current = next;
    selected = 0;
    game.audio.click();
    render();
  }

  render();
  return {
    el,
    get empty() {
      return !current.choices.length;
    },
    pick,
    onKey(e) {
      const n = current.choices.length;
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) {
        e.preventDefault();
        pick(Number(e.key) - 1);
        return true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        selected = (selected + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
        render();
        game.audio.click();
        return true;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reroll();
        return true;
      }
      return false;
    },
  };
}

/** After a won fight: coins, healing and the reward choice. onDone() continues the descent. */
export function createRogueVictoryPanel(game, { rewards, summary, kind, depth, onDone }) {
  const title = kind === 'boss' ? 'GUARDIAN FELLED' : kind === 'glimmerkin' ? 'JACKPOT!' : 'VICTORY';
  const c = rewards.coins;
  const coinParts = [`+${c.base} coins`];
  if (c.golden) coinParts.push(`+${c.golden} from golden runes`);
  if (c.ledger) coinParts.push(`+${c.ledger} ledger`);
  const extras = [];
  if (rewards.heal) extras.push(`❤️ +${rewards.heal} health`);
  if (rewards.vital) extras.push('❤️ Vital spark: healed and stronger');
  if (rewards.rerollGain) extras.push(`🎲 +${rewards.rerollGain} reroll`);
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone();
  };
  const offer = rewards.offer && rewards.offer.kind && rewards.offer.choices.length ? rewards.offer : null;
  const picker = offer ? createOfferPicker(game, offer, { onPick: () => setTimeout(done, 120), label: offer.kind === 'relic' ? 'Choose a relic — it lasts the whole descent' : 'Choose a boon' }) : null;
  const mins = Math.floor(summary.duration / 60);
  const secs = Math.round(summary.duration % 60);
  const m = createModal({
    title: null,
    cls: `victory rogue-victory${picker && offer.choices.length > 3 ? ' wide' : ''}`,
    content: h(
      'div',
      { class: 'victory-body' },
      h('h1', { class: 'result-title victory' }, title),
      h('div', { class: 'rv-depth' }, `Depth ${depth} cleared`),
      statRow([
        [Math.round(summary.avgWpm), 'Avg WPM'],
        [`${(summary.accuracy * 100).toFixed(1)}%`, 'Accuracy'],
        [summary.maxCombo, 'Best combo'],
        [`${mins}:${String(secs).padStart(2, '0')}`, 'Time'],
      ]),
      h('div', { class: 'reward-row' }, h('span', { class: 'gold' }, `🪙 ${coinParts.join(' · ')}`)),
      extras.length ? h('div', { class: 'dim', style: { textAlign: 'center' } }, extras.join(' · ')) : null,
      summary.golden ? h('div', { class: 'faint', style: { textAlign: 'center', fontSize: '12px' } }, `${summary.golden} golden rune${summary.golden === 1 ? '' : 's'} typed cleanly`) : null,
      picker ? picker.el : null,
    ),
    actions: picker
      ? [{ label: 'Take it & descend', hotkey: 'Enter', key: 'Enter', primary: true, onClick: () => picker.pick() }]
      : [{ label: 'Descend deeper', hotkey: 'Enter', key: ['Enter', 'Escape'], primary: true, onClick: done }],
    onKey: (e) => (picker ? picker.onKey(e) : false),
  });
  m.onOpen = () => {
    game.audio.coin();
    if (kind === 'boss') {
      banner('GUARDIAN FELLED', { color: '#ffe066', sub: `Depth ${depth} — the way down opens`, size: 'small', duration: 1800 });
      game.audio.levelUp();
    }
  };
  guardKeys(m);
  return m;
}

/** A standalone pick (keepsake at the start, a reward left open by a reload, treasure). */
export function createOfferModal(game, { title, sub = '', offer, onDone, extraAction = null }) {
  const picker = createOfferPicker(game, offer, { onPick: (id) => setTimeout(() => onDone(id), 120) });
  const actions = [{ label: 'Take the highlighted one', hotkey: 'Enter', key: 'Enter', primary: true, onClick: () => picker.pick() }];
  if (extraAction) actions.push(extraAction);
  const m = createModal({
    title,
    cls: `rogue-offer${offer.choices.length > 3 ? ' wide' : ''}`,
    content: h('div', { class: 'victory-body' }, sub ? h('p', { style: { textAlign: 'center' } }, sub) : null, picker.el),
    actions,
    onKey: (e) => picker.onKey(e),
  });
  guardKeys(m, 300);
  return m;
}

/** Glimmerkin got away: nothing lost, the descent continues. */
export function createRogueEscapedPanel(game, { onDone }) {
  const m = createModal({
    title: null,
    content: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('h1', { class: 'result-title', style: { color: '#ffe066' } }, 'IT GOT AWAY'),
      h('p', { style: { textAlign: 'center' } }, 'The Glimmerkin vanished into the dark with its coins. High-tier spells end it fast.'),
    ),
    actions: [{ label: 'Descend deeper', hotkey: 'Enter', key: ['Enter', 'Escape'], primary: true, onClick: onDone }],
  });
  guardKeys(m);
  return m;
}

function fmtMs(ms) {
  return ms == null ? '–' : `${Math.round(ms)} ms`;
}

/** The end of a descent: depth, record, speed this run, runes that got faster, the build, ink. */
export function createChroniclePanel(game, { chronicle: c, onAgain, onCamp }) {
  const label = circleLabel(game.layoutId, c.circle);
  const record = c.record && !c.first;
  const title = record ? 'NEW RECORD' : c.cause === 'abandon' ? 'THE DESCENT ENDS' : 'YOU HAVE FALLEN';
  const avg = mean(game.save.recentWpm);
  const mins = Math.floor(c.seconds / 60);
  const secs = c.seconds % 60;
  const improvements = c.improvements.length
    ? c.improvements.map((k) =>
        h(
          'div',
          { class: 'imp-row' },
          h('span', { class: 'keycap' }, k.ch === ' ' ? '␣' : k.ch),
          h('span', {}, k.msAfter < k.msBefore ? `${fmtMs(k.msBefore)} → ${fmtMs(k.msAfter)}` : 'steadier'),
          h('span', { class: 'imp-gain' }, k.msAfter < k.msBefore ? `−${Math.round(k.msBefore - k.msAfter)} ms` : ''),
          h('span', { class: 'faint' }, k.accAfter > k.accBefore + 0.004 ? `${Math.round(k.accBefore * 100)}% → ${Math.round(k.accAfter * 100)}%` : ''),
        ),
      )
    : [h('div', { class: 'faint' }, c.depth < 3 ? 'Descend a little further to measure your runes.' : 'Your runes held steady — no key changed much this run.')];
  const relics = c.relics.map((id) => RELIC_BY_ID[id]).filter(Boolean);
  const boons = Object.entries(c.boons).filter(([id]) => BOON_BY_ID[id]);
  const m = createModal({
    title: null,
    cls: 'chronicle',
    content: h(
      'div',
      { class: 'victory-body' },
      h('h1', { class: `result-title ${record ? 'victory' : 'defeat'}` }, title),
      h(
        'div',
        { class: 'ch-depth' },
        h('div', { class: 'ch-num' }, c.depth),
        h('div', {}, h('div', { class: 'ch-label' }, c.depth === 1 ? 'depth cleared' : 'depths cleared'), h('div', { class: 'faint' }, `Circle ${label.roman} · ${label.title}${c.killedBy ? ` · felled by ${c.killedBy}` : ''}`)),
        h('div', { class: 'ch-best' }, record ? (c.prevBest ? `previous best ${c.prevBest}` : '') : `best ${Math.max(c.prevBest, c.depth)}`),
      ),
      statRow([
        [Math.round(c.avgWpm), 'Avg WPM'],
        [`${(c.accuracy * 100).toFixed(1)}%`, 'Accuracy'],
        [c.bestCombo, 'Best combo'],
        [`${mins}:${String(secs).padStart(2, '0')}`, 'Fight time'],
      ]),
      h(
        'div',
        { class: 'ch-cols' },
        h(
          'div',
          { class: 'ch-col' },
          h('div', { class: 'section-label' }, 'Your speed this descent'),
          c.fights.length ? wpmSparkline(c.fights, { width: 300, height: 64, avg }) : h('div', { class: 'faint' }, 'No spells cast.'),
          avg ? h('div', { class: 'faint', style: { fontSize: '12px' } }, `dashed line: your average (${Math.round(avg)} WPM)`) : null,
          h('div', { class: 'section-label' }, 'Runes that got faster'),
          improvements,
          c.weakest ? h('div', { class: 'dim', style: { fontSize: '13px' } }, 'Train next: ', h('span', { class: 'keycap' }, c.weakest)) : null,
        ),
        h(
          'div',
          { class: 'ch-col' },
          h('div', { class: 'section-label' }, 'Your build'),
          relics.length ? h('div', { class: 'ch-build' }, relics.map((r) => h('span', { class: `chip${r.curse ? ' curse' : ''}`, title: r.text }, `${r.icon} ${r.name}`))) : h('div', { class: 'faint' }, 'No relics.'),
          boons.length ? h('div', { class: 'ch-build' }, boons.map(([id, r]) => h('span', { class: 'chip boons', title: BOON_BY_ID[id].name }, `${BOON_BY_ID[id].icon} ${BOON_BY_ID[id].name}${r > 1 ? ` ${r}` : ''}`))) : null,
          h('div', { class: 'ch-ink' }, `🖋️ +${c.ink} Ink`, h('span', { class: 'faint' }, ` · ${c.guardians} guardian${c.guardians === 1 ? '' : 's'} · ${c.golden} golden runes`)),
          h('div', { class: 'faint', style: { fontSize: '12px' } }, 'Spend Ink in the Scriptorium (Glyphdeep tab) on permanent upgrades.'),
        ),
      ),
    ),
    actions: [
      { label: `Descend again (Circle ${label.roman})`, hotkey: 'Enter', key: 'Enter', primary: true, onClick: onAgain },
      { label: 'Return to camp', hotkey: 'Esc', key: 'Escape', onClick: onCamp },
    ],
  });
  m.onOpen = () => {
    if (record) {
      banner('NEW RECORD', { color: '#ffe066', sub: `${c.depth} depths — Circle ${label.roman}`, size: 'small', duration: 2000 });
      game.audio.levelUp();
    }
  };
  guardKeys(m, 800);
  return m;
}


/** Open the Chronicle: Enter starts a new descent on the same circle, Esc goes to the Glyphdeep tab. */
export function openChronicle(game, chronicle) {
  const panel = createChroniclePanel(game, {
    chronicle,
    onAgain: () => {
      game.closeModal(panel);
      game.startRun(chronicle.circle);
    },
    onCamp: () => {
      game.closeModal(panel);
      game.showScreen('camp', { tab: 'glyphdeep' });
    },
  });
  game.openModal(panel);
  return panel;
}
