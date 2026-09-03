// input-history.js
// Converts a live stream of controller-state "change" events into a discrete
// timeline of notated inputs. The key design rule: a NEW history entry is only
// created when the *logical signature* (direction + buttons) actually changes.
// Holding a direction for two seconds produces exactly one entry with a long
// duration — never a flood of repeated identical entries.

import { combinedNotation, classifyEntryType } from './notation.js';

const DEFAULT_MAX_LENGTH = 20;

export class InputHistory extends EventTarget {
  constructor(controllerState, options = {}) {
    super();
    this.controllerState = controllerState;
    this.maxLength = options.maxLength || DEFAULT_MAX_LENGTH;
    this.entries = [];

    this._currentNotation = 'N';
    this._currentType = 'direction';
    this._currentStart = performance.now();

    this._onChange = this._onChange.bind(this);
    controllerState.addEventListener('change', this._onChange);
  }

  setMaxLength(n) {
    this.maxLength = n;
    if (this.entries.length > n) {
      this.entries = this.entries.slice(this.entries.length - n);
    }
    this.dispatchEvent(new CustomEvent('history', { detail: { entries: this.getEntries() } }));
  }

  _onChange(e) {
    const { timestamp, state } = e.detail;
    const notation = combinedNotation(state);

    if (notation === this._currentNotation) {
      // Same logical signature (e.g. a redundant change event) — nothing to log.
      return;
    }

    // The PREVIOUS signature just ended. If it was an actual input (not neutral),
    // finalize it into history with its full held duration.
    if (this._currentNotation !== 'N') {
      const duration = timestamp - this._currentStart;
      const entry = {
        type: this._currentType,
        notation: this._currentNotation,
        timestamp: this._currentStart,
        duration
      };
      this.entries.push(entry);
      if (this.entries.length > this.maxLength) this.entries.shift();
      this.dispatchEvent(new CustomEvent('entry', { detail: { entry } }));
      this.dispatchEvent(new CustomEvent('history', { detail: { entries: this.getEntries() } }));
    }

    this._currentNotation = notation;
    this._currentType = classifyEntryType(state);
    this._currentStart = timestamp;

    this.dispatchEvent(new CustomEvent('current', {
      detail: { notation, type: this._currentType, timestamp }
    }));
  }

  getCurrent() {
    return { notation: this._currentNotation, type: this._currentType, since: this._currentStart };
  }

  getEntries() {
    return this.entries.slice();
  }

  clear() {
    this.entries = [];
    this.dispatchEvent(new CustomEvent('history', { detail: { entries: [] } }));
  }
}
