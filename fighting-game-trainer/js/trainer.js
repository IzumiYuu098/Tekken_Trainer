// trainer.js
// ComboMatcher is a generic, reusable state machine that compares a live stream
// of notated inputs against a target sequence. It is deliberately independent of
// any single UI panel — Practice mode, Movement Training, and the Random
// Challenge system all create their own ComboMatcher instance and feed it the
// same notated tokens coming out of input-history.js.
//
// Event contract:
//   'result'  -> { result, progressIndex, target, got?, timing? }   fired on every
//                 meaningful state change (progress, wrong input, miss, complete)
//   'attempt' -> { success, totalTime, gaps }                       fired once per
//                 finished attempt (success OR failure), for stats/persistence
//   'reset'   -> { target }                                         fired only when
//                 the UI should visibly clear back to an idle state (a brand new
//                 target was set, or the caller explicitly asked to reset). This is
//                 intentionally NOT fired automatically after every failed/completed
//                 attempt, so the result feedback (MISS / WRONG INPUT / COMBO
//                 COMPLETE) has a chance to actually be seen before state clears.

import { TIMING_WINDOWS, classifyGap, computeSequenceTiming, now } from './timing.js';

export const RESULT = {
  PROGRESS: 'PROGRESS',
  PERFECT: 'PERFECT',
  SUCCESS: 'SUCCESS',
  EARLY: 'EARLY',
  LATE: 'LATE',
  WRONG_INPUT: 'WRONG INPUT',
  MISS: 'MISS',
  COMPLETE: 'COMBO COMPLETE'
};

export class ComboMatcher extends EventTarget {
  constructor({ timingWindowMs = TIMING_WINDOWS.normal, referenceGaps = null, missTimeoutMs = 2500 } = {}) {
    super();
    this.target = [];
    this.timingWindowMs = timingWindowMs;
    this.referenceGaps = referenceGaps; // ms[] expected gap between target[i-1] and target[i]
    this.missTimeoutMs = missTimeoutMs;
    this._timeoutHandle = null;
    this._clearAttempt();
  }

  setTarget(tokens, referenceGaps = null) {
    this.target = tokens.slice();
    this.referenceGaps = referenceGaps;
    this._clearAttempt();
    this.dispatchEvent(new CustomEvent('reset', { detail: { target: this.target.slice() } }));
  }

  setTimingWindow(ms) {
    this.timingWindowMs = ms;
  }

  setMissTimeout(ms) {
    this.missTimeoutMs = ms;
  }

  /** Explicit, UI-triggered reset (e.g. a "Reset Attempt" button). */
  reset() {
    this._clearAttempt();
    this.dispatchEvent(new CustomEvent('reset', { detail: { target: this.target.slice() } }));
  }

  /** Internal-only state clear. Does NOT fire a 'reset' UI event on purpose. */
  _clearAttempt() {
    this.progressIndex = 0;
    this.matchedEntries = [];
    this._clearTimeout();
  }

  _clearTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  _armTimeout() {
    this._clearTimeout();
    if (!this.missTimeoutMs || this.progressIndex === 0 || this.progressIndex >= this.target.length) return;
    this._timeoutHandle = setTimeout(() => {
      if (this.progressIndex > 0 && this.progressIndex < this.target.length) {
        this.dispatchEvent(new CustomEvent('result', {
          detail: { result: RESULT.MISS, progressIndex: this.progressIndex, target: this.target.slice() }
        }));
        this.dispatchEvent(new CustomEvent('attempt', { detail: { success: false, totalTime: null, gaps: [] } }));
        this._clearAttempt();
      }
    }, this.missTimeoutMs);
  }

  get lastInputTime() {
    if (!this.matchedEntries.length) return null;
    return this.matchedEntries[this.matchedEntries.length - 1].timestamp;
  }

  /** True while an attempt is in progress (first token matched, not yet finished). */
  get isActive() {
    return this.progressIndex > 0 && this.progressIndex < this.target.length;
  }

  /** Milliseconds elapsed since the current attempt began (0 if idle). */
  get elapsedMs() {
    if (!this.matchedEntries.length) return 0;
    return now() - this.matchedEntries[0].timestamp;
  }

  getMatchedTokens() {
    return this.matchedEntries.map((m) => m.notation);
  }

  processInput(notation, timestamp = now()) {
    if (!this.target.length) return;

    // No attempt in progress: only the first target token can start one. Any
    // other live input (including neutral noise) is ignored rather than failed.
    if (this.progressIndex === 0) {
      if (notation === this.target[0]) {
        this._beginAttempt(notation, timestamp);
      }
      return;
    }

    const expected = this.target[this.progressIndex];

    if (notation !== expected) {
      this.dispatchEvent(new CustomEvent('result', {
        detail: { result: RESULT.WRONG_INPUT, progressIndex: this.progressIndex, target: this.target.slice(), got: notation }
      }));
      this.dispatchEvent(new CustomEvent('attempt', { detail: { success: false, totalTime: null, gaps: [] } }));
      this._clearAttempt();

      // The wrong input might itself be a fresh, valid start of a new attempt.
      if (notation === this.target[0]) {
        this._beginAttempt(notation, timestamp);
      }
      return;
    }

    const actualGap = timestamp - this.lastInputTime;
    const expectedGap = this.referenceGaps ? this.referenceGaps[this.progressIndex - 1] : null;
    const gapResult = classifyGap(actualGap, expectedGap, this.timingWindowMs);

    this.matchedEntries.push({ notation, timestamp });
    this.progressIndex += 1;

    if (this.progressIndex >= this.target.length) {
      this._complete();
      return;
    }

    this.dispatchEvent(new CustomEvent('result', {
      detail: { result: gapResult, progressIndex: this.progressIndex, target: this.target.slice() }
    }));
    this._armTimeout();
  }

  _beginAttempt(notation, timestamp) {
    this.progressIndex = 1;
    this.matchedEntries = [{ notation, timestamp }];
    if (this.target.length === 1) {
      this._complete();
      return;
    }
    this.dispatchEvent(new CustomEvent('result', {
      detail: { result: RESULT.PROGRESS, progressIndex: 1, target: this.target.slice() }
    }));
    this._armTimeout();
  }

  _complete() {
    const timing = computeSequenceTiming(this.matchedEntries.map((m) => ({ timestamp: m.timestamp, duration: 0 })));
    this._clearTimeout();
    this.dispatchEvent(new CustomEvent('result', {
      detail: { result: RESULT.COMPLETE, progressIndex: this.progressIndex, target: this.target.slice(), timing }
    }));
    this.dispatchEvent(new CustomEvent('attempt', {
      detail: { success: true, totalTime: timing.totalTime, gaps: timing.gaps }
    }));
    this._clearAttempt();
  }
}
