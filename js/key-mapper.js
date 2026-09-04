// key-mapper.js
// Translates physical keyboard keys (KeyboardEvent.code) into logical controller
// actions. Fully remappable and persisted. Nothing in here knows about the DOM
// beyond KeyboardEvent.code strings, so it can be unit-reasoned-about in isolation.

import { storage } from './storage.js';

export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'button1', 'button2', 'button3', 'button4'
];

export const ACTION_LABELS = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  button1: 'Button 1',
  button2: 'Button 2',
  button3: 'Button 3',
  button4: 'Button 4'
};

// Default layout: standard WASD for directions, U/I/J/K for the four attacks
// (1=U, 2=I, 3=J, 4=K). Both halves remain fully remappable in Settings.
export const DEFAULT_BINDINGS = {
  up: 'KeyW',
  left: 'KeyA',
  down: 'KeyS',
  right: 'KeyD',
  button1: 'KeyU',
  button2: 'KeyI',
  button3: 'KeyJ',
  button4: 'KeyK'
};

const SPECIAL_CODE_LABELS = {
  Space: 'Space',
  ControlLeft: 'L-Ctrl',
  ControlRight: 'R-Ctrl',
  ShiftLeft: 'L-Shift',
  ShiftRight: 'R-Shift',
  AltLeft: 'L-Alt',
  AltRight: 'R-Alt',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Tab: 'Tab',
  CapsLock: 'Caps',
  Enter: 'Enter',
  Backspace: 'Backspace'
};

export function codeToDisplay(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5) + ' Arrow';
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return SPECIAL_CODE_LABELS[code] || code;
}

export class KeyMapper extends EventTarget {
  constructor() {
    super();
    const stored = storage.getKeyBindings();
    this.bindings = { ...DEFAULT_BINDINGS, ...(stored || {}) };
    this._reverse = new Map();
    this._rebuildReverse();
  }

  _rebuildReverse() {
    this._reverse.clear();
    for (const action of ACTIONS) {
      const code = this.bindings[action];
      if (code) this._reverse.set(code, action);
    }
  }

  codeToAction(code) {
    return this._reverse.get(code) || null;
  }

  getBindingCode(action) {
    return this.bindings[action];
  }

  getBindingDisplay(action) {
    return codeToDisplay(this.bindings[action]);
  }

  getAllBindings() {
    return { ...this.bindings };
  }

  /** Returns the OTHER action already bound to `code`, or null. */
  findConflict(action, code) {
    for (const other of ACTIONS) {
      if (other !== action && this.bindings[other] === code) return other;
    }
    return null;
  }

  setBinding(action, code) {
    if (!ACTIONS.includes(action)) return { ok: false, reason: 'unknown-action' };
    const conflict = this.findConflict(action, code);
    this.bindings[action] = code;
    this._rebuildReverse();
    this.dispatchEvent(new CustomEvent('change', { detail: { action, code, conflict } }));
    return { ok: true, conflict };
  }

  resetToDefault() {
    this.bindings = { ...DEFAULT_BINDINGS };
    this._rebuildReverse();
    this.dispatchEvent(new CustomEvent('change', { detail: { reset: true } }));
  }

  save() {
    storage.setKeyBindings(this.bindings);
  }
}
