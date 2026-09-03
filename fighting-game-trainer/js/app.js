// app.js
// Composition root. Instantiates every system in the order the architecture
// diagram describes (keyboard -> input engine -> key mapper -> controller state
// -> notation -> input history -> combo system -> trainer -> timing ->
// statistics -> ui), wires the few cross-cutting event subscriptions that
// aren't view-specific, and hands everything to ui.js to render.

import { KeyMapper } from './key-mapper.js';
import { InputEngine } from './input-engine.js';
import { ControllerState } from './controller-state.js';
import { InputHistory } from './input-history.js';
import { ComboBuilder, ComboLibrary, generateRandomSequence } from './combo-system.js';
import { ComboMatcher, RESULT } from './trainer.js';
import { MOVEMENT_EXERCISES, getExerciseById } from './movement-training.js';
import { TIMING_WINDOWS, formatSeconds, formatMs } from './timing.js';
import { Statistics } from './statistics.js';
import { AudioFeedback } from './audio.js';
import { storage } from './storage.js';
import { combinedNotation } from './notation.js';
import { initUI } from './ui.js';

// --- Core input pipeline -----------------------------------------------
const keyMapper = new KeyMapper();
const inputEngine = new InputEngine();
const controllerState = new ControllerState(inputEngine, keyMapper);
const inputHistory = new InputHistory(controllerState, { maxLength: storage.getHistoryLength() });

// --- Combo system --------------------------------------------------------
const comboBuilder = new ComboBuilder(inputHistory);
const comboLibrary = new ComboLibrary();

// --- Support systems -------------------------------------------------------
const statistics = new Statistics();
const audio = new AudioFeedback();

// --- Trainer instances (Practice / Movement / Challenge share one engine) --
const initialTimingMs = TIMING_WINDOWS[storage.getTimingDifficulty()] || TIMING_WINDOWS.normal;
const practiceMatcher = new ComboMatcher({ timingWindowMs: initialTimingMs, missTimeoutMs: 3000 });
const movementMatcher = new ComboMatcher({ timingWindowMs: TIMING_WINDOWS.relaxed, missTimeoutMs: 4000 });
const challengeMatcher = new ComboMatcher({ timingWindowMs: initialTimingMs, missTimeoutMs: 3000 });

// Every finalized, notated input is broadcast to all three matchers plus a
// short audio blip. Each matcher independently decides whether that input
// matters to it — this is what lets Practice/Movement/Challenge run
// simultaneously without the input pipeline knowing anything about "modes".
inputHistory.addEventListener('entry', (e) => {
  const { notation, timestamp } = e.detail.entry;
  audio.play('input');
  practiceMatcher.processInput(notation, timestamp);
  movementMatcher.processInput(notation, timestamp);
  challengeMatcher.processInput(notation, timestamp);
});

inputEngine.start();

const DEFAULT_TARGET = ['↓', '↘', '→', '1'];

initUI({
  keyMapper,
  inputEngine,
  controllerState,
  inputHistory,
  comboBuilder,
  comboLibrary,
  statistics,
  audio,
  practiceMatcher,
  movementMatcher,
  challengeMatcher,
  movementExercises: MOVEMENT_EXERCISES,
  getExerciseById,
  generateRandomSequence,
  storage,
  combinedNotation,
  formatSeconds,
  formatMs,
  TIMING_WINDOWS,
  RESULT,
  DEFAULT_TARGET
});
