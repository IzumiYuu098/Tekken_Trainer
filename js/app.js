// app.js
// Composition root for the v2 architecture:
//   KEYBOARD ─┐
//             ├─> INPUT ENGINE / GAMEPAD ENGINE ─> CONTROLLER STATE
//   GAMEPAD ──┘         (both feed the same state through the same API)
//                              │
//                     INPUT EVENT ENGINE (SOCD + chord-window recognition)
//                              │
//                       INPUT HISTORY (log)
//                              │
//                  COMBO BUILDER / CHARACTER LIBRARY
//                              │
//                    TRAINER (ComboMatcher x4: practice/movement/challenge/skill)
//                              │
//                 STATISTICS / PROGRESSION / AUDIO
//                              │
//                             UI
//
// There is exactly ONE InputEventEngine and ONE ControllerState — keyboard
// and gamepad do not have separate combo logic, by construction.

import { KeyMapper } from './key-mapper.js';
import { GamepadMapper } from './gamepad-mapper.js';
import { InputEngine } from './input-engine.js';
import { GamepadEngine } from './gamepad-engine.js';
import { ControllerState } from './controller-state.js';
import { InputEventEngine } from './input-events.js';
import { InputHistory } from './input-history.js';
import { ComboBuilder, generateRandomSequence } from './combo-system.js';
import { CharacterLibrary } from './characters.js';
import { ComboMatcher, RESULT, PRECISION_MODE_NAMES } from './trainer.js';
import { MOVEMENT_EXERCISES, getExerciseById } from './movement-training.js';
import { formatSeconds, formatMs } from './timing.js';
import { Statistics } from './statistics.js';
import { Progression, generateDailySession, SKILL_LEVELS, findSkill } from './progression.js';
import { AudioFeedback } from './audio.js';
import { storage } from './storage.js';
import { SOCD_MODES, SOCD_MODE_LABELS } from './notation.js';
import { parseComboText, serializeSteps, estimateDifficulty } from './combo-notation.js';
import { initUI } from './ui.js';

// --- Core input pipeline (single authoritative path) -----------------------
const keyMapper = new KeyMapper();
const gamepadMapper = new GamepadMapper();
const inputEngine = new InputEngine();
const controllerState = new ControllerState(inputEngine, keyMapper);
const gamepadEngine = new GamepadEngine(controllerState, gamepadMapper);

const inputEventEngine = new InputEventEngine(controllerState, {
  chordWindowMs: storage.getChordWindowMs(),
  socdMode: storage.getSocdMode()
});
const inputHistory = new InputHistory(inputEventEngine, { maxLength: storage.getHistoryLength() });
if (storage.getHistoryPaused()) inputHistory.setPaused(true);

// --- Combo system ------------------------------------------------------------
const comboBuilder = new ComboBuilder(inputHistory);
const characterLibrary = new CharacterLibrary();

// --- Support systems -----------------------------------------------------------
const statistics = new Statistics();
const progression = new Progression(storage);
const audio = new AudioFeedback();

// --- Trainer instances --------------------------------------------------------
// practiceMatcher drives the single Train-tab display for EVERYTHING you can
// "Train": the demo target, a saved character combo, a roadmap skill drill,
// a daily-practice item, or a random challenge. movementMatcher is separate
// only because the Movement tab has its own always-visible display area.
const precisionMode = storage.getPrecisionMode();
const practiceMatcher = new ComboMatcher({ precisionMode });
const movementMatcher = new ComboMatcher({ precisionMode: 'relaxed' });

// --- Apply the input-source setting (keyboard / gamepad / both) --------------
function applyInputSource(source) {
  inputEngine.setEnabled(source === 'keyboard' || source === 'both');
  gamepadEngine.setEnabled(source === 'gamepad' || source === 'both');
}
applyInputSource(storage.getInputSource());

// Every finalized, structured input event is broadcast to every matcher; each
// one independently decides whether it currently has a target to compare
// against (an empty target is a silent no-op — see trainer.js).
inputHistory.addEventListener('entry', (e) => {
  const entry = e.detail.entry;
  audio.play('input');
  practiceMatcher.processInputEvent(entry);
  movementMatcher.processInputEvent(entry);
});

inputEngine.start();
gamepadEngine.start();

const DEFAULT_TARGET = ['DF+1']; // illustrative example from the brief, not a claimed real move

initUI({
  keyMapper,
  gamepadMapper,
  inputEngine,
  gamepadEngine,
  controllerState,
  inputEventEngine,
  inputHistory,
  comboBuilder,
  characterLibrary,
  statistics,
  progression,
  audio,
  practiceMatcher,
  movementMatcher,
  movementExercises: MOVEMENT_EXERCISES,
  getExerciseById,
  generateRandomSequence,
  generateDailySession,
  skillLevels: SKILL_LEVELS,
  findSkill,
  storage,
  formatSeconds,
  formatMs,
  RESULT,
  PRECISION_MODE_NAMES,
  SOCD_MODES,
  SOCD_MODE_LABELS,
  parseComboText,
  serializeSteps,
  estimateDifficulty,
  applyInputSource,
  DEFAULT_TARGET
});
