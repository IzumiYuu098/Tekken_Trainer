// gamepad-mapper.js
// Physical gamepad button index <-> logical action, mirroring key-mapper.js.
// Codes are strings like "btn12" so the storage/remap UI can treat gamepad
// and keyboard bindings symmetrically. Defaults assume the browser reports
// the "standard" Gamepad API mapping (true for a DualShock 4 on Chrome,
// Firefox, and Edge in the large majority of cases) — D-pad on buttons
// 12-15, the four face buttons on 0-3. This is a sensible DEFAULT, not a
// hard assumption: every binding can be recalibrated in Settings by pressing
// the physical button you want, which is what actually makes this
// browser/device-numbering-safe.

import { storage } from './storage.js';

export const GAMEPAD_ACTIONS = ['up', 'down', 'left', 'right', 'button1', 'button2', 'button3', 'button4'];

export const DEFAULT_GAMEPAD_BINDINGS = {
  up: 'btn12',
  down: 'btn13',
  left: 'btn14',
  right: 'btn15',
  button1: 'btn0', // Cross on a standard-mapped DS4
  button2: 'btn1', // Circle
  button3: 'btn2', // Square
  button4: 'btn3' // Triangle
};

export function gamepadCodeToDisplay(code) {
  if (!code) return '—';
  const m = /^btn(\d+)$/.exec(code);
  return m ? `Button ${m[1]}` : code;
}

export class GamepadMapper extends EventTarget {
  constructor() {
    super();
    const stored = storage.getGamepadBindings();
    this.bindings = { ...DEFAULT_GAMEPAD_BINDINGS, ...(stored || {}) };
    this._reverse = new Map();
    this._rebuildReverse();
  }

  _rebuildReverse() {
    this._reverse.clear();
    for (const action of GAMEPAD_ACTIONS) {
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
    return gamepadCodeToDisplay(this.bindings[action]);
  }

  findConflict(action, code) {
    for (const other of GAMEPAD_ACTIONS) {
      if (other !== action && this.bindings[other] === code) return other;
    }
    return null;
  }

  setBinding(action, code) {
    if (!GAMEPAD_ACTIONS.includes(action)) return { ok: false, reason: 'unknown-action' };
    const conflict = this.findConflict(action, code);
    this.bindings[action] = code;
    this._rebuildReverse();
    this.dispatchEvent(new CustomEvent('change', { detail: { action, code, conflict } }));
    return { ok: true, conflict };
  }

  resetToDefault() {
    this.bindings = { ...DEFAULT_GAMEPAD_BINDINGS };
    this._rebuildReverse();
    this.dispatchEvent(new CustomEvent('change', { detail: { reset: true } }));
  }

  save() {
    storage.setGamepadBindings(this.bindings);
  }
}
