// Procedural phone models built from the dimensions in phones.json.
// 1 scene unit = 1 metre. Phone local axes: +x right, +y up, +z out of the screen.

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LOGO_PATHS } from '../logos.js';
import { buildDetailedInterior } from './interior.js';

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

/** A thin rounded slab centred on z=0, thickness t. */
export function slab(w, h, r, t, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(r - bevel, 0.0001)), {
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
  redmi: [3.8, 16, 12],
  slvr: [9.5, 12, 64], // 1.9" screen up top, etched metal keypad below
  karbonn: [5.8, 18, 23],
  motoe: [5.65, 14.5, 15.1],
};
const CORNER = { iphone13: 0.17, redmi: 0.12, slvr: 0.1, karbonn: 0.16, motoe: 0.17 };

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
    g.textAlign = 'left'; g.fillText('Contacts', 10, H - 12);
    g.textAlign = 'right'; g.fillText('Menu', W - 10, H - 12);
  });
}

/** The SLVR's flat, laser-etched metal keypad. */
function keypadTexture(wmm, hmm, base) {
  const S = 30;
  return canvasTexture(Math.round(wmm * S), Math.round(hmm * S), (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    // brushed streaks
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(0, Math.random() * H, W, 1); }
    const line = 'rgba(40,42,46,0.7)';
    g.strokeStyle = line; g.lineWidth = 2;
    const top = H * 0.36; // nav cluster above the number grid
    // soft keys + call/end
    g.fillStyle = '#2B2D31';
    const nx = W / 2, ny = top * 0.5, nr = top * 0.34;
    g.beginPath(); g.arc(nx, ny, nr, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(nx, ny, nr * 0.42, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#2B2D31';
    for (const [x, y] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { g.beginPath(); g.arc(nx + x * nr * 0.72, ny + y * nr * 0.72, 3, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(W * 0.06, top * 0.18); g.lineTo(W * 0.26, top * 0.18); g.stroke();
    g.beginPath(); g.moveTo(W * 0.74, top * 0.18); g.lineTo(W * 0.94, top * 0.18); g.stroke();
    g.fillStyle = '#2E8B45'; g.font = `700 ${top * 0.2}px system-ui`; g.textAlign = 'center';
    g.fillText('✆', W * 0.14, top * 0.72);
    g.fillStyle = '#B8332E'; g.fillText('✆', W * 0.86, top * 0.72);
    // 4×3 grid, separated by etched lines like the real keypad
    const gy = top, gh = H - top - H * 0.04, rows = 4, cols = 3;
    for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(W * 0.05, gy + (gh / rows) * r); g.lineTo(W * 0.95, gy + (gh / rows) * r); g.stroke(); }
    g.beginPath(); g.moveTo(W * 0.05, gy); g.lineTo(W * 0.95, gy); g.stroke();
    const keys = ['1', '2 abc', '3 def', '4 ghi', '5 jkl', '6 mno', '7 pqrs', '8 tuv', '9 wxyz', '*', '0 +', '#'];
    g.fillStyle = '#1E2023';
    keys.forEach((k, i) => {
      const cx = W * (0.18 + (i % cols) * 0.32), cy = gy + (Math.floor(i / cols) + 0.5) * (gh / rows);
      const [n, l] = k.split(' ');
      g.font = `600 ${gh / rows * 0.42}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(n, cx - (l ? W * 0.04 : 0), cy);
      if (l) { g.font = `500 ${gh / rows * 0.2}px system-ui`; g.fillText(l, cx + W * 0.07, cy + 2); }
    });
  });
}

function addFrontDetails(front, look, W, H, { sw, sh, bezelTop, bezelBottom, z }) {
  const layout = look.backLayout;
  const zt = z + 0.03 * MM;
  const dark = new THREE.MeshStandardMaterial({ color: '#0A0A0B', roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#C9CCD0', metalness: 1, roughness: 0.25 });
  if (layout === 'redmi') {
    const spk = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.16, 0.9 * MM), new THREE.MeshStandardMaterial({ color: '#B8BCC2', roughness: 0.5 }));
    spk.position.set(0, H / 2 - bezelTop / 2, zt);
    front.add(spk);
  } else if (layout === 'slvr') {
    const kh = bezelBottom - 4 * MM, kw = W - 5 * MM;
    const pad = decalPlane(kw, kh, keypadTexture(kw / MM, kh / MM, look.keypad ?? '#A7ABB1'), { rough: 0.35, metal: 0.85, transparent: false });
    pad.position.set(0, -H / 2 + 2 * MM + kh / 2, zt);
    front.add(pad);
    const wm = textPlane('MOTOROLA', W * 0.42, 2.2 * MM, { color: '#C9CCD0', weight: 600, spacing: 0.25 });
    wm.position.set(0, H / 2 - bezelTop * 0.62, zt);
    const ear = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.2, 0.8 * MM), dark);
    ear.position.set(0, H / 2 - bezelTop * 0.22, zt);
    front.add(wm, ear);
  } else if (layout === 'karbonn') {
    const ear = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.2, 1.1 * MM), new THREE.MeshStandardMaterial({ color: '#8E8A82', roughness: 0.4, metalness: 0.6 }));
    ear.position.set(0, H / 2 - bezelTop * 0.45, zt);
    const cam = new THREE.Mesh(new THREE.CircleGeometry(0.9 * MM, 24), dark);
    cam.position.set(W * 0.22, H / 2 - bezelTop * 0.45, zt);
    // four capacitive keys: menu · home · back · search
    const keys = canvasTexture(600, 60, (g, Wc, Hc) => {
      g.strokeStyle = '#8B877E'; g.fillStyle = '#8B877E'; g.lineWidth = 5; g.lineCap = 'round';
      const cx = (i) => Wc * (0.125 + i * 0.25), cy = Hc / 2;
      g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(cx(0) - 14, cy + k * 10); g.lineTo(cx(0) + 14, cy + k * 10); } g.stroke();
      g.beginPath(); g.moveTo(cx(1) - 16, cy + 2); g.lineTo(cx(1), cy - 14); g.lineTo(cx(1) + 16, cy + 2); g.moveTo(cx(1) - 11, cy); g.lineTo(cx(1) - 11, cy + 16); g.lineTo(cx(1) + 11, cy + 16); g.lineTo(cx(1) + 11, cy); g.stroke();
      g.beginPath(); g.arc(cx(2), cy + 2, 12, -Math.PI * 0.5, Math.PI * 0.6); g.moveTo(cx(2), cy - 10); g.lineTo(cx(2) - 16, cy - 10); g.moveTo(cx(2) - 16, cy - 10); g.lineTo(cx(2) - 8, cy - 18); g.stroke();
      g.beginPath(); g.arc(cx(3) - 3, cy - 3, 10, 0, Math.PI * 2); g.moveTo(cx(3) + 5, cy + 5); g.lineTo(cx(3) + 14, cy + 14); g.stroke();
    });
    const kp = decalPlane(sw, sw * 0.1, keys);
    kp.position.set(0, -H / 2 + bezelBottom * 0.5, zt);
    front.add(ear, cam, kp);
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
    const logo = logoMesh('apple', 0.0135, new THREE.MeshStandardMaterial({ color: '#A8182C', metalness: 1, roughness: 0.18 }));
    logo.position.set(0, 0.004, -0.08 * MM);
    g.add(logo);
  } else if (layout === 'redmi') {
    const r = 0.075 * W;
    const cam = lens(r, 1.0 * MM); cam.position.set(0, H / 2 - 0.13 * H, -0.5 * MM);
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
    const r = 0.1 * W;
    const cam = lens(r, 0.8 * MM); cam.position.set(0, H / 2 - 0.1 * H, -0.4 * MM);
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.94, 0.25 * MM), new THREE.MeshStandardMaterial({ color: '#0A0A0B' }));
    seam.position.set(0, H / 2 - 0.2 * H, -0.03 * MM); seam.rotation.y = Math.PI;
    const logo = logoMesh('motorola', 0.009, new THREE.MeshStandardMaterial({ color: '#8A8D93', metalness: 0.9, roughness: 0.3 }));
    logo.position.set(0, -0.02 * H, -0.08 * MM);
    const grille = holesPlane(W * 0.3, 2.4 * MM, { rows: 2, cols: 10 }); grille.rotation.y = Math.PI;
    grille.position.set(0, -H / 2 + 0.1 * H, -0.03 * MM);
    g.add(cam, seam, logo, grille);
  } else if (layout === 'karbonn') {
    const r = 0.075 * W;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.35, 0.5 * MM, 12, 40), new THREE.MeshStandardMaterial({ color: '#C8C5BE', metalness: 1, roughness: 0.2 }));
    ring.position.set(0, H / 2 - 0.14 * H, -0.2 * MM);
    const cam = lens(r, 0.8 * MM); cam.position.set(0, H / 2 - 0.14 * H, -0.4 * MM);
    const fl1 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.38, 0.3 * MM, 20), mats.flash);
    fl1.rotation.x = Math.PI / 2; fl1.position.set(r * 2.6, H / 2 - 0.14 * H + r * 0.5, -0.15 * MM);
    const fl2 = fl1.clone(); fl2.position.y -= r;
    const wm = textPlane('KARBONN', W * 0.42, 3 * MM, { color: '#9C968B', weight: 800, spacing: 0.12 });
    wm.rotation.y = Math.PI; wm.position.set(0, -0.08 * H, -0.03 * MM);
    const grille = holesPlane(W * 0.34, 2.4 * MM, { rows: 1, cols: 7, round: false }); grille.rotation.y = Math.PI;
    grille.position.set(0, -H / 2 + 0.1 * H, -0.03 * MM);
    g.add(ring, cam, fl1, fl2, wm, grille);
  } else if (layout === 'motoe') {
    const r = 0.07 * W;
    const cam = lens(r, 0.8 * MM); cam.position.set(0, H / 2 - 0.13 * H, -0.4 * MM);
    // the dimple with the Motorola batwing below the camera
    const dimple = new THREE.Mesh(new THREE.CircleGeometry(r * 1.6, 40), new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.45, metalness: 0.2 }));
    dimple.rotation.y = Math.PI; dimple.position.set(0, H / 2 - 0.25 * H, -0.02 * MM);
    const logo = logoMesh('motorola', r * 2.2, new THREE.MeshStandardMaterial({ color: '#5A5C61', metalness: 0.8, roughness: 0.35 }));
    logo.position.set(0, H / 2 - 0.25 * H, -0.06 * MM);
    g.add(cam, dimple, logo);
  }
  return g;
}

function buildInterior(phone, W, H, D, side) {
  const g = new THREE.Group();
  const anchors = new Map();
  let battery = null;
  const plate = new THREE.Mesh(slab(W - 2 * MM, H - 2 * MM, 5 * MM, 0.6 * MM), mats.plate);
  plate.receiveShadow = true;
  g.add(plate);
  const IW = W - 5 * MM, IH = H - 6 * MM;
  const room = D / 2 - 1.4 * MM; // free depth on the open side
  for (const p of phone.teardown?.parts ?? []) {
    const cx = (p.u + p.w / 2 - 0.5) * IW * side; // mirrored when viewed from the back
    const cy = (p.v + p.h / 2 - 0.5) * IH;
    const w = p.w * IW, h = p.h * IH;
    let mesh, top, thick = 0;
    if (p.kind === 'board') {
      const t = 0.9 * MM;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mats.board);
      mesh.position.set(cx, cy, side * (0.3 * MM + t / 2)); top = 0.3 * MM + t;
    } else if (p.kind === 'chip') {
      const t = 0.8 * MM;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mats.chip);
      mesh.position.set(cx, cy, side * (1.2 * MM + t / 2)); top = 1.2 * MM + t;
    } else if (p.kind === 'battery') {
      const t = Math.min(room, 3.2 * MM);
      thick = t;
      mesh = new THREE.Mesh(slab(w, h, 2.5 * MM, t, 0.4 * MM), mats.battery);
      mesh.position.set(cx, cy, side * (0.3 * MM + t / 2)); top = 0.3 * MM + t;
      const tab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, h * 0.08), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 }));
      tab.position.set(0, -h * 0.4, side * (t / 2 + 0.05 * MM));
      if (side < 0) tab.rotation.y = Math.PI;
      mesh.add(tab);
      battery = mesh;
    } else if (p.kind === 'camera') {
      mesh = new THREE.Group();
      const t = Math.min(room, 3 * MM);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mats.module);
      mesh.add(body);
      const n = phone.look?.backLayout === 'iphone13' ? 2 : 1;
      const r = Math.min(w / (n + 0.6), h) * 0.42;
      for (let i = 0; i < n; i++) {
        const l = lens(r, 0.6 * MM);
        const off = n === 1 ? 0 : (i === 0 ? -1 : 1) * r * 1.05;
        l.position.set(off * side, n === 1 ? 0 : -off, side * (t / 2));
        mesh.add(l);
      }
      mesh.position.set(cx, cy, side * (0.3 * MM + t / 2)); top = 0.3 * MM + t;
    } else {
      const t = 1.6 * MM;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mats.module);
      mesh.position.set(cx, cy, side * (0.3 * MM + t / 2)); top = 0.3 * MM + t;
    }
    mesh.traverse?.((o) => { o.castShadow = true; o.receiveShadow = true; });
    g.add(mesh);
    if (p.spec || p.label) {
      const a = new THREE.Object3D();
      const [ox, oy] = p.hotspotOffset ?? [0, 0];
      a.userData = { part: p };
      if (p.kind === 'battery') {
        // rides along with the battery when it is lifted out
        a.position.set(ox * IW * side, oy * IH, side * (thick / 2 + 0.4 * MM));
        mesh.add(a);
      } else {
        a.position.set(cx + ox * IW * side, cy + oy * IH, side * (top + 0.4 * MM));
        g.add(a);
      }
      anchors.set(p.id, a);
    }
  }
  return { group: g, anchors, battery };
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
  if (layout === 'iphone13') {
    btn(4.5 * MM, L, H / 2 - 17 * MM); // ring/silent switch
    btn(9 * MM, L, H / 2 - 29 * MM); // volume up
    btn(9 * MM, L, H / 2 - 41 * MM); // volume down
    btn(16 * MM, R, H / 2 - 33 * MM); // side button
  } else if (layout === 'redmi') {
    btn(22 * MM, R, H / 2 - 42 * MM); // volume rocker
    btn(10 * MM, R, H / 2 - 62 * MM); // power
  } else if (layout === 'slvr') {
    btn(14 * MM, L, H / 2 - 30 * MM); // volume
    btn(7 * MM, R, H / 2 - 28 * MM); // smart key
    btn(7 * MM, R, H / 2 - 42 * MM); // camera key
  } else if (layout === 'karbonn') {
    btn(14 * MM, L, H / 2 - 30 * MM); // volume
    btn(8 * MM, R, H / 2 - 22 * MM); // power
  } else if (layout === 'motoe') {
    btn(9 * MM, R, H / 2 - 22 * MM); // power
    btn(18 * MM, R, H / 2 - 40 * MM); // volume
  }
}

/**
 * Build a phone. Returns { root, cover, battery, anchors, openSide, dims }.
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
  const frontMat = new THREE.MeshPhysicalMaterial({ color: look.front ?? '#050506', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1 });

  // Frame ring (hollow so the interior shows once a cover is lifted)
  const outer = roundedRectShape(W, H, r);
  const inner = roundedRectShape(W - 2.2 * MM, H - 2.2 * MM, Math.max(r - 1.1 * MM, 0.5 * MM));
  outer.holes.push(new THREE.Path(inner.getPoints(24)));
  const bev = Math.min(0.9 * MM, D * 0.15);
  const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: D - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 4, curveSegments: 24 });
  frameGeo.translate(0, 0, -(D - bev * 2) / 2);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.castShadow = true;
  root.add(frame);

  const glassT = 0.8 * MM;
  // Front: glass + lit screen
  const front = new THREE.Group();
  const frontGlass = new THREE.Mesh(slab(W - 0.4 * MM, H - 0.4 * MM, r - 0.2 * MM, glassT, 0.25 * MM), frontMat);
  frontGlass.castShadow = true;
  front.add(frontGlass);
  const bz = BEZELS[look.backLayout] ?? BEZELS.default;
  const bezelSide = bz[0] * MM, bezelTop = bz[1] * MM, bezelBottom = bz[2] * MM;
  const sw = W - bezelSide * 2, sh = H - bezelTop - bezelBottom;
  const screenTex = simple ? null : look.backLayout === 'slvr' ? featureScreenTexture(phone, sh / sw) : lockScreenTexture(phone, sh / sw, look.backLayout === 'iphone13');
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, color: simple ? '#0c0d10' : '#e4e4e4', toneMapped: false });
  const screenGeo = flatRect(sw, sh, look.backLayout === 'iphone13' ? r - 1.9 * MM : 0.6 * MM);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, (bezelBottom - bezelTop) / 2, glassT / 2 + 0.02 * MM);
  front.add(screen);
  // cover glass over the lit screen: adds only reflections (black diffuse, additive)
  const sheen = new THREE.Mesh(flatRect(W - 1 * MM, H - 1 * MM, r - 0.5 * MM), new THREE.MeshPhysicalMaterial({
    color: '#000000', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.35,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sheen.material.userData.keepEnv = true; // faint room reflection only; never washes out the screen
  sheen.position.z = glassT / 2 + 0.06 * MM;
  sheen.renderOrder = 2;
  front.add(sheen);
  if (!simple) addFrontDetails(front, look, W, H, { sw, sh, bezelTop, bezelBottom, z: glassT / 2 });
  front.position.z = D / 2 - glassT / 2;
  root.add(front);

  // Back cover
  const back = new THREE.Group();
  const backPlate = new THREE.Mesh(slab(W - 0.4 * MM, H - 0.4 * MM, r - 0.2 * MM, glassT, 0.25 * MM), backMat);
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
  let anchors = new Map();
  let openSide = 1;
  let setBatteryOut = null;
  if (phone.teardown && !simple) {
    openSide = phone.teardown.openFrom === 'back' ? -1 : 1;
    if (['redmi', 'iphone13', 'slvr', 'karbonn', 'motoe'].includes(look.backLayout)) {
      // detailed interior modelled on the iFixit teardown photos
      const inside = buildDetailedInterior(phone, W, H, D, openSide);
      interior = inside.group;
      battery = inside.battery;
      anchors = inside.anchors;
    } else {
      const inside = buildInterior(phone, W, H, D, openSide);
      interior = inside.group;
      battery = inside.battery;
      anchors = inside.anchors;
    }
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
    anchors,
    openSide,
    setBatteryOut,
    dims: { W, H, D },
  };
}
