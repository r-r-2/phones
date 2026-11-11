// iPhone 17 Pro surfaces, painted in code onto the downloaded model's UV layout.
// The model's own texture (product photos) is not used: we only measured where each face
// sits in its 2048 px atlas, and draw our own finish there. Positions below are canvas pixels as the
// model's UVs read them (checked in renders): the back reads as drawn, the front mirrored left-to-right.

import * as THREE from 'three';
import { LOGO_PATHS } from '../logos.js';

const S = 2048;
const DEEP_BLUE = '#313949';

const BACK = { x0: 50, x1: 838, y0: 219, y1: 1846, r: 120 };
// the camera plateau's raised top face and the foot of its step, read off the model's own vertices
// (top face: 62 x 40 mm, 4 mm below the top edge; the step wall maps to rows 680-717)
const PLATEAU = { x0: 102, x1: 779, y0: 272, y1: 699, r: 70 };
const PLATEAU_TOP = 717;
const FRONT = { x0: 867, x1: 1656, y0: 218, y1: 1844, r: 118 };
const SCREEN = { x0: 904, x1: 1620, y0: 250, y1: 1812, r: 92 };
const ISLAND = { x0: 1156, x1: 1372, y0: 278, y1: 338 };
const EDGES = [[1702, 1846], [1878, 2023]]; // the two long sides, y as BACK
const BOTTOM = { x0: 50, x1: 838, y0: 44, y1: 183 };
const TOP = { x0: 867, x1: 1656, y0: 1869, y1: 2014 };

function canvas(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  draw(g);
  return c;
}

function rr(g, { x0, x1, y0, y1, r = 0 }) {
  g.beginPath();
  g.roundRect(x0, y0, x1 - x0, y1 - y0, r);
}

function dot(g, x, y, r) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
}

/** Anodised aluminium: fine grain plus a soft top-to-bottom falloff. */
function aluminium(g, box, seed = 1) {
  const grad = g.createLinearGradient(0, box.y0, 0, box.y1);
  grad.addColorStop(0, '#333b4f'); grad.addColorStop(1, '#353d51'); // one aluminium tone end to end
  g.fillStyle = grad; g.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 2500; i++) g.fillRect(box.x0 + rnd() * (box.x1 - box.x0), box.y0 + rnd() * (box.y1 - box.y0), 2, 2);
}

function drawBack(g) {
  aluminium(g, BACK, 7);
  // glass panel below the plateau (for MagSafe): a touch darker and smoother
  g.save();
  rr(g, { x0: BACK.x0 + 22, x1: BACK.x1 - 22, y0: PLATEAU_TOP + 40, y1: BACK.y1 - 22, r: 100 });
  g.clip();
  const gl = g.createLinearGradient(BACK.x0, 0, BACK.x1, 0);
  gl.addColorStop(0, '#2b3243'); gl.addColorStop(0.5, '#31394b'); gl.addColorStop(1, '#2b3243');
  g.fillStyle = gl; g.fillRect(BACK.x0, PLATEAU_TOP, BACK.x1 - BACK.x0, BACK.y1 - PLATEAU_TOP);
  g.restore();
  // plateau step: a thin shadow line and a highlight just above it
  // plateau: same aluminium, with a light chamfer round its top face and a soft shadow at its foot
  rr(g, PLATEAU); g.lineWidth = 6; g.strokeStyle = 'rgba(190,205,235,0.16)'; g.stroke();

  // flash, LiDAR and microphone on the plateau
  dot(g, 684, 364, 36); g.fillStyle = '#e9e4d2'; g.fill();
  dot(g, 684, 364, 22); g.fillStyle = '#f6f2e2'; g.fill();
  dot(g, 686, 586, 37); g.fillStyle = '#0b0c10'; g.fill();
  dot(g, 686, 586, 16); g.fillStyle = '#1b1d24'; g.fill();
  dot(g, 686, 473, 5); g.fillStyle = '#0d1018'; g.fill();

  // Apple mark (Simple Icons), slightly glossier than the glass around it
  const path = new Path2D(LOGO_PATHS.apple);
  const h = 214, scale = h / 24; // measured on the model: 181 × 214 px, about 16 × 20 mm
  g.save();
  g.translate(448 - 12 * scale, 1251 - 12 * scale);
  g.scale(scale, scale);
  g.fillStyle = '#242a38';
  g.fill(path);
  g.restore();
}

function drawEdges(g) {
  for (const [x0, x1] of EDGES) {
    aluminium(g, { x0, x1, y0: BACK.y0, y1: BACK.y1 }, x0);
    // antenna bands near both ends
    g.fillStyle = 'rgba(12,16,26,0.55)';
    for (const y of [BACK.y0 + 150, BACK.y1 - 150]) g.fillRect(x0, y, x1 - x0, 7);
  }
  for (const box of [BOTTOM, TOP]) {
    aluminium(g, box, box.x0 + 3);
    g.fillStyle = 'rgba(12,16,26,0.55)';
    for (const x of [box.x0 + 150, box.x1 - 150]) g.fillRect(x, box.y0, 7, box.y1 - box.y0);
  }
  // bottom edge: USB-C port, speaker and microphone holes
  rr(g, { x0: 394, x1: 524, y0: 80, y1: 116, r: 18 }); g.fillStyle = '#07080b'; g.fill();
  rr(g, { x0: 410, x1: 508, y0: 92, y1: 104, r: 6 }); g.fillStyle = '#2a2d33'; g.fill();
  g.fillStyle = '#0a0c11';
  for (let i = 0; i < 6; i++) { dot(g, 140 + i * 30, 98, 6); g.fill(); }
  for (let i = 0; i < 6; i++) { dot(g, 590 + i * 30, 98, 6); g.fill(); }
  for (const x of [360, 558]) { dot(g, x, 98, 5); g.fill(); }
}

/** The front reads mirrored left-to-right through the UVs, so the screen image is drawn mirrored. */
function screenImage(g, img) {
  g.save();
  g.translate(SCREEN.x0 + SCREEN.x1, 0);
  g.scale(-1, 1);
  g.drawImage(img, SCREEN.x0, SCREEN.y0, SCREEN.x1 - SCREEN.x0, SCREEN.y1 - SCREEN.y0);
  g.restore();
}

function drawFront(g, screen) {
  rr(g, FRONT); g.fillStyle = '#4b5469'; g.fill(); // thin metal rim showing round the glass
  rr(g, { x0: FRONT.x0 + 16, x1: FRONT.x1 - 16, y0: FRONT.y0 + 16, y1: FRONT.y1 - 16, r: FRONT.r - 16 });
  g.fillStyle = '#030304'; g.fill();
  // our own lock screen, drawn upright into the screen area
  g.save();
  rr(g, SCREEN); g.clip();
  screenImage(g, screen);
  g.restore();
  rr(g, { ...ISLAND, r: (ISLAND.y1 - ISLAND.y0) / 2 }); g.fillStyle = '#000'; g.fill();
  dot(g, ISLAND.x0 + 34, (ISLAND.y0 + ISLAND.y1) / 2, 12); g.fillStyle = '#0c1020'; g.fill();
}

/** Replacement materials for the model's photo-textured shell (`body`) and its display face. */
export function iphone17proMaterials(screenCanvas) {
  const colour = new THREE.CanvasTexture(canvas((g) => {
    g.fillStyle = DEEP_BLUE; g.fillRect(0, 0, S, S);
    drawBack(g);
    drawEdges(g);
    drawFront(g, screenCanvas);
  }));
  // roughness (green channel): glass smooth, aluminium satin
  const rough = new THREE.CanvasTexture(canvas((g) => {
    g.fillStyle = 'rgb(0,190,0)'; g.fillRect(0, 0, S, S);
    rr(g, { x0: BACK.x0 + 22, x1: BACK.x1 - 22, y0: PLATEAU_TOP + 40, y1: BACK.y1 - 22, r: 100 });
    g.fillStyle = 'rgb(0,165,0)'; g.fill();
    rr(g, FRONT); g.fillStyle = 'rgb(0,30,0)'; g.fill();
  }));
  // only the screen glows
  const glow = new THREE.CanvasTexture(canvas((g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.save(); rr(g, SCREEN); g.clip();
    screenImage(g, screenCanvas);
    g.restore();
    rr(g, { ...ISLAND, r: (ISLAND.y1 - ISLAND.y0) / 2 }); g.fillStyle = '#000'; g.fill();
  }));
  glow.colorSpace = THREE.SRGBColorSpace;
  for (const t of [colour, rough, glow]) { t.flipY = false; t.anisotropy = 8; }
  colour.colorSpace = THREE.SRGBColorSpace;

  const body = new THREE.MeshPhysicalMaterial({
    map: colour, roughnessMap: rough, roughness: 1, metalness: 1, side: THREE.DoubleSide,
  });
  const display = new THREE.MeshStandardMaterial({
    map: colour, emissive: '#ffffff', emissiveMap: glow, emissiveIntensity: 0.85, roughness: 0.18, metalness: 0,
  });
  display.userData.envScale = 0.15; // keeps the black island black under the room's reflections

  // camera glass: the model's transmission glass sat almost on top of the lens rings and z-fought with them
  // (mottled rings); a thin clear sheen drawn after the rings reads the same without the flicker
  const cover = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  // lens elements: deep glossy glass with a faint coating tint instead of a see-through dark hole
  const lens = new THREE.MeshPhysicalMaterial({
    color: '#0a0c16', roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 0.6, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 420],
  });
  lens.userData.envScale = 1.4;
  // lens rings: an even, satin anodised finish; the model's own dark mirror metal picked up blotchy reflections
  // polygon offset: the ring's top sits on the same plane as the black barrel inside it, and they z-fought
  const ring = new THREE.MeshPhysicalMaterial({ color: '#2f3749', metalness: 0.9, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  ring.userData.envScale = 0.45;
  return { body, display, Glass: cover, Lense: lens, ring };
}
