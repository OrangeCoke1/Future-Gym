import { CanvasTexture, LinearEncoding, RepeatWrapping, sRGBEncoding } from 'three';
import { paintCity, paintCoachOutline, paintFitnessPanel, paintGrille, paintIcon } from './displayTextures.js';
import { ACCENT } from './materials.js';

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

function spaceTexture(ctx, size, panorama) {
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#121820');
  sky.addColorStop(1, '#06080A');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  const random = lobbyRandom(2126);
  const stars = panorama ? 800 : 300;
  for (let i = 0; i < stars; i++) {
    const x = random() * size, y = random() * size;
    const r = (0.16 + random() * 0.72) * size / 512;
    ctx.fillStyle = `rgba(255,247,228,${0.24 + random() * 0.66})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (i % 20 !== 0) continue;
    ctx.fillStyle = 'rgba(225,230,244,.28)';
    ctx.fillRect(x - r * 3, y - r * 0.32, r * 6, r * 0.64);
    ctx.fillRect(x - r * 0.32, y - r * 3, r * 0.64, r * 6);
  }

  const x = size * (panorama ? 0.79 : 0.63), y = size * (panorama ? 0.71 : 1.43);
  const radius = size * (panorama ? 0.154 : 0.77);
  const limb = ctx.createRadialGradient(x, y, radius * 0.95, x, y, radius * 1.075);
  limb.addColorStop(0, '#0C1017');
  limb.addColorStop(0.38, '#3B4C65');
  limb.addColorStop(0.58, 'rgba(96,119,149,.44)');
  limb.addColorStop(1, 'rgba(96,119,149,0)');
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.075, 0, Math.PI * 2);
  ctx.fill();
}

function panelTexture(ctx, size) {
  ctx.fillStyle = '#F8F9F5';
  ctx.fillRect(0, 0, size, size);
  const seam = Math.max(1, size * 0.0016);
  for (const offset of [0.23, 0.43, 0.58, 0.78]) {
    ctx.fillStyle = '#C6CBC1';
    ctx.fillRect(offset * size, 0, seam, size);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(offset * size + seam, 0, seam, size);
  }
  for (const offset of [0.27, 0.53, 0.76]) {
    ctx.fillStyle = '#C6CBC1';
    ctx.fillRect(0, offset * size, size, seam);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, offset * size + seam, size, seam);
  }
}

function floorTexture(ctx, size) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const random = lobbyRandom(22);
  ctx.fillStyle = 'rgba(44,48,40,.09)';
  for (let i = 0; i < 2800; i++) {
    const grain = 0.5 + random() * size / 700;
    ctx.fillRect(random() * size, random() * size, grain, grain);
  }
  ctx.fillStyle = '#D9DED4';
  for (const x of [0.22, 0.78]) ctx.fillRect(x * size, 0, size * 0.0016, size);
  for (const y of [0.22, 0.5, 0.78]) ctx.fillRect(0, y * size, size, size * 0.0018);
}

function hullSeamTexture(ctx, size) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#BEBAAE';
  ctx.lineWidth = size * 0.0025;
  ctx.beginPath();
  for (const y of [0.20, 0.49, 0.78]) {
    ctx.moveTo(0, y * size);
    ctx.lineTo(size, y * size);
  }
  for (const x of [0.125, 0.625]) {
    ctx.moveTo(x * size, 0);
    ctx.lineTo(x * size, size);
  }
  ctx.stroke();
  ctx.translate(size * 0.273, size * 0.383);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `600 ${Math.round(size * 0.024)}px sans-serif`;
  ctx.fillStyle = '#54584F';
  ctx.textAlign = 'center';
  ctx.fillText('FG-2126', 0, 0);
}

function beltTexture(ctx, size) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#A4A39C';
  for (let i = 0; i < 44; i++) ctx.fillRect(0, i * size / 44, size, size / 330);
}

function screenTexture(ctx, size) {
  ctx.fillStyle = '#111B17';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size, size);
  ctx.strokeStyle = 'rgba(200,211,192,.25)';
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
  ctx.fillStyle = '#F1F0E2';
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
  return {
    panels: () => get('panels', 1024, panelTexture),
    floor: () => get('floor', 1024, floorTexture),
    space: (wide = false) => get(wide ? 'sky' : 'porthole', 1024, (ctx, size) => spaceTexture(ctx, size, wide)),
    hull: () => get('hull', 1024, hullSeamTexture),
    shadow: () => get('shadow', 256, (ctx, size) => radial(ctx, size, [
      [0, 'rgba(30,32,28,.45)'], [0.55, 'rgba(30,32,28,.29)'], [1, 'rgba(30,32,28,0)'],
    ])),
    door: () => get('door', 256, (ctx, size) => radial(ctx, size, [
      [0, '#FFF6E8'], [0.64, '#FFEAD1'], [1, '#B98962'],
    ])),
    wash: () => get('wash', 128, (ctx, size) => {
      const tint = ctx.createLinearGradient(0, 0, size, 0);
      tint.addColorStop(0, 'rgba(255,233,189,.52)');
      tint.addColorStop(1, 'rgba(255,233,189,0)');
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
    city: () => get('city', 1024, (ctx, size) => paintCity(ctx, size, lobbyRandom(2126))),
    fitness: () => get('fitness', 512, paintFitnessPanel),
    coachOutline: () => get('coach-outline', 512, paintCoachOutline),
    icon: id => get(`icon-${id}`, 128, (ctx, size) => paintIcon(ctx, size, id)),
    grille: () => get('grille', 256, paintGrille),
    dispose() {
      for (const map of maps.values()) map.dispose();
      maps.clear();
    },
  };
}
