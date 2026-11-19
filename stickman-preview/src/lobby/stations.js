/** @typedef {{ id: string, name: string, act: string, acts: string[], angle: number }} Station */

/** @type {Station[]} */
export const STATIONS = [
  { id: 'cardio', name: '有氧跑台', act: 'jog', acts: ['walk', 'jog', 'high'], angle: -54 },
  { id: 'squat', name: '深蹲架', act: 'squat', acts: ['squat', 'lunge'], angle: -18 },
  { id: 'dumbbell', name: '哑铃区', act: 'curl', acts: ['curl', 'press', 'lateral'], angle: 18 },
  { id: 'mat', name: '体能垫', act: 'jacks', acts: ['jacks', 'wave', 'idle'], angle: 54 },
];
