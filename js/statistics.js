// statistics.js
// Global, persisted performance statistics across every practice/challenge/
// movement attempt. Per-combo statistics (best/average time for one specific
// saved combo) live on the combo object itself, managed by combo-system.js.

import { storage } from './storage.js';

function defaultStats() {
  return {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    bestTime: null,
    times: [],
    fastestInput: null,
    inputGaps: [],
    currentStreak: 0,
    bestStreak: 0
  };
}

export class Statistics extends EventTarget {
  constructor() {
    super();
    const stored = storage.getStatistics();
    this.data = stored ? { ...defaultStats(), ...stored } : defaultStats();
  }

  recordAttempt({ success, totalTime = null, gaps = [], inputDurations = [] }) {
    this.data.totalAttempts += 1;

    if (success) {
      this.data.successfulAttempts += 1;
      this.data.currentStreak += 1;
      this.data.bestStreak = Math.max(this.data.bestStreak, this.data.currentStreak);
      if (typeof totalTime === 'number') {
        this.data.times.push(totalTime);
        if (this.data.times.length > 200) this.data.times.shift();
        this.data.bestTime = this.data.bestTime === null ? totalTime : Math.min(this.data.bestTime, totalTime);
      }
    } else {
      this.data.failedAttempts += 1;
      this.data.currentStreak = 0;
    }

    if (gaps && gaps.length) {
      this.data.inputGaps.push(...gaps);
      if (this.data.inputGaps.length > 500) this.data.inputGaps = this.data.inputGaps.slice(-500);
    }

    if (inputDurations && inputDurations.length) {
      const fastest = Math.min(...inputDurations);
      this.data.fastestInput = this.data.fastestInput === null ? fastest : Math.min(this.data.fastestInput, fastest);
    }

    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.getSummary() }));
  }

  getSummary() {
    const d = this.data;
    const successRate = d.totalAttempts ? (d.successfulAttempts / d.totalAttempts) * 100 : 0;
    const averageTime = d.times.length ? d.times.reduce((a, b) => a + b, 0) / d.times.length : null;
    const averageGap = d.inputGaps.length ? d.inputGaps.reduce((a, b) => a + b, 0) / d.inputGaps.length : null;
    return {
      totalAttempts: d.totalAttempts,
      successfulAttempts: d.successfulAttempts,
      failedAttempts: d.failedAttempts,
      successRate,
      bestTime: d.bestTime,
      averageTime,
      fastestInput: d.fastestInput,
      averageGap,
      currentStreak: d.currentStreak,
      bestStreak: d.bestStreak
    };
  }

  reset() {
    this.data = defaultStats();
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.getSummary() }));
  }

  _persist() {
    storage.setStatistics(this.data);
  }
}
