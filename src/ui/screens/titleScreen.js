import { h, button, charFromEvent, pulseClass } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { confirmModal } from '../components/modal.js';
import { createDifficultyModal, isFreshSave } from '../components/difficultyModal.js';

const WORD = 'SPELLSTROKE';

export function createTitleScreen(game) {
  let letters = [];
  let combo = 0;

  const enterCamp = () => {
    game.audio.banner();
    game.showScreen('camp', { tab: 'map' });
  };
  // first start (or a save from before difficulties existed): choose a path first
  const begin = () => {
    game.audio.unlock();
    if (game.save.settings.difficultyChosen) {
      enterCamp();
      return;
    }
    game.openModal(createDifficultyModal(game, { allowSkip: isFreshSave(game.save), onDone: enterCamp }));
  };
  // The Glyphdeep can be played from the very first launch (PLAN §13.9)
  const descend = () => {
    game.audio.unlock();
    const go = () => {
      game.audio.banner();
      if (game.save.rogue.run) game.continueRun();
      else game.showScreen('camp', { tab: 'glyphdeep' });
    };
    if (game.save.settings.difficultyChosen) {
      go();
      return;
    }
    game.openModal(createDifficultyModal(game, { allowSkip: false, onDone: go }));
  };
  const newGame = () => {
    confirmModal(game, {
      title: 'Start a new journey?',
      text: 'All progress, items and rune mastery will be erased.',
      confirmLabel: 'Erase & begin',
      danger: true,
      onConfirm: () => {
        game.newGame();
        game.hadSave = false;
        begin();
      },
    });
  };

  return {
    mount(root) {
      game.bg.setPalette(ZONES[0].palette, ZONES[0].ambient);
      letters = WORD.split('').map((c, i) => h('span', { style: { animationDelay: `${i * 0.12}s` } }, c));
      const hasProgress = game.hadSave;
      const runNow = game.save.rogue && game.save.rogue.run;
      root.appendChild(
        h(
          'div',
          { class: 'title-screen' },
          h('h1', { class: 'logo' }, letters),
          h('div', { class: 'tagline' }, 'Every spell is a keystroke'),
          h(
            'div',
            { class: 'howto panel' },
            h('div', {}, '✦ ', h('b', {}, 'Type the glowing first letter'), ' of a spell card to start casting, then type the rest of the incantation.'),
            h('div', {}, '✦ ', h('b', {}, 'Speed and accuracy are power.'), ' Faster casts hit harder; mistakes destabilise the spell. Too many and it fizzles.'),
            h('div', {}, '✦ ', h('b', {}, 'Each region teaches new runes'), ' — from the home row to brackets and braces. Master keys in real life to make them stronger in game.'),
          ),
          h(
            'div',
            { class: 'title-actions' },
            hasProgress
              ? [button('Continue', { hotkey: 'Space', cls: 'primary', onClick: begin }), button('New game', { hotkey: 'N', onClick: newGame })]
              : button('Begin your journey', { hotkey: 'Space', cls: 'primary', onClick: begin }),
            button(runNow ? `Continue the descent (depth ${runNow.depth})` : 'The Glyphdeep — endless', { hotkey: 'D', cls: 'rogue-btn', onClick: descend }),
          ),
          h('div', { class: 'title-rogue' }, '🌀 ', h('b', {}, 'The Glyphdeep'), ' — an endless roguelike descent. Pick any set of keys, from the home row to the full keyboard, and see how deep your fingers can take you.'),
          h('div', { class: 'press-hint' }, 'Rest your fingers on the home row · feel the bumps on F and J'),
        ),
      );
    },
    unmount() {},
    onKey(e) {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        begin();
        return;
      }
      if (game.hadSave && (e.key === 'n' || e.key === 'N')) {
        newGame();
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        descend();
        return;
      }
      const ch = charFromEvent(e);
      if (!ch) return;
      // typing letters of the logo makes them glow and sing
      const idx = letters.findIndex((l) => l.textContent.toLowerCase() === ch.toLowerCase());
      if (idx >= 0) {
        combo += 1;
        letters.forEach((l) => {
          if (l.textContent.toLowerCase() === ch.toLowerCase()) pulseClass(l, 'lit', 400);
        });
        game.audio.key(combo);
        const r = letters[idx].getBoundingClientRect();
        game.fx.sparks(r.left + r.width / 2, r.top + r.height / 2, '#f5c66b', 8);
      } else {
        combo = 0;
      }
    },
  };
}
