import { h, kbd, fill } from '../dom.js';
import { createModal } from './modal.js';
import { BAL, DIFFICULTIES, DIFFICULTY_IDS } from '../../data/balance.js';
import { ZONES } from '../../data/zones.js';

const SKIP_ZONE = ZONES.findIndex((z) => z.id === 'archive');

/** True for a journey that has not really started yet (skipping ahead is only offered then). */
export function isFreshSave(save) {
  return save.player.level === 1 && save.unlockedZone === 0 && save.stats.totalKills === 0;
}

/**
 * "Choose your path": pick a difficulty (1/2/3 or ←/→) and, on a fresh journey, optionally skip the
 * letter regions (S). Enter confirms. onDone() runs after the choice has been applied and saved.
 */
export function createDifficultyModal(game, { allowSkip = false, onDone } = {}) {
  let selected = game.save.settings.difficulty || 'adept';
  let skip = false;
  const cardsEl = h('div', { class: 'diff-cards' });
  const skipEl = h('div');

  function render() {
    fill(
      cardsEl,
      DIFFICULTY_IDS.map((id, i) => {
        const d = DIFFICULTIES[id];
        return h(
          'button',
          {
            type: 'button',
            class: `diff-card${id === selected ? ' selected' : ''}`,
            onClick: () => select(id),
          },
          h('div', { class: 'dc-top' }, kbd(String(i + 1)), h('span', { class: 'dc-icon' }, d.icon)),
          h('div', { class: 'dc-name' }, d.name),
          h('div', { class: 'dc-tag' }, d.tagline),
          h('ul', { class: 'dc-perks' }, d.perks.map((p) => h('li', {}, p))),
        );
      }),
    );
    if (allowSkip) {
      fill(
        skipEl,
        h(
          'button',
          { type: 'button', class: `skip-toggle${skip ? ' on' : ''}`, onClick: toggleSkip },
          kbd('S'),
          h('span', { class: 'st-box' }, skip ? '✓' : ''),
          h(
            'span',
            {},
            h('b', {}, 'I already touch type — skip the letter lessons. '),
            `Start in ${ZONES[SKIP_ZONE].name} with every letter unlocked, at level ${BAL.skipAheadLevel}. Earlier regions stay open to revisit.`,
          ),
        ),
      );
    }
  }

  function select(id) {
    if (id === selected) return;
    selected = id;
    game.audio.click();
    render();
  }

  function toggleSkip() {
    skip = !skip;
    game.audio.click();
    render();
  }

  const confirm = () => {
    game.closeModal(m);
    game.applyDifficulty(selected, { skipAhead: allowSkip && skip });
    if (onDone) onDone();
  };

  const m = createModal({
    title: 'Choose your path',
    cls: 'difficulty',
    content: h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('p', { style: { textAlign: 'center' } }, 'How much challenge do you want? You can change this later in Settings.'),
      cardsEl,
      allowSkip ? skipEl : null,
    ),
    actions: [{ label: 'Begin', hotkey: 'Enter', key: 'Enter', primary: true, onClick: confirm }],
    onKey: (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= DIFFICULTY_IDS.length) {
        select(DIFFICULTY_IDS[n - 1]);
        return true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const i = DIFFICULTY_IDS.indexOf(selected) + (e.key === 'ArrowRight' ? 1 : -1);
        select(DIFFICULTY_IDS[Math.max(0, Math.min(DIFFICULTY_IDS.length - 1, i))]);
        return true;
      }
      if (allowSkip && (e.key === 's' || e.key === 'S')) {
        toggleSkip();
        return true;
      }
      return false;
    },
  });
  render();
  return m;
}
