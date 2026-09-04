// gamepad-engine.js
// Polls a connected gamepad using requestAnimationFrame (never a constant
// setInterval — the loop only runs at all while a pad is connected, and
// browsers throttle rAF in background tabs automatically). Every button
// transition is fed into ControllerState through the exact same press()/
// release() calls the keyboard and virtual controller use, tagged with
// source: 'gamepad'. The combo engine downstream has no idea — and no
// need to know — which device produced any given input.
//
// Digital D-pad only (buttons 12-15 in the "standard" Gamepad API mapping).
// Analog-stick-to-direction translation is intentionally NOT implemented:
// the brief explicitly prioritizes D-pad precision over analog movement for
// fighting-game notation, and analog would need a real, tunable deadzone to
// be trustworthy rather than a guess.

export class GamepadEngine extends EventTarget {
  constructor(controllerState, gamepadMapper) {
    super();
    this.controllerState = controllerState;
    this.gamepadMapper = gamepadMapper;
    this.connected = false;
    this.gamepadId = null;
    this.gamepadIndex = null;
    this.mapping = null;

    this._heldButtons = new Set();
    this._rafHandle = null;
    this._captureResolve = null;
    this.enabled = true;

    this._onConnect = this._onConnect.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);
    this._loop = this._loop.bind(this);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) this._releaseAllHeld();
  }

  start() {
    window.addEventListener('gamepadconnected', this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
    this._pollForExisting();
  }

  stop() {
    window.removeEventListener('gamepadconnected', this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    if (this._rafHandle) { cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
  }

  _pollForExisting() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (pad) { this._connectPad(pad); break; }
    }
  }

  _onConnect(e) {
    this._connectPad(e.gamepad);
  }

  _connectPad(pad) {
    if (!pad) return;
    this.connected = true;
    this.gamepadId = pad.id;
    this.gamepadIndex = pad.index;
    this.mapping = pad.mapping;
    this.dispatchEvent(new CustomEvent('connect', { detail: { id: pad.id, index: pad.index, mapping: pad.mapping } }));
    if (!this._rafHandle) this._loop();
  }

  _onDisconnect(e) {
    if (this.gamepadIndex !== null && e.gamepad.index !== this.gamepadIndex) return;
    this._releaseAllHeld();
    const id = this.gamepadId;
    this.connected = false;
    this.gamepadId = null;
    this.gamepadIndex = null;
    if (this._rafHandle) { cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
    this.dispatchEvent(new CustomEvent('disconnect', { detail: { id } }));
  }

  _releaseAllHeld() {
    for (const code of this._heldButtons) {
      const action = this.gamepadMapper.codeToAction(code);
      if (action) this.controllerState.release(action, { source: 'gamepad' });
    }
    this._heldButtons.clear();
  }

  /** Resolves with the raw button code ("btnN") of the next physical button pressed — used by the calibration UI. */
  captureNextButton() {
    return new Promise((resolve) => { this._captureResolve = resolve; });
  }

  cancelCapture() {
    this._captureResolve = null;
  }

  _loop() {
    this._rafHandle = requestAnimationFrame(this._loop);
    if (this.gamepadIndex === null || !navigator.getGamepads) return;
    const pad = navigator.getGamepads()[this.gamepadIndex];
    if (!pad) return;

    if (this._captureResolve) {
      for (let i = 0; i < pad.buttons.length; i++) {
        if (pad.buttons[i].pressed) {
          const resolve = this._captureResolve;
          this._captureResolve = null;
          resolve('btn' + i);
          break;
        }
      }
      return;
    }

    const nowHeld = new Set();
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed) nowHeld.add('btn' + i);
    }

    if (!this.enabled) {
      this._releaseAllHeld();
      return;
    }

    for (const code of nowHeld) {
      if (!this._heldButtons.has(code)) {
        const action = this.gamepadMapper.codeToAction(code);
        if (action) this.controllerState.press(action, { source: 'gamepad' });
      }
    }
    for (const code of this._heldButtons) {
      if (!nowHeld.has(code)) {
        const action = this.gamepadMapper.codeToAction(code);
        if (action) this.controllerState.release(action, { source: 'gamepad' });
      }
    }
    this._heldButtons = nowHeld;
  }
}
