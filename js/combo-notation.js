// combo-notation.js
// Turns free-text combo entry (e.g. "CH → WS+4 → DEW → BT → DASH", typed while
// watching a combo video) into a structured list of steps. This is
// deliberately NOT trying to understand every character's terminology — it
// recognizes real, verifiable inputs (via notation.js), expands a small set
// of unambiguous movement macros into real inputs, and treats everything
// else as an opaque LABEL: a training checkpoint the player must manually
// confirm, because the browser has no way to verify a stance/state claim
// like "WS" or "DEW" actually happened in the real game.

import { parseNotationToken, combineNotation } from './notation.js';

// Only movement macros that translate to something the input engine can
// genuinely detect and verify get expanded into real input steps. Anything
// else (WS, FC, BT, CH, DEW, character-specific terms, ...) is preserved as
// a label rather than guessed at.
const MOVEMENT_MACROS = {
  DASH: ['F', 'F'],
  BACKDASH: ['B', 'B'],
  DOUBLE_FORWARD: ['F', 'F'],
  DOUBLE_BACK: ['B', 'B']
};

function makeInputStep(notation) {
  const parsed = parseNotationToken(notation);
  return {
    type: 'input',
    notation: parsed.raw,
    direction: parsed.direction,
    buttons: parsed.buttons.slice()
  };
}

function makeLabelStep(raw) {
  return { type: 'label', notation: raw };
}

/** Splits free-text combo entry on arrows, commas, semicolons, or whitespace. */
export function tokenizeComboText(text) {
  return (text || '')
    .split(/[\s,;→>]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Converts raw tokenized text into structured steps (input / label), expanding known macros. */
export function parseComboText(text) {
  const tokens = tokenizeComboText(text);
  const steps = [];
  for (const raw of tokens) {
    const macroKey = raw.toUpperCase().replace(/[\s-]/g, '_');
    if (MOVEMENT_MACROS[macroKey]) {
      MOVEMENT_MACROS[macroKey].forEach((n) => steps.push(makeInputStep(n)));
      continue;
    }
    const parsed = parseNotationToken(raw);
    if (parsed.kind === 'empty') continue;
    if (parsed.kind === 'input') {
      steps.push(makeInputStep(parsed.raw));
    } else {
      steps.push(makeLabelStep(raw));
    }
  }
  return steps;
}

/** Turns a structured step list back into editable text. */
export function serializeSteps(steps) {
  return steps.map((s) => s.notation).join(' \u2192 ');
}

/**
 * A single real input token (from the live input engine) becomes one 'input' step.
 * Used by the combo builder when recording live play.
 */
export function stepFromLiveEvent(inputEvent) {
  return {
    type: 'input',
    notation: inputEvent.notation,
    direction: inputEvent.direction,
    buttons: inputEvent.buttons.slice()
  };
}

/**
 * Rough, transparent difficulty estimate based on structural complexity.
 * This is a heuristic, not a claim about in-game execution difficulty — the
 * difficulty field is always user-editable regardless of this suggestion.
 */
export function estimateDifficulty(steps) {
  const inputSteps = steps.filter((s) => s.type === 'input');
  const labelSteps = steps.filter((s) => s.type === 'label');
  const simultaneousButtonSteps = inputSteps.filter((s) => s.buttons.length >= 2).length;
  const diagonalSteps = inputSteps.filter((s) => s.direction && s.direction.length === 2).length;

  let score = 0;
  score += inputSteps.length; // base length
  score += simultaneousButtonSteps * 2; // simultaneous attacks are harder
  score += diagonalSteps * 1; // diagonals add directional complexity
  score += labelSteps.length * 2; // stance/movement requirements add complexity

  if (score <= 3) return 'Beginner';
  if (score <= 7) return 'Intermediate';
  if (score <= 13) return 'Advanced';
  return 'Expert';
}
