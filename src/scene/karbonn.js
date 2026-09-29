// Karbonn A7 (white), traced from its product photos: front, back and left side.
// All positions below are millimetres measured on those photos at 1:1 scale
// (x from the left edge, y from the top edge, as seen from the side being drawn).
// Body 60 × 115 × 12 mm: the photos give 60 mm for the width (the 50 mm some spec sites list can't hold a 3.5" screen).

import * as THREE from 'three';
import { lens, flatShape, archedShape } from './phone.js';

// local copy: phone.js imports this module, so its MM isn't initialised yet when this file runs
const MM = 0.001;

// Outline: soft top and bottom arcs running into wide rounded corners.
export const KARBONN_OUTLINE = { top: 0.75 * MM, bot: 0.8 * MM, cvTop: 7.3 * MM, cvBot: 8.2 * MM, ch: 10 * MM };
// Lit screen (3.5" LCD) placement: side, top, bottom bezels in mm.
export const KARBONN_BEZELS = [5.35, 13.5, 24.1];

// Cross-section, front to back, from the side photo: a 2 mm black glass front, a 3.7 mm silver band,
// then the white battery cover (6.3 mm) that rounds off into the back like a pebble.
const FRONT_T = 2.0, BAND_T = 3.7;
const LIP_Y = 105.3; // the white chin under the glass starts here
const LIP_DROP = 1.0; // the chin leans back this far by the bottom edge
const PLATE_INSET = 0.4; // glass sits just inside the band
const SHELL_RX = 4.5, SHELL_RZ = 5.3, SHELL_WALL = 1.0; // pebble back: edge inset, curve depth, straight wall
const SHELL_ENDS = 0.45; // the curve runs further in at the top and bottom ends (side photo)

const PX = 24; // canvas pixels per millimetre

function canvasTex(wmm, hmm, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(wmm * PX); c.height = Math.round(hmm * PX);
  const g = c.getContext('2d');
  g.scale(PX, PX); // draw in millimetres
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Canvas version of archedShape (y down), for the black glass panel. */
function archedPath(g, x, y, w, h, { top, bot, cvTop, cvBot, ch }) {
  const x1 = x + w, yB = y + h, half = w / 2 - ch;
  const mT = (2 * top) / half, mB = (2 * bot) / half;
  g.beginPath();
  g.moveTo(x + ch, y + top);
  g.quadraticCurveTo(x + w / 2, y - top, x1 - ch, y + top);
  g.quadraticCurveTo(x1, y + top + mT * ch, x1, y + top + cvTop);
  g.lineTo(x1, yB - bot - cvBot);
  g.quadraticCurveTo(x1, yB - bot - mB * ch, x1 - ch, yB - bot);
  g.quadraticCurveTo(x + w / 2, yB + bot, x + ch, yB - bot);
  g.quadraticCurveTo(x, yB - bot - mB * ch, x, yB - bot - cvBot);
  g.lineTo(x, y + top + cvTop);
  g.quadraticCurveTo(x, y + top + mT * ch, x + ch, y + top);
  g.closePath();
}

function capsule(g, x, y, w, h) {
  g.beginPath();
  g.roundRect(x, y, w, h, h / 2);
}

function frontTexture(W, H) {
  return canvasTex(W, H, (g) => {
    // glass with a white-silver border printed under it
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#eeeff0'); base.addColorStop(0.5, '#e4e5e7'); base.addColorStop(1, '#e8e9ea');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const sides = g.createLinearGradient(0, 0, W, 0);
    sides.addColorStop(0, 'rgba(120,122,128,0.28)'); sides.addColorStop(0.03, 'rgba(120,122,128,0)');
    sides.addColorStop(0.97, 'rgba(120,122,128,0)'); sides.addColorStop(1, 'rgba(120,122,128,0.28)');
    g.fillStyle = sides; g.fillRect(0, 0, W, H);

    // black panel round the screen
    archedPath(g, 1.48, 5.06, 57.04, 94.62, { top: 0.85, bot: 0.6, cvTop: 7, cvBot: 5.6, ch: 9 });
    g.fillStyle = '#060607'; g.fill();

    // earpiece: grey mesh in a darker capsule
    g.fillStyle = '#56575b'; capsule(g, 19.3, 1.75, 21.3, 1.55); g.fill();
    const mesh = g.createLinearGradient(0, 2, 0, 3.1);
    mesh.addColorStop(0, '#8d8f93'); mesh.addColorStop(0.5, '#b3b5b8'); mesh.addColorStop(1, '#8a8c90');
    g.fillStyle = mesh; capsule(g, 19.6, 2.0, 20.7, 1.05); g.fill();

    // front camera
    g.fillStyle = '#2b2c30'; g.beginPath(); g.arc(50.4, 10.0, 1.0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#101114'; g.beginPath(); g.arc(50.4, 10.0, 0.55, 0, Math.PI * 2); g.fill();

    // capacitive keys printed on the glass: menu, home, back
    g.strokeStyle = '#6c6d71'; g.lineWidth = 0.34; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const y of [95.4, 96.3, 97.2]) { g.beginPath(); g.moveTo(11.8, y); g.lineTo(13.9, y); g.stroke(); }
    g.beginPath();
    g.moveTo(28.9, 96.4); g.lineTo(30.3, 94.9); g.lineTo(31.7, 96.4);
    g.moveTo(29.3, 96.0); g.lineTo(29.3, 97.7); g.lineTo(31.3, 97.7); g.lineTo(31.3, 96.0);
    g.moveTo(31.1, 95.3); g.lineTo(31.1, 95.8);
    g.stroke();
    g.beginPath();
    g.moveTo(46.7, 95.4); g.lineTo(48.3, 95.4);
    g.arc(48.3, 96.3, 0.9, -Math.PI / 2, Math.PI / 2);
    g.lineTo(46.9, 97.2);
    g.stroke();
    g.beginPath(); g.moveTo(47.3, 94.8); g.lineTo(46.6, 95.4); g.lineTo(47.3, 96.0); g.stroke();
  });
}

function backTexture(W, H) {
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#f3f3f2'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // camera resolution under the lens
    g.fillStyle = '#bfc0c3';
    g.font = '400 3.2px Arial, Helvetica, sans-serif';
    g.fillText('5.0 MP', 30.9, 22.8);
    // maker name in its dark red, stretched to the photo's 17.4 mm width
    g.fillStyle = '#842e2e';
    g.font = '700 3.4px Verdana, "DejaVu Sans", sans-serif';
    g.save(); g.translate(30.1, 83.6); g.scale(17.4 / g.measureText('Karbonn').width, 1);
    g.fillText('Karbonn', 0, 0);
    g.restore();
    // loudspeaker: two slots
    for (const [y, h] of [[92.8, 1.0], [95.35, 0.9]]) {
      g.fillStyle = 'rgba(255,255,255,0.9)'; capsule(g, 26.0, y + 0.12, 8.0, h); g.fill();
      g.fillStyle = '#131316'; capsule(g, 26.05, y, 7.9, h); g.fill();
    }
  });
}

/** Optical-trackpad look for the right half of the chin button: dark knurling that fades in from the left. */
function padTexture(wmm, hmm) {
  return canvasTex(wmm, hmm, (g) => {
    capsule(g, 0, 0, wmm, hmm);
    g.save(); g.clip();
    g.fillStyle = '#55575b'; g.fillRect(0, 0, wmm, hmm);
    g.strokeStyle = 'rgba(20,20,24,0.8)'; g.lineWidth = 0.18;
    for (let x = 0.3; x < wmm; x += 0.45) {
      g.beginPath();
      for (let y = 0; y <= hmm; y += 0.5) g.lineTo(x + (Math.floor(y / 0.5) % 2) * 0.22, y);
      g.stroke();
    }
    const fade = g.createLinearGradient(0, 0, wmm * 0.45, 0);
    fade.addColorStop(0, 'rgba(244,244,244,1)'); fade.addColorStop(1, 'rgba(244,244,244,0)');
    g.fillStyle = fade; g.fillRect(0, 0, wmm, hmm);
    g.restore();
  });
}

// ---- geometry helpers ------------------------------------------------------------------------

/** Evenly spaced points round the body outline, counter-clockwise. */
function outlinePoints(W, H, n = 240) {
  const pts = archedShape(W, H, KARBONN_OUTLINE).getSpacedPoints(n).slice(0, n);
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  return pts;
}

/**
 * Move each outline point inwards by `d` along its normal; `ends` makes the inset grow towards the
 * top and bottom (× 1 + ends·ny⁴), staying under the corners' smallest radius (~5.5 mm).
 */
function inset(pts, d, ends = 0) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    const nx = ty / l, ny = -tx / l; // outward normal
    const dd = d * (1 + ends * ny ** 4);
    return new THREE.Vector2(p.x - nx * dd, p.y - ny * dd);
  });
}

/** Surface through a stack of rings, given as [inset, z] pairs (metres), from front to back. */
function loft(pts, rings, ends = 0) {
  const n = pts.length, pos = [], idx = [];
  for (const [d, z] of rings) for (const p of inset(pts, d, ends)) pos.push(p.x, p.y, z);
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + ((i + 1) % n), c = a + n, e = b + n;
      idx.push(a, c, b, b, c, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Keep the part of a shape above (keep > 0) or below (keep < 0) the line y = yc. */
function cutShape(shape, yc, keep) {
  const src = shape.getPoints(24), out = [];
  const inside = (p) => (keep > 0 ? p.y >= yc : p.y <= yc);
  for (let i = 0; i < src.length; i++) {
    const p = src[i], q = src[(i + 1) % src.length];
    if (inside(p)) out.push(p.clone());
    if (inside(p) !== inside(q)) {
      const t = (yc - p.y) / (q.y - p.y);
      out.push(new THREE.Vector2(p.x + (q.x - p.x) * t, yc));
    }
  }
  return new THREE.Shape(out);
}

function extrude(shape, depth, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24,
  });
  geo.translate(0, 0, bevel); // back face at z = 0, front face at z = depth
  return geo;
}

/** Map a geometry's UVs to the body's W × H so textures drawn in body mm line up 1:1. */
function bodyUVs(geo, W, H) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / H + 0.5);
  uv.needsUpdate = true;
}

function whitePlastic() {
  // a little emission keeps the white reading as white rather than warm grey in the wooden room
  const m = new THREE.MeshPhysicalMaterial({ color: '#fafaf8', emissive: '#242424', roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.18, side: THREE.DoubleSide });
  m.userData.envScale = 0.6;
  return m;
}

function chrome() {
  const m = new THREE.MeshStandardMaterial({ color: '#eceef2', metalness: 1, roughness: 0.12, emissive: '#7c8088', emissiveIntensity: 0.3 });
  m.userData.envScale = 1.4;
  return m;
}

/**
 * The Karbonn's body, built to the side photo's cross-section.
 * Returns the static frame (silver band, white chin, inner housing), the textured front glass
 * (centred on z = 0, `frontT` thick) and the removable white back cover (in body coordinates).
 */
export function karbonnBody(W, H, D, { frameMat }) {
  const wmm = W / MM, hmm = H / MM;
  const zFront = D / 2, zBand = zFront - FRONT_T * MM, zJoin = zBand - BAND_T * MM;
  const pts = outlinePoints(W, H);

  // silver band: straight walls with softly rounded edges
  const frame = new THREE.Group();
  const bandMat = frameMat.clone(); bandMat.side = THREE.DoubleSide;
  const e = 0.3 * MM;
  const band = new THREE.Mesh(loft(pts, [[0.45 * MM, zBand], [0.12 * MM, zBand - 0.08 * MM], [0, zBand - e], [0, zJoin + e], [0.12 * MM, zJoin]]), bandMat);
  frame.add(band);
  // dark inner housing: only seen with the cover off
  const housing = new THREE.Mesh(loft(pts, [[0.9 * MM, zJoin], [0.9 * MM, zJoin - 3.2 * MM]]),
    new THREE.MeshStandardMaterial({ color: '#2a2b2f', roughness: 0.7, side: THREE.DoubleSide }));
  frame.add(housing);

  // white chin: the part of the front below the glass, leaning back towards the bottom edge
  const white = whitePlastic();
  const yLip = H / 2 - LIP_Y * MM, yBot = -H / 2;
  const lb = 0.25 * MM;
  const lipShape = cutShape(archedShape(W - 2 * (0.05 * MM + lb), H - 2 * (0.05 * MM + lb), KARBONN_OUTLINE), yLip - lb, -1);
  const lipGeo = extrude(lipShape, FRONT_T * MM, lb);
  const lp = lipGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const k = THREE.MathUtils.clamp((yLip - lp.getY(i)) / (yLip - yBot), 0, 1);
    lp.setZ(i, lp.getZ(i) - (lp.getZ(i) / (FRONT_T * MM)) * LIP_DROP * MM * k);
  }
  lipGeo.computeVertexNormals();
  // the chin leans away from the light, so it gets a bit more lift than the rest of the white
  const lipMat = white.clone(); lipMat.emissive.set('#3a3a3a');
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.position.z = zBand;
  frame.add(lip);

  // front glass: black panel with the white border printed under it; black edges
  const pb = 0.3 * MM;
  const plateShape = cutShape(archedShape(W - 2 * (PLATE_INSET * MM + pb), H - 2 * (PLATE_INSET * MM + pb), KARBONN_OUTLINE), yLip + pb, 1);
  const plateGeo = extrude(plateShape, FRONT_T * MM, pb);
  plateGeo.translate(0, 0, -FRONT_T * MM / 2);
  bodyUVs(plateGeo, W, H);
  const faceTex = frontTexture(wmm, hmm);
  // the printed border is bright silver-white in the photos; emission lifts it without greying the black
  const face = new THREE.MeshPhysicalMaterial({ map: faceTex, emissive: '#3a3a3a', emissiveMap: faceTex, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.04, specularIntensity: 0.5 });
  face.userData.envScale = 0.45;
  const edge = new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.15, clearcoat: 0.6 });
  edge.userData.envScale = 0.5;
  const frontPlate = new THREE.Mesh(plateGeo, [face, edge]);

  // back cover: white pebble from the band down to a flat back carrying the print
  const cover = new THREE.Group();
  const rings = [[0.2 * MM, zJoin], [0.03 * MM, zJoin - 0.08 * MM], [0, zJoin - 0.2 * MM], [0, zJoin - SHELL_WALL * MM]];
  const zc = zJoin - SHELL_WALL * MM, rz = zc + D / 2;
  for (let s = 1; s <= 10; s++) {
    const a = (s / 10) * (Math.PI / 2);
    rings.push([SHELL_RX * MM * (1 - Math.cos(a)), zc - rz * Math.sin(a)]);
  }
  const shell = new THREE.Mesh(loft(pts, rings, SHELL_ENDS), white);
  cover.add(shell);
  const backFace = inset(pts, SHELL_RX * MM, SHELL_ENDS);
  const printMat = white.clone(); printMat.map = backTexture(wmm, hmm); printMat.side = THREE.FrontSide;
  const print = new THREE.Mesh(flatShape(new THREE.Shape(backFace), W, H), printMat);
  print.rotation.y = Math.PI; // reads correctly from behind (the outline is symmetric)
  print.position.z = -D / 2;
  cover.add(print);

  // buttons: volume rocker on the left side of the cover, power key on top (from the side and back photos)
  const btnMat = white.clone(); btnMat.side = THREE.FrontSide;
  const zBtn = zJoin - 0.8 * MM;
  for (const [y0, y1] of [[17.9, 28.9], [29.2, 40.1]]) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.75 * MM, (y1 - y0 - 1.5) * MM, 6, 16), btnMat);
    b.scale.x = 0.7;
    b.position.set(-W / 2 + 0.05 * MM, H / 2 - ((y0 + y1) / 2) * MM, zBtn);
    cover.add(b);
  }
  const pwr = new THREE.Mesh(new THREE.CapsuleGeometry(0.8 * MM, 6.5 * MM, 6, 16), bandMat);
  pwr.rotation.z = Math.PI / 2; pwr.scale.x = 0.7;
  pwr.position.set(14.5 * MM, H / 2 - 0.05 * MM, zJoin + 1.2 * MM);
  frame.add(pwr);

  return { frame, frontPlate, frontT: FRONT_T * MM, cover };
}

/** Parts that stand on the front glass: chin button and earpiece. `z` is the glass surface. */
export function karbonnFront(front, W, H, z) {
  const wmm = W / MM, hmm = H / MM;
  const at = (xmm, ymm) => new THREE.Vector2((xmm - wmm / 2) * MM, (hmm / 2 - ymm) * MM);

  // chin button: glossy white capsule, right half dark and knurled
  const bw = 14.0, bh = 3.7, bb = 0.2;
  const pill = new THREE.Shape();
  const r = (bh - 2 * bb) / 2, hw = (bw - 2 * bb) / 2 - r;
  pill.absarc(hw * MM, 0, r * MM, -Math.PI / 2, Math.PI / 2, false);
  pill.absarc(-hw * MM, 0, r * MM, Math.PI / 2, Math.PI * 1.5, false);
  const geo = extrude(pill, 0.55 * MM, bb * MM);
  const btnMat = new THREE.MeshPhysicalMaterial({ color: '#f4f4f3', roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.05 });
  btnMat.userData.envScale = 0.7;
  const btn = new THREE.Mesh(geo, btnMat);
  const bp = at(29.9, 103.3);
  btn.position.set(bp.x, bp.y, z - 0.1 * MM);
  front.add(btn);
  const pw = 6.6, ph = bh - 0.3;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(pw * MM, ph * MM),
    new THREE.MeshPhysicalMaterial({ map: padTexture(pw, ph), transparent: true, roughness: 0.4, clearcoat: 0.4 }));
  const pp = at(36.9 - 0.15 - pw / 2, 103.3);
  pad.position.set(pp.x, pp.y, z + 0.46 * MM);
  front.add(pad);

  // earpiece: a thin chrome rim round the printed grille
  const ear = new THREE.Shape();
  const er = 0.78, ehw = 21.3 / 2 - er;
  ear.absarc(ehw * MM, 0, er * MM, -Math.PI / 2, Math.PI / 2, false);
  ear.absarc(-ehw * MM, 0, er * MM, Math.PI / 2, Math.PI * 1.5, false);
  const hole = new THREE.Path();
  const ir = 0.56, ihw = 20.7 / 2 - ir;
  hole.absarc(ihw * MM, 0, ir * MM, -Math.PI / 2, Math.PI / 2, false);
  hole.absarc(-ihw * MM, 0, ir * MM, Math.PI / 2, Math.PI * 1.5, false);
  ear.holes.push(hole);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ear, { depth: 0.08 * MM, bevelEnabled: false, curveSegments: 16 }), chrome());
  const ep = at(29.95, 2.525);
  rim.position.set(ep.x, ep.y, z);
  front.add(rim);

  // front camera lens under the glass
  const fc = lens(0.7 * MM, 0.1 * MM);
  const cp = at(50.4, 10.0);
  fc.position.set(cp.x, cp.y, z - 0.02 * MM);
  front.add(fc);
}

/** Camera with its raised red bezel, twin flash (added to the back cover's detail group, facing -z). */
export function karbonnBack(g, W, H) {
  const wmm = W / MM, hmm = H / MM;
  // mm measured on the back photo (x from the left as seen from behind) → local coords
  const at = (xmm, ymm) => new THREE.Vector2((wmm / 2 - xmm) * MM, (hmm / 2 - ymm) * MM);
  const cp = at(30.0, 13.1);

  // red anodised bezel: rises 0.8 mm off the back with a rounded top
  const prof = [[6.1, 0], [6.08, 0.3], [5.95, 0.6], [5.7, 0.78], [5.3, 0.84], [4.8, 0.82], [4.5, 0.72], [4.4, 0.58]]
    .map(([rr, h]) => new THREE.Vector2(rr * MM, h * MM));
  const red = new THREE.MeshPhysicalMaterial({ color: '#9c2a28', metalness: 0.5, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
  const bezel = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), red);
  bezel.rotation.x = -Math.PI / 2; // lathe +y → -z (out of the back)
  bezel.position.set(cp.x, cp.y, 0);
  g.add(bezel);
  // bright ring between bezel and lens
  const ringMat = chrome(); ringMat.side = THREE.DoubleSide;
  const ring = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(4.4 * MM, 0.58 * MM), new THREE.Vector2(4.05 * MM, 0.5 * MM), new THREE.Vector2(3.75 * MM, 0.36 * MM)], 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cp.x, cp.y, 0);
  g.add(ring);
  const l = lens(3.75 * MM, 0.5 * MM);
  l.position.set(cp.x, cp.y, -0.12 * MM);
  g.add(l);

  // twin LED flash
  const led = new THREE.MeshStandardMaterial({ color: '#f6f2d4', roughness: 0.35, emissive: '#3b3825', emissiveIntensity: 0.25 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#77797e', metalness: 0.6, roughness: 0.35 });
  for (const y of [11.3, 15.5]) {
    const p = at(20.6, y);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * MM, 1.0 * MM, 0.12 * MM, 32), led);
    disc.rotation.x = Math.PI / 2; disc.position.set(p.x, p.y, -0.06 * MM);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12 * MM, 0.13 * MM, 10, 40), rimMat);
    rim.position.set(p.x, p.y, -0.06 * MM);
    g.add(disc, rim);
  }
}
