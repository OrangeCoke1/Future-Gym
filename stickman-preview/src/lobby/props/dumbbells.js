import { TorusGeometry } from 'three';
import { lathe, roundedBorder, roundedPane } from './geometry.js';

const LONG = [Math.PI / 2, 0, 0];

const dumbbellHead = [
  [0, -0.035], [0.064, -0.035], [0.080, -0.029], [0.089, -0.014], [0.091, 0.012],
  [0.086, 0.030], [0.069, 0.041], [0, 0.041],
];
const bellProfile = [
  [0, 0], [0.052, 0], [0.076, 0.009], [0.096, 0.039], [0.104, 0.084],
  [0.098, 0.135], [0.065, 0.165], [0, 0.171],
];

export function buildDumbbells({ batch, materials, signal, detailed }) {
  const { add, box, cylinder, tube } = batch;
  const { housing, graphite, aluminum, chrome, grip, rubber, padding, roller } = materials;
  const segments = detailed ? 32 : 18;
  const width = 2.70, depth = 0.72;

  box(housing, [width, 0.075, depth], [0, 1.09, 0], 0.035);
  box(housing, [width, 0.089, depth], [0, 0.055, 0], 0.042);
  box(housing, [width - 0.15, 0.064, depth - 0.04], [0, 0.528, 0.011], 0.023);
  for (const x of [-1.301, 1.301]) box(housing, [0.098, 1.05, depth - 0.019], [x, 0.563, 0], 0.045);
  add(roundedPane(width - 0.10, 1.054, 0.13, detailed), padding, [0, 0.554, -0.351]);
  add(roundedBorder(width + 0.02, 1.118, 0.166, 0.078, detailed), housing, [0, 0.568, 0.35]);
  add(roundedBorder(width - 0.124, 0.978, 0.12, 0.013, detailed), signal, [0, 0.567, 0.358]);

  for (let i = 0; i < 5; i++) {
    const x = -0.89 + i * 0.408;
    const scale = 1.05 - i * 0.07, h = 0.573 + 0.091 * scale;
    cylinder(grip, 0.017, 0.15, [x, h, 0.005], LONG);
    for (const side of [-1, 1]) {
      const z = side * 0.097;
      const direction = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      add(lathe(dumbbellHead.map(pair => pair.map(value => value * scale)), segments), aluminum, [x, h, z],
        [direction, 0, 0]);
      cylinder(graphite, 0.050 * scale, 0.009, [x, h, z + side * 0.04], LONG);
    }
    add(new TorusGeometry(0.033 * scale, 0.0033, 6, 24), signal, [x, h, 0.144]);
  }

  for (const [x, scale] of [[-0.73, 1.12], [-0.43, 0.94]]) {
    add(lathe(bellProfile.map(pair => pair.map(value => value * scale)), segments), graphite, [x, 0.108, 0.056]);
    tube(chrome, [[x - 0.057 * scale, 0.24, 0.056], [x - 0.068 * scale, 0.29, 0.056],
      [x - 0.039, 0.314 * scale, 0.056], [x + 0.035, 0.314 * scale, 0.056],
      [x + 0.066 * scale, 0.29, 0.056], [x + 0.055 * scale, 0.24, 0.056]], 0.014);
  }
  cylinder(roller, 0.081, 0.455, [0.449, 0.191, -0.033], [0.09, 0, Math.PI / 2]);
  cylinder(padding, 0.052, 0.017, [0.680, 0.191, -0.033], [0, 0, Math.PI / 2]);

  const bottle = lathe([
    [0, 0], [0.046, 0.001], [0.053, 0.017], [0.053, 0.179], [0.044, 0.203], [0.032, 0.206],
  ], segments);
  add(bottle, housing, [0.224, 1.128, 0.103]);
  cylinder(graphite, 0.039, 0.031, [0.224, 1.349, 0.103]);
  box(rubber, [0.030, 0.013, 0.025], [0.229, 1.369, 0.103], 0.005);
  cylinder(graphite, 0.102, 0.141, [-0.648, 1.212, 0.095]);
  cylinder(housing, 0.106, 0.024, [-0.648, 1.144, 0.095]);
  add(new TorusGeometry(0.101, 0.004, 8, 36), signal, [-0.648, 1.276, 0.095], LONG);
}
