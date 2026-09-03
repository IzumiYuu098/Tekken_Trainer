// movement-training.js
// A data-driven list of directional-input drills. Each exercise is judged purely
// as an input sequence (via trainer.js's ComboMatcher) — this file makes no
// claim about simulating any specific game's movement physics.
//
// To add a new exercise, just push another object onto MOVEMENT_EXERCISES. Every
// entry needs a unique `id`, a display `name`, a short `description`, and a
// `sequence` array of notation tokens (see notation.js for the symbol set).

export const MOVEMENT_EXERCISES = [
  { id: 'forward', name: 'Forward', description: 'Tap forward once.', sequence: ['→'] },
  { id: 'back', name: 'Back', description: 'Tap back once.', sequence: ['←'] },
  { id: 'crouch', name: 'Crouch', description: 'Hold down.', sequence: ['↓'] },
  { id: 'jump', name: 'Jump', description: 'Tap up.', sequence: ['↑'] },
  { id: 'forward-dash', name: 'Forward Dash', description: 'Two quick forward taps.', sequence: ['→', '→'] },
  { id: 'backdash', name: 'Backdash', description: 'Two quick back taps.', sequence: ['←', '←'] },
  { id: 'diagonal-df', name: 'Down-Forward Diagonal', description: 'Down-right diagonal.', sequence: ['↘'] },
  { id: 'diagonal-db', name: 'Down-Back Diagonal', description: 'Down-left diagonal.', sequence: ['↙'] },
  { id: 'diagonal-uf', name: 'Up-Forward Diagonal', description: 'Up-right diagonal.', sequence: ['↗'] },
  { id: 'diagonal-ub', name: 'Up-Back Diagonal', description: 'Up-left diagonal.', sequence: ['↖'] },
  { id: 'repeated-backdash', name: 'Repeated Backdash', description: 'Four backdashes in a row.', sequence: ['←', '←', '←', '←'] },
  { id: 'directional-transition', name: 'Directional Transition', description: 'Crouch smoothly into forward.', sequence: ['↓', '↘', '→'] },
  { id: 'diagonal-transition', name: 'Diagonal Transition', description: 'Alternate forward diagonals.', sequence: ['↘', '→', '↘', '→'] },
  { id: 'crouch-dash', name: 'Crouch-Dash Sequence', description: 'Classic crouch into forward dash motion.', sequence: ['↓', '↘', '→'] },
  { id: 'wavedash', name: 'Wavedash-Style Practice', description: 'Repeated crouch-dash motion.', sequence: ['↓', '↘', '→', '↓', '↘', '→'] },
  { id: 'kbd', name: 'KBD-Style Practice', description: 'Rapid backward diagonal cycling drill.', sequence: ['←', '↓', '↙', '←', '↓', '↙', '←'] }
];

export function getExerciseById(id) {
  return MOVEMENT_EXERCISES.find((ex) => ex.id === id) || null;
}
