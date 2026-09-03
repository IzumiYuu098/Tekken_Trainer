// controller-state.js
// The single source of truth for "what is currently pressed". Both the physical
// keyboard (via InputEngine + KeyMapper) and the virtual on-screen controller
// (mouse/touch clicks) feed into this same object, so every downstream system
// (notation, history, combo builder, practice mode) behaves identically no
// matter which input source produced the press.

export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'button1', 'button2', 'button3', 'button4'
];

function createEmptyState() {
  return {
    up: false, down: false, left: false, right: false,
    button1: false, button2: false, button3: false, button4: false
  };
}

export class ControllerState extends EventTarget {
  constructor(inputEngine, keyMapper) {
    super();
    this.inputEngine = inputEngine;
    this.keyMapper = keyMapper;
    this.state = createEmptyState();
    this._pressTimestamps = {};
    // Reference-count each action so overlapping sources (e.g. keyboard AND a
    // virtual-controller click both driving "left") don't release early.
    this._sourceCounts = {};
    for (const a of ACTIONS) this._sourceCounts[a] = 0;

    this._onEngineKeyDown = this._onEngineKeyDown.bind(this);
    this._onEngineKeyUp = this._onEngineKeyUp.bind(this);
    this._onEngineBlurClear = this._onEngineBlurClear.bind(this);

    if (inputEngine) {
      inputEngine.addEventListener('keydown', this._onEngineKeyDown);
      inputEngine.addEventListener('keyup', this._onEngineKeyUp);
      inputEngine.addEventListener('blur-clear', this._onEngineBlurClear);
    }
  }

  _onEngineKeyDown(e) {
    const { code, timestamp } = e.detail;
    const action = this.keyMapper.codeToAction(code);
    if (!action) return;
    this._activate(action, timestamp);
  }

  _onEngineKeyUp(e) {
    const { code, timestamp } = e.detail;
    const action = this.keyMapper.codeToAction(code);
    if (!action) return;
    this._deactivate(action, timestamp);
  }

  _onEngineBlurClear() {
    // Safety net: force every action off regardless of source-count bookkeeping.
    const timestamp = performance.now();
    let changed = false;
    for (const action of ACTIONS) {
      if (this.state[action]) {
        this.state[action] = false;
        changed = true;
      }
      this._sourceCounts[action] = 0;
    }
    if (changed) {
      this.dispatchEvent(new CustomEvent('change', {
        detail: { action: null, pressed: false, timestamp, forced: true, state: { ...this.state } }
      }));
    }
  }

  /** Used by the virtual on-screen controller (mouse/touch). */
  press(action, timestamp = performance.now()) {
    if (!ACTIONS.includes(action)) return;
    this._activate(action, timestamp);
  }

  release(action, timestamp = performance.now()) {
    if (!ACTIONS.includes(action)) return;
    this._deactivate(action, timestamp);
  }

  _activate(action, timestamp) {
    this._sourceCounts[action] += 1;
    if (this.state[action]) return; // already active via another source
    this.state[action] = true;
    this._pressTimestamps[action] = timestamp;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { action, pressed: true, timestamp, state: { ...this.state } }
    }));
  }

  _deactivate(action, timestamp) {
    this._sourceCounts[action] = Math.max(0, this._sourceCounts[action] - 1);
    if (this._sourceCounts[action] > 0) return; // still held by another source
    if (!this.state[action]) return;
    this.state[action] = false;
    const pressTimestamp = this._pressTimestamps[action];
    const duration = typeof pressTimestamp === 'number' ? timestamp - pressTimestamp : 0;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { action, pressed: false, timestamp, duration, state: { ...this.state } }
    }));
  }

  getState() {
    return { ...this.state };
  }

  reset() {
    this.state = createEmptyState();
    for (const a of ACTIONS) this._sourceCounts[a] = 0;
    this.dispatchEvent(new CustomEvent('change', {
      detail: { action: null, pressed: false, timestamp: performance.now(), state: { ...this.state } }
    }));
  }
}
