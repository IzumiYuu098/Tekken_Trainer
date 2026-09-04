// storage.js
// Thin, defensive wrapper around localStorage. Every read/write is try/caught
// so a disabled or full storage quota never crashes the trainer. Storage is
// versioned (see STORAGE_VERSION) so future updates can migrate old data
// instead of silently discarding it — see characters.js for the one
// migration this update actually needs (flat saved-combos -> per-character
// combo library).

const NAMESPACE = 'fgtrainer:';
export const STORAGE_VERSION = 2;

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
  // --- versioning -----------------------------------------------------
  getStorageVersion() { return safeGet('storageVersion', 0); },
  setStorageVersion(v) { return safeSet('storageVersion', v); },

  // --- input mapping ----------------------------------------------------
  getKeyBindings() { return safeGet('keyBindings', null); },
  setKeyBindings(bindings) { return safeSet('keyBindings', bindings); },

  getGamepadBindings() { return safeGet('gamepadBindings', null); },
  setGamepadBindings(bindings) { return safeSet('gamepadBindings', bindings); },

  getInputSource() { return safeGet('inputSource', 'both'); }, // 'keyboard' | 'gamepad' | 'both'
  setInputSource(source) { return safeSet('inputSource', source); },

  getSocdMode() { return safeGet('socdMode', 'neutral'); }, // 'neutral' | 'last' | 'first'
  setSocdMode(mode) { return safeSet('socdMode', mode); },

  getChordWindowMs() { return safeGet('chordWindowMs', 40); },
  setChordWindowMs(ms) { return safeSet('chordWindowMs', ms); },

  // --- practice / timing ------------------------------------------------
  getPrecisionMode() { return safeGet('precisionMode', 'normal'); }, // relaxed|normal|strict|perfect
  setPrecisionMode(mode) { return safeSet('precisionMode', mode); },

  getTimingDifficulty() { return safeGet('timingDifficulty', 'normal'); }, // legacy alias, still read by old code paths
  setTimingDifficulty(level) { return safeSet('timingDifficulty', level); },

  // --- history ------------------------------------------------------------
  getHistoryLength() { return safeGet('historyLength', 50); },
  setHistoryLength(length) { return safeSet('historyLength', length); },

  getAutoScroll() { return safeGet('autoScroll', true); },
  setAutoScroll(v) { return safeSet('autoScroll', v); },

  getHistoryPaused() { return safeGet('historyPaused', false); },
  setHistoryPaused(v) { return safeSet('historyPaused', v); },

  // --- data ---------------------------------------------------------------
  getSavedCombos() { return safeGet('savedCombos', []); }, // legacy v1 shape, read-only migration source
  setSavedCombos(combos) { return safeSet('savedCombos', combos); },

  getCharacters() { return safeGet('characters', null); },
  setCharacters(characters) { return safeSet('characters', characters); },

  getStatistics() { return safeGet('statistics', null); },
  setStatistics(stats) { return safeSet('statistics', stats); },

  getProgression() { return safeGet('progression', null); },
  setProgression(progress) { return safeSet('progression', progress); },

  getDailyPracticeConfig() { return safeGet('dailyPracticeConfig', { length: 6 }); },
  setDailyPracticeConfig(cfg) { return safeSet('dailyPracticeConfig', cfg); },

  // --- presentation ---------------------------------------------------------
  getTheme() { return safeGet('theme', 'fighting-game'); },
  setTheme(theme) { return safeSet('theme', theme); },

  getSoundSettings() { return safeGet('soundSettings', { muted: false, volume: 0.6 }); },
  setSoundSettings(settings) { return safeSet('soundSettings', settings); },

  getReducedMotionOverride() { return safeGet('reducedMotionOverride', null); },
  setReducedMotionOverride(value) { return safeSet('reducedMotionOverride', value); },

  getDebugMode() { return safeGet('debugMode', false); },
  setDebugMode(v) { return safeSet('debugMode', v); },

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

  /** Full snapshot for the Export Data feature. */
  exportAll() {
    const keys = [
      'keyBindings', 'gamepadBindings', 'inputSource', 'socdMode', 'chordWindowMs',
      'precisionMode', 'historyLength', 'autoScroll', 'characters', 'statistics',
      'progression', 'dailyPracticeConfig', 'theme', 'soundSettings'
    ];
    const data = { storageVersion: STORAGE_VERSION, exportedAt: new Date().toISOString() };
    for (const k of keys) data[k] = safeGet(k, null);
    return data;
  },

  /** Import a previously-exported snapshot. Unknown/missing fields are ignored safely. */
  importAll(data) {
    if (!data || typeof data !== 'object') return false;
    const keys = [
      'keyBindings', 'gamepadBindings', 'inputSource', 'socdMode', 'chordWindowMs',
      'precisionMode', 'historyLength', 'autoScroll', 'characters', 'statistics',
      'progression', 'dailyPracticeConfig', 'theme', 'soundSettings'
    ];
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null) safeSet(k, data[k]);
    }
    return true;
  },

  _remove: safeRemove
};
