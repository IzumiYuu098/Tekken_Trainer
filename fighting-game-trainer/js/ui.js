// ui.js
// The only module allowed to touch the DOM. Everything here is wiring:
// it listens to engine/system events and updates elements, and it listens to
// DOM events and calls into the engine/system modules. No game logic lives here.

import { ACTIONS, ACTION_LABELS } from './key-mapper.js';
import { RESULT } from './trainer.js';
import { TIMING_WINDOWS } from './timing.js';

const RESULT_REVERT_MS = 1100;

function q(id) {
  return document.getElementById(id);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function resultClass(result) {
  switch (result) {
    case RESULT.PERFECT:
    case RESULT.SUCCESS:
    case RESULT.COMPLETE:
      return 'result-good';
    case RESULT.EARLY:
    case RESULT.LATE:
      return 'result-warn';
    case RESULT.WRONG_INPUT:
    case RESULT.MISS:
      return 'result-bad';
    default:
      return 'result-neutral';
  }
}

function badgeText(result, progressIndex, total) {
  if (result === RESULT.PROGRESS) return `${progressIndex}/${total}`;
  return result;
}

/** Renders a row of notation tokens as chips. `matchedCount` highlights that many from the left as correct. */
function renderTokenRow(container, tokens, matchedCount = -1, emptyText = '') {
  container.innerHTML = '';
  if (!tokens.length) {
    if (emptyText) container.appendChild(el('span', 'placeholder', emptyText));
    return;
  }
  tokens.forEach((token, i) => {
    const chip = el('span', 'token-chip', token);
    if (matchedCount >= 0) {
      chip.classList.add(i < matchedCount ? 'token-matched' : 'token-pending');
    }
    if (/\d/.test(token)) chip.classList.add('token-atk');
    container.appendChild(chip);
  });
}

export function initUI(deps) {
  const {
    keyMapper, controllerState, inputHistory,
    comboBuilder, comboLibrary, statistics, audio,
    practiceMatcher, movementMatcher, challengeMatcher,
    movementExercises, generateRandomSequence,
    storage, formatSeconds, DEFAULT_TARGET
  } = deps;

  // ---------------------------------------------------------------- Tabs ----
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanels = {
    practice: q('tab-practice'),
    movement: q('tab-movement'),
    challenge: q('tab-challenge'),
    settings: q('tab-settings')
  };
  function activateTab(name) {
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    Object.entries(tabPanels).forEach(([key, panel]) => panel.classList.toggle('active', key === name));
  }
  tabButtons.forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  // -------------------------------------------------------------- Theme -----
  const themeSelect = q('theme-select');
  const virtualController = q('virtual-controller');
  function applyTheme(theme) {
    virtualController.dataset.theme = theme;
    virtualController.className = 'virtual-controller theme-' + theme;
  }
  const storedTheme = storage.getTheme();
  themeSelect.value = storedTheme;
  applyTheme(storedTheme);
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    storage.setTheme(themeSelect.value);
  });

  // ---------------------------------------------------------- Sound/mute ----
  const muteBtn = q('mute-btn');
  const soundToggle = q('sound-toggle-checkbox');
  function syncSoundUI() {
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(audio.muted));
    soundToggle.checked = !audio.muted;
  }
  syncSoundUI();
  muteBtn.addEventListener('click', () => { audio.toggleMute(); syncSoundUI(); });
  soundToggle.addEventListener('change', () => { audio.setMuted(!soundToggle.checked); syncSoundUI(); });

  // ------------------------------------------------------- Reduced motion ---
  const reducedMotionCheckbox = q('reduced-motion-checkbox');
  const storedReducedMotion = storage.getReducedMotionOverride();
  reducedMotionCheckbox.checked = !!storedReducedMotion;
  document.body.classList.toggle('force-reduced-motion', !!storedReducedMotion);
  reducedMotionCheckbox.addEventListener('change', () => {
    storage.setReducedMotionOverride(reducedMotionCheckbox.checked);
    document.body.classList.toggle('force-reduced-motion', reducedMotionCheckbox.checked);
  });

  // ------------------------------------------------------- Virtual controller
  const vcButtons = Array.from(virtualController.querySelectorAll('.vc-btn'));
  vcButtons.forEach((btn) => {
    const action = btn.dataset.action;
    const activate = (ev) => { ev.preventDefault(); controllerState.press(action); };
    const deactivate = (ev) => { ev.preventDefault(); controllerState.release(action); };
    btn.addEventListener('pointerdown', activate);
    btn.addEventListener('pointerup', deactivate);
    btn.addEventListener('pointerleave', deactivate);
    btn.addEventListener('pointercancel', deactivate);
    // Keyboard accessibility: Enter/Space activates like a click-and-hold.
    btn.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { ev.preventDefault(); controllerState.press(action); }
    });
    btn.addEventListener('keyup', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); controllerState.release(action); }
    });
  });
  controllerState.addEventListener('change', (e) => {
    const state = e.detail.state;
    vcButtons.forEach((btn) => {
      btn.classList.toggle('active', !!state[btn.dataset.action]);
    });
  });

  // --------------------------------------------------- Current input / history
  const currentInputDisplay = q('current-input-display');
  const historyDisplay = q('input-history-display');
  const historyLengthSelect = q('history-length-select');
  const clearHistoryBtn = q('clear-history-btn');

  historyLengthSelect.value = String(inputHistory.maxLength);
  inputHistory.addEventListener('current', (e) => {
    currentInputDisplay.textContent = e.detail.notation;
    currentInputDisplay.classList.toggle('token-atk', /\d/.test(e.detail.notation));
  });
  inputHistory.addEventListener('history', (e) => {
    historyDisplay.innerHTML = '';
    if (!e.detail.entries.length) {
      historyDisplay.appendChild(el('span', 'placeholder', 'No inputs recorded yet.'));
      return;
    }
    e.detail.entries.forEach((entry) => {
      const chip = el('span', 'token-chip history-chip', entry.notation);
      if (/\d/.test(entry.notation)) chip.classList.add('token-atk');
      historyDisplay.appendChild(chip);
    });
    historyDisplay.scrollLeft = historyDisplay.scrollWidth;
  });
  historyLengthSelect.addEventListener('change', () => {
    const n = parseInt(historyLengthSelect.value, 10);
    inputHistory.setMaxLength(n);
    storage.setHistoryLength(n);
  });
  clearHistoryBtn.addEventListener('click', () => inputHistory.clear());

  // ------------------------------------------------------------ Combo builder
  const builderSequenceDisplay = q('builder-sequence-display');
  const builderRecordBtn = q('builder-record-btn');
  const builderAddCurrentBtn = q('builder-add-current-btn');
  const builderDeleteLastBtn = q('builder-delete-last-btn');
  const builderClearBtn = q('builder-clear-btn');
  const builderRandomBtn = q('builder-random-btn');
  const builderPalette = q('builder-manual-palette');
  const builderNameInput = q('builder-combo-name-input');
  const builderDifficultySelect = q('builder-difficulty-select');
  const builderSaveBtn = q('builder-save-btn');
  const builderUseAsTargetBtn = q('builder-use-as-target-btn');

  function renderBuilder(sequence) {
    renderTokenRow(builderSequenceDisplay, sequence, -1, 'No inputs yet — record, click the controller, or add manually.');
  }
  renderBuilder(comboBuilder.getSequence());
  comboBuilder.addEventListener('change', (e) => renderBuilder(e.detail.sequence));
  comboBuilder.addEventListener('recording', (e) => {
    builderRecordBtn.textContent = e.detail.recording ? '■ Stop' : '● Record';
    builderRecordBtn.classList.toggle('recording', e.detail.recording);
  });

  builderRecordBtn.addEventListener('click', () => {
    if (comboBuilder.recording) comboBuilder.stopRecording();
    else comboBuilder.startRecording();
  });
  builderAddCurrentBtn.addEventListener('click', () => {
    const current = inputHistory.getCurrent();
    if (current.notation === 'N') return;
    comboBuilder.addToken(current.notation);
  });
  builderDeleteLastBtn.addEventListener('click', () => comboBuilder.deleteLast());
  builderClearBtn.addEventListener('click', () => comboBuilder.clear());
  builderRandomBtn.addEventListener('click', () => {
    const { tokens } = generateRandomSequence(builderDifficultySelect.value);
    comboBuilder.setSequence(tokens);
  });
  builderPalette.querySelectorAll('.palette-btn').forEach((btn) => {
    btn.addEventListener('click', () => comboBuilder.addToken(btn.dataset.token));
  });
  builderSaveBtn.addEventListener('click', () => {
    const sequence = comboBuilder.getSequence();
    if (!sequence.length) return;
    comboLibrary.save({
      name: builderNameInput.value,
      inputs: sequence,
      difficulty: builderDifficultySelect.value,
      referenceGaps: comboBuilder.getReferenceGaps()
    });
    builderNameInput.value = '';
  });
  builderUseAsTargetBtn.addEventListener('click', () => {
    const sequence = comboBuilder.getSequence();
    if (!sequence.length) return;
    activePracticeComboId = null;
    practiceMatcher.setTarget(sequence, comboBuilder.getReferenceGaps());
    activateTab('practice');
  });

  // ------------------------------------------------------------ Saved combos
  const savedCombosList = q('saved-combos-list');
  let activePracticeComboId = null;

  function renderSavedCombos(combos) {
    savedCombosList.innerHTML = '';
    if (!combos.length) {
      savedCombosList.appendChild(el('li', 'empty-note', 'No combos saved yet.'));
      return;
    }
    combos.slice().reverse().forEach((combo) => {
      const li = el('li', 'combo-item');
      const header = el('div', 'combo-item-header');
      header.appendChild(el('span', 'combo-name', combo.name));
      header.appendChild(el('span', 'combo-difficulty', combo.difficulty));
      li.appendChild(header);

      const seqRow = el('div', 'token-row combo-sequence-row');
      renderTokenRow(seqRow, combo.inputs);
      li.appendChild(seqRow);

      const rate = combo.attempts ? Math.round((combo.successes / combo.attempts) * 100) : 0;
      const best = combo.bestTime !== null ? formatSeconds(combo.bestTime) : '—';
      li.appendChild(el('div', 'combo-meta', `${combo.attempts} attempts · ${rate}% success · best ${best}`));

      const actions = el('div', 'combo-actions');
      const practiceBtn = el('button', 'ghost-btn small', 'Practice');
      practiceBtn.type = 'button';
      practiceBtn.addEventListener('click', () => {
        activePracticeComboId = combo.id;
        practiceMatcher.setTarget(combo.inputs, combo.referenceGaps);
        activateTab('practice');
      });

      const loadBtn = el('button', 'ghost-btn small', 'Load');
      loadBtn.type = 'button';
      loadBtn.addEventListener('click', () => {
        comboBuilder.setSequence(combo.inputs);
        builderNameInput.value = combo.name;
        builderDifficultySelect.value = combo.difficulty;
        activateTab('practice');
      });

      const renameBtn = el('button', 'ghost-btn small', 'Rename');
      renameBtn.type = 'button';
      renameBtn.addEventListener('click', () => {
        const newName = window.prompt('Rename combo', combo.name);
        if (newName !== null) comboLibrary.rename(combo.id, newName);
      });

      const deleteBtn = el('button', 'ghost-btn small danger', 'Delete');
      deleteBtn.type = 'button';
      deleteBtn.addEventListener('click', () => {
        if (window.confirm(`Delete "${combo.name}"?`)) {
          if (activePracticeComboId === combo.id) activePracticeComboId = null;
          comboLibrary.remove(combo.id);
        }
      });

      actions.append(practiceBtn, loadBtn, renameBtn, deleteBtn);
      li.appendChild(actions);
      savedCombosList.appendChild(li);
    });
  }
  renderSavedCombos(comboLibrary.list());
  comboLibrary.addEventListener('change', (e) => renderSavedCombos(e.detail.combos));

  // ---------------------------------------------------------------- Practice
  const practiceTargetDisplay = q('practice-target-display');
  const practiceProgressDisplay = q('practice-progress-display');
  const practiceTimerDisplay = q('practice-timer-display');
  const practiceResultDisplay = q('practice-result-display');
  const practiceResetBtn = q('practice-reset-btn');
  const practiceTimingNote = q('practice-timing-note');

  function wireMatcherDisplay(matcher, { targetEl, progressEl, resultEl, timerEl, onAttempt }) {
    let revertTimer = null;
    function clearRevert() {
      if (revertTimer) { clearTimeout(revertTimer); revertTimer = null; }
    }
    function paintTarget() {
      renderTokenRow(targetEl, matcher.target, -1, 'No target set.');
    }
    matcher.addEventListener('reset', () => {
      clearRevert();
      paintTarget();
      renderTokenRow(progressEl, [], -1, '');
      resultEl.textContent = 'READY';
      resultEl.className = 'meta-value result-badge result-neutral';
      if (timerEl) timerEl.textContent = formatSeconds(0);
    });
    matcher.addEventListener('result', (e) => {
      clearRevert();
      const { result, progressIndex, target } = e.detail;
      renderTokenRow(progressEl, matcher.getMatchedTokens(), matcher.getMatchedTokens().length, '');
      resultEl.textContent = badgeText(result, progressIndex, target.length);
      resultEl.className = 'meta-value result-badge ' + resultClass(result);
    });
    matcher.addEventListener('attempt', (e) => {
      if (onAttempt) onAttempt(e.detail);
      revertTimer = setTimeout(() => {
        renderTokenRow(progressEl, [], -1, '');
        resultEl.textContent = 'READY';
        resultEl.className = 'meta-value result-badge result-neutral';
      }, RESULT_REVERT_MS);
    });
    paintTarget();
  }

  wireMatcherDisplay(practiceMatcher, {
    targetEl: practiceTargetDisplay,
    progressEl: practiceProgressDisplay,
    resultEl: practiceResultDisplay,
    timerEl: practiceTimerDisplay,
    onAttempt: (detail) => {
      audio.play(detail.success ? 'success' : 'failure');
      statistics.recordAttempt(detail);
      if (activePracticeComboId) {
        comboLibrary.recordAttempt(activePracticeComboId, detail);
      }
    }
  });
  practiceMatcher.setTarget(DEFAULT_TARGET);
  practiceResetBtn.addEventListener('click', () => practiceMatcher.reset());

  const timingSelect = q('timing-difficulty-select');
  const storedTimingLevel = storage.getTimingDifficulty();
  timingSelect.value = storedTimingLevel;
  function applyTimingLevel(level) {
    const ms = TIMING_WINDOWS[level] || TIMING_WINDOWS.normal;
    practiceMatcher.setTimingWindow(ms);
    challengeMatcher.setTimingWindow(ms);
    practiceTimingNote.textContent = `Timing: ${level[0].toUpperCase()}${level.slice(1)} (±${ms}ms)`;
  }
  applyTimingLevel(storedTimingLevel);
  timingSelect.addEventListener('change', () => {
    storage.setTimingDifficulty(timingSelect.value);
    applyTimingLevel(timingSelect.value);
  });

  // ---------------------------------------------------------------- Movement
  const movementList = q('movement-exercise-list');
  const movementActiveName = q('movement-active-name');
  const movementTargetDisplay = q('movement-target-display');
  const movementProgressDisplay = q('movement-progress-display');
  const movementResultDisplay = q('movement-result-display');
  const movementResetBtn = q('movement-reset-btn');

  movementExercises.forEach((ex) => {
    const btn = el('button', 'exercise-btn', ex.name);
    btn.type = 'button';
    btn.title = ex.description;
    btn.dataset.exerciseId = ex.id;
    btn.addEventListener('click', () => {
      Array.from(movementList.children).forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      movementActiveName.textContent = `${ex.name} — ${ex.description}`;
      movementMatcher.setTarget(ex.sequence);
    });
    movementList.appendChild(btn);
  });

  wireMatcherDisplay(movementMatcher, {
    targetEl: movementTargetDisplay,
    progressEl: movementProgressDisplay,
    resultEl: movementResultDisplay,
    timerEl: null,
    onAttempt: (detail) => {
      audio.play(detail.success ? 'success' : 'failure');
      statistics.recordAttempt(detail);
    }
  });
  movementResetBtn.addEventListener('click', () => movementMatcher.reset());

  // ---------------------------------------------------------------- Challenge
  const challengeDifficultySelect = q('challenge-difficulty-select');
  const challengeNewBtn = q('challenge-new-btn');
  const challengeTargetDisplay = q('challenge-target-display');
  const challengeProgressDisplay = q('challenge-progress-display');
  const challengeTimerDisplay = q('challenge-timer-display');
  const challengeResultDisplay = q('challenge-result-display');

  wireMatcherDisplay(challengeMatcher, {
    targetEl: challengeTargetDisplay,
    progressEl: challengeProgressDisplay,
    resultEl: challengeResultDisplay,
    timerEl: challengeTimerDisplay,
    onAttempt: (detail) => {
      audio.play(detail.success ? 'success' : 'failure');
      statistics.recordAttempt(detail);
    }
  });
  challengeNewBtn.addEventListener('click', () => {
    const { tokens } = generateRandomSequence(challengeDifficultySelect.value);
    challengeMatcher.setTarget(tokens);
  });

  // ------------------------------------------------------ Live timer ticking
  setInterval(() => {
    if (practiceMatcher.isActive) practiceTimerDisplay.textContent = formatSeconds(practiceMatcher.elapsedMs);
    if (challengeMatcher.isActive) challengeTimerDisplay.textContent = formatSeconds(challengeMatcher.elapsedMs);
  }, 50);

  // ----------------------------------------------------------------- Settings
  const keybindList = q('keybind-list');
  const conflictWarning = q('keybind-conflict-warning');
  let listeningAction = null;

  function renderKeybindButtons() {
    keybindList.querySelectorAll('.remap-btn').forEach((btn) => {
      const action = btn.dataset.action;
      btn.textContent = keyMapper.getBindingDisplay(action);
      btn.classList.remove('listening');
    });
  }
  renderKeybindButtons();

  function beginListening(action, btn) {
    if (listeningAction) return;
    listeningAction = action;
    btn.classList.add('listening');
    const original = btn.textContent;
    btn.textContent = 'Press a key…';

    function onKey(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      window.removeEventListener('keydown', onKey, true);
      listeningAction = null;

      if (ev.code === 'Escape') {
        renderKeybindButtons();
        return;
      }

      const result = keyMapper.setBinding(action, ev.code);
      renderKeybindButtons();
      if (result.conflict) {
        conflictWarning.textContent =
          `${ACTION_LABELS[action]} and ${ACTION_LABELS[result.conflict]} are now both bound to the same key. Rebind one of them.`;
        conflictWarning.classList.remove('hidden');
      } else {
        conflictWarning.classList.add('hidden');
      }
    }
    window.addEventListener('keydown', onKey, true);
    // Safety: if the button loses focus without a key press (e.g. clicked elsewhere), it will
    // simply keep listening until a key is pressed; this is fine since only one key is needed.
    void original;
  }

  keybindList.querySelectorAll('.remap-btn').forEach((btn) => {
    btn.addEventListener('click', () => beginListening(btn.dataset.action, btn));
  });

  const saveSettingsBtn = q('save-settings-btn');
  const resetDefaultsBtn = q('reset-defaults-btn');
  const settingsSavedNote = q('settings-saved-note');

  saveSettingsBtn.addEventListener('click', () => {
    keyMapper.save();
    settingsSavedNote.textContent = 'Settings saved.';
    setTimeout(() => { settingsSavedNote.textContent = ''; }, 2000);
  });
  resetDefaultsBtn.addEventListener('click', () => {
    keyMapper.resetToDefault();
    keyMapper.save();
    renderKeybindButtons();
    conflictWarning.classList.add('hidden');
    settingsSavedNote.textContent = 'Defaults restored.';
    setTimeout(() => { settingsSavedNote.textContent = ''; }, 2000);
  });

  // -------------------------------------------------------------- Statistics
  function renderStats(summary) {
    q('stat-total-attempts').textContent = summary.totalAttempts;
    q('stat-successful-attempts').textContent = summary.successfulAttempts;
    q('stat-failed-attempts').textContent = summary.failedAttempts;
    q('stat-success-rate').textContent = `${Math.round(summary.successRate)}%`;
    q('stat-best-time').textContent = summary.bestTime !== null ? formatSeconds(summary.bestTime) : '—';
    q('stat-average-time').textContent = summary.averageTime !== null ? formatSeconds(summary.averageTime) : '—';
    q('stat-fastest-input').textContent = summary.fastestInput !== null ? `${Math.round(summary.fastestInput)}ms` : '—';
    q('stat-average-gap').textContent = summary.averageGap !== null ? `${Math.round(summary.averageGap)}ms` : '—';
    q('stat-current-streak').textContent = summary.currentStreak;
    q('stat-best-streak').textContent = summary.bestStreak;
  }
  renderStats(statistics.getSummary());
  statistics.addEventListener('change', (e) => renderStats(e.detail));
  q('reset-stats-btn').addEventListener('click', () => {
    if (window.confirm('Reset all statistics?')) statistics.reset();
  });
}
