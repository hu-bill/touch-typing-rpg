// Camp tab 6: the Glyphdeep — choose a rune circle, spend Ink in the Scriptorium, see your records (PLAN §13.9).
import { h, kbd, fill, button } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { META_UPGRADES, RELIC_BY_ID } from '../../data/rogue.js';
import { circleLabel, bestDepth, buyUpgrade, upgradeCost, runBaseStats, rogueFightStats } from '../../logic/rogue.js';
import { confirmModal } from '../components/modal.js';
import { openChronicle } from '../components/rogueReveal.js';

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function createGlyphdeepTab(game, camp) {
  let el;
  let left;
  let right;
  let selected = 0;
  const R = () => game.save.rogue;

  function start() {
    const run = R().run;
    if (run) {
      game.continueRun();
      return;
    }
    game.audio.banner();
    game.startRun(selected);
  }

  function abandon() {
    const run = R().run;
    if (!run) return;
    confirmModal(game, {
      title: 'Abandon this descent?',
      text: `It ends at depth ${run.depth}. You keep the Ink you earned.`,
      confirmLabel: 'Abandon',
      danger: true,
      onConfirm: () => {
        game.hunt = run;
        const c = game.endRun('abandon');
        render();
        if (camp.refreshHeader) camp.refreshHeader();
        if (c) openChronicle(game, c);
      },
    });
  }

  function select(i) {
    if (R().run) return;
    selected = Math.max(0, Math.min(ZONES.length - 1, i));
    render();
    game.audio.click();
  }

  function renderLeft() {
    const run = R().run;
    const rows = ZONES.map((z, i) => {
      const label = circleLabel(game.layoutId, i);
      const best = bestDepth(game.save, i);
      const beyond = i > game.save.unlockedZone;
      return h(
        'div',
        { class: `circle-row${i === selected && !run ? ' selected' : ''}${run && run.circle === i ? ' active' : ''}`, onClick: () => select(i), style: { '--zone-accent': z.palette.accent } },
        h('span', { class: 'cr-roman' }, label.roman),
        h('span', { class: 'cr-icon' }, label.icon),
        h('span', { class: 'cr-text' }, h('span', { class: 'cr-title' }, label.title, beyond ? h('span', { class: 'cr-tag' }, 'new keys') : null), h('span', { class: 'cr-keys' }, i === 0 ? label.keys : `+ ${label.keys}`)),
        h('span', { class: 'cr-best', title: 'Your deepest descent with this circle' }, best ? `🏆 ${best}` : '—'),
      );
    });
    let runBox = null;
    if (run) {
      const label = circleLabel(game.layoutId, run.circle);
      const max = rogueFightStats(runBaseStats(game.save), run).maxHp;
      runBox = h(
        'div',
        { class: 'gd-run' },
        h('div', { class: 'section-label' }, 'Descent in progress'),
        h('div', { class: 'gd-run-line' }, `Circle ${label.roman} · ${label.title} — depth ${run.depth}`),
        h('div', { class: 'dim' }, `❤️ ${Math.round(run.hp ?? max)} / ${max} · 🪙 ${run.coins} · ${run.relics.map((id) => RELIC_BY_ID[id] && RELIC_BY_ID[id].icon).join(' ') || 'no relics yet'}`),
        h('div', { class: 'gd-actions' }, button('Continue the descent', { hotkey: 'Enter', cls: 'primary', onClick: start }), button('Abandon', { hotkey: 'X', cls: 'danger', onClick: abandon })),
      );
    }
    fill(
      left,
      h('div', { class: 'gd-head' }, h('div', { class: 'gd-icon' }, '🌀'), h('div', {}, h('div', { class: 'zone-sub' }, 'Endless mode'), h('div', { class: 'zone-name' }, 'The Glyphdeep'))),
      h(
        'div',
        { class: 'zone-blurb' },
        'An endless descent. Every room is deeper and every foe stronger — the only goal is to get as far as you can. Campaign levels and gear stay at camp: your typing, your relics and your choices are all you carry.',
      ),
      runBox,
      h('div', { class: 'section-label' }, run ? 'Rune circles' : 'Choose your rune circle — the keys your spells will use'),
      h('div', { class: `circle-list${run ? ' locked' : ''}` }, rows),
      run
        ? null
        : h(
            'div',
            { class: 'gd-actions' },
            button(`Descend — Circle ${circleLabel(game.layoutId, selected).roman}`, { hotkey: 'Enter', cls: 'primary', onClick: start }),
            h('span', { class: 'faint' }, kbd('↑'), kbd('↓'), ' choose a circle'),
          ),
    );
  }

  function renderRight() {
    const r = R();
    const up = r.upgrades;
    const rows = META_UPGRADES.map((u) => {
      const rank = up[u.id] || 0;
      const maxed = rank >= u.max;
      const cost = maxed ? 0 : upgradeCost(u.id, rank);
      const afford = !maxed && r.ink >= cost;
      return h(
        'div',
        { class: `meta-row${maxed ? ' maxed' : ''}` },
        h('span', { class: 'mr-icon' }, u.icon),
        h(
          'span',
          { class: 'mr-text' },
          h('span', { class: 'mr-name' }, u.name, h('span', { class: 'mr-pips' }, Array.from({ length: u.max }, (_, i) => h('i', { class: i < rank ? 'on' : '' })))),
          h('span', { class: 'mr-desc' }, rank ? u.text(rank) : u.text(1)),
          !maxed && rank ? h('span', { class: 'mr-next' }, `Next: ${u.text(rank + 1)}`) : null,
        ),
        maxed
          ? h('span', { class: 'mr-max' }, 'MAX')
          : button(`🖋️ ${cost}`, {
              cls: `small${afford ? ' primary' : ''}`,
              disabled: !afford,
              title: afford ? `Buy for ${cost} Ink` : `Needs ${cost} Ink`,
              onClick: () => {
                if (buyUpgrade(game.save, u.id)) {
                  game.persist();
                  game.audio.levelUp();
                  game.toast(`${u.name} ${'I'.repeat(rank + 1)}`, { icon: u.icon, sub: u.text(rank + 1), color: '#b48cff' });
                  render();
                }
              },
            }),
      );
    });
    const s = game.save.stats;
    const runs = r.runs.slice(0, 6).map((c) => {
      const label = circleLabel(game.layoutId, c.circle);
      return h(
        'div',
        { class: 'run-row' },
        h('span', { class: 'rr-depth' }, c.depth),
        h('span', { class: 'rr-text' }, `Circle ${label.roman} · ${Math.round(c.avgWpm)} WPM · ${(c.accuracy * 100).toFixed(0)}%${c.killedBy ? ` · ${c.killedBy}` : c.cause === 'abandon' ? ' · abandoned' : ''}`),
        c.record ? h('span', { class: 'rr-rec', title: 'A new record at the time' }, '🏆') : h('span'),
        h('span', { class: 'faint' }, ago(c.t)),
      );
    });
    fill(
      right,
      h('div', { class: 'gd-ink' }, h('span', {}, '🖋️'), h('div', {}, h('div', { class: 'gd-ink-n' }, r.ink), h('div', { class: 'faint' }, 'Ink — earned with every depth, guardian and golden rune'))),
      h('div', { class: 'section-label' }, 'The Scriptorium — permanent upgrades'),
      h('div', { class: 'meta-list' }, rows),
      h('div', { class: 'section-label' }, 'Records'),
      h(
        'div',
        { class: 'tiles gd-tiles' },
        [
          [r.totalRuns, 'Descents'],
          [s.bestDepth || 0, 'Deepest'],
          [s.guardiansSlain || 0, 'Guardians'],
          [s.goldenRunes || 0, 'Golden runes'],
        ].map(([v, l]) => h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l))),
      ),
      runs.length ? [h('div', { class: 'section-label' }, 'Recent descents'), h('div', { class: 'run-list' }, runs)] : h('div', { class: 'faint' }, 'No descents yet. The first one is the hardest — and the most fun.'),
    );
  }

  function render() {
    renderLeft();
    renderRight();
  }

  return {
    mount(container) {
      const r = R();
      selected = r.run ? r.run.circle : r.lastCircle ?? Math.min(game.save.unlockedZone, ZONES.length - 1);
      left = h('div', { class: 'gd-setup panel' });
      right = h('div', { class: 'gd-meta panel' });
      el = h('div', { class: 'tab-content glyphdeep' }, left, right);
      container.appendChild(el);
      const z = ZONES[selected];
      game.bg.setPalette({ ...ZONES[8].palette, accent: z.palette.accent }, 'void');
      render();
    },
    unmount() {},
    onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        start();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        select(selected - 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        select(selected + 1);
      } else if ((e.key === 'x' || e.key === 'X') && R().run) {
        abandon();
      }
    },
  };
}
