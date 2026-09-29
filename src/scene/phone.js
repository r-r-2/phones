// Procedural phone models built from the dimensions in phones.json.
// 1 scene unit = 1 metre. Phone local axes: +x right, +y up, +z out of the screen.

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LOGO_PATHS } from '../logos.js';
import { buildDetailedInterior } from './interior.js';
import { SLVR_OUTLINE, SLVR_SIDE, SLVR_BEZELS, slvrFront, slvrBack } from './slvr.js';

export const MM = 0.001;

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Candybar outline with arched top and bottom edges (e.g. the SLVR), traced from product photos.
 * `o` (metres): top/bot = how far the arcs rise above their ends, cvTop/cvBot = height of the
 * corner curves, ch = corner width. The width and height stay exactly w × h.
 */
export function archedShape(w, h, o) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, yT = h / 2, yB = -h / 2;
  const { top, bot, cvTop, cvBot, ch } = o;
  const half = x1 - ch;
  const mT = (2 * top) / half, mB = (2 * bot) / half; // arc slope at its ends, so corners join smoothly
  s.moveTo(x0 + ch, yB + bot);
  s.quadraticCurveTo(0, yB - bot, x1 - ch, yB + bot);
  s.quadraticCurveTo(x1, yB + bot + mB * ch, x1, yB + bot + cvBot);
  s.lineTo(x1, yT - top - cvTop);
  s.quadraticCurveTo(x1, yT - top - mT * ch, x1 - ch, yT - top);
  s.quadraticCurveTo(0, yT + top, x0 + ch, yT - top);
  s.quadraticCurveTo(x0, yT - top - mT * ch, x0, yT - top - cvTop);
  s.lineTo(x0, yB + bot + cvBot);
  s.quadraticCurveTo(x0, yB + bot + mB * ch, x0 + ch, yB + bot);
  return s;
}

/** Body outline: a traced custom outline when the design has one, else a rounded rectangle. */
export function outlineShape(w, h, r, outline = null) {
  return outline ? archedShape(w, h, outline) : roundedRectShape(w, h, r);
}

/** Flat shape geometry with 0..1 UVs across its w × h bounds (for full-face decals). */
export function flatShape(shape, w, h) {
  const g = new THREE.ShapeGeometry(shape, 24);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

/** A thin rounded slab centred on z=0, thickness t. */
export function slab(w, h, r, t, bevel = 0, outline = null) {
  const g = new THREE.ExtrudeGeometry(outlineShape(w - bevel * 2, h - bevel * 2, Math.max(r - bevel, 0.0001), outline), {
    depth: Math.max(t - bevel * 2, 0.00001),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, -(t - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Rounded rect shape geometry with 0..1 UVs across its bounds. */
function flatRect(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 16);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

function lockScreenTexture(phone, aspect, notch) {
  const W = 1024, H = Math.round(1024 * aspect);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const [a, b] = phone.look?.wallpaper ?? ['#334', '#112'];
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft light blobs
  const blob = (x, y, r, col) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  };
  blob(W * 0.8, H * 0.25, W * 0.7, 'rgba(255,255,255,0.18)');
  blob(W * 0.1, H * 0.85, W * 0.8, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'center';
  ctx.font = '600 60px "Instrument Sans", system-ui, sans-serif';
  const when = phone.owned?.range?.split('–')[0]?.trim() || phone.owned?.label || '';
  ctx.fillText(when.toUpperCase(), W / 2, H * 0.17);
  ctx.font = '700 128px "Instrument Sans", system-ui, sans-serif';
  ctx.fillText(phone.name, W / 2, H * 0.17 + 144, W * 0.9);
  if (notch) {
    ctx.fillStyle = '#000';
    const nw = W * 0.42, nh = H * 0.045;
    ctx.beginPath();
    ctx.roundRect((W - nw) / 2, -nh, nw, nh * 2, nh * 0.8);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const mats = {
  plate: new THREE.MeshStandardMaterial({ color: '#222326', roughness: 0.7, metalness: 0.25, envMapIntensity: 0.45 }),
  board: new THREE.MeshStandardMaterial({ color: '#0F2A1F', roughness: 0.6, metalness: 0.15, envMapIntensity: 0.45 }),
  chip: new THREE.MeshStandardMaterial({ color: '#2C3034', roughness: 0.42, metalness: 0.55, envMapIntensity: 0.6 }),
  battery: new THREE.MeshStandardMaterial({ color: '#2E3136', roughness: 0.5, metalness: 0.3, envMapIntensity: 0.5 }),
  module: new THREE.MeshStandardMaterial({ color: '#27292D', roughness: 0.55, metalness: 0.35, envMapIntensity: 0.5 }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#06070B', roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 0.3, clearcoat: 0.3, envMapIntensity: 1 }),
  lensRing: new THREE.MeshStandardMaterial({ color: '#9A9DA2', roughness: 0.18, metalness: 1 }),
  flash: new THREE.MeshStandardMaterial({ color: '#F4EDE2', roughness: 0.3, emissive: '#3a352c', emissiveIntensity: 0.2 }),
};

mats.lens.userData.envScale = 0.3;
export function lens(radius, depth) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 32), mats.lensRing);
  ring.rotation.x = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, depth + 0.0002, 32), mats.lens);
  glass.rotation.x = Math.PI / 2;
  g.add(ring, glass);
  return g;
}

/** A flat logo mesh from an SVG path, `height` metres tall, facing -z (for a phone's back). */
export function logoMesh(name, height, mat) {
  const d = LOGO_PATHS[name];
  if (!d) return null;
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${d}"/></svg>`);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ShapeGeometry(shapes, 12);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const s = height / (bb.max.y - bb.min.y);
  // centre it, flip SVG's y-down to y-up, scale to size
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  // flip y (SVG is y-down) and x (it is read from behind the phone)
  geo.scale(-s, -s, 1);
  mat.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, mat);
}


// Bezels (side, top, bottom) in mm and corner radius as a fraction of the width, per design
const BEZELS = {
  default: [3.8, 16, 12],
  iphone13: [1.9, 1.9, 1.9],
  iphone11: [4.2, 4.2, 4.2], // LCD: thicker even bezel than the OLED 13
  iphone6p: [4.65, 18, 18],
  iphone7p: [4.7, 18, 18],
  redmi: [3.8, 16, 12],
  slvr: SLVR_BEZELS, // traced from the product photo (see slvr.js)
  karbonn: [5.8, 18, 23],
  motoe: [5.65, 14.5, 15.1],
};
const CORNER = { iphone13: 0.17, iphone11: 0.18, iphone6p: 0.13, iphone7p: 0.13, redmi: 0.12, slvr: 0.2, karbonn: 0.16, motoe: 0.17 };
// full-screen designs: notch in the lock screen and a screen that follows the body's corners
const NOTCHED = new Set(['iphone13', 'iphone11']);
// designs with a traced outline / rounded-pill sides instead of a rounded rectangle
const OUTLINES = { slvr: SLVR_OUTLINE };
const SIDES = { slvr: SLVR_SIDE };

function canvasTexture(wpx, hpx, draw) {
  const c = document.createElement('canvas');
  c.width = wpx; c.height = hpx;
  draw(c.getContext('2d'), wpx, hpx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A flat textured plane, `w`×`h` metres, facing +z (turn it round for the back). */
function decalPlane(w, h, tex, { rough = 0.5, metal = 0, transparent = true } = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: rough, metalness: metal, depthWrite: !transparent }));
}

function textPlane(text, w, h, { color = '#fff', weight = 700, family = 'system-ui, sans-serif', spacing = 0 } = {}) {
  const tex = canvasTexture(Math.round(w / MM * 40), Math.round(h / MM * 40), (g, W, H) => {
    g.fillStyle = color;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${weight} ${H * 0.8}px ${family}`;
    if (spacing) g.letterSpacing = `${spacing * H}px`;
    g.fillText(text, W / 2, H / 2 + H * 0.04, W);
  });
  return decalPlane(w, h, tex, { rough: 0.5 });
}

/** Slot grille made of small holes, as a transparent decal. */
function holesPlane(w, h, { rows = 3, cols = 12, color = '#060606', round = true } = {}) {
  const tex = canvasTexture(Math.round(w / MM * 30), Math.round(h / MM * 30), (g, W, H) => {
    g.fillStyle = color;
    const dx = W / cols, dy = H / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (round) { g.beginPath(); g.arc((x + 0.5) * dx, (y + 0.5) * dy, Math.min(dx, dy) * 0.3, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(x * dx + dx * 0.15, (y + 0.5) * dy - dy * 0.2, dx * 0.7, dy * 0.4);
    }
  });
  return decalPlane(w, h, tex);
}

/** Old-school feature-phone standby screen. */
function featureScreenTexture(phone, aspect) {
  const W = 352, H = Math.round(352 * aspect);
  return canvasTexture(W, H, (g) => {
    const [a, b] = phone.look?.wallpaper ?? ['#2E5E9E', '#0C1830'];
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // status bar: signal bars + battery
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) g.fillRect(10 + i * 7, 26 - i * 4, 5, 4 + i * 4);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
    g.strokeRect(W - 44, 12, 30, 14); g.fillRect(W - 14, 16, 3, 6); g.fillRect(W - 41, 15, 20, 8);
    g.textAlign = 'center';
    g.font = '700 64px system-ui, sans-serif';
    g.fillText('10:08', W / 2, H * 0.38);
    g.font = '600 22px system-ui, sans-serif';
    g.fillText((phone.owned?.label ?? '').toString(), W / 2, H * 0.47);
    g.font = '700 28px system-ui, sans-serif';
    g.fillText(phone.name.replace('Motorola ', ''), W / 2, H * 0.6, W * 0.9);
    // soft-key labels
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, H - 38, W, 38);
    g.fillStyle = '#fff'; g.font = '600 20px system-ui, sans-serif';
    g.textAlign = 'left'; g.fillText('Styles', 10, H - 12);
    g.textAlign = 'right'; g.fillText('Camera', W - 10, H - 12);
  });
}

function addFrontDetails(front, look, W, H, { sw, sh, bezelTop, bezelBottom, z }) {
  const layout = look.backLayout;
  const zt = z + 0.03 * MM;
  const dark = new THREE.MeshStandardMaterial({ color: '#0A0A0B', roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#C9CCD0', metalness: 1, roughness: 0.25 });
  if (layout === 'iphone6p' || layout === 'iphone7p') {
    // earpiece slot, front camera, and the round home button
    const ear = new THREE.Mesh(new RoundedBoxGeometry(W * 0.14, 1.3 * MM, 0.2 * MM, 2, 0.1 * MM), dark);
    ear.position.set(0, H / 2 - bezelTop * 0.5, z);
    const cam = new THREE.Mesh(new THREE.CircleGeometry(1.1 * MM, 24), dark);
    cam.position.set(-W * 0.14, H / 2 - bezelTop * 0.5, zt);
    const hb = -H / 2 + bezelBottom * 0.5, hr = 5.5 * MM;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(hr, 0.35 * MM, 12, 48), new THREE.MeshStandardMaterial({ color: '#7A7D82', metalness: 1, roughness: 0.3 }));
    ring.position.set(0, hb, z);
    const btnFace = new THREE.Mesh(new THREE.CircleGeometry(hr - 0.2 * MM, 48), new THREE.MeshPhysicalMaterial({ color: '#101113', roughness: 0.25, clearcoat: 0.5 }));
    btnFace.position.set(0, hb, z - 0.1 * MM);
    front.add(ear, cam, ring, btnFace);
    if (layout === 'iphone7p') ring.material.color.set('#1B1C1E'); // 7 Plus: solid-state button, no steel ring look
  } else if (layout === 'redmi') {
    const spk = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.16, 0.9 * MM), new THREE.MeshStandardMaterial({ color: '#B8BCC2', roughness: 0.5 }));
    spk.position.set(0, H / 2 - bezelTop / 2, zt);
    front.add(spk);
  } else if (layout === 'slvr') {
    slvrFront(front, W, H, z);
  } else if (layout === 'karbonn') {
    // HTC-Desire-style front: grey glass around the screen, a white chin with a silver pill button
    const white = new THREE.MeshPhysicalMaterial({ color: look.back ?? "#F4F1EA", roughness: 0.32 });
    white.userData.envScale = 0.6;
    const chinH = bezelBottom - 2 * MM;
    const chin = new THREE.Mesh(slab(W - 0.8 * MM, chinH, Math.min(W, H) * 0.14, 0.8 * MM, 0.3 * MM), white);
    chin.position.set(0, -H / 2 + 0.4 * MM + chinH / 2, z);
    const silver = new THREE.MeshStandardMaterial({ color: '#C9CCD0', metalness: 1, roughness: 0.22 });
    const pill = new THREE.Mesh(new RoundedBoxGeometry(10 * MM, 4.6 * MM, 1.0 * MM, 3, 1.2 * MM), silver);
    pill.position.set(0, chin.position.y + 0.5 * MM, z + 0.5 * MM);
    const keys = canvasTexture(400, 60, (g, Wc, Hc) => {
      g.strokeStyle = '#9A968D'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(30, Hc / 2 + k * 10); g.lineTo(62, Hc / 2 + k * 10); } g.stroke();
      g.beginPath(); g.arc(Wc - 46, Hc / 2 + 2, 13, -Math.PI * 0.5, Math.PI * 0.6); g.moveTo(Wc - 46, Hc / 2 - 11); g.lineTo(Wc - 62, Hc / 2 - 11); g.lineTo(Wc - 54, Hc / 2 - 19); g.stroke();
    });
    const kp = decalPlane(W * 0.72, W * 0.72 * 0.15, keys);
    kp.position.set(0, pill.position.y, z + 0.42 * MM);
    const ear = new THREE.Mesh(new RoundedBoxGeometry(W * 0.2, 1.4 * MM, 0.3 * MM, 2, 0.15 * MM), silver);
    ear.position.set(0, H / 2 - bezelTop * 0.45, z + 0.05 * MM);
    const cam = new THREE.Mesh(new THREE.CircleGeometry(0.9 * MM, 24), dark);
    cam.position.set(W * 0.2, H / 2 - bezelTop * 0.45, zt);
    front.add(chin, pill, kp, ear, cam);
  } else if (layout === 'motoe') {
    // chrome earpiece and loudspeaker grilles above and below the screen
    for (const [y, wf] of [[H / 2 - bezelTop * 0.5, 0.36], [-H / 2 + bezelBottom * 0.5, 0.36]]) {
      const bar = new THREE.Mesh(new RoundedBoxGeometry(W * wf, 2.2 * MM, 0.3 * MM, 2, 0.14 * MM), chrome);
      bar.position.set(0, y, z + 0.1 * MM);
      const holes = holesPlane(W * wf - 1.2 * MM, 1.2 * MM, { rows: 2, cols: 24 });
      holes.position.set(0, y, z + 0.27 * MM);
      front.add(bar, holes);
    }
  }
}

function buildBackDetails(phone, W, H, backMat) {
  const g = new THREE.Group();
  const layout = phone.look?.backLayout;
  if (layout === 'iphone13') {
    // raised camera plateau in the top-left corner (as seen from behind: top-right in local coords)
    const size = 0.43 * W;
    const bump = new THREE.Mesh(slab(size, size, size * 0.26, 1.2 * MM, 0.3 * MM), backMat);
    const bx = W / 2 - size / 2 - 0.08 * W, by = H / 2 - size / 2 - 0.05 * W;
    bump.position.set(bx, by, -0.6 * MM);
    g.add(bump);
    const r = size * 0.19;
    const l1 = lens(r, 1.6 * MM); l1.position.set(bx + size * 0.2, by + size * 0.2, -1.3 * MM);
    const l2 = lens(r, 1.6 * MM); l2.position.set(bx - size * 0.2, by - size * 0.2, -1.3 * MM);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.07, 0.4 * MM, 24), mats.flash);
    fl.rotation.x = Math.PI / 2; fl.position.set(bx - size * 0.22, by + size * 0.24, -1.25 * MM);
    g.add(l1, l2, fl);
    const logo = logoMesh('apple', 0.0135 * (W / 0.0642), new THREE.MeshStandardMaterial({ color: phone.look?.logo ?? '#A8182C', metalness: 1, roughness: 0.18 }));
    logo.position.set(0, 0.004, -0.08 * MM);
    g.add(logo);
  } else if (layout === 'iphone11') {
    // square glass plateau, two lenses stacked on the left (from behind), flash top-right
    const size = 0.46 * W;
    const bump = new THREE.Mesh(slab(size, size, size * 0.22, 1.1 * MM, 0.3 * MM), backMat);
    const bx = W / 2 - size / 2 - 0.07 * W, by = H / 2 - size / 2 - 0.07 * W;
    bump.position.set(bx, by, -0.55 * MM);
    const r = size * 0.17;
    const l1 = lens(r, 1.6 * MM); l1.position.set(bx + size * 0.2, by + size * 0.2, -1.3 * MM);
    const l2 = lens(r, 1.6 * MM); l2.position.set(bx + size * 0.2, by - size * 0.2, -1.3 * MM);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.07, 0.4 * MM, 24), mats.flash);
    fl.rotation.x = Math.PI / 2; fl.position.set(bx - size * 0.22, by + size * 0.22, -1.2 * MM);
    const logo = logoMesh('apple', 0.016, new THREE.MeshStandardMaterial({ color: phone.look?.logo ?? '#3A3B3F', metalness: 1, roughness: 0.2 }));
    logo.position.set(0, -0.004, -0.08 * MM);
    g.add(bump, l1, l2, fl, logo);
  } else if (layout === 'iphone6p' || layout === 'iphone7p') {
    const is7 = layout === 'iphone7p';
    const r = 0.06 * W;
    const cx = W / 2 - 0.13 * W, cy = H / 2 - 0.085 * W;
    if (is7) {
      // dual-camera pill
      const pill = new THREE.Mesh(slab(r * 5.2, r * 2.6, r * 1.3, 0.7 * MM, 0.25 * MM), backMat);
      pill.position.set(cx - r * 1.3, cy, -0.3 * MM);
      const l1 = lens(r, 0.9 * MM); l1.position.set(cx, cy, -0.55 * MM);
      const l2 = lens(r, 0.9 * MM); l2.position.set(cx - r * 2.6, cy, -0.55 * MM);
      g.add(pill, l1, l2);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, 0.45 * MM, 12, 40), new THREE.MeshStandardMaterial({ color: '#8C8F94', metalness: 1, roughness: 0.25 }));
      ring.position.set(cx, cy, -0.3 * MM);
      const l = lens(r, 0.8 * MM); l.position.set(cx, cy, -0.35 * MM);
      g.add(ring, l);
    }
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.3 * MM, 24), mats.flash);
    fl.rotation.x = Math.PI / 2; fl.position.set(cx - r * (is7 ? 5.2 : 2.6), cy, -0.2 * MM);
    // antenna lines across the aluminium back
    const bandMat = new THREE.MeshStandardMaterial({ color: is7 ? '#232427' : '#45474B', roughness: 0.6 });
    for (const y of [H / 2 - 0.1 * H, -H / 2 + 0.1 * H]) {
      for (const dy of is7 ? [0] : [-0.9 * MM, 0.9 * MM]) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.99, 0.5 * MM), bandMat);
        band.rotation.y = Math.PI; band.position.set(0, (is7 ? (y > 0 ? H / 2 - 0.03 * H : -H / 2 + 0.03 * H) : y) + dy, -0.04 * MM);
        g.add(band);
      }
    }
    const logo = logoMesh('apple', 0.019, new THREE.MeshStandardMaterial({ color: is7 ? '#18191B' : '#C9CBCE', metalness: 1, roughness: is7 ? 0.08 : 0.12 }));
    logo.position.set(0, 0.006, -0.08 * MM);
    g.add(fl, logo);
  } else if (layout === 'redmi') {
    const r = 0.075 * W;
    const cam = lens(r, 0.6 * MM); cam.position.set(0, H / 2 - 0.13 * H, -0.2 * MM); // near-flush
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.3 * MM, 24), mats.flash);
    fl.rotation.x = Math.PI / 2; fl.position.set(0, H / 2 - 0.13 * H - r * 2.1, -0.2 * MM);
    const fp = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.35 * MM, 12, 40), mats.lensRing);
    fp.position.set(0, H / 2 - 0.31 * H, -0.1 * MM);
    const stripMat = new THREE.MeshStandardMaterial({ color: '#DCDEE1', roughness: 0.6 });
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.98, 0.6 * MM), stripMat);
    s1.position.set(0, H / 2 - 0.06 * H, -0.05 * MM); s1.rotation.y = Math.PI;
    const s2 = s1.clone(); s2.position.y = -H / 2 + 0.06 * H;
    const logo = logoMesh('mi', 0.0042, new THREE.MeshStandardMaterial({ color: '#6E737A', metalness: 0.7, roughness: 0.3 }));
    logo.position.set(0, -H / 2 + 0.2 * H, -0.08 * MM);
    g.add(cam, fl, fp, s1, s2, logo);
  } else if (layout === 'slvr') {
    slvrBack(g, W, H, backMat);
  } else if (layout === 'karbonn') {
    // camera with its signature red ring, flash beside it, red wordmark and a small two-slot speaker
    const r = 0.075 * W, cy = H / 2 - 0.14 * H;
    const red = new THREE.MeshPhysicalMaterial({ color: '#C8202E', roughness: 0.25, clearcoat: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.3, 0.8 * MM, 16, 48), red);
    ring.scale.z = 0.5; // a flat red bezel, not a donut
    ring.position.set(0, cy, -0.15 * MM);
    const cam = lens(r, 0.6 * MM); cam.position.set(0, cy, -0.2 * MM);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.3 * MM, 20), mats.flash);
    fl.rotation.x = Math.PI / 2; fl.position.set(-r * 2.9, cy, -0.15 * MM);
    const wm = textPlane('Karbonn', W * 0.34, 3.2 * MM, { color: '#C8202E', weight: 700 });
    wm.rotation.y = Math.PI; wm.position.set(0, -0.2 * H, -0.03 * MM);
    const grille = holesPlane(W * 0.14, 2.2 * MM, { rows: 2, cols: 1, round: false }); grille.rotation.y = Math.PI;
    grille.position.set(0, -0.28 * H, -0.03 * MM);
    g.add(ring, cam, fl, wm, grille);
  } else if (layout === 'motoe') {
    const r = 0.07 * W;
    const cam = lens(r, 0.6 * MM); cam.position.set(0, H / 2 - 0.13 * H, -0.2 * MM);
    // the dimple with the Motorola batwing below the camera
    const dimple = new THREE.Mesh(new THREE.CircleGeometry(r * 1.6, 40), new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.45, metalness: 0.2 }));
    dimple.rotation.y = Math.PI; dimple.position.set(0, H / 2 - 0.25 * H, -0.02 * MM);
    const logo = logoMesh('motorola', r * 2.2, new THREE.MeshStandardMaterial({ color: '#5A5C61', metalness: 0.8, roughness: 0.35 }));
    logo.position.set(0, H / 2 - 0.25 * H, -0.06 * MM);
    g.add(cam, dimple, logo);
  }
  return g;
}

let brushedTex = null;
function brushedTexture() {
  if (brushedTex) return brushedTex;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6a6a6a';
  g.fillRect(0, 0, S, S);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const v = 80 + rnd() * 70;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(rnd() * S - 100, rnd() * S, 80 + rnd() * 400, 1);
  }
  brushedTex = new THREE.CanvasTexture(c);
  brushedTex.wrapS = brushedTex.wrapT = THREE.RepeatWrapping;
  return brushedTex;
}

/** Side buttons, in the frame colour. */
function addButtons(root, layout, W, H, D, mat) {
  const btn = (len, x, y) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.9 * MM, len, D * 0.42, 3, 0.35 * MM), mat);
    m.position.set(x, y, 0);
    root.add(m);
  };
  const L = -W / 2 - 0.25 * MM, R = W / 2 + 0.25 * MM;
  if (layout === 'iphone13' || layout === 'iphone11' || layout === 'iphone6p' || layout === 'iphone7p') {
    btn(4.5 * MM, L, H / 2 - 17 * MM); // ring/silent switch
    btn(9 * MM, L, H / 2 - 29 * MM); // volume up
    btn(9 * MM, L, H / 2 - 41 * MM); // volume down
    btn(16 * MM, R, H / 2 - 33 * MM); // side button
  } else if (layout === 'redmi') {
    btn(22 * MM, R, H / 2 - 42 * MM); // volume rocker
    btn(10 * MM, R, H / 2 - 62 * MM); // power
  } else if (layout === 'slvr') {
    // positions from the product photos
    btn(11 * MM, L, H / 2 - 22.5 * MM); // volume
    btn(9 * MM, R, H / 2 - 18.5 * MM); // voice key
    btn(11 * MM, R, H / 2 - 72.5 * MM); // smart key
  } else if (layout === 'karbonn') {
    btn(14 * MM, L, H / 2 - 30 * MM); // volume
    btn(8 * MM, R, H / 2 - 22 * MM); // power
  } else if (layout === 'motoe') {
    btn(9 * MM, R, H / 2 - 22 * MM); // power
    btn(18 * MM, R, H / 2 - 40 * MM); // volume
  }
}

/**
 * Build a phone. Returns { root, cover, battery, openSide, dims }.
 * `root` is centred on the phone's middle.
 */
export function buildPhone(phone, { simple = false } = {}) {
  const { w, h, d } = phone.dimensionsMm;
  const W = w * MM, H = h * MM, D = d * MM;
  const look = phone.look ?? {};
  const r = Math.min(W, H) * (simple ? 0.14 : (CORNER[look.backLayout] ?? 0.12));
  const root = new THREE.Group();
  root.name = phone.id;

  const bodyColor = look.frame ?? phone.color?.hex ?? '#222';
  const isMetalBack = (look.backMetalness ?? 0) > 0.5;
  // Anodised aluminium frame
  const frameMat = new THREE.MeshPhysicalMaterial({ color: bodyColor, metalness: 1, roughness: look.frameRoughness ?? 0.3, envMapIntensity: 1 });
  const backMat = isMetalBack
    // bead-blasted / brushed aluminium unibody back
    ? new THREE.MeshPhysicalMaterial({
      color: look.back, metalness: 1, roughness: look.backRoughness ?? 0.4, roughnessMap: brushedTexture(),
      anisotropy: 0.6, anisotropyRotation: 0, envMapIntensity: 1,
    })
    // colour-infused glass back: glossy, reflects the room
    : new THREE.MeshPhysicalMaterial({
      color: look.back ?? phone.color?.hex ?? '#222', metalness: 0, roughness: look.backRoughness ?? 0.08,
      // glass backs get a thin clearcoat; matte plastic backs don't
      clearcoat: (look.backRoughness ?? 0.08) > 0.25 ? 0 : 0.35, clearcoatRoughness: 0.05, specularIntensity: 0.35, envMapIntensity: 1,
    });
  // Colour-infused glass should read as its own colour, with only a soft sheen of the room on top
  if (!isMetalBack && (look.backRoughness ?? 0.08) <= 0.25) backMat.userData.envScale = 0.3;
  const frontMat = new THREE.MeshPhysicalMaterial({ color: look.front ?? '#050506', roughness: 0.12, clearcoat: 0.25, clearcoatRoughness: 0.05, specularIntensity: 0.4, envMapIntensity: 1 });
  // grazing reflections on the glass edge were drawing a bright outline round dark phones
  frontMat.userData.envScale = 0.35;

  // Frame ring (hollow so the interior shows once a cover is lifted)
  // the bevel grows the outline by bevelSize, so draw the shape that much smaller to keep the real width/height
  const outline = OUTLINES[look.backLayout] ?? null;
  const side = SIDES[look.backLayout];
  const bev = side?.bev ?? Math.min(0.9 * MM, D * 0.15), bs = side?.bs ?? bev * 0.6;
  const outer = outlineShape(W - 2 * bs, H - 2 * bs, r - bs, outline);
  const inner = outlineShape(W - 2.2 * MM + 2 * bs, H - 2.2 * MM + 2 * bs, Math.max(r - 1.1 * MM + bs, 0.5 * MM), outline);
  // front/back plates sit inside the rounded edge when the sides are pill-shaped
  const plateInset = side ? 2 * bs + 0.3 * MM : 0.4 * MM;
  outer.holes.push(new THREE.Path(inner.getPoints(24)));
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: D - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bs, bevelSegments: 4, curveSegments: 24 });
  frameGeo.translate(0, 0, -(D - bev * 2) / 2);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.castShadow = true;
  root.add(frame);

  const glassT = 0.8 * MM;
  // Front: glass + lit screen
  const front = new THREE.Group();
  const frontGlass = new THREE.Mesh(slab(W - plateInset, H - plateInset, r - 0.2 * MM, glassT, 0.25 * MM, outline), frontMat);
  frontGlass.castShadow = true;
  front.add(frontGlass);
  const bz = BEZELS[look.backLayout] ?? BEZELS.default;
  const bezelSide = bz[0] * MM, bezelTop = bz[1] * MM, bezelBottom = bz[2] * MM;
  const sw = W - bezelSide * 2, sh = H - bezelTop - bezelBottom;
  const screenTex = simple ? null : look.backLayout === 'slvr' ? featureScreenTexture(phone, sh / sw) : lockScreenTexture(phone, sh / sw, NOTCHED.has(look.backLayout));
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, color: simple ? '#0c0d10' : '#e4e4e4', toneMapped: false });
  const screenGeo = flatRect(sw, sh, NOTCHED.has(look.backLayout) ? r - bz[0] * MM : 0.6 * MM);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, (bezelBottom - bezelTop) / 2, glassT / 2 + 0.02 * MM);
  front.add(screen);
  // cover glass over the lit screen: adds only reflections (black diffuse, additive)
  // only over the lit screen: across the bezels it read as a grey rim
  const sheen = new THREE.Mesh(flatRect(sw, sh, NOTCHED.has(look.backLayout) ? r - bz[0] * MM : 0.6 * MM), new THREE.MeshPhysicalMaterial({
    color: '#000000', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.35,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sheen.material.userData.keepEnv = true; // faint room reflection only; never washes out the screen
  sheen.position.set(0, (bezelBottom - bezelTop) / 2, glassT / 2 + 0.06 * MM);
  sheen.renderOrder = 2;
  front.add(sheen);
  if (!simple) addFrontDetails(front, look, W, H, { sw, sh, bezelTop, bezelBottom, z: glassT / 2 });
  front.position.z = D / 2 - glassT / 2;
  root.add(front);

  // Back cover
  const back = new THREE.Group();
  const backPlate = new THREE.Mesh(slab(W - plateInset, H - plateInset, r - 0.2 * MM, glassT, 0.25 * MM, outline), backMat);
  backPlate.castShadow = true;
  back.add(backPlate);
  if (!simple) {
    const det = buildBackDetails(phone, W, H, backMat);
    det.position.z = -glassT / 2;
    back.add(det);
  } else {
    // a simple camera dot so work phones read as phones from behind
    const l = lens(W * 0.07, 0.8 * MM); l.position.set(W * 0.3, H * 0.4, -glassT / 2 - 0.3 * MM); back.add(l);
  }
  back.position.z = -D / 2 + glassT / 2;
  root.add(back);

  let interior = null;
  let battery = null;
  let openSide = 1;
  let setBatteryOut = null;
  if (phone.teardown && !simple) {
    openSide = phone.teardown.openFrom === 'back' ? -1 : 1;
    // detailed interior laid out after iFixit teardowns (one branch per backLayout)
    const inside = buildDetailedInterior(phone, W, H, D, openSide, outline ? 12 * MM : r);
    interior = inside.group;
    battery = inside.battery;
    root.add(interior);
  }

  if (!simple) addButtons(root, look.backLayout, W, H, D, frameMat);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    root,
    cover: openSide === 1 ? front : back,
    front,
    back,
    interior,
    battery,
    openSide,
    setBatteryOut,
    dims: { W, H, D },
  };
}
