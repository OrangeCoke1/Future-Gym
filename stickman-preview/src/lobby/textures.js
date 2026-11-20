import { CanvasTexture, LinearEncoding, LinearFilter, RepeatWrapping, sRGBEncoding } from 'three';
import { paintCoachOutline, paintFitnessPanel, paintGrille, paintIcon } from './displayTextures.js';
import { ACCENT, NAVY } from './materials.js';

export function lobbyRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function radial(ctx, size, stops) {
  const mid = size / 2;
  const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  for (const [offset, fill] of stops) gradient.addColorStop(offset, fill);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

function panelTexture(ctx, size) {
  ctx.fillStyle = '#F5F7FB';
  ctx.fillRect(0, 0, size, size);
  ctx.scale(size, size);
  ctx.lineWidth = 0.0037;
  ctx.strokeStyle = '#8291A6';
  for (const x of [0.21, 0.39, 0.61, 0.79]) {
    const slope = x < 0.5 ? 0.03 : -0.03;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 0.20);
    ctx.lineTo(x + slope, 0.254);
    ctx.lineTo(x + slope, 0.75);
    ctx.lineTo(x, 0.81);
    ctx.lineTo(x, 1);
    ctx.stroke();
  }
  ctx.strokeRect(0, 0.43, 1, 0.122);
}

function floorTexture(ctx, size) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const random = lobbyRandom(22);
  ctx.fillStyle = 'rgba(34,48,68,.12)';
  for (let i = 0; i < 2800; i++) {
    const grain = 0.5 + random() * size / 700;
    ctx.fillRect(random() * size, random() * size, grain, grain);
  }
  ctx.fillStyle = '#A5B2C5';
  for (const x of [0.11, 0.24, 0.76, 0.89]) ctx.fillRect(x * size, 0, size * 0.0026, size);
  for (const y of [0.22, 0.5, 0.78]) ctx.fillRect(0, y * size, size, size * 0.0023);
}

function capsuleTexture(ctx, size) {
  ctx.fillStyle = '#F1F4FB';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size, size);
  ctx.strokeStyle = '#76859B';
  ctx.lineWidth = 0.0034;
  for (const x of [0.105, 0.415, 0.585, 0.895]) {
    ctx.beginPath();
    ctx.moveTo(x, 0.105);
    ctx.lineTo(x, 0.255);
    ctx.lineTo(x + 0.026, 0.298);
    ctx.lineTo(x + 0.026, 0.718);
    ctx.lineTo(x, 0.761);
    ctx.lineTo(x, 0.91);
    ctx.stroke();
  }
  ctx.restore();
  ctx.translate(size * 0.265, size * 0.478);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic bold ${Math.round(size * 0.075)}px Arial, sans-serif`;
  ctx.fillText('A.I.M.S.', 0, 0, size * 0.34);
}

function beltTexture(ctx, size) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#A4A39C';
  for (let i = 0; i < 44; i++) ctx.fillRect(0, i * size / 44, size, size / 330);
}

function screenTexture(ctx, size) {
  ctx.fillStyle = '#131D2D';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size, size);
  ctx.strokeStyle = 'rgba(180,204,237,.25)';
  ctx.lineWidth = 0.0025;
  for (let i = 1; i < 5; i++) {
    const y = 0.12 + i * 0.145;
    ctx.beginPath();
    ctx.moveTo(0.07, y);
    ctx.lineTo(0.93, y);
    ctx.stroke();
  }
  const graph = [[0.088, .68], [.15, .62], [.21, .65], [.28, .51], [.33, .55], [.40, .38],
    [.46, .49], [.52, .43], [.56, .54], [.64, .41], [.70, .52], [.79, .36], [.84, .45], [.91, .31]];
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(...graph[0]);
  for (const point of graph.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#EAF2FF';
  ctx.font = `600 ${Math.round(size * 0.108)}px sans-serif`;
  ctx.fillText('6.5 KM/H', size * 0.08, size * 0.275);
}

function knurlTexture(ctx, size) {
  ctx.fillStyle = '#E8E8E8';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = Math.max(1, size / 96);
  const gap = size / 24;
  ctx.beginPath();
  for (let x = -size; x <= size * 2; x += gap) {
    ctx.moveTo(x - size, 0);
    ctx.lineTo(x, size);
    ctx.moveTo(x + size, 0);
    ctx.lineTo(x, size);
  }
  ctx.stroke();
}

function grainTexture(ctx, size) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const random = lobbyRandom(73);
  for (let i = 0; i < 4700; i++) {
    ctx.fillStyle = i % 2 ? '#9D9D9D' : '#646464';
    ctx.fillRect(random() * size, random() * size, size / 295, size / 295);
  }
}

function rollerTexture(ctx, size) {
  ctx.fillStyle = '#A0A0A0';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#525252';
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 24; col++) {
      const x = ((col + (row % 2 ? 0.55 : 0.15)) / 24) * size;
      const y = ((row + 0.5) / 12) * size;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.01, size * 0.021, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function createLobbyTextures(detailed) {
  const maps = new Map();
  const limit = detailed ? 1024 : 512;
  let skyline, cityReady = false;
  function get(key, size, paint, linear = false) {
    if (maps.has(key)) return maps.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(size, limit);
    paint(canvas.getContext('2d'), canvas.width);
    const map = new CanvasTexture(canvas);
    map.encoding = linear ? LinearEncoding : sRGBEncoding;
    maps.set(key, map);
    return map;
  }

  function city() {
    const map = get('city', 32, (ctx, size) => {
      const sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, '#8DA9C6');
      sky.addColorStop(1, '#526880');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, size);
    });
    if (!skyline) {
      map.minFilter = LinearFilter;
      map.generateMipmaps = false;
      skyline = new Image();
      skyline.onload = () => {
        map.image = skyline;
        map.needsUpdate = true;
        cityReady = true;
      };
      skyline.onerror = () => { cityReady = true; };
      skyline.src = `${import.meta.env.BASE_URL}models/lobby-skyline.webp`;
    }
    return map;
  }

  return {
    panels: () => get('panels', 1024, panelTexture),
    floor: () => get('floor', 1024, floorTexture),
    capsuleSkin: () => get('capsule-skin', 1024, capsuleTexture),
    shadow: () => get('shadow', 256, (ctx, size) => radial(ctx, size, [
      [0, 'rgba(13,21,34,.54)'], [0.55, 'rgba(13,21,34,.32)'], [1, 'rgba(13,21,34,0)'],
    ])),
    wash: () => get('wash', 128, (ctx, size) => {
      const tint = ctx.createLinearGradient(0, 0, size, 0);
      tint.addColorStop(0, 'rgba(204,227,255,.52)');
      tint.addColorStop(1, 'rgba(204,227,255,0)');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, size, size);
    }),
    belt() {
      const map = get('belt', 512, beltTexture);
      map.wrapT = RepeatWrapping;
      map.repeat.y = 4;
      return map;
    },
    screen: () => get('console', 512, screenTexture),
    knurl: () => get('knurl', 128, knurlTexture, true),
    grain: () => get('grain', 256, grainTexture, true),
    roller: () => get('roller', 256, rollerTexture, true),
    city,
    cityReady: () => cityReady,
    wordmark: () => get('wordmark', 512, (ctx, size) => {
      ctx.fillStyle = NAVY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `italic 900 ${Math.round(size * 0.23)}px Arial, sans-serif`;
      ctx.fillText('A.I.M.S.', size / 2, size / 2, size * 0.86);
    }),
    fitness: () => get('fitness', 512, paintFitnessPanel),
    coachOutline: () => get('coach-outline', 512, paintCoachOutline),
    icon: id => get(`icon-${id}`, 128, (ctx, size) => paintIcon(ctx, size, id)),
    grille: () => get('grille', 256, paintGrille),
    dispose() {
      if (skyline) skyline.onload = skyline.onerror = null;
      for (const map of maps.values()) map.dispose();
      maps.clear();
    },
  };
}
