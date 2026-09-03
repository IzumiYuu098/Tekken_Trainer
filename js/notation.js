// notation.js
// Pure, stateless functions that turn a raw controller state into fighting-game
// notation. Nothing here touches timing, history, or the DOM — it just answers
// "given these booleans, what symbol is this?"
//
// Simultaneous opposite directions (left+right, up+down) are a real possibility
// on a keyboard/leverless controller in a way they never are on an analog stick.
// This engine does NOT try to guess a specific game's SOCD (simultaneous-opposing-
// cardinal-direction) resolution behavior. It uses the simplest, most predictable
// rule — opposing directions cancel to neutral on that axis — and always keeps the
// raw boolean state available separately so nothing is ever silently lost.

export function resolveDirection({ up, down, left, right }) {
  const vertical = up && down ? null : up ? 'up' : down ? 'down' : null;
  const horizontal = left && right ? null : left ? 'left' : right ? 'right' : null;
  return { vertical, horizontal };
}

const DIRECTION_SYMBOLS = {
  'up|': '↑',
  'down|': '↓',
  '|left': '←',
  '|right': '→',
  'up|left': '↖',
  'up|right': '↗',
  'down|left': '↙',
  'down|right': '↘',
  '|': 'N'
};

export const DIRECTION_SYMBOL_LIST = ['↑', '↓', '←', '→', '↖', '↗', '↙', '↘'];

export function directionNotation(state) {
  const { vertical, horizontal } = resolveDirection(state);
  const key = `${vertical || ''}|${horizontal || ''}`;
  return DIRECTION_SYMBOLS[key] || 'N';
}

const BUTTON_ORDER = ['button1', 'button2', 'button3', 'button4'];
const BUTTON_LABEL = { button1: '1', button2: '2', button3: '3', button4: '4' };

export function buttonNotation(state) {
  const active = BUTTON_ORDER.filter((b) => state[b]).map((b) => BUTTON_LABEL[b]);
  return active.join('+');
}

/**
 * Full combined notation for a controller-state snapshot, e.g. "↘ 1+2", "←", "1", "N".
 */
export function combinedNotation(state) {
  const dir = directionNotation(state);
  const btn = buttonNotation(state);
  if (dir === 'N' && !btn) return 'N';
  if (dir === 'N') return btn;
  if (!btn) return dir;
  return `${dir} ${btn}`;
}

export function classifyEntryType(state) {
  const dir = directionNotation(state);
  const btn = buttonNotation(state);
  if (dir !== 'N' && btn) return 'mixed';
  if (btn) return 'button';
  return 'direction';
}

/** True if the raw state has an opposite-direction pair held (left+right or up+down). */
export function hasOpposingDirections({ up, down, left, right }) {
  return !!((up && down) || (left && right));
}
