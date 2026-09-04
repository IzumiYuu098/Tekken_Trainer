// ui.js
// The only module that touches the DOM. Everything here is wiring: listen to
// engine/system events and update elements, listen to DOM events and call
// into the engine/system modules. No game logic lives here.

import { ACTION_LABELS } from './key-mapper.js';
import { RESULT } from './trainer.js';
import { parseNotationToken } from './notation.js';

const RESULT_REVERT_MS = 1100;

function q(id) { return document.getElementById(id); }

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
    case RESULT.TIMING_ERROR:
      return 'result-warn';
    case RESULT.LABEL_STEP:
    case RESULT.PROGRESS:
      return 'result-info';
    case RESULT.WRONG_INPUT:
    case RESULT.WRONG_BUTTON:
    case RESULT.MISSING_BUTTON:
    case RESULT.EXTRA_INPUT:
    case RESULT.MISS:
      return 'result-bad';
    default:
      return 'result-neutral';
  }
}

/** Renders plain notation-token strings as chips (used for history + matched-progress rows). */
function renderTokenRow(container, tokens, matchedCount = -1, emptyText = '') {
  container.innerHTML = '';
  if (!tokens.length) {
    if (emptyText) container.appendChild(el('span', 'placeholder', emptyText));
    return;
  }
  tokens.forEach((token, i) => {
    const chip = el('span', 'token-chip', token);
    if (matchedCount >= 0) chip.classList.add(i < matchedCount ? 'token-matched' : 'token-pending');
    if (/\d/.test(token) && parseNotationToken(token).kind === 'input') chip.classList.add('token-atk');
    container.appendChild(chip);
  });
}

/** Renders structured STEP objects (distinguishing real inputs from unverifiable labels). */
function renderTargetRow(container, steps) {
  container.innerHTML = '';
  if (!steps.length) {
    container.appendChild(el('span', 'placeholder', 'No target set.'));
    return;
  }
  steps.forEach((step) => {
    const chip = el('span', 'token-chip', step.notation);
    if (step.type === 'label') chip.classList.add('token-label');
    else if (/\d/.test(step.notation)) chip.classList.add('token-atk');
    container.appendChild(chip);
  });
}

export function initUI(deps) {
  const {
    keyMapper, gamepadMapper, controllerState, inputEventEngine, inputHistory,
    comboBuilder, characterLibrary, statistics, progression, audio,
    practiceMatcher, movementMatcher, gamepadEngine,
    movementExercises, generateRandomSequence, generateDailySession,
    skillLevels, storage, formatSeconds,
    parseComboText, applyInputSource, DEFAULT_TARGET
  } = deps;

  // ---------------------------------------------------------------- Tabs ----
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanels = {
    train: q('tab-train'), characters: q('tab-characters'), combos: q('tab-combos'),
    movement: q('tab-movement'), progress: q('tab-progress'), settings: q('tab-settings')
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
    virtualController.className = 'virtual-controller theme-' + theme;
  }
  const storedTheme = storage.getTheme();
  themeSelect.value = storedTheme;
  applyTheme(storedTheme);
  themeSelect.addEventListener('change', () => { applyTheme(themeSelect.value); storage.setTheme(themeSelect.value); });

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
    btn.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { ev.preventDefault(); controllerState.press(action); } });
    btn.addEventListener('keyup', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); controllerState.release(action); } });
  });
  controllerState.addEventListener('change', (e) => {
    const state = e.detail.state;
    vcButtons.forEach((btn) => btn.classList.toggle('active', !!state[btn.dataset.action]));
  });

  // --------------------------------------------------------- Gamepad status -
  const gamepadStatusBadge = q('gamepad-status-badge');
  const gamepadDetail = q('gamepad-detail');
  gamepadEngine.addEventListener('connect', (e) => {
    gamepadStatusBadge.textContent = 'Gamepad: Connected';
    gamepadStatusBadge.classList.remove('status-off');
    gamepadStatusBadge.classList.add('status-on');
    gamepadDetail.textContent = `Connected: ${e.detail.id} (mapping: ${e.detail.mapping || 'unknown'})`;
  });
  gamepadEngine.addEventListener('disconnect', () => {
    gamepadStatusBadge.textContent = 'Gamepad: Not Connected';
    gamepadStatusBadge.classList.remove('status-on');
    gamepadStatusBadge.classList.add('status-off');
    gamepadDetail.textContent = 'Not connected. Plug in a controller and press any button.';
  });

  // --------------------------------------------------- Current input / debug
  const currentInputDisplay = q('current-input-display');
  const debugModeCheckbox = q('debug-mode-checkbox');
  const debugPanel = q('debug-panel');
  const debugRaw = q('debug-raw'); const debugState = q('debug-state'); const debugNormalized = q('debug-normalized');
  const debugTimestamp = q('debug-timestamp'); const debugDuration = q('debug-duration'); const debugSource = q('debug-source');

  debugModeCheckbox.checked = storage.getDebugMode();
  debugPanel.classList.toggle('hidden', !debugModeCheckbox.checked);
  debugModeCheckbox.addEventListener('change', () => {
    storage.setDebugMode(debugModeCheckbox.checked);
    debugPanel.classList.toggle('hidden', !debugModeCheckbox.checked);
  });

  inputEventEngine.addEventListener('current', (e) => {
    currentInputDisplay.textContent = e.detail.notation;
    currentInputDisplay.classList.toggle('token-atk', /\d/.test(e.detail.notation));
    if (debugModeCheckbox.checked) debugNormalized.textContent = e.detail.notation;
  });
  controllerState.addEventListener('change', (e) => {
    if (!debugModeCheckbox.checked) return;
    const d = e.detail;
    debugRaw.textContent = d.action ? `${d.action} ${d.pressed ? 'DOWN' : 'UP'}` : '(forced clear)';
    debugState.textContent = JSON.stringify(d.state);
    debugTimestamp.textContent = Math.round(d.timestamp) + 'ms';
    debugDuration.textContent = typeof d.duration === 'number' ? Math.round(d.duration) + 'ms' : '—';
    debugSource.textContent = d.source || '—';
  });

  // --------------------------------------------------------------- History --
  const historyDisplay = q('input-history-display');
  const historyLengthSelect = q('history-length-select');
  const autoScrollCheckbox = q('history-autoscroll-checkbox');
  const pauseBtn = q('history-pause-btn');
  const clearHistoryBtn = q('clear-history-btn');

  historyLengthSelect.value = String(inputHistory.maxLength);
  autoScrollCheckbox.checked = storage.getAutoScroll();
  pauseBtn.textContent = inputHistory.paused ? 'Resume' : 'Pause';

  function renderHistory(entries) {
    historyDisplay.innerHTML = '';
    entries.forEach((entry, i) => {
      const li = el('li', 'history-entry');
      if (i === entries.length - 1) li.classList.add('latest');
      li.appendChild(el('span', 'history-index', String(i + 1).padStart(2, '0')));
      const notation = el('span', 'history-notation', entry.notation);
      if (/\d/.test(entry.notation)) notation.classList.add('token-atk');
      li.appendChild(notation);
      historyDisplay.appendChild(li);
    });
    if (autoScrollCheckbox.checked) historyDisplay.scrollTop = historyDisplay.scrollHeight;
  }
  inputHistory.addEventListener('history', (e) => renderHistory(e.detail.entries));
  historyLengthSelect.addEventListener('change', () => {
    const n = parseInt(historyLengthSelect.value, 10);
    inputHistory.setMaxLength(n);
    storage.setHistoryLength(n);
  });
  autoScrollCheckbox.addEventListener('change', () => storage.setAutoScroll(autoScrollCheckbox.checked));
  pauseBtn.addEventListener('click', () => {
    inputHistory.setPaused(!inputHistory.paused);
    pauseBtn.textContent = inputHistory.paused ? 'Resume' : 'Pause';
    storage.setHistoryPaused(inputHistory.paused);
  });
  clearHistoryBtn.addEventListener('click', () => inputHistory.clear());

  // ------------------------------------------------------------ Mini stats --
  function renderMiniStats(summary) {
    q('mini-stat-attempts').textContent = summary.totalAttempts;
    q('mini-stat-rate').textContent = Math.round(summary.successRate) + '%';
    q('mini-stat-streak').textContent = summary.currentStreak;
  }
  renderMiniStats(statistics.getSummary());
  statistics.addEventListener('change', (e) => renderMiniStats(e.detail));

  // --------------------------------------------------- Generic matcher wiring
  function wireMatcherDisplay(matcher, { targetEl, progressEl, resultEl, timerEl, feedbackEl, confirmBtn, onAttempt }) {
    let revertTimer = null;
    function clearRevert() { if (revertTimer) { clearTimeout(revertTimer); revertTimer = null; } }
    function paintTarget() { renderTargetRow(targetEl, matcher.steps); }
    function updateConfirmVisibility() {
      if (!confirmBtn) return;
      const step = matcher.currentStep;
      confirmBtn.classList.toggle('hidden', !(step && step.type === 'label'));
    }

    matcher.addEventListener('reset', () => {
      clearRevert();
      paintTarget();
      renderTokenRow(progressEl, [], -1, '');
      resultEl.textContent = 'READY';
      resultEl.className = 'meta-value result-badge result-neutral';
      if (timerEl) timerEl.textContent = formatSeconds(0);
      if (feedbackEl) feedbackEl.textContent = '';
      updateConfirmVisibility();
    });

    matcher.addEventListener('result', (e) => {
      clearRevert();
      const { result, target } = e.detail;
      renderTokenRow(progressEl, matcher.getMatchedTokens(), matcher.getMatchedTokens().length, '');
      resultEl.textContent = result === RESULT.PROGRESS ? `${matcher.progressIndex}/${target.length}` : result;
      resultEl.className = 'meta-value result-badge ' + resultClass(result);
      if (feedbackEl) feedbackEl.textContent = e.detail.feedback || '';
      if (result === RESULT.LABEL_STEP) audio.play('confirm');
      updateConfirmVisibility();
    });

    matcher.addEventListener('attempt', (e) => {
      if (onAttempt) onAttempt(e.detail);
      revertTimer = setTimeout(() => {
        renderTokenRow(progressEl, [], -1, '');
        resultEl.textContent = 'READY';
        resultEl.className = 'meta-value result-badge result-neutral';
        if (feedbackEl) feedbackEl.textContent = '';
        updateConfirmVisibility();
      }, RESULT_REVERT_MS);
    });

    if (confirmBtn) confirmBtn.addEventListener('click', () => matcher.confirmLabelStep());
    paintTarget();
    updateConfirmVisibility();
  }

  // ------------------------------------------------------------------ Train -
  const trainActiveLabel = q('train-active-label');
  const trainTargetDisplay = q('train-target-display');
  const trainProgressDisplay = q('train-progress-display');
  const trainTimerDisplay = q('train-timer-display');
  const trainResultDisplay = q('train-result-display');
  const trainConfirmBtn = q('train-confirm-label-btn');
  const trainResetBtn = q('train-reset-btn');
  const trainFeedback = q('train-feedback-text');
  const trainPrecisionNote = q('train-precision-note');

  let activePracticeContext = { type: 'demo' };

  function handlePracticeAttempt(detail) {
    statistics.recordAttempt(detail);
    audio.play(detail.success ? (detail.isPerfect ? 'perfect' : 'success') : 'failure');
    if (!activePracticeContext) return;
    if (activePracticeContext.type === 'combo') characterLibrary.recordAttempt(activePracticeContext.id, detail);
    else if (activePracticeContext.type === 'skill') progression.recordDrillAttempt(activePracticeContext.id, detail);
    else if (activePracticeContext.type === 'challenge') progression.recordChallengeCompletion(activePracticeContext.difficulty, detail.success);
  }

  wireMatcherDisplay(practiceMatcher, {
    targetEl: trainTargetDisplay, progressEl: trainProgressDisplay, resultEl: trainResultDisplay,
    timerEl: trainTimerDisplay, feedbackEl: trainFeedback, confirmBtn: trainConfirmBtn,
    onAttempt: handlePracticeAttempt
  });
  activePracticeContext = { type: 'demo' };
  practiceMatcher.setTarget(DEFAULT_TARGET);
  trainResetBtn.addEventListener('click', () => practiceMatcher.reset());

  setInterval(() => {
    if (practiceMatcher.isActive) trainTimerDisplay.textContent = formatSeconds(practiceMatcher.elapsedMs);
  }, 50);

  function loadIntoTrain({ steps, referenceGaps = null, label, context }) {
    activePracticeContext = context;
    practiceMatcher.setTarget(steps, referenceGaps);
    trainActiveLabel.textContent = label;
    activateTab('train');
  }

  function applyPrecisionNote(mode) {
    const windowsMs = { relaxed: 120, normal: 60, strict: 30, perfect: 15 };
    trainPrecisionNote.textContent = `Precision: ${mode[0].toUpperCase()}${mode.slice(1)} (±${windowsMs[mode]}ms)`;
  }
  applyPrecisionNote(storage.getPrecisionMode());

  // --------------------------------------------------------------- Movement -
  const movementList = q('movement-exercise-list');
  const movementActiveName = q('movement-active-name');
  const movementTargetDisplay = q('movement-target-display');
  const movementProgressDisplay = q('movement-progress-display');
  const movementResultDisplay = q('movement-result-display');
  const movementResetBtn = q('movement-reset-btn');
  let activeMovementExercise = null;

  movementExercises.forEach((ex) => {
    const btn = el('button', 'exercise-btn', ex.name);
    btn.type = 'button';
    btn.title = ex.description;
    btn.addEventListener('click', () => {
      Array.from(movementList.children).forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      activeMovementExercise = ex;
      movementActiveName.textContent = `${ex.name} — ${ex.description}`;
      movementMatcher.setTarget(ex.sequence);
    });
    movementList.appendChild(btn);
  });

  wireMatcherDisplay(movementMatcher, {
    targetEl: movementTargetDisplay, progressEl: movementProgressDisplay, resultEl: movementResultDisplay, timerEl: null,
    onAttempt: (detail) => {
      statistics.recordAttempt(detail);
      audio.play(detail.success ? 'success' : 'failure');
      if (activeMovementExercise && activeMovementExercise.skillId) {
        progression.recordDrillAttempt(activeMovementExercise.skillId, detail);
      }
    }
  });
  movementResetBtn.addEventListener('click', () => movementMatcher.reset());

  // -------------------------------------------------------- Combo builder ---
  const builderSequenceDisplay = q('builder-sequence-display');
  const builderRecordBtn = q('builder-record-btn');
  const builderAddCurrentBtn = q('builder-add-current-btn');
  const builderDeleteLastBtn = q('builder-delete-last-btn');
  const builderClearBtn = q('builder-clear-btn');
  const builderUseInFormBtn = q('builder-use-in-form-btn');
  const builderPalette = q('builder-manual-palette');

  let lastCurrentNotation = 'N';
  inputEventEngine.addEventListener('current', (e) => { lastCurrentNotation = e.detail.notation; });

  function renderBuilder(steps) { renderTargetRow(builderSequenceDisplay, steps); }
  renderBuilder(comboBuilder.getSteps());
  comboBuilder.addEventListener('change', (e) => renderBuilder(e.detail.steps));
  comboBuilder.addEventListener('recording', (e) => {
    builderRecordBtn.textContent = e.detail.recording ? '■ Stop' : '● Record';
    builderRecordBtn.classList.toggle('recording', e.detail.recording);
  });
  builderRecordBtn.addEventListener('click', () => { comboBuilder.recording ? comboBuilder.stopRecording() : comboBuilder.startRecording(); });
  builderAddCurrentBtn.addEventListener('click', () => {
    if (lastCurrentNotation === 'N') return;
    const parsed = parseNotationToken(lastCurrentNotation);
    if (parsed.kind !== 'input') return;
    comboBuilder.addStep({ type: 'input', notation: parsed.raw, direction: parsed.direction, buttons: parsed.buttons });
  });
  builderDeleteLastBtn.addEventListener('click', () => comboBuilder.deleteLast());
  builderClearBtn.addEventListener('click', () => comboBuilder.clear());
  builderPalette.querySelectorAll('.palette-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parsed = parseNotationToken(btn.dataset.token);
      comboBuilder.addStep({ type: 'input', notation: parsed.raw, direction: parsed.direction, buttons: parsed.buttons });
    });
  });
  builderUseInFormBtn.addEventListener('click', () => {
    comboFormNotation.value = comboBuilder.getNotationText();
    renderComboFormPreview();
  });

  // ------------------------------------------------------------ Characters --
  const addCharacterNameInput = q('add-character-name-input');
  const addCharacterBtn = q('add-character-btn');
  const characterListEl = q('character-list');
  const characterDetailName = q('character-detail-name');
  const characterDetailSummary = q('character-detail-summary');
  const characterDetailCombos = q('character-detail-combos');
  const comboFormCharacterSelect = q('combo-form-character');
  const comboCharacterFilter = q('combo-character-filter');

  let selectedCharacterId = 'lili';
  let editingComboId = null;

  function renderComboCard(combo) {
    const character = characterLibrary.getCharacter(combo.character);
    const card = el('div', 'combo-card');
    const header = el('div', 'combo-card-header');
    header.appendChild(el('span', 'combo-name', combo.name));
    header.appendChild(el('span', 'combo-difficulty', combo.difficulty));
    card.appendChild(header);
    if (character) card.appendChild(el('div', 'hint-text', character.name));
    const seqRow = el('div', 'token-row combo-sequence-row');
    renderTargetRow(seqRow, combo.steps);
    card.appendChild(seqRow);
    const mastery = characterLibrary.getMastery(combo.id);
    const rate = combo.attempts ? Math.round((combo.successes / combo.attempts) * 100) : 0;
    const best = combo.bestTime !== null ? formatSeconds(combo.bestTime) : '—';
    card.appendChild(el('div', 'combo-meta', `Mastery ${mastery}% · ${combo.attempts} attempts · ${rate}% success · best ${best}`));
    if (combo.notes) card.appendChild(el('div', 'hint-text', combo.notes));
    const actions = el('div', 'combo-actions');
    const trainBtn = el('button', 'ghost-btn small', 'Train'); trainBtn.type = 'button';
    trainBtn.addEventListener('click', () => loadIntoTrain({
      steps: combo.steps, referenceGaps: combo.referenceGaps,
      label: `${character ? character.name + ' — ' : ''}${combo.name}`, context: { type: 'combo', id: combo.id }
    }));
    const editBtn = el('button', 'ghost-btn small', 'Edit'); editBtn.type = 'button';
    editBtn.addEventListener('click', () => beginEditCombo(combo));
    const deleteBtn = el('button', 'ghost-btn small danger', 'Delete'); deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', () => { if (window.confirm(`Delete "${combo.name}"?`)) characterLibrary.removeCombo(combo.id); });
    actions.append(trainBtn, editBtn, deleteBtn);
    card.appendChild(actions);
    return card;
  }

  function beginEditCombo(combo) {
    editingComboId = combo.id;
    comboFormCharacterSelect.value = combo.character;
    comboFormName.value = combo.name;
    comboFormNotation.value = combo.notation;
    comboFormDifficulty.value = combo.difficulty;
    comboFormNotes.value = combo.notes || '';
    comboFormSource.value = combo.source || '';
    comboFormSaveBtn.textContent = 'Update Combo';
    renderComboFormPreview();
    activateTab('combos');
  }

  function renderCharacterOptions() {
    const characters = characterLibrary.listCharacters();
    [[comboFormCharacterSelect, false], [comboCharacterFilter, true]].forEach(([select, includeAll]) => {
      const currentVal = select.value;
      select.innerHTML = '';
      if (includeAll) select.appendChild(new Option('All', ''));
      characters.forEach((c) => select.appendChild(new Option(c.name, c.id)));
      if (currentVal && Array.from(select.options).some((o) => o.value === currentVal)) select.value = currentVal;
    });
  }

  function renderCharacterList() {
    characterListEl.innerHTML = '';
    characterLibrary.listCharacters().forEach((c) => {
      const li = el('li', 'character-item' + (c.id === selectedCharacterId ? ' active' : ''));
      const nameBtn = el('button', 'character-select-btn', c.name); nameBtn.type = 'button';
      nameBtn.addEventListener('click', () => { selectedCharacterId = c.id; renderCharacterList(); renderCharacterDetail(); });
      li.appendChild(nameBtn);
      const renameBtn = el('button', 'ghost-btn small', 'Rename'); renameBtn.type = 'button';
      renameBtn.addEventListener('click', () => {
        const name = window.prompt('Rename character', c.name);
        if (name !== null) characterLibrary.renameCharacter(c.id, name);
      });
      const deleteBtn = el('button', 'ghost-btn small danger', 'Delete'); deleteBtn.type = 'button';
      deleteBtn.addEventListener('click', () => {
        if (window.confirm(`Delete "${c.name}" and all their combos?`)) {
          characterLibrary.removeCharacter(c.id);
          if (selectedCharacterId === c.id) selectedCharacterId = null;
        }
      });
      li.append(renameBtn, deleteBtn);
      characterListEl.appendChild(li);
    });
  }

  function renderCharacterDetail() {
    const character = selectedCharacterId ? characterLibrary.getCharacter(selectedCharacterId) : null;
    if (!character) {
      characterDetailName.textContent = 'Select a character';
      characterDetailSummary.textContent = '';
      characterDetailCombos.innerHTML = '';
      return;
    }
    const combos = characterLibrary.listCombos(character.id);
    characterDetailName.textContent = character.name;
    const byDifficulty = {};
    combos.forEach((c) => { byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] || 0) + 1; });
    characterDetailSummary.textContent = combos.length
      ? `${combos.length} combo(s) — ${Object.entries(byDifficulty).map(([d, n]) => `${n} ${d}`).join(', ')}`
      : 'No combos yet — add one in the Combos tab.';
    characterDetailCombos.innerHTML = '';
    combos.forEach((c) => characterDetailCombos.appendChild(renderComboCard(c)));
  }

  function renderComboList() {
    const list = q('combo-list');
    const characterFilter = comboCharacterFilter.value;
    const difficultyFilter = q('combo-difficulty-filter').value;
    let combos = characterLibrary.listCombos();
    if (characterFilter) combos = combos.filter((c) => c.character === characterFilter);
    if (difficultyFilter) combos = combos.filter((c) => c.difficulty === difficultyFilter);
    list.innerHTML = '';
    if (!combos.length) { list.appendChild(el('p', 'empty-note', 'No combos match this filter yet.')); return; }
    combos.forEach((c) => list.appendChild(renderComboCard(c)));
  }

  function refreshCharacterUI() {
    renderCharacterOptions();
    renderCharacterList();
    renderCharacterDetail();
    renderComboList();
    renderSkillTree();
  }

  addCharacterBtn.addEventListener('click', () => {
    if (!addCharacterNameInput.value.trim()) return;
    const c = characterLibrary.addCharacter(addCharacterNameInput.value);
    addCharacterNameInput.value = '';
    selectedCharacterId = c.id;
  });
  comboCharacterFilter.addEventListener('change', renderComboList);
  q('combo-difficulty-filter').addEventListener('change', renderComboList);
  characterLibrary.addEventListener('change', refreshCharacterUI);

  // ------------------------------------------------------------ Combo form --
  const comboFormName = q('combo-form-name');
  const comboFormNotation = q('combo-form-notation');
  const comboFormPreview = q('combo-form-preview');
  const comboFormDifficulty = q('combo-form-difficulty');
  const comboFormNotes = q('combo-form-notes');
  const comboFormSource = q('combo-form-source');
  const comboFormSaveBtn = q('combo-form-save-btn');

  function renderComboFormPreview() {
    const steps = parseComboText(comboFormNotation.value);
    renderTargetRow(comboFormPreview, steps);
  }
  comboFormNotation.addEventListener('input', renderComboFormPreview);

  comboFormSaveBtn.addEventListener('click', () => {
    if (!comboFormNotation.value.trim()) return;
    const payload = {
      character: comboFormCharacterSelect.value,
      name: comboFormName.value,
      notationText: comboFormNotation.value,
      difficulty: comboFormDifficulty.value || null,
      notes: comboFormNotes.value,
      source: comboFormSource.value
    };
    if (editingComboId) {
      characterLibrary.updateCombo(editingComboId, payload);
      editingComboId = null;
      comboFormSaveBtn.textContent = 'Save Combo';
    } else {
      characterLibrary.addCombo(payload);
    }
    comboFormName.value = ''; comboFormNotation.value = ''; comboFormNotes.value = ''; comboFormSource.value = ''; comboFormDifficulty.value = '';
    renderComboFormPreview();
  });

  refreshCharacterUI();

  // -------------------------------------------------------------- Progress --
  function renderStats(summary) {
    q('stat-total-attempts').textContent = summary.totalAttempts;
    q('stat-successful-attempts').textContent = summary.successfulAttempts;
    q('stat-failed-attempts').textContent = summary.failedAttempts;
    q('stat-success-rate').textContent = `${Math.round(summary.successRate)}%`;
    q('stat-perfect-attempts').textContent = summary.perfectAttempts;
    q('stat-input-errors').textContent = summary.inputErrors;
    q('stat-timing-errors').textContent = summary.timingErrors;
    q('stat-best-time').textContent = summary.bestTime !== null ? formatSeconds(summary.bestTime) : '—';
    q('stat-average-time').textContent = summary.averageTime !== null ? formatSeconds(summary.averageTime) : '—';
    q('stat-fastest-input').textContent = summary.fastestInput !== null ? `${Math.round(summary.fastestInput)}ms` : '—';
    q('stat-average-gap').textContent = summary.averageGap !== null ? `${Math.round(summary.averageGap)}ms` : '—';
    q('stat-current-streak').textContent = summary.currentStreak;
    q('stat-best-streak').textContent = summary.bestStreak;
  }
  renderStats(statistics.getSummary());
  statistics.addEventListener('change', (e) => renderStats(e.detail));
  q('reset-stats-btn').addEventListener('click', () => { if (window.confirm('Reset all statistics?')) statistics.reset(); });

  // Random challenge
  q('challenge-new-btn').addEventListener('click', () => {
    const difficulty = q('challenge-difficulty-select').value;
    const { tokens } = generateRandomSequence(difficulty);
    loadIntoTrain({ steps: tokens, label: `Random Challenge (${difficulty})`, context: { type: 'challenge', difficulty } });
  });

  // Daily practice
  function renderDailySession(session) {
    const list = q('daily-session-list');
    list.innerHTML = '';
    session.forEach((item, i) => {
      const li = el('li', 'daily-session-item');
      let label; let onStart;
      if (item.kind === 'skill') {
        label = item.skill.name;
        onStart = () => loadIntoTrain({ steps: item.skill.sequence, label: item.skill.name, context: { type: 'skill', id: item.skill.id } });
      } else if (item.kind === 'combo') {
        const character = characterLibrary.getCharacter(item.combo.character);
        label = `${character ? character.name + ' — ' : ''}${item.combo.name}`;
        onStart = () => loadIntoTrain({ steps: item.combo.steps, referenceGaps: item.combo.referenceGaps, label, context: { type: 'combo', id: item.combo.id } });
      } else {
        label = `Random Challenge (${item.difficulty})`;
        onStart = () => {
          const { tokens } = generateRandomSequence(item.difficulty);
          loadIntoTrain({ steps: tokens, label, context: { type: 'challenge', difficulty: item.difficulty } });
        };
      }
      li.appendChild(el('span', 'daily-item-label', `${i + 1}. ${label}`));
      const btn = el('button', 'ghost-btn small', 'Start'); btn.type = 'button';
      btn.addEventListener('click', onStart);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }
  q('daily-generate-btn').addEventListener('click', () => {
    const length = parseInt(q('daily-length-select').value, 10);
    renderDailySession(generateDailySession(characterLibrary, length));
  });

  // Skill tree
  function renderSkillTree() {
    const container = q('skill-tree');
    container.innerHTML = '';
    skillLevels.forEach((level) => {
      const block = el('div', 'skill-level');
      block.appendChild(el('h4', 'skill-level-title', `Level ${level.level} — ${level.title}`));
      const list = el('div', 'skill-list');
      level.skills.forEach((skill) => {
        const row = el('div', 'skill-row');
        const status = progression.getStatus(skill.id);
        const badge = el('span', 'status-pill status-' + status.toLowerCase().replace(/_/g, '-'), status.replace(/_/g, ' '));
        const info = el('div', 'skill-info');
        info.appendChild(el('span', 'skill-name', skill.name));
        info.appendChild(el('span', 'skill-desc', skill.description));
        row.append(badge, info);
        if (skill.type === 'drill' && skill.sequence) {
          const btn = el('button', 'ghost-btn small', 'Train'); btn.type = 'button';
          btn.addEventListener('click', () => loadIntoTrain({ steps: skill.sequence, label: skill.name, context: { type: 'skill', id: skill.id } }));
          row.appendChild(btn);
        } else if (skill.type === 'checklist') {
          const entry = progression.getEntry(skill.id);
          const btn = el('button', 'ghost-btn small', entry.checked ? 'Unmark' : 'Mark practiced'); btn.type = 'button';
          btn.addEventListener('click', () => progression.toggleChecklist(skill.id));
          row.appendChild(btn);
        } else {
          row.appendChild(el('span', 'hint-text', 'Tracked automatically'));
        }
        list.appendChild(row);
      });
      block.appendChild(list);
      container.appendChild(block);
    });
  }
  progression.addEventListener('change', renderSkillTree);
  renderSkillTree();

  // Import / export
  q('export-data-btn').addEventListener('click', () => {
    const data = storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'notation-lab-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    q('import-export-note').textContent = 'Exported.';
  });
  q('import-data-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        storage.importAll(JSON.parse(reader.result));
        q('import-export-note').textContent = 'Imported — reloading…';
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        q('import-export-note').textContent = 'Import failed: invalid file.';
      }
    };
    reader.readAsText(file);
  });

  // ----------------------------------------------------------------- Settings
  const inputSourceSelect = q('input-source-select');
  inputSourceSelect.value = storage.getInputSource();
  inputSourceSelect.addEventListener('change', () => {
    storage.setInputSource(inputSourceSelect.value);
    applyInputSource(inputSourceSelect.value);
  });

  // Keyboard remap
  const keybindList = q('keybind-list');
  const conflictWarning = q('keybind-conflict-warning');
  let listeningAction = null;

  function renderKeybindButtons() {
    keybindList.querySelectorAll('.remap-btn').forEach((btn) => {
      btn.textContent = keyMapper.getBindingDisplay(btn.dataset.action);
      btn.classList.remove('listening');
    });
  }
  renderKeybindButtons();

  function beginListeningKeyboard(action, btn) {
    if (listeningAction) return;
    listeningAction = action;
    btn.classList.add('listening');
    btn.textContent = 'Press a key…';
    function onKey(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      window.removeEventListener('keydown', onKey, true);
      listeningAction = null;
      if (ev.code === 'Escape') { renderKeybindButtons(); return; }
      const result = keyMapper.setBinding(action, ev.code);
      renderKeybindButtons();
      if (result.conflict) {
        conflictWarning.textContent = `${ACTION_LABELS[action]} and ${ACTION_LABELS[result.conflict]} are now both bound to the same key.`;
        conflictWarning.classList.remove('hidden');
      } else {
        conflictWarning.classList.add('hidden');
      }
    }
    window.addEventListener('keydown', onKey, true);
  }
  keybindList.querySelectorAll('.remap-btn').forEach((btn) => btn.addEventListener('click', () => beginListeningKeyboard(btn.dataset.action, btn)));

  // Gamepad remap
  const gamepadMappingList = q('gamepad-mapping-list');
  const gamepadConflictWarning = q('gamepad-conflict-warning');
  let listeningGamepadAction = null;

  function renderGamepadButtons() {
    gamepadMappingList.querySelectorAll('.gamepad-remap-btn').forEach((btn) => {
      btn.textContent = gamepadMapper.getBindingDisplay(btn.dataset.action);
      btn.classList.remove('listening');
    });
  }
  renderGamepadButtons();

  gamepadMappingList.querySelectorAll('.gamepad-remap-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (listeningGamepadAction === action) { gamepadEngine.cancelCapture(); listeningGamepadAction = null; renderGamepadButtons(); return; }
      if (listeningGamepadAction) return;
      listeningGamepadAction = action;
      btn.classList.add('listening');
      btn.textContent = 'Press a button…';
      gamepadEngine.captureNextButton().then((code) => {
        listeningGamepadAction = null;
        const result = gamepadMapper.setBinding(action, code);
        renderGamepadButtons();
        if (result.conflict) {
          gamepadConflictWarning.textContent = `${ACTION_LABELS[action]} and ${ACTION_LABELS[result.conflict]} are now both bound to the same button.`;
          gamepadConflictWarning.classList.remove('hidden');
        } else {
          gamepadConflictWarning.classList.add('hidden');
        }
      });
    });
  });
  q('gamepad-reset-btn').addEventListener('click', () => {
    gamepadMapper.resetToDefault();
    gamepadMapper.save();
    renderGamepadButtons();
    gamepadConflictWarning.classList.add('hidden');
  });

  // SOCD / chord window / precision mode
  const socdSelect = q('socd-mode-select');
  socdSelect.value = storage.getSocdMode();
  socdSelect.addEventListener('change', () => { storage.setSocdMode(socdSelect.value); inputEventEngine.setSocdMode(socdSelect.value); });

  const chordWindowSelect = q('chord-window-select');
  chordWindowSelect.value = String(storage.getChordWindowMs());
  chordWindowSelect.addEventListener('change', () => {
    const ms = parseInt(chordWindowSelect.value, 10);
    storage.setChordWindowMs(ms);
    inputEventEngine.setChordWindow(ms);
  });

  const precisionSelect = q('precision-mode-select');
  precisionSelect.value = storage.getPrecisionMode();
  precisionSelect.addEventListener('change', () => {
    storage.setPrecisionMode(precisionSelect.value);
    practiceMatcher.setPrecisionMode(precisionSelect.value);
    applyPrecisionNote(precisionSelect.value);
  });

  // Save / reset
  const saveSettingsBtn = q('save-settings-btn');
  const resetDefaultsBtn = q('reset-defaults-btn');
  const settingsSavedNote = q('settings-saved-note');
  saveSettingsBtn.addEventListener('click', () => {
    keyMapper.save();
    gamepadMapper.save();
    settingsSavedNote.textContent = 'Settings saved.';
    setTimeout(() => { settingsSavedNote.textContent = ''; }, 2000);
  });
  resetDefaultsBtn.addEventListener('click', () => {
    keyMapper.resetToDefault(); keyMapper.save();
    gamepadMapper.resetToDefault(); gamepadMapper.save();
    renderKeybindButtons(); renderGamepadButtons();
    conflictWarning.classList.add('hidden'); gamepadConflictWarning.classList.add('hidden');
    settingsSavedNote.textContent = 'Defaults restored.';
    setTimeout(() => { settingsSavedNote.textContent = ''; }, 2000);
  });
}
