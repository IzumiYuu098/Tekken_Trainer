// storage.js
// Thin, defensive wrapper around localStorage. Every read/write is try/caught so a
// disabled or full storage quota never crashes the trainer — it just falls back
// to sane in-memory defaults for that session.

const NAMESPACE = 'fgtrainer:';

function safeGet(key, fallback) {
  try {
    const raw = window.localStorage.getItem(NAMESPACE + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] failed to read "${key}"`, err);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] failed to write "${key}"`, err);
    return false;
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(NAMESPACE + key);
    return true;
  } catch (err) {
    console.warn(`[storage] failed to remove "${key}"`, err);
    return false;
  }
}

export const storage = {
  getKeyBindings() {
    return safeGet('keyBindings', null);
  },
  setKeyBindings(bindings) {
    return safeSet('keyBindings', bindings);
  },

  getTheme() {
    return safeGet('theme', 'fighting-game');
  },
  setTheme(theme) {
    return safeSet('theme', theme);
  },

  getSoundSettings() {
    return safeGet('soundSettings', { muted: false, volume: 0.6 });
  },
  setSoundSettings(settings) {
    return safeSet('soundSettings', settings);
  },

  getTimingDifficulty() {
    return safeGet('timingDifficulty', 'normal');
  },
  setTimingDifficulty(level) {
    return safeSet('timingDifficulty', level);
  },

  getHistoryLength() {
    return safeGet('historyLength', 20);
  },
  setHistoryLength(length) {
    return safeSet('historyLength', length);
  },

  getSavedCombos() {
    return safeGet('savedCombos', []);
  },
  setSavedCombos(combos) {
    return safeSet('savedCombos', combos);
  },

  getStatistics() {
    return safeGet('statistics', null);
  },
  setStatistics(stats) {
    return safeSet('statistics', stats);
  },

  getReducedMotionOverride() {
    return safeGet('reducedMotionOverride', null);
  },
  setReducedMotionOverride(value) {
    return safeSet('reducedMotionOverride', value);
  },

  clearAll() {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(NAMESPACE))
        .forEach((k) => window.localStorage.removeItem(k));
      return true;
    } catch (err) {
      console.warn('[storage] failed to clear all', err);
      return false;
    }
  },

  _remove: safeRemove
};
