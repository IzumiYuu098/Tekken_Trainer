// input-events.js
// THE fix for the input-history accuracy bug. This sits between raw
// controller-state changes and the input history log, and is the one place
// that decides "is this a meaningful input event, or just part of the same
// gesture settling?"
//
// Two separate outputs, on purpose:
//   'current' -> fires on EVERY controller-state change, with ZERO added
//                latency. This is what the live "CURRENT INPUT" display uses
//                — it must never feel delayed.
//   'event'   -> fires only when a meaningful, settled input is recognized,
//                using a short "chord window". This is what the input
//                history log uses.
//
// ALGORITHM (see README for the full write-up):
//   Every raw change (press OR release) restarts a `chordWindowMs` timer.
//   Rapid bursts of activity (e.g. D, F, U pressed within a few ms of each
//   other) keep pushing that timer forward, so nothing is evaluated until
//   the state goes quiet. When it finally goes quiet, we look at the ACTUAL
//   controller state at that instant (after SOCD resolution) and compare it
//   to the last emitted event:
//     - if BOTH direction and buttons are neutral -> nothing to log, just
//       reset the baseline (the gesture ended cleanly).
//     - if the DIRECTION changed to a new value -> that's a new event, even
//       if it's a "smaller" direction than before (e.g. DF -> D when a
//       forward key is released is a real, meaningful transition).
//     - else if a NEW button appears that wasn't part of the last emitted
//       event -> that's a new event (e.g. holding DF, then adding "+2").
//     - else (only buttons were dropped, direction unchanged) -> nothing to
//       log; a button being *released* is not a new performed input, it's
//       just the tail end of the input that was already logged.
//   This single rule set is what turns "D, DF, DF, DF+1, DF, F" into one
//   clean "DF+1" while still correctly logging genuine transitions like
//   DF -> D, without ever needing a crude fixed debounce delay on the whole
//   pipeline (the live display stays instant; only the log is debounced).

import { resolveSOCD, directionLabel, buttonLabel, combineNotation, classifyEntryType } from './notation.js';

const DEFAULT_CHORD_WINDOW_MS = 40;

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `evt_${Date.now().toString(36)}_${_idCounter}`;
}

export class InputEventEngine extends EventTarget {
  constructor(controllerState, { chordWindowMs = DEFAULT_CHORD_WINDOW_MS, socdMode = 'neutral' } = {}) {
    super();
    this.controllerState = controllerState;
    this.chordWindowMs = chordWindowMs;
    this.socdMode = socdMode;

    this._latestState = controllerState.getState();
    this._latestPressTimestamps = controllerState.getPressTimestamps();
    this._lastSource = null;
    this._pendingTimer = null;
    this._gestureStartTime = null;
    this._lastChangeTime = performance.now();
    this._lastEmitted = { direction: 'N', buttons: '' };

    this._onChange = this._onChange.bind(this);
    this._settle = this._settle.bind(this);
    controllerState.addEventListener('change', this._onChange);
  }

  setChordWindow(ms) {
    this.chordWindowMs = Math.max(0, ms);
  }

  setSocdMode(mode) {
    this.socdMode = mode;
  }

  /** Clears any in-flight gesture and resets the "last meaningful event" baseline to neutral. */
  reset() {
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
    this._gestureStartTime = null;
    this._lastEmitted = { direction: 'N', buttons: '' };
  }

  _onChange(e) {
    const { state, pressTimestamps, timestamp, source } = e.detail;
    this._latestState = state;
    this._latestPressTimestamps = pressTimestamps || {};
    this._lastSource = source || this._lastSource;
    this._lastChangeTime = timestamp;
    if (this._gestureStartTime === null) this._gestureStartTime = timestamp;

    // --- Instant live display: zero added latency, no chord-window delay ---
    const effective = resolveSOCD(state, this._latestPressTimestamps, this.socdMode);
    const direction = directionLabel(effective);
    const buttons = buttonLabel(effective);
    this.dispatchEvent(new CustomEvent('current', {
      detail: {
        notation: combineNotation(direction, buttons),
        direction,
        buttons,
        type: classifyEntryType(direction, buttons),
        timestamp,
        raw: state,
        source
      }
    }));

    // --- Debounced meaningful-event decision ---
    if (this._pendingTimer) clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(this._settle, this.chordWindowMs);
  }

  _settle() {
    this._pendingTimer = null;
    const effective = resolveSOCD(this._latestState, this._latestPressTimestamps, this.socdMode);
    const direction = directionLabel(effective);
    const buttons = buttonLabel(effective);
    const isNeutral = direction === 'N' && !buttons;
    const gestureStart = this._gestureStartTime;
    this._gestureStartTime = null;

    if (isNeutral) {
      this._lastEmitted = { direction: 'N', buttons: '' };
      return;
    }

    const directionChanged = direction !== this._lastEmitted.direction;
    const lastButtonSet = this._lastEmitted.buttons ? this._lastEmitted.buttons.split('+') : [];
    const currentButtonSet = buttons ? buttons.split('+') : [];
    const buttonsGrew = currentButtonSet.some((b) => !lastButtonSet.includes(b));

    if (directionChanged || buttonsGrew) {
      const notation = combineNotation(direction, buttons);
      const type = classifyEntryType(direction, buttons);
      const duration = Math.max(0, (this._lastChangeTime ?? gestureStart) - gestureStart);
      const inputEvent = {
        id: nextId(),
        timestamp: gestureStart,
        type,
        direction,
        buttons: currentButtonSet.slice(),
        notation,
        duration,
        source: this._lastSource
      };
      this.dispatchEvent(new CustomEvent('event', { detail: { event: inputEvent } }));
    }

    this._lastEmitted = { direction, buttons };
  }
}
