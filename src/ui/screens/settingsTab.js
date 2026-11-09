import { h, button, fill } from '../dom.js';
import { LAYOUTS } from '../../data/layouts.js';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../data/balance.js';
import { createModal } from '../components/modal.js';
import { createDifficultyModal } from '../components/difficultyModal.js';

function segmented(options, value, onPick) {
  return h(
    'div',
    { class: 'seg' },
    options.map(([v, label]) => h('button', { type: 'button', class: v === value ? 'on' : '', onClick: () => onPick(v) }, label)),
  );
}

export function createSettingsTab(game, camp) {
  let root;

  function set(key, value) {
    game.save.settings[key] = value;
    if (key === 'volume') game.audio.setVolume(value);
    if (key === 'shake') game.fx.setShakeEnabled(value);
    game.persist();
    render();
  }

  function confirmReset() {
    const input = h('input', { type: 'text', placeholder: 'type reset', autocomplete: 'off' });
    const doReset = () => {
      if (input.value.trim().toLowerCase() !== 'reset') {
        input.style.borderColor = '#ff5566';
        return;
      }
      game.closeModal(m);
      game.newGame();
      game.toast('Progress reset', { icon: '🌱', sub: 'A new journey begins', color: '#6ee7a8' });
      game.showScreen('camp', { tab: 'map' });
      game.openModal(createDifficultyModal(game, { allowSkip: true, onDone: () => game.showScreen('camp', { tab: 'map' }) }));
    };
    const m = createModal({
      title: 'Reset all progress?',
      content: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, h('p', {}, 'Your level, items, gold, zones and rune mastery will be erased. Type "reset" to confirm.'), input),
      actions: [
        { label: 'Cancel', hotkey: 'Esc', key: 'Escape', onClick: () => game.closeModal(m) },
        { label: 'Erase everything', danger: true, onClick: doReset },
      ],
      onKey: (e) => {
        if (e.key === 'Enter') {
          doReset();
          return true;
        }
        if (e.key === 'Escape') {
          game.closeModal(m);
          return true;
        }
        return true; // let the input receive typing
      },
    });
    m.onOpen = () => setTimeout(() => input.focus(), 30);
    game.openModal(m);
  }

  function render() {
    const s = game.save.settings;
    const row = (name, desc, control) => h('div', { class: 'setting' }, h('div', { class: 's-text' }, h('div', { class: 's-name' }, name), h('div', { class: 's-desc' }, desc)), control);
    fill(root, 
      h('h3', { class: 'title-font', style: { margin: 0, color: 'var(--gold-2)' } }, 'Settings'),
      row(
        'Keyboard layout',
        'Lessons, the on-screen keyboard and incantations follow physical key positions on your layout.',
        segmented(Object.values(LAYOUTS).map((l) => [l.id, l.name]), s.layout, (v) => set('layout', v)),
      ),
      row(
        'Keyboard guide',
        'Hints lights up the next key only when you hesitate for over a second — the best way to stop looking down.',
        segmented([['hints', 'Hints'], ['always', 'Always'], ['off', 'Off']], s.guide, (v) => set('guide', v)),
      ),
      row(
        'Difficulty',
        DIFFICULTIES[s.difficulty || 'adept'].perks.join(' · '),
        segmented(DIFFICULTY_IDS.map((id) => [id, `${DIFFICULTIES[id].icon} ${DIFFICULTIES[id].name}`]), s.difficulty || 'adept', (v) => {
          game.save.settings.difficultyChosen = true;
          set('difficulty', v);
        }),
      ),
      row(
        'Volume',
        'Every correct key plays the next note of a melody that climbs with your combo.',
        h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, onInput: (e) => { game.save.settings.volume = Number(e.target.value); game.audio.setVolume(game.save.settings.volume); }, onChange: () => game.persist() }),
      ),
      row('Screen shake & flashes', 'Impacts shake and flash the screen.', segmented([[true, 'On'], [false, 'Off']], s.shake, (v) => set('shake', v))),
      row('Reset progress', 'Start over from the Hearthrow Meadow.', button('Reset…', { cls: 'danger', onClick: confirmReset })),
      h('div', { class: 'faint', style: { fontSize: '12px', textAlign: 'center' } }, 'Progress is saved automatically in this browser.'),
    );
  }

  return {
    mount(container) {
      root = h('div', { class: 'settings panel' });
      container.appendChild(h('div', { class: 'tab-content' }, root));
      render();
    },
    unmount() {},
  };
}
