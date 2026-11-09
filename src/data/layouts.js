// Physical keyboard layouts. Keys are identified by KeyboardEvent.code (physical position),
// so the curriculum (home row first, etc.) is identical on every layout.

export const FINGERS = {
  lp: { name: 'Left pinky', color: '#ff6b8b' },
  lr: { name: 'Left ring', color: '#ffa94d' },
  lm: { name: 'Left middle', color: '#ffe066' },
  li: { name: 'Left index', color: '#69db7c' },
  ri: { name: 'Right index', color: '#4dd4ac' },
  rm: { name: 'Right middle', color: '#4dabf7' },
  rr: { name: 'Right ring', color: '#9775fa' },
  rp: { name: 'Right pinky', color: '#f783ac' },
  th: { name: 'Thumb', color: '#adb5bd' },
};

const FINGER_CODES = {
  lp: ['Backquote', 'Digit1', 'KeyQ', 'KeyA', 'KeyZ', 'IntlBackslash', 'ShiftLeft', 'Tab', 'CapsLock'],
  lr: ['Digit2', 'KeyW', 'KeyS', 'KeyX'],
  lm: ['Digit3', 'KeyE', 'KeyD', 'KeyC'],
  li: ['Digit4', 'Digit5', 'KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB'],
  ri: ['Digit6', 'Digit7', 'KeyY', 'KeyU', 'KeyH', 'KeyJ', 'KeyN', 'KeyM'],
  rm: ['Digit8', 'KeyI', 'KeyK', 'Comma'],
  rr: ['Digit9', 'KeyO', 'KeyL', 'Period'],
  rp: [
    'Digit0', 'Minus', 'Equal', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash',
    'Semicolon', 'Quote', 'Slash', 'ShiftRight', 'Enter', 'Backspace',
  ],
  th: ['Space', 'AltRight'],
};

export const CODE_FINGER = {};
for (const [finger, codes] of Object.entries(FINGER_CODES)) {
  for (const code of codes) CODE_FINGER[code] = finger;
}

/** character key */
const k = (code, base, shift, extra = {}) => ({ code, base, shift, ...extra });
/** special (non-character) key, drawn only */
const s = (code, label, w) => ({ code, label, w, special: true });

const letter = (code, ch, extra = {}) => k(code, ch, ch.toUpperCase(), extra);

export const LAYOUTS = {
  qwerty: {
    id: 'qwerty',
    name: 'QWERTY (US)',
    rows: [
      [
        k('Backquote', '`', '~'), k('Digit1', '1', '!'), k('Digit2', '2', '@'), k('Digit3', '3', '#'),
        k('Digit4', '4', '$'), k('Digit5', '5', '%'), k('Digit6', '6', '^'), k('Digit7', '7', '&'),
        k('Digit8', '8', '*'), k('Digit9', '9', '('), k('Digit0', '0', ')'), k('Minus', '-', '_'),
        k('Equal', '=', '+'), s('Backspace', '⌫', 2),
      ],
      [
        s('Tab', 'Tab', 1.5),
        letter('KeyQ', 'q'), letter('KeyW', 'w'), letter('KeyE', 'e'), letter('KeyR', 'r'),
        letter('KeyT', 't'), letter('KeyY', 'y'), letter('KeyU', 'u'), letter('KeyI', 'i'),
        letter('KeyO', 'o'), letter('KeyP', 'p'), k('BracketLeft', '[', '{'), k('BracketRight', ']', '}'),
        k('Backslash', '\\', '|', { w: 1.5 }),
      ],
      [
        s('CapsLock', 'Caps', 1.8),
        letter('KeyA', 'a'), letter('KeyS', 's'), letter('KeyD', 'd'), letter('KeyF', 'f', { bump: true }),
        letter('KeyG', 'g'), letter('KeyH', 'h'), letter('KeyJ', 'j', { bump: true }), letter('KeyK', 'k'),
        letter('KeyL', 'l'), k('Semicolon', ';', ':'), k('Quote', "'", '"'), s('Enter', 'Enter', 2.2),
      ],
      [
        s('ShiftLeft', 'Shift', 2.35),
        letter('KeyZ', 'z'), letter('KeyX', 'x'), letter('KeyC', 'c'), letter('KeyV', 'v'),
        letter('KeyB', 'b'), letter('KeyN', 'n'), letter('KeyM', 'm'), k('Comma', ',', '<'),
        k('Period', '.', '>'), k('Slash', '/', '?'), s('ShiftRight', 'Shift', 2.65),
      ],
      [s('Space', '', 6.5)],
    ],
  },
  qwertz: {
    id: 'qwertz',
    name: 'QWERTZ (DE)',
    rows: [
      [
        k('Backquote', '^', '°', { dead: ['base'] }), k('Digit1', '1', '!'), k('Digit2', '2', '"', { altgr: '²' }),
        k('Digit3', '3', '§', { altgr: '³' }), k('Digit4', '4', '$'), k('Digit5', '5', '%'),
        k('Digit6', '6', '&'), k('Digit7', '7', '/', { altgr: '{' }), k('Digit8', '8', '(', { altgr: '[' }),
        k('Digit9', '9', ')', { altgr: ']' }), k('Digit0', '0', '=', { altgr: '}' }),
        k('Minus', 'ß', '?', { altgr: '\\' }), k('Equal', '´', '`', { dead: ['base', 'shift'] }),
        s('Backspace', '⌫', 2),
      ],
      [
        s('Tab', 'Tab', 1.5),
        letter('KeyQ', 'q', { altgr: '@' }), letter('KeyW', 'w'), letter('KeyE', 'e', { altgr: '€' }),
        letter('KeyR', 'r'), letter('KeyT', 't'), letter('KeyY', 'z'), letter('KeyU', 'u'),
        letter('KeyI', 'i'), letter('KeyO', 'o'), letter('KeyP', 'p'), k('BracketLeft', 'ü', 'Ü'),
        k('BracketRight', '+', '*', { altgr: '~' }), s('Enter', 'Enter', 1.5),
      ],
      [
        s('CapsLock', 'Caps', 1.8),
        letter('KeyA', 'a'), letter('KeyS', 's'), letter('KeyD', 'd'), letter('KeyF', 'f', { bump: true }),
        letter('KeyG', 'g'), letter('KeyH', 'h'), letter('KeyJ', 'j', { bump: true }), letter('KeyK', 'k'),
        letter('KeyL', 'l'), k('Semicolon', 'ö', 'Ö'), k('Quote', 'ä', 'Ä'), k('Backslash', '#', "'"),
        s('Enter', '', 1.2),
      ],
      [
        s('ShiftLeft', 'Shift', 1.35), k('IntlBackslash', '<', '>', { altgr: '|' }),
        letter('KeyZ', 'y'), letter('KeyX', 'x'), letter('KeyC', 'c'), letter('KeyV', 'v'),
        letter('KeyB', 'b'), letter('KeyN', 'n'), letter('KeyM', 'm', { altgr: 'µ' }), k('Comma', ',', ';'),
        k('Period', '.', ':'), k('Slash', '-', '_'), s('ShiftRight', 'Shift', 2.65),
      ],
      [s('Space', '', 6.5), s('AltRight', 'AltGr', 1.5)],
    ],
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);
