import * as THREE from 'three';

export const DARK = '#0B0F12';

function floorMark() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ink = canvas.getContext('2d');
  ink.translate(512, 512);
  ink.lineWidth = 2;
  for (const r of [162, 245, 390, 464, 474]) {
    ink.strokeStyle = r > 400 ? '#35525b' : '#23373f';
    ink.beginPath();
    ink.arc(0, 0, r, 0, Math.PI * 2);
    ink.stroke();
  }
  for (let i = 0; i < 72; i++) {
    ink.rotate(Math.PI / 36);
    ink.strokeStyle = i % 6 ? '#476771' : '#a9cbd0';
    ink.beginPath();
    ink.moveTo(428, 0);
    ink.lineTo(i % 6 ? 436 : 450, 0);
    ink.stroke();
  }
  ink.fillStyle = '#78959b';
  ink.font = '600 58px sans-serif';
  ink.textAlign = 'center';
  ink.fillText('2126', 0, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

export function lightRoom(scene) {
  const key = new THREE.DirectionalLight('#EAF6FF', 1.65);
  key.position.set(-3, 6, 4);
  scene.add(new THREE.HemisphereLight('#EAF6FF', '#1D231E', 1.2), key);
}

export function buildGymRoom(scene) {
  scene.background = new THREE.Color(DARK);
  scene.fog = new THREE.Fog(DARK, 8, 22);
  lightRoom(scene);

  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(6, 14, 24, 64),
    new THREE.MeshStandardMaterial({ color: '#10151A', side: THREE.BackSide }),
  );
  hull.rotation.x = Math.PI / 2;
  scene.add(hull);

  const deck = new THREE.Mesh(new THREE.PlaneGeometry(12, 26), new THREE.MeshStandardMaterial({ color: '#19252a' }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -0.025;
  scene.add(deck);
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 11.5),
    new THREE.MeshBasicMaterial({ map: floorMark(), transparent: true, depthWrite: false }),
  );
  mark.rotation.x = -Math.PI / 2;
  scene.add(mark);

  const ribMaterial = new THREE.MeshStandardMaterial({ color: '#293b43', metalness: 0.45, roughness: 0.55 });
  const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(5.91, 0.063, 6, 64, Math.PI), ribMaterial, 24);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < ribs.count; i++) ribs.setMatrixAt(i, matrix.makeTranslation(0, 0, -7 + 14 * i / 23));
  scene.add(ribs);

  const glow = new THREE.MeshBasicMaterial({ color: '#8dd1dc' });
  const portal = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.035, 6, 64, Math.PI), glow);
  portal.position.set(0, 0, -10.9);
  scene.add(portal);
  const bulkhead = new THREE.Mesh(new THREE.TorusGeometry(2.61, 0.095, 8, 64, Math.PI), ribMaterial);
  bulkhead.position.copy(portal.position);
  scene.add(bulkhead);

  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.04, 1.68), glow, 22);
  for (let i = 0; i < 11; i++) {
    for (const [side, sign] of [-1, 1].entries()) {
      strips.setMatrixAt(i * 2 + side, matrix.makeTranslation(sign * 5.63, 0.055, -10 + i * 1.9));
    }
  }
  scene.add(strips);

  const positions = new Float32Array(800 * 3);
  const colors = new Float32Array(positions.length);
  const pale = new THREE.Color('#EAF6FF'), blue = new THREE.Color('#2563D0');
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (Math.random() - 0.5) * 10;
    positions[i + 1] = Math.random() * 5;
    positions[i + 2] = (Math.random() - 0.5) * 22;
    (i % 9 ? blue : pale).toArray(colors, i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({
    vertexColors: true, size: 0.026, transparent: true, opacity: 0.62,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(dust);
  return dust;
}
