// trainer.js
// ComboMatcher compares a live stream of structured InputEvents (from
// input-events.js) against a target sequence of STEPS. A step is either:
//   { type: 'input', notation, direction, buttons: [] }  — a real, verifiable
//     input, compared structurally (not by string) so mismatches can be
//     diagnosed precisely (wrong direction vs wrong button vs missing button
//     vs extra input).
//   { type: 'label', notation }  — an unverifiable checkpoint (a stance,
//     movement, or character-specific term like "WS"/"BT"/"DEW"). The
//     trainer cannot see inside the real game, so label steps are never
//     matched against live input — the player manually confirms them via
//     confirmLabelStep() once they've performed it in-game.
//
// Precision modes control timing tolerance and how strict/forgiving the
// matcher is about stray or mistimed input. This is the same matcher class
// behind Practice mode, Movement Training, and the Random Challenge system.

import { classifyGap, computeSequenceTiming, now } from './timing.js';
import { parseNotationToken } from './notation.js';

export const RESULT = {
  PROGRESS: 'PROGRESS',
  PERFECT: 'PERFECT',
  SUCCESS: 'SUCCESS',
  TIMING_ERROR: 'TIMING ERROR',
  WRONG_INPUT: 'WRONG INPUT',
  WRONG_BUTTON: 'WRONG BUTTON',
  MISSING_BUTTON: 'MISSING BUTTON',
  EXTRA_INPUT: 'EXTRA INPUT',
  MISS: 'MISS',
  LABEL_STEP: 'CONFIRM STEP',
  COMPLETE: 'COMBO COMPLETE'
};

export const PRECISION_MODES = {
  relaxed: { timingWindowMs: 120, missTimeoutMs: 5000, allowAutoRestart: true, flagStrayInput: false, failOnTimingError: false },
  normal: { timingWindowMs: 60, missTimeoutMs: 3000, allowAutoRestart: true, flagStrayInput: false, failOnTimingError: false },
  strict: { timingWindowMs: 30, missTimeoutMs: 2000, allowAutoRestart: true, flagStrayInput: true, failOnTimingError: true },
  perfect: { timingWindowMs: 15, missTimeoutMs: 1200, allowAutoRestart: false, flagStrayInput: true, failOnTimingError: true }
};
export const PRECISION_MODE_NAMES = ['relaxed', 'normal', 'strict', 'perfect'];

function stepFromToken(token) {
  const parsed = parseNotationToken(token);
  if (parsed.kind === 'label') return { type: 'label', notation: token };
  return { type: 'input', notation: parsed.raw, direction: parsed.direction, buttons: parsed.buttons };
}

export class ComboMatcher extends EventTarget {
  constructor({ precisionMode = 'normal', referenceGaps = null } = {}) {
    super();
    this.steps = [];
    this.referenceGaps = referenceGaps;
    this._timeoutHandle = null;
    this.setPrecisionMode(precisionMode);
    this._clearAttempt();
  }

  setPrecisionMode(name) {
    const preset = PRECISION_MODES[name] || PRECISION_MODES.normal;
    this.mode = { ...preset };
    this.precisionModeName = PRECISION_MODES[name] ? name : 'normal';
  }

  /** Fine-tune on top of the current precision mode without switching modes entirely. */
  setTimingWindow(ms) { this.mode.timingWindowMs = ms; }
  setMissTimeout(ms) { this.mode.missTimeoutMs = ms; }

  /** Accepts either plain notation-token strings or pre-built step objects (see combo-notation.js). */
  setTarget(stepsOrTokens, referenceGaps = null) {
    this.steps = (stepsOrTokens || []).map((s) => (typeof s === 'string' ? stepFromToken(s) : s));
    this.referenceGaps = referenceGaps;
    this._clearAttempt();
    this.dispatchEvent(new CustomEvent('reset', { detail: { target: this._targetSummary() } }));
  }

  reset() {
    this._clearAttempt();
    this.dispatchEvent(new CustomEvent('reset', { detail: { target: this._targetSummary() } }));
  }

  _clearAttempt() {
    this.progressIndex = 0;
    this.matchedEntries = [];
    this._allPerfectSoFar = true;
    this._clearTimeout();
  }

  _clearTimeout() {
    if (this._timeoutHandle) { clearTimeout(this._timeoutHandle); this._timeoutHandle = null; }
  }

  _armTimeout() {
    this._clearTimeout();
    if (!this.mode.missTimeoutMs || this.progressIndex === 0 || this.progressIndex >= this.steps.length) return;
    this._timeoutHandle = setTimeout(() => {
      if (this.progressIndex > 0 && this.progressIndex < this.steps.length) {
        const expected = this.steps[this.progressIndex];
        this.dispatchEvent(new CustomEvent('result', {
          detail: {
            result: RESULT.MISS, stepIndex: this.progressIndex, target: this._targetSummary(),
            expected: expected.notation, feedback: `No input received in time. Expected ${expected.notation}.`
          }
        }));
        this.dispatchEvent(new CustomEvent('attempt', { detail: { success: false, totalTime: null, gaps: [], errorKind: RESULT.MISS } }));
        this._clearAttempt();
      }
    }, this.mode.missTimeoutMs);
  }

  get lastInputTime() {
    if (!this.matchedEntries.length) return null;
    return this.matchedEntries[this.matchedEntries.length - 1].timestamp;
  }

  get isActive() {
    return this.progressIndex > 0 && this.progressIndex < this.steps.length;
  }

  get elapsedMs() {
    if (!this.matchedEntries.length) return 0;
    return now() - this.matchedEntries[0].timestamp;
  }

  get currentStep() {
    return this.steps[this.progressIndex] || null;
  }

  getMatchedTokens() {
    return this.matchedEntries.map((m) => m.notation);
  }

  _targetSummary() {
    return this.steps.map((s) => s.notation);
  }

  /** Structural comparison — never a plain string comparison. */
  _compareStep(expectedStep, evt) {
    if (expectedStep.direction !== evt.direction) return { matches: false, kind: RESULT.WRONG_INPUT };
    const exp = expectedStep.buttons.slice().sort();
    const act = evt.buttons.slice().sort();
    const same = exp.length === act.length && exp.every((b, i) => b === act[i]);
    if (same) return { matches: true, kind: null };
    if (exp.length && !act.length) return { matches: false, kind: RESULT.MISSING_BUTTON };
    if (!exp.length && act.length) return { matches: false, kind: RESULT.EXTRA_INPUT };
    return { matches: false, kind: RESULT.WRONG_BUTTON };
  }

  _feedbackFor(kind, expectedStep, evt, extra = {}) {
    switch (kind) {
      case RESULT.WRONG_INPUT:
        return `Expected ${expectedStep.notation}, got ${evt.notation} — wrong direction.`;
      case RESULT.WRONG_BUTTON:
        return `Wrong button — expected ${expectedStep.buttons.join('+') || 'none'}, got ${evt.buttons.join('+') || 'none'}.`;
      case RESULT.MISSING_BUTTON:
        return `Missing button — expected ${expectedStep.buttons.join('+')}.`;
      case RESULT.EXTRA_INPUT:
        return `Extra input — pressed ${evt.buttons.join('+')} when none was expected.`;
      case RESULT.TIMING_ERROR:
        return `Timing error — expected within ${this.mode.timingWindowMs}ms of the previous input, yours was ${Math.round(extra.actualGap || 0)}ms.`;
      default:
        return '';
    }
  }

  _failAttempt(kind, expectedStep, evt, extra = {}) {
    this.dispatchEvent(new CustomEvent('result', {
      detail: {
        result: kind, stepIndex: this.progressIndex, target: this._targetSummary(),
        expected: expectedStep.notation, received: evt.notation,
        feedback: this._feedbackFor(kind, expectedStep, evt, extra), ...extra
      }
    }));
    this.dispatchEvent(new CustomEvent('attempt', { detail: { success: false, totalTime: null, gaps: [], errorKind: kind } }));
    this._clearAttempt();
  }

  /** Feed a real, structured InputEvent (as produced by input-events.js) into the matcher. */
  processInputEvent(evt) {
    if (!this.steps.length) return;
    const currentStep = this.steps[this.progressIndex];
    if (!currentStep) return;
    if (currentStep.type === 'label') return; // waiting for a manual confirmLabelStep()

    if (this.progressIndex === 0) {
      const cmp = this._compareStep(this.steps[0], evt);
      if (cmp.matches) {
        this._beginAttempt(evt);
      } else if (this.mode.flagStrayInput) {
        this.dispatchEvent(new CustomEvent('result', {
          detail: { result: RESULT.EXTRA_INPUT, stepIndex: 0, target: this._targetSummary(), received: evt.notation, feedback: 'Stray input before starting the combo.' }
        }));
      }
      return;
    }

    const expectedStep = this.steps[this.progressIndex];
    const cmp = this._compareStep(expectedStep, evt);

    if (!cmp.matches) {
      this._failAttempt(cmp.kind, expectedStep, evt);
      if (this.mode.allowAutoRestart && this._compareStep(this.steps[0], evt).matches) this._beginAttempt(evt);
      return;
    }

    const actualGap = evt.timestamp - this.lastInputTime;
    const expectedGap = this.referenceGaps ? this.referenceGaps[this.progressIndex - 1] : null;
    const gapClass = classifyGap(actualGap, expectedGap, this.mode.timingWindowMs); // PERFECT | EARLY | LATE | SUCCESS
    const mistimed = gapClass === 'EARLY' || gapClass === 'LATE';

    if (mistimed && this.mode.failOnTimingError) {
      this._failAttempt(RESULT.TIMING_ERROR, expectedStep, evt, { timingDetail: gapClass, expectedGap, actualGap });
      if (this.mode.allowAutoRestart && this._compareStep(this.steps[0], evt).matches) this._beginAttempt(evt);
      return;
    }

    this.matchedEntries.push({ ...evt });
    this.progressIndex += 1;
    const topResult = mistimed ? RESULT.TIMING_ERROR : gapClass;
    if (gapClass !== 'PERFECT') this._allPerfectSoFar = false;

    if (this.progressIndex >= this.steps.length) { this._completeAttempt(topResult); return; }
    this._afterAdvance(topResult);
  }

  /** UI calls this when the player has manually performed/confirmed an unverifiable label step. */
  confirmLabelStep() {
    const step = this.steps[this.progressIndex];
    if (!step || step.type !== 'label') return;
    this.matchedEntries.push({ notation: step.notation, timestamp: now(), direction: null, buttons: [], type: 'label' });
    this.progressIndex += 1;
    if (this.progressIndex >= this.steps.length) { this._completeAttempt(RESULT.SUCCESS); return; }
    this._afterAdvance(RESULT.SUCCESS);
  }

  _beginAttempt(evt) {
    this.progressIndex = 1;
    this.matchedEntries = [{ ...evt }];
    if (this.steps.length === 1) { this._completeAttempt(RESULT.SUCCESS); return; }
    this._afterAdvance(RESULT.PROGRESS);
  }

  _afterAdvance(resultIfNotLabel) {
    const nextStep = this.steps[this.progressIndex];
    if (nextStep && nextStep.type === 'label') {
      this._clearTimeout();
      this.dispatchEvent(new CustomEvent('result', {
        detail: { result: RESULT.LABEL_STEP, stepIndex: this.progressIndex, target: this._targetSummary(), label: nextStep.notation }
      }));
      return;
    }
    this.dispatchEvent(new CustomEvent('result', {
      detail: { result: resultIfNotLabel, stepIndex: this.progressIndex, target: this._targetSummary() }
    }));
    this._armTimeout();
  }

  _completeAttempt(lastResult) {
    const timing = computeSequenceTiming(this.matchedEntries.map((m) => ({ timestamp: m.timestamp, duration: m.duration || 0 })));
    this._clearTimeout();
    const isPerfect = this._allPerfectSoFar && this.matchedEntries.length > 1;
    this.dispatchEvent(new CustomEvent('result', {
      detail: { result: RESULT.COMPLETE, stepIndex: this.progressIndex, target: this._targetSummary(), timing, lastStepResult: lastResult }
    }));
    this.dispatchEvent(new CustomEvent('attempt', { detail: { success: true, totalTime: timing.totalTime, gaps: timing.gaps, isPerfect } }));
    this._clearAttempt();
  }
}
