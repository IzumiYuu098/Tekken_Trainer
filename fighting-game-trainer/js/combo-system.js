// combo-system.js
// Two related but distinct responsibilities live here:
//   ComboBuilder  - the transient, in-progress sequence a user is constructing
//                   (by recording live inputs, clicking the virtual controller,
//                   or adding notation tokens manually).
//   ComboLibrary  - persisted, named combos (save/load/rename/delete) backed by
//                   localStorage via storage.js, including per-combo run stats.
//
// A small random-sequence generator is also exported here since both the combo
// builder's "Random Combo" button and the Random Challenge system need it.

import { storage } from './storage.js';

function createId() {
  return 'combo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export class ComboBuilder extends EventTarget {
  constructor(inputHistory) {
    super();
    this.inputHistory = inputHistory;
    this.sequence = [];
    this.recording = false;
    this._referenceTimestamps = [];

    this._onEntry = this._onEntry.bind(this);
    inputHistory.addEventListener('entry', this._onEntry);
  }

  _onEntry(e) {
    if (!this.recording) return;
    this.addToken(e.detail.entry.notation, e.detail.entry.timestamp);
  }

  startRecording() {
    this.recording = true;
    this.sequence = [];
    this._referenceTimestamps = [];
    this.dispatchEvent(new CustomEvent('recording', { detail: { recording: true } }));
    this.dispatchEvent(new CustomEvent('change', { detail: { sequence: this.getSequence() } }));
  }

  stopRecording() {
    this.recording = false;
    this.dispatchEvent(new CustomEvent('recording', { detail: { recording: false } }));
  }

  addToken(token, timestamp = performance.now()) {
    this.sequence.push(token);
    this._referenceTimestamps.push(timestamp);
    this.dispatchEvent(new CustomEvent('change', { detail: { sequence: this.getSequence() } }));
  }

  deleteLast() {
    this.sequence.pop();
    this._referenceTimestamps.pop();
    this.dispatchEvent(new CustomEvent('change', { detail: { sequence: this.getSequence() } }));
  }

  clear() {
    this.sequence = [];
    this._referenceTimestamps = [];
    this.dispatchEvent(new CustomEvent('change', { detail: { sequence: this.getSequence() } }));
  }

  setSequence(seq) {
    this.sequence = seq.slice();
    this._referenceTimestamps = [];
    this.dispatchEvent(new CustomEvent('change', { detail: { sequence: this.getSequence() } }));
  }

  getSequence() {
    return this.sequence.slice();
  }

  /** Gaps (ms) between consecutive recorded tokens, or null if not recorded live. */
  getReferenceGaps() {
    if (this._referenceTimestamps.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < this._referenceTimestamps.length; i++) {
      gaps.push(this._referenceTimestamps[i] - this._referenceTimestamps[i - 1]);
    }
    return gaps;
  }
}

export class ComboLibrary extends EventTarget {
  constructor() {
    super();
    this.combos = storage.getSavedCombos() || [];
  }

  list() {
    return this.combos.slice();
  }

  get(id) {
    return this.combos.find((c) => c.id === id) || null;
  }

  save({ name, inputs, difficulty = 'Normal', referenceGaps = null }) {
    const combo = {
      id: createId(),
      name: name && name.trim() ? name.trim() : `Combo ${this.combos.length + 1}`,
      inputs: inputs.slice(),
      referenceGaps: referenceGaps ? referenceGaps.slice() : null,
      difficulty,
      createdAt: Date.now(),
      bestTime: null,
      averageTime: null,
      attempts: 0,
      successes: 0
    };
    this.combos.push(combo);
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { combos: this.list() } }));
    return combo;
  }

  rename(id, newName) {
    const combo = this.get(id);
    if (!combo || !newName || !newName.trim()) return false;
    combo.name = newName.trim();
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { combos: this.list() } }));
    return true;
  }

  remove(id) {
    this.combos = this.combos.filter((c) => c.id !== id);
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { combos: this.list() } }));
  }

  recordAttempt(id, { success, totalTime }) {
    const combo = this.get(id);
    if (!combo) return;
    combo.attempts += 1;
    if (success && typeof totalTime === 'number') {
      const prevSuccesses = combo.successes;
      combo.successes += 1;
      combo.bestTime = combo.bestTime === null ? totalTime : Math.min(combo.bestTime, totalTime);
      combo.averageTime = combo.averageTime === null
        ? totalTime
        : (combo.averageTime * prevSuccesses + totalTime) / combo.successes;
    }
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { combos: this.list() } }));
  }

  _persist() {
    storage.setSavedCombos(this.combos);
  }
}

// ---------------------------------------------------------------------------
// Random sequence generation (combo builder "Random Combo" + Random Challenge)
// ---------------------------------------------------------------------------

export const DIFFICULTY_PRESETS = {
  Easy: { length: [2, 3], diagonalChance: 0.15, simultaneousChance: 0.0, buttonChance: 0.4, timingWindow: 'relaxed' },
  Normal: { length: [3, 4], diagonalChance: 0.35, simultaneousChance: 0.1, buttonChance: 0.5, timingWindow: 'normal' },
  Hard: { length: [4, 6], diagonalChance: 0.55, simultaneousChance: 0.25, buttonChance: 0.6, timingWindow: 'normal' },
  Expert: { length: [5, 8], diagonalChance: 0.75, simultaneousChance: 0.4, buttonChance: 0.7, timingWindow: 'strict' }
};

const CARDINALS = ['↑', '↓', '←', '→'];
const DIAGONALS = ['↖', '↗', '↙', '↘'];
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
      token = `${dir} ${button}`;
    }

    tokens.push(token);
  }

  return { tokens, difficulty, timingWindow: preset.timingWindow };
}
