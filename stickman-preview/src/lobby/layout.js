export const ROOM = { halfWidth: 3.06, height: 3.47, back: -4.42, front: 6.45 };
export const HATCH = { y: 1.58, z: ROOM.front + 0.82, radius: 0.55 };

export const BAYS = {
  cardio: { position: [-0.56, 0, -2.47], yaw: 0.03, scale: 1.23, size: [1.19, 1.56, 2.14], anchor: [0, 1.6, -0.1], focus: 1.05 },
  squat: { position: [1.76, 0, 0.33], yaw: -0.2, size: [1.77, 2.87, 1.64], anchor: [0, 2.90, 0.16], focus: 1.34 },
  dumbbell: { position: [-2.69, 0, -0.135], yaw: 1.43, size: [2.77, 1.14, 0.84], anchor: [0.24, 1.22, 0.37], focus: 0.68 },
  mat: { position: [-0.04, 0, 0.72], yaw: 0, size: [1.68, 0.20, 2.04], anchor: [0, 0.49, -0.42], focus: 0.15 },
};

export const WALL_PLAQUES = [
  { id: 'dumbbell', y: 2.86 },
  { id: 'cardio', y: 2.37 },
  { id: 'mat', y: 1.88 },
  { id: 'squat', y: 1.39 },
];
export const WALL_PLAQUE_X = 2.956;
export const WALL_PLAQUE_Z = 0.75;
