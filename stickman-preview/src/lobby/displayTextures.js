function stroke(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.stroke();
}

export function paintIcon(ctx, size, id) {
  ctx.scale(size, size);
  ctx.strokeStyle = '#FDF2FF';
  ctx.fillStyle = '#FDF2FF';
  ctx.lineWidth = 0.054;
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
  ctx.fillStyle = 'rgba(220,199,255,.14)';
  ctx.strokeStyle = '#E9D8FF';
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
  ctx.strokeStyle = 'rgba(223,208,255,.43)';
  ctx.lineWidth = 0.0025;
  stroke(ctx, [[0.5, 0.218], [0.5, 0.447], [0.46, 0.548], [0.445, 0.737], [0.46, 0.887]]);
  stroke(ctx, [[0.5, 0.447], [0.54, 0.548], [0.555, 0.737], [0.54, 0.887]]);
  stroke(ctx, [[0.385, 0.297], [0.46, 0.329], [0.54, 0.329], [0.615, 0.297]]);
  stroke(ctx, [[0.417, 0.467], [0.5, 0.495], [0.583, 0.467]]);
}

export function paintFitnessPanel(ctx, size) {
  ctx.scale(size, size);
  const glass = ctx.createLinearGradient(0, 0, 1, 0.88);
  glass.addColorStop(0, '#554568');
  glass.addColorStop(0.54, '#6B5886');
  glass.addColorStop(1, '#83709D');
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, 1, 1);
  ctx.lineWidth = 0.002;
  ctx.strokeStyle = 'rgba(243,221,255,.115)';
  for (let i = 1; i < 10; i++) {
    const v = i / 10;
    stroke(ctx, [[0.045, v], [0.497, v]]);
    stroke(ctx, [[0.05 + v * 0.45, 0.06], [0.05 + v * 0.45, 0.94]]);
  }

  ctx.fillStyle = 'rgba(229,206,255,.08)';
  ctx.strokeStyle = 'rgba(238,215,255,.37)';
  for (let i = 0; i < 3; i++) {
    const y = 0.10 + i * 0.268;
    ctx.beginPath();
    ctx.roundRect(0.595, y, 0.342, 0.219, 0.045);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#F7E9FF';
  ctx.beginPath();
  ctx.moveTo(0.683, 0.256);
  ctx.bezierCurveTo(0.624, 0.196, 0.634, 0.142, 0.659, 0.146);
  ctx.quadraticCurveTo(0.676, 0.145, 0.683, 0.172);
  ctx.quadraticCurveTo(0.699, 0.135, 0.717, 0.15);
  ctx.bezierCurveTo(0.741, 0.173, 0.718, 0.219, 0.683, 0.256);
  ctx.fill();
  ctx.strokeStyle = '#E9D7FF';
  ctx.lineWidth = 0.006;
  stroke(ctx, [[0.737, 0.214], [0.761, 0.214], [0.775, 0.183], [0.788, 0.247], [0.804, 0.157],
    [0.815, 0.252], [0.832, 0.212], [0.897, 0.212]]);
  for (const [i, h] of [0.061, 0.091, 0.065, 0.116, 0.09, 0.151, 0.104, 0.137, 0.081, 0.115].entries()) {
    ctx.fillStyle = i % 3 ? '#E3CCFF' : '#FBF2FF';
    ctx.fillRect(0.626 + i * 0.028, 0.556 - h, 0.016, h);
  }
  ctx.lineWidth = 0.013;
  ctx.strokeStyle = '#F7E9FF';
  ctx.beginPath();
  ctx.ellipse(0.68, 0.744, 0.038, 0.068, 0, -Math.PI * 0.26, Math.PI * 1.29);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(243,222,255,.42)';
  ctx.lineWidth = 0.004;
  for (const [i, end] of [0.881, 0.852, 0.903, 0.815].entries()) {
    const y = 0.696 + i * 0.028;
    stroke(ctx, [[0.749, y], [end, y]]);
  }
}

export function paintCity(ctx, size, random) {
  ctx.scale(size, size);
  const sky = ctx.createLinearGradient(0, 0, 0, 1);
  sky.addColorStop(0, '#6F71AA');
  sky.addColorStop(0.36, '#A29BCB');
  sky.addColorStop(0.73, '#F2B7D0');
  sky.addColorStop(1, '#DBA0C4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1, 1);

  for (let i = 0; i < 28; i++) {
    const x = random(), y = 0.18 + random() * 0.44;
    const w = 0.019 + random() * 0.12, h = 0.009 + random() * 0.016;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w, h);
    const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    cloud.addColorStop(0, 'rgba(255,205,235,.30)');
    cloud.addColorStop(1, 'rgba(255,205,235,0)');
    ctx.fillStyle = cloud;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function tower(x, base, w, height, layer, spire) {
    const top = base - height;
    const inset = 0.002 + w * 0.16;
    const colors = [['#B496BC', '#C6A0BD'], ['#7E76AB', '#A48AB2'], ['#4D567E', '#7A7098']][layer];
    const facade = ctx.createLinearGradient(x, 0, x + w, 0);
    facade.addColorStop(0, colors[0]);
    facade.addColorStop(0.69, colors[0]);
    facade.addColorStop(0.71, colors[1]);
    facade.addColorStop(1, colors[1]);
    ctx.fillStyle = facade;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, top + height * 0.11);
    ctx.lineTo(x + inset, top + height * 0.065);
    ctx.lineTo(x + inset, top);
    ctx.lineTo(x + w - inset, top);
    ctx.lineTo(x + w - inset, top + height * 0.06);
    ctx.lineTo(x + w, top + height * 0.11);
    ctx.lineTo(x + w, base);
    ctx.closePath();
    ctx.fill();
    if (spire) {
      ctx.fillRect(x + w * 0.44, top - height * 0.10, w * 0.1, height * 0.13);
      ctx.fillStyle = 'rgba(255,221,241,.72)';
      ctx.fillRect(x + w * 0.48, top - height * 0.145, Math.max(w * 0.034, 0.0006), height * 0.088);
    }

    const pitch = 0.0105 - layer * 0.0013;
    const columns = Math.max(2, Math.floor(w / 0.004));
    for (let y = top + height * 0.14; y < base - pitch; y += pitch) {
      for (let i = 0; i < columns; i++) {
        const q = random();
        if (q > (layer ? 0.37 : 0.22)) continue;
        ctx.fillStyle = q < 0.075 ? 'rgba(253,225,238,.72)' : q < 0.18 ? 'rgba(181,177,245,.54)' : 'rgba(250,175,206,.51)';
        ctx.fillRect(x + w * (i + 0.4) / columns, y, w * 0.36 / columns, pitch * 0.25);
      }
    }
  }

  for (const [layer, count] of [44, 38, 31].entries()) {
    for (let i = 0; i < count; i++) {
      const x = i / count + random() * 0.015 - 0.015;
      const w = 0.012 + random() * (0.025 + layer * 0.008);
      const height = 0.067 + random() * (0.16 + layer * 0.034);
      tower(x, 0.85 + layer * 0.078 + random() * 0.04, w, height, layer, random() > 0.73);
    }
    if (layer === 1) {
      tower(0.309, 0.99, 0.051, 0.671, layer, true);
      tower(0.681, 1.00, 0.039, 0.456, layer, true);
    }
    if (layer === 2) {
      tower(0.076, 1.00, 0.031, 0.353, layer, true);
      tower(0.823, 1.00, 0.045, 0.409, layer, true);
    }
  }

  for (const [x, y, scale] of [[0.805, 0.313, 1], [0.552, 0.552, 0.53], [0.222, 0.583, 0.29]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(-0.14);
    ctx.fillStyle = 'rgba(73,72,124,.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.16, 0.042, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(252,224,255,.86)';
    ctx.lineWidth = 0.007;
    ctx.beginPath();
    ctx.ellipse(0, -0.004, 0.171, 0.041, 0, Math.PI * 0.08, Math.PI * 1.32);
    ctx.stroke();
    ctx.restore();
  }
}

export function paintGrille(ctx, size) {
  ctx.scale(size, size);
  ctx.fillStyle = 'rgba(54,44,75,.63)';
  for (let row = 0; row < 33; row++) {
    for (let col = 0; col < 18; col++) {
      const x = 0.049 + col * 0.052, y = 0.032 + row * 0.029;
      ctx.beginPath();
      ctx.roundRect(x, y, 0.015, 0.016, 0.004);
      ctx.fill();
    }
  }
}
