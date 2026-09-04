// combo-system.js
// The transient, in-progress combo builder: record live input, or build a
// sequence via the manual notation editor / random generator. Persisted,
// named combos now live in characters.js (per-character combo library) —
// this file is only the "workbench" for constructing one before saving it.

import { stepFromLiveEvent } from './combo-notation.js';

export class ComboBuilder extends EventTarget {
  constructor(inputHistory) {
    super();
    this.inputHistory = inputHistory;
    this.steps = [];
    this.recording = false;
    this._referenceTimestamps = [];

    this._onEntry = this._onEntry.bind(this);
    inputHistory.addEventListener('entry', this._onEntry);
  }

  _onEntry(e) {
    if (!this.recording) return;
    this.addStep(stepFromLiveEvent(e.detail.entry), e.detail.entry.timestamp);
  }

  startRecording() {
    this.recording = true;
    this.steps = [];
    this._referenceTimestamps = [];
    this.dispatchEvent(new CustomEvent('recording', { detail: { recording: true } }));
    this.dispatchEvent(new CustomEvent('change', { detail: { steps: this.getSteps() } }));
  }

  stopRecording() {
    this.recording = false;
    this.dispatchEvent(new CustomEvent('recording', { detail: { recording: false } }));
  }

  addStep(step, timestamp = performance.now()) {
    this.steps.push(step);
    this._referenceTimestamps.push(timestamp);
    this.dispatchEvent(new CustomEvent('change', { detail: { steps: this.getSteps() } }));
  }

  deleteLast() {
    this.steps.pop();
    this._referenceTimestamps.pop();
    this.dispatchEvent(new CustomEvent('change', { detail: { steps: this.getSteps() } }));
  }

  clear() {
    this.steps = [];
    this._referenceTimestamps = [];
    this.dispatchEvent(new CustomEvent('change', { detail: { steps: this.getSteps() } }));
  }

  setSteps(steps) {
    this.steps = steps.slice();
    this._referenceTimestamps = [];
    this.dispatchEvent(new CustomEvent('change', { detail: { steps: this.getSteps() } }));
  }

  getSteps() {
    return this.steps.slice();
  }

  getNotationText() {
    return this.steps.map((s) => s.notation).join(' \u2192 ');
  }

  /** Gaps (ms) between consecutive recorded steps, or null if not recorded live. */
  getReferenceGaps() {
    if (this._referenceTimestamps.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < this._referenceTimestamps.length; i++) {
      gaps.push(this._referenceTimestamps[i] - this._referenceTimestamps[i - 1]);
    }
    return gaps;
  }
}

// ---------------------------------------------------------------------------
// Random sequence generation (Random Challenge system + movement variety)
// ---------------------------------------------------------------------------

export const DIFFICULTY_PRESETS = {
  Easy: { length: [2, 3], diagonalChance: 0.15, simultaneousChance: 0.0, buttonChance: 0.4, precisionMode: 'relaxed' },
  Normal: { length: [3, 4], diagonalChance: 0.35, simultaneousChance: 0.1, buttonChance: 0.5, precisionMode: 'normal' },
  Hard: { length: [4, 6], diagonalChance: 0.55, simultaneousChance: 0.25, buttonChance: 0.6, precisionMode: 'normal' },
  Expert: { length: [5, 8], diagonalChance: 0.75, simultaneousChance: 0.4, buttonChance: 0.7, precisionMode: 'strict' }
};

const CARDINALS = ['U', 'D', 'B', 'F'];
const DIAGONALS = ['UB', 'UF', 'DB', 'DF'];
const BUTTONS = ['1', '2', '3', '4'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomSequence(difficulty = 'Normal') {
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.Normal;
  const [min, max] = preset.length;
  const length = min + Math.floor(Math.random() * (max - min + 1));
  const tokens = [];

  for (let i = 0; i < length; i++) {
    const isDiagonal = Math.random() < preset.diagonalChance;
    const dir = isDiagonal ? pick(DIAGONALS) : pick(CARDINALS);
    let token = dir;

    if (Math.random() < preset.buttonChance) {
      let button = pick(BUTTONS);
      if (Math.random() < preset.simultaneousChance) {
        let second = pick(BUTTONS);
        let attempts = 0;
        while (second === button && attempts < 5) {
          second = pick(BUTTONS);
          attempts += 1;
        }
        if (second !== button) {
          const nums = [button, second].map(Number).sort((a, b) => a - b);
          button = nums.join('+');
        }
      }
      token = `${dir}+${button}`;
    }

    tokens.push(token);
  }

  return { tokens, difficulty, precisionMode: preset.precisionMode };
}
