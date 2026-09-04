// progression.js
// The beginner -> advanced training roadmap. Each skill is either:
//   type: 'drill'     — has a real input sequence, tracked automatically via
//                        attempts/successes/perfect runs (fed by whichever
//                        ComboMatcher is running it).
//   type: 'checklist' — a conceptual or game-specific item (e.g. "controller
//                        orientation", "sidestep", "wall routes") that this
//                        browser-based trainer genuinely cannot verify by
//                        watching input alone. The player marks it practiced
//                        manually rather than the system pretending to grade it.
//
// Status is computed from real counts, never asserted:
//   NOT_STARTED -> LEARNING -> PRACTICING -> CONSISTENT -> MASTERED
// Thresholds are documented below and are intentionally conservative — this
// never calls someone "pro", only "MASTERED" against a stated, fixed bar.

export const SKILL_LEVELS = [
  {
    level: 1,
    title: 'Fundamentals',
    skills: [
      { id: 'l1-orientation', name: 'Controller orientation', type: 'checklist', description: 'Get comfortable with the virtual controller and your key bindings before drilling.' },
      { id: 'l1-buttons', name: '1/2/3/4 buttons', type: 'drill', description: 'Press each attack button once, in order.', sequence: ['1', '2', '3', '4'] },
      { id: 'l1-directions', name: 'Directional inputs', type: 'drill', description: 'Tap each cardinal direction once.', sequence: ['F', 'B', 'U', 'D'] },
      { id: 'l1-diagonals', name: 'Diagonals', type: 'drill', description: 'Tap each diagonal once.', sequence: ['DF', 'DB', 'UF', 'UB'] },
      { id: 'l1-simultaneous', name: 'Simultaneous buttons', type: 'drill', description: 'Press two-button chords cleanly.', sequence: ['1+2', '3+4'] }
    ]
  },
  {
    level: 2,
    title: 'Basic Movement',
    skills: [
      { id: 'l2-dash', name: 'Dash', type: 'drill', description: 'Two quick forward taps.', sequence: ['F', 'F'] },
      { id: 'l2-backdash', name: 'Backdash', type: 'drill', description: 'Two quick back taps.', sequence: ['B', 'B'] },
      { id: 'l2-crouch', name: 'Crouch', type: 'drill', description: 'Hold down cleanly.', sequence: ['D'] },
      { id: 'l2-sidestep', name: 'Sidestep', type: 'checklist', description: 'Sidestep is a 3D positional move this 2D-input trainer cannot verify — practice it in-game.' },
      { id: 'l2-diagonal-movement', name: 'Diagonal movement', type: 'drill', description: 'Move through both forward diagonals.', sequence: ['DF', 'DB'] }
    ]
  },
  {
    level: 3,
    title: 'Input Control',
    skills: [
      { id: 'l3-df', name: 'DF', type: 'drill', description: 'Clean down-forward diagonal.', sequence: ['DF'] },
      { id: 'l3-db', name: 'DB', type: 'drill', description: 'Clean down-back diagonal.', sequence: ['DB'] },
      { id: 'l3-uf', name: 'UF', type: 'drill', description: 'Clean up-forward diagonal.', sequence: ['UF'] },
      { id: 'l3-ub', name: 'UB', type: 'drill', description: 'Clean up-back diagonal.', sequence: ['UB'] },
      { id: 'l3-transitions', name: 'Directional transitions', type: 'drill', description: 'Crouch smoothly into a forward dash motion.', sequence: ['D', 'DF', 'F'] }
    ]
  },
  {
    level: 4,
    title: 'Timing',
    skills: [
      { id: 'l4-fast', name: 'Fast transitions', type: 'drill', description: 'Same crouch-dash motion, aim for Strict precision.', sequence: ['D', 'DF', 'F'] },
      { id: 'l4-repeated', name: 'Repeated inputs', type: 'drill', description: 'Four clean forward taps back to back.', sequence: ['F', 'F', 'F', 'F'] },
      { id: 'l4-buffering', name: 'Input buffering awareness', type: 'checklist', description: 'Understand that this trainer measures real gaps between inputs — it does not simulate a game\'s internal input buffer.' }
    ]
  },
  {
    level: 5,
    title: 'Basic Combos',
    skills: [
      { id: 'l5-poke-string', name: 'Poke into launcher (generic)', type: 'drill', description: 'A generic 3-hit execution pattern — not a real move, just practicing chaining inputs.', sequence: ['F', '1', '2'] },
      { id: 'l5-followup', name: 'Simultaneous-attack follow-up', type: 'drill', description: 'Generic pattern chaining a diagonal chord into a button.', sequence: ['DF+1', 'F+2'] }
    ]
  },
  {
    level: 6,
    title: 'Intermediate',
    skills: [
      { id: 'l6-stance', name: 'Stance transitions', type: 'checklist', description: 'Stance state can\'t be verified from input alone — practice in-game, and log real combos with stance labels (e.g. "WS") in the Combos tab.' },
      { id: 'l6-ws-rhythm', name: 'While-Standing rhythm', type: 'drill', description: 'Practice the rhythm of confirming a stance then attacking, using a label checkpoint.', sequence: [{ type: 'label', notation: 'WS' }, '4'] },
      { id: 'l6-movement-attack', name: 'Movement into attack', type: 'drill', description: 'Dash in and attack.', sequence: ['F', 'F', '1'] },
      { id: 'l6-simultaneous-attacks', name: 'Simultaneous attacks', type: 'drill', description: 'Both two-button chords.', sequence: ['1+2', '3+4'] }
    ]
  },
  {
    level: 7,
    title: 'Advanced Movement',
    skills: [
      { id: 'l7-backdash-chain', name: 'Backdash chain', type: 'drill', description: 'Four backdashes in a row.', sequence: ['B', 'B', 'B', 'B'] },
      { id: 'l7-kbd', name: 'KBD-style practice', type: 'drill', description: 'Rapid backward diagonal cycling drill.', sequence: ['B', 'D', 'DB', 'B', 'D', 'DB', 'B'] },
      { id: 'l7-wavedash', name: 'Wavedash-style practice', type: 'drill', description: 'Repeated crouch-dash motion.', sequence: ['D', 'DF', 'F', 'D', 'DF', 'F'] },
      { id: 'l7-rapid-transitions', name: 'Rapid direction changes', type: 'drill', description: 'Alternate forward and back quickly.', sequence: ['F', 'B', 'F', 'B'] }
    ]
  },
  {
    level: 8,
    title: 'Advanced Combos',
    skills: [
      { id: 'l8-longer-drill', name: 'Longer execution drill (generic)', type: 'drill', description: 'A generic six-step execution pattern, not a real character combo.', sequence: ['F', '1', 'F', '2', 'DF+1', 'F+2'] },
      { id: 'l8-stance-combo', name: 'Stance + input combo', type: 'drill', description: 'Mixes a label checkpoint into a longer pattern.', sequence: ['F', '1', { type: 'label', notation: 'BT' }, '2'] },
      { id: 'l8-wall-routes', name: 'Wall routes', type: 'checklist', description: 'Wall position is game-state this trainer can\'t see — practice in-game and log real routes in the Combos tab.' },
      { id: 'l8-character-routes', name: 'Character-specific routes', type: 'checklist', description: 'Add your character\'s real combos in the Combos tab — this roadmap only covers generic execution fundamentals.' }
    ]
  },
  {
    level: 9,
    title: 'Precision',
    skills: [
      { id: 'l9-strict-timing', name: 'Strict timing drill', type: 'drill', description: 'Switch Precision Mode to Strict or Perfect in Settings, then run this.', sequence: ['D', 'DF', 'F', '1'] },
      { id: 'l9-consistency', name: 'Consistency check', type: 'drill', description: 'Repeat this cleanly, many times, aiming for a high success rate.', sequence: ['F', 'F', '1+2'] },
      { id: 'l9-speed', name: 'Speed check', type: 'drill', description: 'Same KBD pattern, now timed for speed.', sequence: ['B', 'D', 'DB', 'B', 'D', 'DB', 'B'] }
    ]
  },
  {
    level: 10,
    title: 'Mastery',
    skills: [
      { id: 'l10-expert-challenge', name: 'Expert random challenges', type: 'drill', description: 'Complete Expert-difficulty Random Challenges (tracked automatically from the Challenge tab).', sequence: null },
      { id: 'l10-long-combo', name: 'Long combo mastery', type: 'checklist', description: 'Reach high mastery % on a saved combo with 5+ steps in the Combos tab.' },
      { id: 'l10-difficult-movement', name: 'Difficult movement under pressure', type: 'drill', description: 'Wavedash pattern under Strict/Perfect precision.', sequence: ['D', 'DF', 'F', 'D', 'DF', 'F'] }
    ]
  }
];

function allSkills() {
  return SKILL_LEVELS.flatMap((lvl) => lvl.skills);
}

export function findSkill(skillId) {
  return allSkills().find((s) => s.id === skillId) || null;
}

function defaultProgressState() {
  const state = {};
  for (const s of allSkills()) {
    state[s.id] = { attempts: 0, successes: 0, perfectCount: 0, checked: false };
  }
  return state;
}

/**
 * CONSISTENT requires 10+ successful attempts at an 80%+ success rate.
 * MASTERED requires 20+ successful attempts at 90%+ with at least 10 perfect
 * runs. Both thresholds are fixed and documented, never asserted early.
 */
export function computeDrillStatus(entry) {
  if (!entry || !entry.attempts) return 'NOT_STARTED';
  const rate = entry.successes / entry.attempts;
  if (entry.successes >= 20 && rate >= 0.9 && entry.perfectCount >= 10) return 'MASTERED';
  if (entry.successes >= 10 && rate >= 0.8) return 'CONSISTENT';
  if (entry.attempts >= 3) return 'PRACTICING';
  return 'LEARNING';
}

export class Progression extends EventTarget {
  constructor(storage) {
    super();
    this.storage = storage;
    const stored = storage.getProgression();
    this.state = { ...defaultProgressState(), ...(stored || {}) };
  }

  _persist() {
    this.storage.setProgression(this.state);
  }

  getEntry(skillId) {
    return this.state[skillId] || { attempts: 0, successes: 0, perfectCount: 0, checked: false };
  }

  getStatus(skillId) {
    const skill = findSkill(skillId);
    const entry = this.getEntry(skillId);
    if (!skill) return 'NOT_STARTED';
    if (skill.type === 'checklist') return entry.checked ? 'CONSISTENT' : 'NOT_STARTED';
    return computeDrillStatus(entry);
  }

  recordDrillAttempt(skillId, { success, isPerfect = false }) {
    if (!this.state[skillId]) this.state[skillId] = { attempts: 0, successes: 0, perfectCount: 0, checked: false };
    const entry = this.state[skillId];
    entry.attempts += 1;
    if (success) {
      entry.successes += 1;
      if (isPerfect) entry.perfectCount += 1;
    }
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { skillId } }));
  }

  toggleChecklist(skillId) {
    if (!this.state[skillId]) this.state[skillId] = { attempts: 0, successes: 0, perfectCount: 0, checked: false };
    this.state[skillId].checked = !this.state[skillId].checked;
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { skillId } }));
  }

  /** Hooked to the Random Challenge system so Level 10's expert-challenge skill tracks automatically. */
  recordChallengeCompletion(difficulty, success) {
    if (difficulty !== 'Expert') return;
    this.recordDrillAttempt('l10-expert-challenge', { success, isPerfect: false });
  }

  getLevelSummary() {
    return SKILL_LEVELS.map((lvl) => {
      const statuses = lvl.skills.map((s) => this.getStatus(s.id));
      const masteredCount = statuses.filter((s) => s === 'MASTERED' || s === 'CONSISTENT').length;
      return { level: lvl.level, title: lvl.title, total: lvl.skills.length, complete: masteredCount };
    });
  }

  resetAll() {
    this.state = defaultProgressState();
    this._persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { skillId: null } }));
  }
}

// ---------------------------------------------------------------------------
// Daily practice session generator
// ---------------------------------------------------------------------------

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Builds a short, varied practice session: a mix of fundamentals, movement,
 * timing, and (if any exist) one of the player's own saved combos, plus a
 * random challenge to finish. Length is configurable; unmet minimums are
 * filled with generic drills.
 */
export function generateDailySession(characterLibrary, length = 6) {
  const byId = (id) => findSkill(id);
  const pool = [
    byId('l1-directions'), byId('l2-dash'), byId('l2-backdash'), byId('l3-df'),
    byId('l3-transitions'), byId('l4-fast'), byId('l7-kbd'), byId('l7-wavedash')
  ].filter(Boolean);

  const session = [];
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const drillCount = Math.max(1, length - 2);
  for (let i = 0; i < Math.min(drillCount, shuffled.length); i++) {
    session.push({ kind: 'skill', skill: shuffled[i] });
  }

  const combos = characterLibrary ? characterLibrary.listCombos() : [];
  if (combos.length && session.length < length - 1) {
    session.push({ kind: 'combo', combo: pickRandom(combos) });
  }

  if (session.length < length) {
    session.push({ kind: 'challenge', difficulty: 'Normal' });
  }

  return session.slice(0, length);
}
