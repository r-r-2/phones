// Moto E (1st gen, black), traced from its product photos: front, back and right side.
// Positions are millimetres measured on those photos at 1:1 (x from the left edge, y from the top edge).
// Body 64.8 × 124.8 × 12.3 mm. The side photo shows the shape that matters: a flat glass front on a
// 3.5 mm black band, then a back cover that domes out to 12.3 mm in the middle and rolls off towards
// every edge (almost to nothing along the long sides, ~3.5 mm thick at the top and bottom ends).

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { LOGO_PATHS } from '../logos.js';
import { roundedRectShape, lens } from './phone.js';

const MM = 0.001; // local: phone.js imports this module, so its MM isn't ready yet

export const MOTOE_BEZELS = [5.4, 11.5, 17.8]; // 4.3" screen: 54 × 95.5 mm
const CORNER_R = 8.5;
const FRONT_T = 1.0, BAND_T = 3.5; // glass, then the black band down to the cover seam
const DOME_END = 0.5; // cover thickness left at the top/bottom ends, as a fraction of its full height
const DOME_SIDE = 0.2; // same along the long sides
const CAM = { x: 32.4, y: 21, ring: 5.0, bore: 4.1, lens: 2.1 }; // chrome ring OD 10 mm
const DIMPLE = { x: 32.4, y: 43, r: 5.25, depth: 0.9, mark: 10.6 }; // the M itself is ~6.5 mm wide inside the icon's circle

function chrome() {
  const m = new THREE.MeshStandardMaterial({ color: '#dfe2e7', metalness: 1, roughness: 0.14, emissive: '#5c6068', emissiveIntensity: 0.3 });
  m.userData.envScale = 1.4;
  return m;
}

function softBlack() {
  // the soft-touch cover: matte, a hint of sheen so the dome reads as a curve
  const m = new THREE.MeshPhysicalMaterial({ color: '#26272a', roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  m.userData.envScale = 0.3;
  return m;
}

/** Height of the cover above the seam, as a fraction of the full dome height: r = 0 at the centre, 1 at the rim. */
function domeProfile(r, nx, ny) {
  const ax = Math.abs(nx), ay = Math.abs(ny);
  const edge = (DOME_SIDE * ax + DOME_END * ay) / (ax + ay || 1); // what's left at the rim in this direction
  const fall = Math.sqrt(Math.max(0, 1 - Math.pow(r, 3))); // flat-ish middle, rolling off at the rim
  return edge + (1 - edge) * fall;
}

/** How far (x, y) is from the centre towards the rounded-rect rim, 0..1 (so the dome follows the outline, not an ellipse). */
function rimFraction(x, y, W, H) {
  const a = W / 2, b = H / 2, rc = CORNER_R * MM;
  const inside = (px, py) => {
    px = Math.abs(px); py = Math.abs(py);
    if (px > a || py > b) return false;
    if (px <= a - rc || py <= b - rc) return true;
    return Math.hypot(px - (a - rc), py - (b - rc)) <= rc;
  };
  if (x === 0 && y === 0) return 0;
  let lo = 0, hi = 4; // scale factors: inside at lo, outside at hi
  for (let i = 0; i < 24; i++) { const k = (lo + hi) / 2; if (inside(x * k, y * k)) lo = k; else hi = k; }
  return Math.min(1, 1 / lo);
}

/** The Motorola dimple: a shallow bowl, as a depth in metres at (x, y) (body coords, mm). */
function dimpleDepth(xmm, ymm) {
  const d = Math.hypot(xmm - DIMPLE.x, ymm - DIMPLE.y) / DIMPLE.r;
  if (d >= 1) return 0;
  return DIMPLE.depth * MM * (1 - d * d) * (1 - d * d);
}

/**
 * The domed back as a radial grid over the rounded-rect footprint: ring k at fraction r_k of the way
 * from the centre to the outline, direction j round the outline. Returns the geometry and a function
 * giving the surface z at any (x, y) so parts can sit on it.
 */
function domeGeometry(W, H, zJoin, height) {
  const outline = roundedRectShape(W, H, CORNER_R * MM).getSpacedPoints(240);
  outline.pop(); // the last point repeats the first
  const N = outline.length;
  const RINGS = 64;
  const zAt = (x, y, r = rimFraction(x, y, W, H)) =>
    zJoin - height * domeProfile(r, x / (W / 2), y / (H / 2)) + dimpleDepth(x / MM + W / MM / 2, H / MM / 2 - y / MM);
  const pos = [], uv = [], idx = [];
  pos.push(0, 0, zAt(0, 0)); uv.push(0.5, 0.5); // centre
  for (let k = 1; k <= RINGS; k++) {
    const t = k / RINGS;
    const r = 1 - Math.pow(1 - t, 1.6); // denser rings near the rim, where it curves fastest
    for (let j = 0; j < N; j++) {
      const x = outline[j].x * r, y = outline[j].y * r;
      pos.push(x, y, zAt(x, y, r)); uv.push(x / W + 0.5, y / H + 0.5);
    }
  }
  // rim wall up to the seam
  for (let j = 0; j < N; j++) { pos.push(outline[j].x, outline[j].y, zJoin); uv.push(outline[j].x / W + 0.5, outline[j].y / H + 0.5); }
  const ring = (k, j) => (k === 0 ? 0 : 1 + (k - 1) * N + (j % N));
  for (let j = 0; j < N; j++) idx.push(0, ring(1, j + 1), ring(1, j)); // fan, facing -z
  for (let k = 1; k <= RINGS; k++) {
    for (let j = 0; j < N; j++) {
      const a = ring(k, j), b = ring(k, j + 1), c = ring(k + 1, j), d = ring(k + 1, j + 1);
      idx.push(a, d, c, a, b, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, zAt };
}

function wall(W, H, z0, z1, inset = 0) {
  const shape = roundedRectShape(W - 2 * inset, H - 2 * inset, (CORNER_R - inset / MM) * MM);
  const pts = shape.getSpacedPoints(160); pts.pop();
  const N = pts.length, pos = [], idx = [];
  for (const z of [z0, z1]) for (const p of pts) pos.push(p.x, p.y, z);
  for (let j = 0; j < N; j++) { const a = j, b = (j + 1) % N; idx.push(a, b + N, a + N, a, b, b + N); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function batwing(size) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${LOGO_PATHS.motorola}"/></svg>`);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const holes = shapes.flatMap((sh) => sh.holes.map((h) => new THREE.Shape(h.getPoints(24))));
  const geo = new THREE.ShapeGeometry(holes.length ? holes : shapes, 16);
  geo.translate(-12, -12, 0);
  geo.scale(size / 24, -size / 24, 1);
  return geo;
}

/** Body: black band + inner housing (frame), flat black glass (frontPlate) and the domed cover. */
export function motoeBody(W, H, D, { frameMat }) {
  const zFront = D / 2, zBand = zFront - FRONT_T * MM, zJoin = zBand - BAND_T * MM;
  const frame = new THREE.Group();

  // black band round the glass, flat walls with a softened front edge
  const bandMat = new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
  bandMat.userData.envScale = 0.5;
  void frameMat;
  frame.add(new THREE.Mesh(wall(W, H, zBand, zJoin), bandMat));
  frame.add(new THREE.Mesh(wall(W, H, zBand + 0.25 * MM, zBand, 0.25 * MM), bandMat));
  // dark housing behind the band, seen when the cover is off
  frame.add(new THREE.Mesh(wall(W, H, zJoin, zJoin - 3 * MM, 0.9 * MM), new THREE.MeshStandardMaterial({ color: '#1e1f22', roughness: 0.75, side: THREE.DoubleSide })));

  // front glass: a plain black plate; the lit screen and the grilles go on top
  const glassGeo = new THREE.ExtrudeGeometry(roundedRectShape(W - 0.9 * MM, H - 0.9 * MM, (CORNER_R - 0.45) * MM), { depth: FRONT_T * MM - 0.4 * MM, bevelEnabled: true, bevelThickness: 0.2 * MM, bevelSize: 0.2 * MM, bevelSegments: 2, curveSegments: 24 });
  glassGeo.translate(0, 0, -(FRONT_T * MM - 0.4 * MM) / 2);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#070708', roughness: 0.08, clearcoat: 0.9, clearcoatRoughness: 0.03, specularIntensity: 0.5 });
  glassMat.userData.envScale = 0.4;
  const frontPlate = new THREE.Mesh(glassGeo, glassMat);

  // the cover: domed soft-touch shell with the dimple cut into it
  const cover = new THREE.Group();
  const height = zJoin + D / 2; // seam to the deepest point of the dome
  const { geo, zAt } = domeGeometry(W, H, zJoin, height);
  cover.add(new THREE.Mesh(geo, softBlack()));
  cover.userData.zAt = zAt;

  // camera: chrome ring standing a touch proud, black bore, lens inside
  const at = (xmm, ymm) => new THREE.Vector2((xmm - W / MM / 2) * MM, (H / MM / 2 - ymm) * MM);
  const cp = at(CAM.x, CAM.y), cz = zAt(cp.x, cp.y);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(CAM.ring * MM, CAM.ring * MM, 0.5 * MM, 64), chrome());
  ring.rotation.x = Math.PI / 2; ring.position.set(cp.x, cp.y, cz - 0.1 * MM);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(CAM.bore * MM, CAM.bore * MM, 0.6 * MM, 64), new THREE.MeshStandardMaterial({ color: '#08090b', roughness: 0.5 }));
  bore.rotation.x = Math.PI / 2; bore.position.set(cp.x, cp.y, cz - 0.1 * MM);
  const l = lens(CAM.lens * MM, 0.4 * MM); l.position.set(cp.x, cp.y, cz - 0.35 * MM);
  cover.add(ring, bore, l);

  // the batwing, light grey, lying in the bottom of the dimple
  const dp = at(DIMPLE.x, DIMPLE.y);
  const mark = new THREE.Mesh(batwing(DIMPLE.mark * MM), new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
  mark.rotation.y = Math.PI;
  // flat in the bowl: at the depth the bowl has 2.5 mm out, so the centre floats a hair and the tips just meet the slope
  mark.position.set(dp.x, dp.y, zAt(dp.x + 2.5 * MM, dp.y) - 0.03 * MM);
  cover.add(mark);

  // silver keys on the right side, on the band: power 9 mm, volume 17 mm (side photo)
  const keyMat = new THREE.MeshStandardMaterial({ color: '#b5b8bd', metalness: 1, roughness: 0.3 });
  keyMat.userData.envScale = 1.1;
  for (const [y0, y1] of [[24, 33], [41, 58]]) {
    const k = new THREE.Mesh(new THREE.CapsuleGeometry(0.7 * MM, (y1 - y0 - 1.4) * MM, 4, 12), keyMat);
    k.scale.x = 0.6;
    k.position.set(W / 2 + 0.15 * MM, H / 2 - ((y0 + y1) / 2) * MM, zBand - BAND_T * MM / 2);
    frame.add(k);
  }

  // the insides sit right behind the seam: the dome is thin at its edges, so a centred interior would poke through
  return { frame, frontPlate, frontT: FRONT_T * MM, cover, interiorZ: zJoin - 0.3 * MM };
}

/** Front parts on the glass: the two chrome-rimmed grilles above and below the screen. `z` is the glass face. */
export function motoeFront(front, W, H, z) {
  const at = (xmm, ymm) => new THREE.Vector2((xmm - W / MM / 2) * MM, (H / MM / 2 - ymm) * MM);
  const slot = (cx, cy, wmm, hmm) => {
    const shape = new THREE.Shape(), hole = new THREE.Path();
    const r = hmm / 2, hw = wmm / 2 - r;
    shape.absarc(hw * MM, 0, r * MM, -Math.PI / 2, Math.PI / 2, false);
    shape.absarc(-hw * MM, 0, r * MM, Math.PI / 2, Math.PI * 1.5, false);
    const ri = r - 0.35, hwi = hw;
    hole.absarc(hwi * MM, 0, ri * MM, -Math.PI / 2, Math.PI / 2, false);
    hole.absarc(-hwi * MM, 0, ri * MM, Math.PI / 2, Math.PI * 1.5, false);
    shape.holes.push(hole);
    const p = at(cx, cy);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.18 * MM, bevelEnabled: false, curveSegments: 16 }), chrome());
    rim.position.set(p.x, p.y, z);
    // dark mesh inside the rim: a flat capsule, slightly sunk
    const inner = new THREE.Shape();
    inner.absarc(hwi * MM, 0, ri * MM, -Math.PI / 2, Math.PI / 2, false);
    inner.absarc(-hwi * MM, 0, ri * MM, Math.PI / 2, Math.PI * 1.5, false);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(inner, 16), new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.9 }));
    mesh.position.set(p.x, p.y, z + 0.02 * MM);
    front.add(rim, mesh);
  };
  slot(32.4, 7.0, 18, 1.7); // earpiece
  slot(32.4, 117.5, 27, 1.7); // loudspeaker
}
