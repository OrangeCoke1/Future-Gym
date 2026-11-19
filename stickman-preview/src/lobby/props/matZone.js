export function buildMatZone({ batch, materials, signal }) {
  const { box, tube } = batch;
  box(materials.mat, [1.67, 0.044, 2.04], [0, 0.025, 0], 0.021);
  const y = 0.049;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      tube(signal, [[x * 0.49, y, z * 0.864], [x * 0.633, y, z * 0.864],
        [x * 0.704, y, z * 0.824], [x * 0.733, y, z * 0.761],
        [x * 0.733, y, z * 0.665]], 0.008);
    }
  }
  box(signal, [0.139, 0.004, 0.009], [0, y, -0.052], 0.0017);
  box(signal, [0.009, 0.004, 0.139], [0, y, -0.052], 0.0017);
}
