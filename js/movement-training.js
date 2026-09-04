// movement-training.js
// The dedicated Movement tab's drill list (letter-based Tekken notation).
// Where a drill overlaps with a roadmap skill (see progression.js), it
// carries a `skillId` so completing it here also credits that skill's
// progress — the Movement tab and the Progress tab are different views onto
// some of the same underlying practice, not two competing systems.

export const MOVEMENT_EXERCISES = [
  { id: 'forward', name: 'Forward', description: 'Tap forward once.', sequence: ['F'] },
  { id: 'back', name: 'Back', description: 'Tap back once.', sequence: ['B'] },
  { id: 'crouch', name: 'Crouch', description: 'Hold down.', sequence: ['D'], skillId: 'l2-crouch' },
  { id: 'jump', name: 'Jump', description: 'Tap up.', sequence: ['U'] },
  { id: 'forward-dash', name: 'Forward Dash', description: 'Two quick forward taps.', sequence: ['F', 'F'], skillId: 'l2-dash' },
  { id: 'backdash', name: 'Backdash', description: 'Two quick back taps.', sequence: ['B', 'B'], skillId: 'l2-backdash' },
  { id: 'diagonal-df', name: 'Down-Forward Diagonal', description: 'Down-right diagonal.', sequence: ['DF'], skillId: 'l3-df' },
  { id: 'diagonal-db', name: 'Down-Back Diagonal', description: 'Down-left diagonal.', sequence: ['DB'], skillId: 'l3-db' },
  { id: 'diagonal-uf', name: 'Up-Forward Diagonal', description: 'Up-right diagonal.', sequence: ['UF'], skillId: 'l3-uf' },
  { id: 'diagonal-ub', name: 'Up-Back Diagonal', description: 'Up-left diagonal.', sequence: ['UB'], skillId: 'l3-ub' },
  { id: 'repeated-backdash', name: 'Repeated Backdash', description: 'Four backdashes in a row.', sequence: ['B', 'B', 'B', 'B'], skillId: 'l7-backdash-chain' },
  { id: 'directional-transition', name: 'Directional Transition', description: 'Crouch smoothly into forward.', sequence: ['D', 'DF', 'F'], skillId: 'l3-transitions' },
  { id: 'diagonal-transition', name: 'Diagonal Transition', description: 'Alternate forward diagonals.', sequence: ['DF', 'F', 'DF', 'F'] },
  { id: 'crouch-dash', name: 'Crouch-Dash Sequence', description: 'Classic crouch into forward dash motion.', sequence: ['D', 'DF', 'F'] },
  { id: 'wavedash', name: 'Wavedash-Style Practice', description: 'Repeated crouch-dash motion.', sequence: ['D', 'DF', 'F', 'D', 'DF', 'F'], skillId: 'l7-wavedash' },
  { id: 'kbd', name: 'KBD-Style Practice', description: 'Rapid backward diagonal cycling drill.', sequence: ['B', 'D', 'DB', 'B', 'D', 'DB', 'B'], skillId: 'l7-kbd' }
];

export function getExerciseById(id) {
  return MOVEMENT_EXERCISES.find((ex) => ex.id === id) || null;
}
