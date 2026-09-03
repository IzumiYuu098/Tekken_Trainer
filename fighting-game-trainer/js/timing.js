// timing.js
// High-resolution timing helpers shared by the trainer, combo system, and
// statistics modules. Everything is measured with performance.now() upstream;
// this file only does arithmetic and classification on those numbers.

export const TIMING_WINDOWS = {
  strict: 30,
  normal: 60,
  relaxed: 100
};

export const TIMING_LEVELS = ['strict', 'normal', 'relaxed'];

export function now() {
  return performance.now();
}

/**
 * Classifies how an actual gap (ms) compares to an expected/reference gap (ms)
 * within a tolerance window (ms). If there is no reference gap to compare
 * against, the input is simply correct ("SUCCESS") — we never fail someone on
 * timing we have no ground truth for.
 */
export function classifyGap(actualGapMs, expectedGapMs, windowMs) {
  if (expectedGapMs === null || expectedGapMs === undefined || Number.isNaN(expectedGapMs)) {
    return 'SUCCESS';
  }
  const delta = actualGapMs - expectedGapMs;
  if (Math.abs(delta) <= windowMs) return 'PERFECT';
  return delta < 0 ? 'EARLY' : 'LATE';
}

/**
 * Given a chronological list of finalized input entries ({ timestamp, duration }),
 * compute overall sequence timing stats.
 */
export function computeSequenceTiming(entries) {
  if (!entries.length) {
    return { totalTime: 0, gaps: [], averageGap: 0, fastestInput: null, slowestInput: null };
  }
  const gaps = [];
  for (let i = 1; i < entries.length; i++) {
    gaps.push(entries[i].timestamp - entries[i - 1].timestamp);
  }
  const durations = entries.map((e) => e.duration).filter((d) => typeof d === 'number' && d >= 0);
  const totalTime = entries.length > 1
    ? entries[entries.length - 1].timestamp - entries[0].timestamp
    : (entries[0].duration || 0);
  const averageGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const fastestInput = durations.length ? Math.min(...durations) : null;
  const slowestInput = durations.length ? Math.max(...durations) : null;
  return { totalTime, gaps, averageGap, fastestInput, slowestInput };
}

export function formatSeconds(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  return (ms / 1000).toFixed(3) + 's';
}

export function formatMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  return Math.round(ms) + 'ms';
}
