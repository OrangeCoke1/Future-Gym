import { ACCENT } from './materials.js';

function stroke(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.stroke();
}

export function paintIcon(ctx, size, id) {
  ctx.scale(size, size);
  ctx.strokeStyle = ctx.fillStyle = '#FFFDF4';
  ctx.lineWidth = 0.047;
  ctx.lineCap = ctx.lineJoin = 'round';

  if (id === 'dumbbell') {
    ctx.translate(0.5, 0.5);
    ctx.rotate(-0.17);
    ctx.translate(-0.5, -0.5);
    stroke(ctx, [[0.27, 0.5], [0.73, 0.5]]);
    for (const [x, length] of [[0.26, 0.29], [0.34, 0.42], [0.66, 0.42], [0.74, 0.29]]) {
      stroke(ctx, [[x, 0.5 - length / 2], [x, 0.5 + length / 2]]);
    }
  } else if (id === 'mat') {
    ctx.beginPath();
    ctx.arc(0.5, 0.255, 0.06, 0, Math.PI * 2);
    ctx.fill();
    stroke(ctx, [[0.35, 0.57], [0.44, 0.46], [0.45, 0.39], [0.55, 0.39], [0.56, 0.46], [0.65, 0.57]]);
    stroke(ctx, [[0.52, 0.48], [0.56, 0.59], [0.69, 0.61], [0.75, 0.7], [0.68, 0.73], [0.32, 0.73],
      [0.25, 0.7], [0.31, 0.61], [0.44, 0.59], [0.48, 0.48]]);
  } else if (id === 'cardio') {
    ctx.beginPath();
    ctx.arc(0.62, 0.25, 0.059, 0, Math.PI * 2);
    ctx.fill();
    stroke(ctx, [[0.33, 0.44], [0.48, 0.35], [0.56, 0.39], [0.61, 0.5], [0.72, 0.45]]);
    stroke(ctx, [[0.56, 0.39], [0.46, 0.54], [0.59, 0.63], [0.67, 0.78]]);
    stroke(ctx, [[0.46, 0.54], [0.38, 0.68], [0.26, 0.74]]);
  } else {
    stroke(ctx, [[0.17, 0.53], [0.3, 0.53], [0.36, 0.42], [0.42, 0.63], [0.5, 0.29],
      [0.56, 0.68], [0.64, 0.49], [0.83, 0.49]]);
  }
}

export function paintCoachOutline(ctx, size) {
  ctx.scale(size, size);
  ctx.lineWidth = 0.005;
  ctx.fillStyle = 'rgba(205,226,255,.14)';
  ctx.strokeStyle = '#EAF2FF';
  ctx.beginPath();
  ctx.ellipse(0.5, 0.12, 0.043, 0.056, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const left = [
    [0.467, 0.17], [0.46, 0.215], [0.375, 0.253], [0.344, 0.317], [0.313, 0.431],
    [0.299, 0.519], [0.335, 0.543], [0.357, 0.491], [0.384, 0.394], [0.41, 0.329],
    [0.424, 0.419], [0.397, 0.507], [0.406, 0.629], [0.423, 0.752], [0.427, 0.871],
    [0.396, 0.907], [0.415, 0.939], [0.478, 0.92], [0.475, 0.872], [0.481, 0.749], [0.5, 0.606],
  ];
  ctx.moveTo(...left[0]);
  for (const xy of left.slice(1)) ctx.lineTo(...xy);
  for (const [x, y] of left.slice(0, -1).reverse()) ctx.lineTo(1 - x, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(196,220,252,.46)';
  ctx.lineWidth = 0.0025;
  stroke(ctx, [[0.5, 0.218], [0.5, 0.447], [0.46, 0.548], [0.445, 0.737], [0.46, 0.887]]);
  stroke(ctx, [[0.5, 0.447], [0.54, 0.548], [0.555, 0.737], [0.54, 0.887]]);
  stroke(ctx, [[0.385, 0.297], [0.46, 0.329], [0.54, 0.329], [0.615, 0.297]]);
  stroke(ctx, [[0.417, 0.467], [0.5, 0.495], [0.583, 0.467]]);
}

export function paintFitnessPanel(ctx, size) {
  ctx.scale(size, size);
  const glass = ctx.createLinearGradient(0, 0, 1, 0.88);
  glass.addColorStop(0, '#26354C');
  glass.addColorStop(0.47, '#101B2E');
  glass.addColorStop(1, '#1F3048');
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, 1, 1);
  ctx.lineWidth = 0.002;
  ctx.strokeStyle = 'rgba(177,203,239,.16)';
  for (let i = 1; i < 10; i++) {
    const v = i / 10;
    stroke(ctx, [[0.045, v], [0.497, v]]);
    stroke(ctx, [[0.05 + v * 0.45, 0.06], [0.05 + v * 0.45, 0.94]]);
  }

  ctx.fillStyle = 'rgba(176,208,246,.065)';
  ctx.strokeStyle = 'rgba(183,209,245,.28)';
  for (let i = 0; i < 3; i++) {
    const y = 0.10 + i * 0.268;
    ctx.beginPath();
    ctx.roundRect(0.595, y, 0.342, 0.219, 0.023);
    ctx.fill();
    ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28 - 0.25) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.strokeStyle = i < 12 ? ACCENT : 'rgba(205,225,250,.32)';
    stroke(ctx, [[0.681 + dx * 0.039, 0.214 + dy * 0.065], [0.681 + dx * 0.056, 0.214 + dy * 0.096]]);
  }
  ctx.save();
  ctx.translate(0.681, 0.214);
  ctx.scale(0.57, 0.55);
  ctx.translate(-0.681, -0.197);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(0.683, 0.256);
  ctx.bezierCurveTo(0.624, 0.196, 0.634, 0.142, 0.659, 0.146);
  ctx.quadraticCurveTo(0.676, 0.145, 0.683, 0.172);
  ctx.quadraticCurveTo(0.699, 0.135, 0.717, 0.15);
  ctx.bezierCurveTo(0.741, 0.173, 0.718, 0.219, 0.683, 0.256);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#EAF2FF';
  ctx.lineWidth = 0.006;
  stroke(ctx, [[0.737, 0.214], [0.761, 0.214], [0.775, 0.183], [0.788, 0.247], [0.804, 0.157],
    [0.815, 0.252], [0.832, 0.212], [0.897, 0.212]]);
  for (const [i, h] of [0.061, 0.091, 0.065, 0.116, 0.09, 0.151, 0.104, 0.137, 0.081, 0.115].entries()) {
    ctx.fillStyle = i % 3 ? '#91AACC' : '#EAF2FF';
    ctx.fillRect(0.626 + i * 0.028, 0.556 - h, 0.016, h);
  }
  ctx.lineWidth = 0.013;
  ctx.strokeStyle = ACCENT;
  ctx.beginPath();
  ctx.ellipse(0.68, 0.744, 0.038, 0.068, 0, -Math.PI * 0.26, Math.PI * 1.29);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(211,229,253,.44)';
  ctx.lineWidth = 0.004;
  for (const [i, end] of [0.881, 0.852, 0.903, 0.815].entries()) {
    const y = 0.696 + i * 0.028;
    stroke(ctx, [[0.749, y], [end, y]]);
  }
}

export function paintGrille(ctx, size) {
  ctx.scale(size, size);
  ctx.fillStyle = 'rgba(36,46,43,.74)';
  for (let row = 0; row < 33; row++) {
    for (let col = 0; col < 18; col++) {
      const x = 0.049 + col * 0.052, y = 0.032 + row * 0.029;
      ctx.beginPath();
      ctx.roundRect(x, y, 0.015, 0.016, 0.004);
      ctx.fill();
    }
  }
}
