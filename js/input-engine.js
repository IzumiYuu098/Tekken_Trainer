// input-engine.js
// Raw keyboard capture. Knows nothing about game logic, notation, or the DOM
// beyond window-level key events. Responsibilities:
//   - collapse OS/browser auto-repeat keydown spam into a single logical press
//   - track precise press/release timestamps using performance.now()
//   - forcibly clear all held keys when the window/tab loses focus so nothing
//     can ever get "stuck" pressed.

export class InputEngine extends EventTarget {
  constructor() {
    super();
    this._held = new Map(); // code -> pressTimestamp
    this._running = false;
    this.enabled = true;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) this._onBlur(); // clear any held keys immediately when disabled
  }

  start() {
    if (this._running) return;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._running = true;
  }

  stop() {
    if (!this._running) return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._running = false;
  }

  _onKeyDown(e) {
    const code = e.code;
    if (!code || !this.enabled) return;

    // Ignore keystrokes typed into a text field (e.g. renaming a combo, typing
    // a settings value) so the trainer doesn't eat the user's typing.
    if (this._isTypingTarget(e.target)) return;

    if (this._held.has(code)) {
      // Auto-repeat guard: the browser keeps firing keydown while a key is held.
      // We already know about this key, so this is not a new logical press.
      return;
    }

    const timestamp = performance.now();
    this._held.set(code, timestamp);
    this.dispatchEvent(new CustomEvent('keydown', { detail: { code, timestamp, key: e.key } }));
  }

  _onKeyUp(e) {
    const code = e.code;
    if (!code) return;

    const pressTimestamp = this._held.get(code);
    if (pressTimestamp === undefined) return;

    const timestamp = performance.now();
    const duration = timestamp - pressTimestamp;
    this._held.delete(code);
    this.dispatchEvent(new CustomEvent('keyup', { detail: { code, timestamp, duration, key: e.key } }));
  }

  _onVisibility() {
    if (document.hidden) this._onBlur();
  }

  _onBlur() {
    if (this._held.size === 0) return;
    const timestamp = performance.now();
    const codes = Array.from(this._held.keys());
    for (const code of codes) {
      const pressTimestamp = this._held.get(code);
      const duration = timestamp - pressTimestamp;
      this._held.delete(code);
      this.dispatchEvent(new CustomEvent('keyup', { detail: { code, timestamp, duration, synthetic: true } }));
    }
    this.dispatchEvent(new CustomEvent('blur-clear', { detail: { timestamp, codes } }));
  }

  _isTypingTarget(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
  }

  isHeld(code) {
    return this._held.has(code);
  }

  getHeldCodes() {
    return Array.from(this._held.keys());
  }
}
