// The room: floor, walls, ceiling light strips, the round display tables and the stands.
// Palette: warm stone floor, warm off-white walls with one charcoal feature wall,
// light-oak table tops on off-white bases, white stands.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { MM } from './phone.js';

export const TABLE = { height: 0.9, radius: 0.62, standRadius: 0.45 };
export const WORK_TABLE = { center: new THREE.Vector3(1.9, 0, -3.3), height: 0.9, radius: 0.45, standRadius: 0.3 };
export const STAND_LEAN = THREE.MathUtils.degToRad(11);

export const PALETTE = {
  floor: '#7A5436',   // smoked oak planks
  wall: '#D2B48C',    // light oak slats
  ceiling: '#EDE8E0',
  marble: '#F4F4F2',
  stand: '#FBFAF7',
  fog: '#CDBBA5',
};

const standMat = new THREE.MeshPhysicalMaterial({ color: PALETTE.stand, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
const metal = new THREE.MeshStandardMaterial({ color: '#C4C7CB', roughness: 0.22, metalness: 1 });

// ---- procedural textures (no downloads needed) ----
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

/** Wood planks running left-right, with grain, tone variation and staggered joints. */
function planksTexture({ base, planks = 8, S = 1024, seed = 7, joints = true, gap = 1.5, knots = true, grain = 1 }) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  const rnd = rng(seed);
  const ph = S / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    const tone = (rnd() - 0.5) * 30;
    g.fillStyle = tone > 0 ? `rgba(255,225,190,${tone / 220})` : `rgba(40,25,10,${-tone / 180})`;
    g.fillRect(0, y0, S, ph);
    for (let i = 0; i < 55; i++) {
      const y = y0 + rnd() * ph;
      const amp = 1 + rnd() * 4, freq = 0.003 + rnd() * 0.008, off = rnd() * 10;
      g.strokeStyle = `rgba(${50 + rnd() * 40},${30 + rnd() * 25},12,${(0.06 + rnd() * 0.14) * grain})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      for (let x = 0; x <= S; x += 12) {
        const yy = y + Math.sin(x * freq + off) * amp;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    // knots
    if (knots && rnd() > 0.6) {
      const kx = rnd() * S, ky = y0 + ph / 2;
      const rg = g.createRadialGradient(kx, ky, 0, kx, ky, ph * 0.25);
      rg.addColorStop(0, 'rgba(40,22,8,0.45)'); rg.addColorStop(1, 'rgba(40,22,8,0)');
      g.fillStyle = rg; g.fillRect(kx - ph, ky - ph, ph * 2, ph * 2);
    }
    g.fillStyle = 'rgba(20,12,4,0.55)';
    g.fillRect(0, y0, S, gap);
    if (joints) {
      const jx = rnd() * S;
      g.fillRect(jx, y0, gap, ph);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** White marble with soft grey veins. */
function marbleTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.marble;
  g.fillRect(0, 0, S, S);
  const rnd = rng(19);
  // cloudy base
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = 60 + rnd() * 220;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(180,176,170,${0.04 + rnd() * 0.05})`); rg.addColorStop(1, 'rgba(180,176,170,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // veins
  const vein = (w, a) => {
    let x = rnd() * S, y = rnd() * S * 0.2 - S * 0.1;
    g.strokeStyle = `rgba(110,106,100,${a})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y);
    while (y < S * 1.1) {
      x += (rnd() - 0.4) * 60; y += 20 + rnd() * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  };
  g.filter = 'blur(3px)';
  for (let i = 0; i < 6; i++) vein(1.5 + rnd() * 3, 0.14 + rnd() * 0.1);
  g.filter = 'blur(0.6px)';
  for (let i = 0; i < 10; i++) vein(0.6 + rnd() * 1.0, 0.1 + rnd() * 0.1);
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let marbleMat = null;
function roundTable(radius, height) {
  marbleMat ??= new THREE.MeshPhysicalMaterial({ map: marbleTexture(), roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.15 });
  const g = new THREE.Group();
  const topT = 0.035;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, topT, 128), marbleMat);
  top.position.y = height - topT / 2;
  const baseH = height - topT - 0.003;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, baseH, 96), marbleMat);
  base.position.y = baseH / 2 + 0.002; // clear of the floor and the top: no coplanar faces
  for (const m of [top, base]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

/**
 * A display stand. Its group origin sits on the table top; `mount` is where
 * the phone's centre goes (already leaned back). The stand faces +z.
 */
export function makeStand(phoneH = 0.13) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.012, 0.06, 4, 0.004), standMat);
  base.position.y = 0.0065; // 0.5 mm clear of the table top
  base.castShadow = true; base.receiveShadow = true;
  const POST = 0.032;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, POST, 20), metal);
  post.position.set(0, 0.012 + POST / 2, -0.008);
  post.castShadow = true;
  const cradle = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.03, 0.004, 3, 0.0015), metal);
  cradle.position.set(0, 0.012 + POST, -0.008);
  cradle.rotation.x = -STAND_LEAN;
  g.add(base, post, cradle);
  const mount = new THREE.Object3D();
  const lift = phoneH * 0.5 - (POST - 0.004);
  mount.position.set(0, 0.012 + POST + Math.cos(STAND_LEAN) * lift, -0.008 - Math.sin(STAND_LEAN) * lift + 0.006);
  mount.rotation.x = -STAND_LEAN;
  g.add(mount);
  g.userData.mount = mount;
  return g;
}

function room(scene) {
  const W = 18, Dp = 14, H = 3.3;
  // vertical oak slats on every wall
  const slatTex = (len) => {
    const t = planksTexture({ base: PALETTE.wall, planks: 16, seed: 23, joints: false, gap: 3, knots: false, grain: 0.55 });
    t.rotation = Math.PI / 2; t.center.set(0.5, 0.5);
    t.repeat.set(1, len / 2.2); // one texture per wall height (no seam), ~14 cm slats
    return t;
  };
  const wallMat = (len) => new THREE.MeshStandardMaterial({ map: slatTex(len), roughness: 0.75, envMapIntensity: 0.6 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: PALETTE.ceiling, roughness: 0.95 });
  // Separate planes: a box's bottom face would sit exactly on the floor and flicker.
  const mk = (w, h, mat, pos, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m;
  };
  mk(W, H, wallMat(W), new THREE.Vector3(0, H / 2, -Dp / 2), 0);
  mk(W, H, wallMat(W), new THREE.Vector3(0, H / 2, Dp / 2), Math.PI);
  mk(Dp, H, wallMat(Dp), new THREE.Vector3(-W / 2, H / 2, 0), Math.PI / 2);
  mk(Dp, H, wallMat(Dp), new THREE.Vector3(W / 2, H / 2, 0), -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
  scene.add(ceil);
  const lightMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false });
  const geo = new THREE.BoxGeometry(W - 1, 0.04, 0.16); // wide enough not to shimmer at a distance
  for (let i = -3; i <= 3; i++) {
    const m = new THREE.Mesh(geo, lightMat);
    m.position.set(0, H - 0.04, i * 1.8);
    scene.add(m);
  }
}

function floorTex() {
  const t = planksTexture({ base: PALETTE.floor, planks: 8, seed: 5 });
  t.repeat.set(20 / 3, 20 / 1.5); // 3 m long, 19 cm wide planks
  return t;
}

export function buildShowroom(scene) {
  scene.background = new THREE.Color(PALETTE.fog);
  scene.fog = new THREE.Fog(PALETTE.fog, 10, 24);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshPhysicalMaterial({ map: floorTex(), roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  room(scene);

  const main = roundTable(TABLE.radius, TABLE.height);
  scene.add(main);
  const work = roundTable(WORK_TABLE.radius, WORK_TABLE.height);
  work.position.copy(WORK_TABLE.center);
  scene.add(work);

  scene.add(new THREE.HemisphereLight('#fffaf2', '#8a6f55', 0.9));
  // a soft panel light over each table, like a store's display lighting
  RectAreaLightUniformsLib.init();
  for (const [c, size] of [[new THREE.Vector3(0, 0, 0), 1.6], [WORK_TABLE.center, 1.2]]) {
    const area = new THREE.RectAreaLight('#ffffff', 3, size, size);
    area.position.set(c.x, 2.9, c.z);
    area.lookAt(c.x, 0, c.z);
    scene.add(area);
  }
  const key = new THREE.DirectionalLight('#fff6ea', 1.6);
  key.position.set(1.2, 5, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
  key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5;
  key.shadow.camera.near = 1; key.shadow.camera.far = 12;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.03;
  key.target.position.set(0.6, 0, -1.2);
  scene.add(key, key.target);

  return { main, work };
}

/** Place a stand on a round table at `angle` (radians, 0 = facing +z). */
export function placeOnTable(stand, center, tableH, radius, angle) {
  stand.position.set(center.x + Math.sin(angle) * radius, tableH, center.z + Math.cos(angle) * radius);
  stand.rotation.y = angle;
}

export { MM };
