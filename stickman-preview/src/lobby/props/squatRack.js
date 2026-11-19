const FRONT = [Math.PI / 2, 0, 0];
const ACROSS = [0, 0, Math.PI / 2];

export function buildSquatRack({ batch, materials, signal }) {
  const { box, cylinder, tube } = batch;
  const { housing, graphite, chrome, aluminum, rubber, padding, grip } = materials;

  for (const side of [-1, 1]) {
    const x = side * 0.752;
    const inner = side * 0.622;
    box(housing, [0.246, 0.124, 1.515], [x, 0.095, 0.034], 0.056);
    box(rubber, [0.245, 0.11, 0.21], [x, 0.072, 0.74], 0.039);
    box(rubber, [0.227, 0.083, 0.20], [x, 0.055, -0.67], 0.032);
    tube(housing, [[x, 0.14, -0.63], [x, 0.60, -0.65], [x, 1.65, -0.65], [x, 2.52, -0.65],
      [x, 2.71, -0.58], [x, 2.754, -0.40], [x, 2.754, 0.04],
      [x, 2.723, 0.22], [x, 2.63, 0.32], [x, 2.50, 0.34]], 0.093);
    box(graphite, [0.185, 2.32, 0.178], [x, 1.335, -0.50], 0.046);
    box(aluminum, [0.018, 1.965, 0.019], [x + side * 0.097, 1.389, -0.456], 0.006);
    cylinder(chrome, 0.014, 2.239, [inner, 1.292, -0.333]);
    cylinder(chrome, 0.014, 2.239, [inner + side * 0.157, 1.292, -0.333]);
    box(signal, [0.011, 0.455, 0.009], [x + side * 0.097, 1.33, -0.441], 0.003);
    box(signal, [0.011, 0.162, 0.009], [x + side * 0.076, 0.30, -0.44], 0.003);

    for (let i = 0; i < 12; i++) {
      const y = 0.212 + i * 0.049;
      box(graphite, [0.212, 0.038, 0.244], [x, y, -0.288], 0.012);
      cylinder(aluminum, 0.006, 0.007, [x - side * 0.031, y, -0.166], FRONT);
    }
    box(aluminum, [0.212, 0.030, 0.25], [x, 0.793, -0.285], 0.012);

    const wheelX = x - side * 0.041;
    cylinder(graphite, 0.097, 0.082, [wheelX, 2.55, 0.31], FRONT);
    cylinder(aluminum, 0.069, 0.091, [wheelX, 2.55, 0.319], FRONT);
    cylinder(housing, 0.094, 0.079, [wheelX, 1.79, -0.16], FRONT);
    cylinder(aluminum, 0.066, 0.012, [wheelX, 1.79, -0.115], FRONT);
    cylinder(graphite, 0.022, 0.016, [wheelX, 1.79, -0.108], FRONT);
    tube(rubber, [[wheelX, 2.55, 0.359], [wheelX, 2.28, 0.361], [wheelX, 1.74, 0.367], [wheelX, 1.512, 0.374]], 0.006);
    tube(rubber, [[wheelX, 1.518, 0.374], [wheelX - 0.05, 1.438, 0.374], [wheelX - 0.076, 1.350, 0.374],
      [wheelX, 1.337, 0.374], [wheelX + 0.076, 1.350, 0.374], [wheelX + 0.05, 1.438, 0.374],
      [wheelX, 1.518, 0.374]], 0.013);
    cylinder(grip, 0.021, 0.14, [wheelX, 1.343, 0.375], ACROSS);

    tube(graphite, [[0, 2.674, 0.525], [side * 0.34, 2.674, 0.525], [side * 0.58, 2.666, 0.57],
      [side * 0.72, 2.60, 0.71], [side * 0.78, 2.537, 0.763]], 0.024);
  }

  box(housing, [1.56, 0.176, 0.27], [0, 2.747, -0.51], 0.077);
  box(housing, [1.47, 0.125, 0.15], [0, 2.711, 0.199], 0.053);
  box(graphite, [0.723, 0.043, 0.112], [0, 2.644, 0.280], 0.020);
  box(housing, [1.53, 0.081, 0.215], [0, 0.107, -0.59], 0.038);

  const recline = [-0.36, 0, 0];
  box(padding, [0.514, 0.774, 0.126], [0, 0.966, 0.028], 0.055, recline);
  box(padding, [0.439, 0.231, 0.117], [0, 1.432, -0.147], 0.050, recline);
  box(padding, [0.564, 0.105, 0.51], [0, 0.512, 0.413], 0.049, [0.055, 0, 0]);
  box(graphite, [0.527, 0.024, 0.486], [0, 0.474, 0.414], 0.012, [0.055, 0, 0]);
  box(housing, [0.476, 0.045, 0.471], [0, 0.453, 0.390], 0.019);
  box(housing, [0.111, 0.658, 0.078], [0, 0.918, -0.037], 0.034, recline);
  tube(housing, [[0, 0.46, 0.399], [0, 0.36, 0.49], [0, 0.195, 0.604], [0, 0.079, 0.685]], 0.054);
  tube(housing, [[0, 0.46, 0.399], [0, 0.341, 0.207], [0, 0.167, -0.01], [0, 0.076, -0.133]], 0.047);
  for (const z of [-0.133, 0.685]) {
    box(housing, [0.513, 0.073, 0.111], [0, 0.058, z], 0.033);
    for (const side of [-1, 1]) box(rubber, [0.128, 0.064, 0.115], [side * 0.249, 0.047, z], 0.026);
  }
  cylinder(aluminum, 0.058, 0.165, [0, 0.456, 0.184], ACROSS);
  cylinder(graphite, 0.036, 0.027, [0.088, 0.456, 0.184], ACROSS);
}
