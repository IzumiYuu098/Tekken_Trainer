// notation.js
// Pure, stateless functions that turn controller state into fighting-game
// notation. This trainer uses standard Tekken-style command notation (as
// written in every combo guide): U/D/B/F for the four cardinal directions
// (Back/Forward are relative to a character always facing right — the
// universal convention combo notation is written in), DB/DF/UB/UF for
// diagonals, N for neutral, and 1/2/3/4 for the four attack buttons, joined
// with "+" (e.g. "DF+1", "DF+1+2").
//
// SOCD (Simultaneous Opposing Cardinal Direction) handling: holding two
// opposite directions at once (left+right, up+down) is a real possibility on
// a keyboard/leverless controller. This module does NOT claim to reproduce
// any specific game's or controller's SOCD behavior — it exposes three
// documented, selectable resolution policies and always keeps the raw
// boolean state available separately so nothing is silently lost.

export const SOCD_MODES = ['neutral', 'last', 'first'];
export const SOCD_MODE_LABELS = {
  neutral: 'Neutral (opposing directions cancel out)',
  last: 'Last Input Priority (most recently pressed wins)',
  first: 'First Input Priority (first held direction wins)'
};

function resolveAxis(state, pressTimestamps, mode, posKey, negKey) {
  const posActive = !!state[posKey];
  const negActive = !!state[negKey];
  if (posActive && negActive) {
    if (mode === 'neutral') return null;
    const posT = typeof pressTimestamps[posKey] === 'number' ? pressTimestamps[posKey] : 0;
    const negT = typeof pressTimestamps[negKey] === 'number' ? pressTimestamps[negKey] : 0;
    if (mode === 'last') return posT >= negT ? posKey : negKey;
    if (mode === 'first') return posT <= negT ? posKey : negKey;
    return null;
  }
  if (posActive) return posKey;
  if (negActive) return negKey;
  return null;
}

/**
 * Applies the configured SOCD policy to raw controller state, producing an
 * "effective" state where at most one of {up,down} and one of {left,right}
 * is true. Buttons pass through unchanged.
 */
export function resolveSOCD(state, pressTimestamps = {}, mode = 'neutral') {
  const vertical = resolveAxis(state, pressTimestamps, mode, 'up', 'down');
  const horizontal = resolveAxis(state, pressTimestamps, mode, 'right', 'left');
  return {
    up: vertical === 'up',
    down: vertical === 'down',
    left: horizontal === 'left',
    right: horizontal === 'right',
    button1: !!state.button1,
    button2: !!state.button2,
    button3: !!state.button3,
    button4: !!state.button4
  };
}

/** True if the RAW (pre-SOCD) state has an opposing pair held. Useful for the debugger. */
export function hasOpposingDirections({ up, down, left, right }) {
  return !!((up && down) || (left && right));
}

const DIRECTION_LABELS = {
  'up|': 'U',
  'down|': 'D',
  '|left': 'B',
  '|right': 'F',
  'up|left': 'UB',
  'up|right': 'UF',
  'down|left': 'DB',
  'down|right': 'DF',
  '|': 'N'
};

export const DIRECTION_LABEL_LIST = ['U', 'D', 'B', 'F', 'UB', 'UF', 'DB', 'DF'];

/** effectiveState must already be SOCD-resolved (see resolveSOCD). */
export function directionLabel(effectiveState) {
  const vertical = effectiveState.up ? 'up' : effectiveState.down ? 'down' : null;
  const horizontal = effectiveState.left ? 'left' : effectiveState.right ? 'right' : null;
  const key = `${vertical || ''}|${horizontal || ''}`;
  return DIRECTION_LABELS[key] || 'N';
}

const BUTTON_ORDER = ['button1', 'button2', 'button3', 'button4'];
const BUTTON_LABEL = { button1: '1', button2: '2', button3: '3', button4: '4' };

export function buttonLabel(state) {
  return BUTTON_ORDER.filter((b) => state[b]).map((b) => BUTTON_LABEL[b]).join('+');
}

/** Joins a direction label and a button label (e.g. "DF", "1+2") into one token, e.g. "DF+1+2". */
export function combineNotation(direction, buttons) {
  if (!direction || direction === 'N') return buttons || 'N';
  return buttons ? `${direction}+${buttons}` : direction;
}

/** One-shot: raw state + press timestamps + SOCD mode -> final notation token. */
export function computeNotation(state, pressTimestamps = {}, socdMode = 'neutral') {
  const effective = resolveSOCD(state, pressTimestamps, socdMode);
  return combineNotation(directionLabel(effective), buttonLabel(effective));
}

export function classifyEntryType(direction, buttons) {
  const hasButtons = !!buttons;
  const hasDirection = !!direction && direction !== 'N';
  if (hasDirection && hasButtons) return 'mixed';
  if (hasButtons) return 'button';
  if (hasDirection) return 'direction';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Structured token parsing — turns a notation STRING (typed by a user in the
// combo notation editor, or produced live by the input engine) into a
// structured { direction, buttons[] } object. Anything that doesn't parse as
// valid direction/button syntax is reported as an opaque custom LABEL rather
// than guessed at — this is what lets the combo library hold real,
// unverifiable move labels like "WS", "BT", "DEW" alongside real inputs.
// ---------------------------------------------------------------------------

const VALID_DIRECTIONS = new Set(['N', 'U', 'D', 'B', 'F', 'UB', 'UF', 'DB', 'DF']);
const VALID_BUTTONS = new Set(['1', '2', '3', '4']);

export function parseNotationToken(token) {
  const raw = (token || '').toString().trim();
  if (!raw) return { kind: 'empty', direction: 'N', buttons: [], raw: '' };

  const parts = raw.split('+').map((p) => p.trim()).filter(Boolean);
  let direction = 'N';
  const buttons = [];
  let valid = parts.length > 0;
  let directionSeen = false;

  parts.forEach((part, i) => {
    const upper = part.toUpperCase();
    if (VALID_BUTTONS.has(part)) {
      buttons.push(part);
    } else if (i === 0 && VALID_DIRECTIONS.has(upper)) {
      direction = upper;
      directionSeen = true;
    } else {
      valid = false;
    }
  });

  if (!valid) {
    return { kind: 'label', direction: null, buttons: [], raw };
  }
  buttons.sort();
  if (direction === 'N' && !buttons.length && !directionSeen) {
    return { kind: 'empty', direction: 'N', buttons: [], raw };
  }
  return { kind: 'input', direction, buttons, raw: combineNotation(direction, buttons.join('+')) };
}

/** Structured equality check between two notation tokens (order-independent on buttons). */
export function tokensEqual(a, b) {
  const pa = typeof a === 'string' ? parseNotationToken(a) : a;
  const pb = typeof b === 'string' ? parseNotationToken(b) : b;
  if (pa.kind !== pb.kind) return false;
  if (pa.kind === 'label') return pa.raw === pb.raw;
  return pa.direction === pb.direction && pa.buttons.join('+') === pb.buttons.join('+');
}
