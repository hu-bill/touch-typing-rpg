import './styles/main.css';
import { loadSave, createNewSave } from './core/save.js';
import { Game } from './ui/game.js';

function safeStorage() {
  try {
    const k = '__spellstroke_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
}

async function detectLayout() {
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      const map = await navigator.keyboard.getLayoutMap();
      if (map.get('KeyY') === 'z') return 'qwertz';
      if (map.get('KeyY') === 'y') return 'qwerty';
    }
  } catch {
    /* ignore */
  }
  return (navigator.language || '').toLowerCase().startsWith('de') ? 'qwertz' : 'qwerty';
}

async function boot() {
  const storage = safeStorage();
  let save = loadSave(storage);
  const hadSave = !!save;
  if (!save) {
    save = createNewSave();
    save.settings.layout = await detectLayout();
  }
  const game = new Game({ root: document.getElementById('app'), save, storage, hadSave });
  window.__spellstroke = game; // handy for debugging in the console

  window.addEventListener('keydown', (e) => game.onKeyDown(e));
  // The game is keyboard-driven: never leave focus on a clicked button, or Space/Enter would re-click it.
  document.addEventListener('click', () => {
    const el = document.activeElement;
    if (el && el.tagName === 'BUTTON') el.blur();
  });
  let last = performance.now();
  const frame = (t) => {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    game.update(dt, performance.now());
    requestAnimationFrame(frame);
  };
  game.showScreen('title');
  requestAnimationFrame(frame);
}

boot();
