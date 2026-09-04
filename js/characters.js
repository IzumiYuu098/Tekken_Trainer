// characters.js
// Per-character combo library. Replaces the old flat, single-list
// ComboLibrary. Handles a one-time migration of pre-update saved combos
// (which used arrow-glyph notation like "↘ 1") into the new letter-based
// notation ("DF+1") inside an "Unsorted (imported)" character bucket, so
// nothing the user saved before is lost.

import { storage } from './storage.js';
import { parseComboText, serializeSteps, estimateDifficulty } from './combo-notation.js';

function createId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const OLD_ARROW_TO_LETTER = { '↑': 'U', '↓': 'D', '←': 'B', '→': 'F', '↖': 'UB', '↗': 'UF', '↙': 'DB', '↘': 'DF', N: 'N' };

function migrateOldToken(oldToken) {
  if (!oldToken) return 'N';
  const parts = oldToken.split(' ');
  let dirPart = null;
  let btnPart = null;
  if (parts.length === 2) {
    dirPart = parts[0];
    btnPart = parts[1];
  } else if (OLD_ARROW_TO_LETTER[parts[0]] !== undefined) {
    dirPart = parts[0];
  } else {
    btnPart = parts[0];
  }
  const dir = dirPart ? (OLD_ARROW_TO_LETTER[dirPart] || 'N') : 'N';
  return btnPart ? (dir === 'N' ? btnPart : `${dir}+${btnPart}`) : dir;
}

function defaultCharacters() {
  return [{ id: 'lili', name: 'Lili', createdAt: Date.now() }];
}

export class CharacterLibrary extends EventTarget {
  constructor() {
    super();
    this._load();
  }

  _load() {
    let data = storage.getCharacters();
    const version = storage.getStorageVersion();

    if (!data) {
      data = { characters: defaultCharacters(), combos: [] };

      if (version < 2) {
        const legacy = storage.getSavedCombos();
        if (legacy && legacy.length) {
          data.characters.push({ id: 'unsorted', name: 'Unsorted (imported)', createdAt: Date.now() });
          legacy.forEach((old) => {
            const migratedText = (old.inputs || []).map(migrateOldToken).join(' ');
            const steps = parseComboText(migratedText);
            data.combos.push({
              id: old.id || createId('combo'),
              character: 'unsorted',
              name: old.name || 'Imported combo',
              steps,
              notation: serializeSteps(steps),
              difficulty: old.difficulty || estimateDifficulty(steps),
              notes: 'Imported from a previous version of this trainer.',
              source: '',
              dateAdded: old.createdAt || Date.now(),
              referenceGaps: old.referenceGaps || null,
              attempts: old.attempts || 0,
              successes: old.successes || 0,
              perfectAttempts: 0,
              errors: 0,
              bestTime: typeof old.bestTime === 'number' ? old.bestTime : null,
              averageTime: typeof old.averageTime === 'number' ? old.averageTime : null
            });
          });
        }
      }
      storage.setCharacters(data);
    }
    storage.setStorageVersion(2);

    this.characters = data.characters;
    this.combos = data.combos;
  }

  _persist() {
    storage.setCharacters({ characters: this.characters, combos: this.combos });
  }

  listCharacters() { return this.characters.slice(); }
  getCharacter(id) { return this.characters.find((c) => c.id === id) || null; }

  addCharacter(name) {
    const character = { id: createId('char'), name: name && name.trim() ? name.trim() : 'New Character', createdAt: Date.now() };
    this.characters.push(character);
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
    return character;
  }

  renameCharacter(id, newName) {
    const c = this.getCharacter(id);
    if (!c || !newName || !newName.trim()) return false;
    c.name = newName.trim();
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
    return true;
  }

  removeCharacter(id) {
    this.characters = this.characters.filter((c) => c.id !== id);
    this.combos = this.combos.filter((c) => c.character !== id);
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
  }

  listCombos(characterId = null) {
    return characterId ? this.combos.filter((c) => c.character === characterId) : this.combos.slice();
  }

  getCombo(id) { return this.combos.find((c) => c.id === id) || null; }

  addCombo({ character, name, notationText, difficulty = null, notes = '', source = '', referenceGaps = null }) {
    const steps = parseComboText(notationText);
    const combo = {
      id: createId('combo'),
      character,
      name: name && name.trim() ? name.trim() : 'New Combo',
      steps,
      notation: serializeSteps(steps),
      difficulty: difficulty || estimateDifficulty(steps),
      notes,
      source,
      dateAdded: Date.now(),
      referenceGaps,
      attempts: 0,
      successes: 0,
      perfectAttempts: 0,
      errors: 0,
      bestTime: null,
      averageTime: null
    };
    this.combos.push(combo);
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
    return combo;
  }

  updateCombo(id, patch) {
    const combo = this.getCombo(id);
    if (!combo) return null;
    if (patch.notationText !== undefined) {
      combo.steps = parseComboText(patch.notationText);
      combo.notation = serializeSteps(combo.steps);
    }
    if (patch.name !== undefined && patch.name.trim()) combo.name = patch.name.trim();
    if (patch.difficulty !== undefined) combo.difficulty = patch.difficulty;
    if (patch.notes !== undefined) combo.notes = patch.notes;
    if (patch.source !== undefined) combo.source = patch.source;
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
    return combo;
  }

  removeCombo(id) {
    this.combos = this.combos.filter((c) => c.id !== id);
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
  }

  recordAttempt(id, { success, totalTime, isPerfect = false, errorKind = null }) {
    const combo = this.getCombo(id);
    if (!combo) return;
    combo.attempts += 1;
    if (success) {
      const prevSuccesses = combo.successes;
      combo.successes += 1;
      if (isPerfect) combo.perfectAttempts += 1;
      if (typeof totalTime === 'number') {
        combo.bestTime = combo.bestTime === null ? totalTime : Math.min(combo.bestTime, totalTime);
        combo.averageTime = combo.averageTime === null
          ? totalTime
          : (combo.averageTime * prevSuccesses + totalTime) / combo.successes;
      }
    } else if (errorKind) {
      combo.errors += 1;
    }
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: {} }));
  }

  /**
   * 0-100 mastery estimate blending success rate (60%) and perfect-execution
   * rate (40%). This is a documented heuristic for tracking your own
   * improvement over time, not a claim about objective "skill".
   */
  getMastery(id) {
    const combo = this.getCombo(id);
    if (!combo || !combo.attempts) return 0;
    const successRate = combo.successes / combo.attempts;
    const perfectRate = combo.perfectAttempts / combo.attempts;
    return Math.round((successRate * 0.6 + perfectRate * 0.4) * 100);
  }
}
