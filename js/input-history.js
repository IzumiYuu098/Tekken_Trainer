// input-history.js
// A thin, dumb log of already-normalized InputEvents produced by
// input-events.js. This file intentionally contains NO chord/timing logic
// anymore — that all lives in the event engine. This file only: stores
// events (up to maxLength), supports pausing, and tells the UI to
// auto-scroll or not.

const DEFAULT_MAX_LENGTH = 50;
export const HISTORY_LENGTH_OPTIONS = [10, 20, 30, 50, 100];

export class InputHistory extends EventTarget {
  constructor(inputEventEngine, options = {}) {
    super();
    this.inputEventEngine = inputEventEngine;
    this.maxLength = options.maxLength || DEFAULT_MAX_LENGTH;
    this.paused = false;
    this.entries = [];

    this._onEvent = this._onEvent.bind(this);
    inputEventEngine.addEventListener('event', this._onEvent);
  }

  _onEvent(e) {
    if (this.paused) return;
    const entry = e.detail.event;
    this.entries.push(entry);
    if (this.entries.length > this.maxLength) this.entries.shift();
    this.dispatchEvent(new CustomEvent('entry', { detail: { entry } }));
    this.dispatchEvent(new CustomEvent('history', { detail: { entries: this.getEntries() } }));
  }

  setMaxLength(n) {
    this.maxLength = n;
    if (this.entries.length > n) this.entries = this.entries.slice(this.entries.length - n);
    this.dispatchEvent(new CustomEvent('history', { detail: { entries: this.getEntries() } }));
  }

  setPaused(paused) {
    this.paused = !!paused;
    this.dispatchEvent(new CustomEvent('pause', { detail: { paused: this.paused } }));
  }

  getEntries() {
    return this.entries.slice();
  }

  clear() {
    this.entries = [];
    this.dispatchEvent(new CustomEvent('history', { detail: { entries: [] } }));
  }
}
