import { MASTERY_NAMES, masteryBonus } from '../../logic/mastery.js';
import { charInfo } from '../../logic/keyboard.js';
import { MASTERY_COLORS } from './keyboardView.js';

const GAP_MS = 700;
let nextAt = 0;

/** Announce a new personal-best mastery level of a key: toast + chime + key flash. Queued 700 ms apart. */
export function announceMastery(game, { ch, level, keyboard = null }) {
  const now = performance.now();
  const startAt = Math.max(now, nextAt);
  nextAt = startAt + GAP_MS;
  const show = () => {
    const label = ch === ' ' ? '␣' : ch;
    game.toast(`Rune ${label} → ${MASTERY_NAMES[level]}`, {
      icon: '✦',
      sub: `+${Math.round(masteryBonus(level) * 100)}% power whenever you type it`,
      color: MASTERY_COLORS[level],
      life: 3600,
    });
    game.audio.loot(level + 1);
    const info = charInfo(game.layoutId, ch);
    if (keyboard && info && keyboard.el.isConnected) keyboard.celebrate(info.code, MASTERY_COLORS[level]);
  };
  if (startAt <= now) show();
  else setTimeout(show, startAt - now);
}
