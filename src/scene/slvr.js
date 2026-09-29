// Motorola SLVR L7e (blue), traced from GSMArena's official front/back photos.
// All positions below are millimetres measured on those photos at 1:1 scale
// (x from the left edge, y from the top edge, as seen from the side being drawn).

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { lens, flatShape, archedShape } from './phone.js';
import { LOGO_PATHS } from '../logos.js';

// local copy: phone.js imports this module, so its MM isn't initialised yet when this file runs
const MM = 0.001;

// Outline: the top and bottom edges are gentle arcs, the sides are straight.
export const SLVR_OUTLINE = { top: 4.0 * MM, bot: 3.7 * MM, cvTop: 7.8 * MM, cvBot: 8.2 * MM, ch: 2.5 * MM };
// Rounded sides (the body is a soft pill in cross-section, not a flat slab).
// Sides: flat walls with a small rounded edge (the phone is a thin slab, not a pill).
export const SLVR_SIDE = { bev: 1.3 * MM, bs: 0.9 * MM };
// Screen (LCD) placement: side, top, bottom bezels in mm.
export const SLVR_BEZELS = [9.05, 18.5, 55.5];

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

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** A tapered speaker slot (thick in the middle, pointed at the ends, slightly smiling). */
function slot(g, x0, x1, y, th, lift) {
  const xm = (x0 + x1) / 2;
  g.beginPath();
  g.moveTo(x0, y - lift);
  g.quadraticCurveTo(xm, y - th, x1, y - lift);
  g.quadraticCurveTo(xm, y + th + lift * 0.5, x0, y - lift);
  g.fill();
}

/** A row separator on the keypad: a thin line whose ends curve up. */
function sepLine(g, x0, x1, y, lift) {
  g.beginPath();
  g.moveTo(x0, y - lift);
  g.quadraticCurveTo(x0 + 3, y, x0 + 6, y);
  g.lineTo(x1 - 6, y);
  g.quadraticCurveTo(x1 - 3, y, x1, y - lift);
  g.stroke();
}

function frontTexture(W, H) {
  return canvasTex(W, H, (g) => {
    // body: dark navy, a touch lighter towards the rounded side edges
    const side = g.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, '#5a6078'); side.addColorStop(0.07, '#363c52'); side.addColorStop(0.93, '#363c52'); side.addColorStop(1, '#5a6078');
    g.fillStyle = side; g.fillRect(0, 0, W, H);

    // earpiece slots either side of the emblem
    g.fillStyle = 'rgba(150,160,190,0.35)';
    slot(g, 6.8, 17.2, 9.7, 0.85, 0.9);
    slot(g, 31.8, 42.2, 9.7, 0.85, 0.9);
    g.fillStyle = '#05070c';
    slot(g, 6.8, 17.2, 9.4, 0.75, 0.9);
    slot(g, 31.8, 42.2, 9.4, 0.75, 0.9);

    // blue surround of the display, with the MOTOROLA wordmark on it
    const frame = g.createLinearGradient(0, 13.5, 0, 60.5);
    frame.addColorStop(0, '#343b86'); frame.addColorStop(0.5, '#2b3172'); frame.addColorStop(1, '#262c66');
    g.fillStyle = frame; rrect(g, 5, 13.4, 39, 47.2, [3.2, 3.2, 1.2, 1.2]); g.fill();
    g.fillStyle = '#05070b'; rrect(g, 6.5, 17.7, 36, 41.1, 0.8); g.fill();
    g.fillStyle = '#f2f4fa';
    g.font = '700 1.85px Arial, Helvetica, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '0.35px';
    g.fillText('MOTOROLA', W / 2, 16.9);
    if ('letterSpacing' in g) g.letterSpacing = '0px';

    // keypad plate: royal blue with a darker rim and a soft sheen across the top
    const kx = 4.7, ky = 60.6, kw = 39.6, kh = 45.6;
    const kp = g.createRadialGradient(24.5, 86, 2, 24.5, 84, 30);
    kp.addColorStop(0, '#5053b8'); kp.addColorStop(0.55, '#3d40a0'); kp.addColorStop(1, '#23255e');
    g.fillStyle = kp; rrect(g, kx, ky, kw, kh, [2, 2, 4, 4]); g.fill();
    const sheen = g.createLinearGradient(8, 60, 30, 72);
    sheen.addColorStop(0, 'rgba(170,175,255,0.4)'); sheen.addColorStop(0.5, 'rgba(160,170,255,0.08)'); sheen.addColorStop(1, 'rgba(160,170,255,0)');
    g.fillStyle = sheen; rrect(g, kx, ky, kw, 14, [2, 2, 0, 0]); g.fill();

    // soft-key dots and strokes, icon keys, call/end
    const ink = '#e9ecf8';
    g.fillStyle = ink;
    for (const x of [12.5, 36.5]) { g.beginPath(); g.arc(x, 65, 0.55, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(210,216,245,0.85)'; g.lineWidth = 0.28; g.lineCap = 'round';
    const stroke = (x0, x1, y, lift) => { g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + lift, x1, y - lift * 0.3); g.stroke(); };
    stroke(7.2, 15.2, 67.6, -0.6); stroke(41.8, 33.8, 67.6, -0.6);
    stroke(6.8, 14.8, 73.4, 0.5); stroke(42.2, 34.2, 73.4, 0.5);
    stroke(7.2, 16, 79.2, 0.6); stroke(41.8, 33, 79.2, 0.6);
    // globe (browser) and shortcut keys
    g.lineWidth = 0.22;
    g.beginPath(); g.arc(10.8, 70.6, 1.1, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(10.8, 70.6, 0.45, 1.1, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(9.7, 70.6); g.lineTo(11.9, 70.6); g.stroke();
    g.font = '700 2.3px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('C', 38, 70.7);
    g.beginPath(); g.arc(39.1, 71.1, 0.55, Math.PI * 1.1, Math.PI * 2.4); g.stroke();
    // send (green) and end (red)
    const phoneKey = (x, y, col, down) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 1.15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.3;
      g.beginPath(); g.arc(x, y + (down ? 0.25 : -0.1), 0.55, down ? Math.PI * 1.05 : Math.PI * 0.2, down ? Math.PI * 1.95 : Math.PI * 1.3, false); g.stroke();
    };
    phoneKey(11, 76.2, '#3cbf53', false);
    phoneKey(38, 76.2, '#e4413a', true);

    // number keys: curved separators and silver-white legends
    g.strokeStyle = 'rgba(205,212,245,0.8)'; g.lineWidth = 0.26;
    for (const y of [86.6, 92.0, 97.5, 103.0]) sepLine(g, 7, 42, y, 1.1);
    g.fillStyle = ink;
    const rows = [83.8, 89.3, 94.8, 100.3];
    const digit = (t, x, y, align) => { g.font = '700 4.4px "Arial Narrow", Arial, sans-serif'; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y + 0.15); };
    const letters = (t, x, y, align) => { g.font = '600 1.75px Arial, sans-serif'; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y + 0.45); };
    const keys = [
      ['1', '.,@'], ['2', 'ABC'], ['3', 'DEF'],
      ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
      ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ];
    keys.forEach(([d, l], i) => {
      const y = rows[Math.floor(i / 3)], col = i % 3;
      if (col === 0) { digit(d, 9.3, y, 'left'); letters(l, 11.4, y, 'left'); }
      if (col === 1) { digit(d, 22.6, y, 'left'); letters(l, 24.7, y, 'left'); }
      if (col === 2) { digit(d, 41.4, y, 'right'); letters(l, 39.1, y, 'right'); }
    });
    // bottom row: *, 0 and #
    digit('✱', 9.2, rows[3], 'left'); letters('⌴ 🔒︎', 11.6, rows[3], 'left');
    digit('0', 22.6, rows[3], 'left'); letters('+ ↑', 24.7, rows[3], 'left');
    digit('#', 41.4, rows[3], 'right'); letters('⌨', 38.9, rows[3], 'right');
  });
}

function backTexture(W, H) {
  return canvasTex(W, H, (g) => {
    // satin navy; lighting does the shading, so this stays close to the plain colour
    const base = g.createLinearGradient(0, 0, W, 0);
    base.addColorStop(0, '#343a4c'); base.addColorStop(0.5, '#282d3c'); base.addColorStop(1, '#222634');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const ink = '#e8ebf2';
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 0.28; g.lineCap = 'round';
    // USB mark
    g.beginPath(); g.moveTo(7.2, 21); g.lineTo(7.2, 17.3); g.stroke();
    g.beginPath(); g.moveTo(7.2, 19.8); g.lineTo(6.2, 18.9); g.lineTo(6.2, 18.2); g.stroke();
    g.beginPath(); g.moveTo(7.2, 19.3); g.lineTo(8.2, 18.5); g.lineTo(8.2, 17.9); g.stroke();
    g.beginPath(); g.moveTo(6.8, 17.6); g.lineTo(7.2, 16.9); g.lineTo(7.6, 17.6); g.fill();
    g.beginPath(); g.arc(7.2, 21.2, 0.35, 0, Math.PI * 2); g.fill();
    // microSD | Bluetooth
    g.strokeRect(22.2, 81.8, 2.2, 2.7);
    g.fillRect(22.6, 82.2, 0.5, 0.6);
    g.beginPath(); g.moveTo(25.5, 81.3); g.lineTo(25.5, 85.1); g.stroke();
    g.beginPath(); g.moveTo(26.8, 82.2); g.lineTo(28.4, 83.8); g.lineTo(27.6, 84.6); g.lineTo(27.6, 81.4); g.lineTo(28.4, 82.2); g.lineTo(26.8, 83.8); g.stroke();
    g.font = '600 0.8px Arial'; g.fillText('®', 28.8, 81.9);

    // the removable bottom cap: seam, speaker slots, the round key and two screws
    g.strokeStyle = '#070a12'; g.lineWidth = 0.32;
    g.beginPath(); g.moveTo(1.2, 90.8); g.lineTo(47.8, 90.8); g.stroke();
    g.strokeStyle = 'rgba(120,135,170,0.35)'; g.lineWidth = 0.2;
    g.beginPath(); g.moveTo(1.2, 91.2); g.lineTo(47.8, 91.2); g.stroke();
    for (let i = 0; i < 7; i++) {
      const x = 17.4 + i * 2.37;
      g.fillStyle = '#04060b'; rrect(g, x - 0.55, 96, 1.1, 11.2, 0.55); g.fill();
      g.strokeStyle = 'rgba(130,145,180,0.35)'; g.lineWidth = 0.15; rrect(g, x - 0.62, 95.9, 1.24, 11.4, 0.62); g.stroke();
    }
    g.strokeStyle = '#070a12'; g.lineWidth = 0.3;
    g.beginPath(); g.arc(40.3, 98.2, 2.8, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(130,145,180,0.35)'; g.lineWidth = 0.15;
    g.beginPath(); g.arc(40.3, 98.2, 3.05, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    g.fillStyle = '#05070c';
    for (const x of [3.6, 45.3]) { g.beginPath(); g.arc(x, 100.5, 0.45, 0, Math.PI * 2); g.fill(); }
  });
}

const chrome = () => {
  // a touch of emission stands in for the bright studio reflections chrome shows in real photos
  const m = new THREE.MeshStandardMaterial({ color: '#f1f3f7', metalness: 1, roughness: 0.08, emissive: '#8a8e96', emissiveIntensity: 0.35 });
  m.userData.envScale = 1.5; // polished chrome: brighter than the phone's satin metal
  return m;
};

/**
 * The batwing "M" on its own. Simple Icons draws the mark as a disc with the M cut out,
 * so take the cut-outs (holes) as shapes: that gives a dark M to sit on a chrome disc.
 */
function batwing(size) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${LOGO_PATHS.motorola}"/></svg>`);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const holes = shapes.flatMap((sh) => sh.holes.map((h) => new THREE.Shape(h.getPoints(24))));
  const geo = new THREE.ShapeGeometry(holes.length ? holes : shapes, 16);
  geo.translate(-12, -12, 0);
  geo.scale(size / 24, -size / 24, 1); // SVG is y-down
  return geo;
}

/** Chrome disc with the batwing mark, as on the front and the back of the phone. */
function emblem(radius, thick, facing) {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.03, thick, 64), chrome());
  disc.rotation.x = Math.PI / 2;
  grp.add(disc);
  const mark = new THREE.Mesh(batwing(radius * 2), new THREE.MeshStandardMaterial({ color: '#2a2e3c', metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }));
  if (facing < 0) mark.rotation.y = Math.PI; // read correctly from behind
  mark.position.z = facing * (thick / 2 + 0.03 * MM);
  grp.add(mark);
  return grp;
}

/** Front of the phone: decal face, chrome emblem and nav ring, placed on the front glass. */
export function slvrFront(front, W, H, z, bezels) {
  const wmm = W / MM, hmm = H / MM;
  const face = new THREE.Mesh(
    // the face sits inside the rounded side edges; UVs span the full body so photo mm map 1:1
    flatShape(archedShape(W - 2.2 * MM, H - 2.2 * MM, SLVR_OUTLINE), W, H),
    new THREE.MeshPhysicalMaterial({ map: frontTexture(wmm, hmm), roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.12, metalness: 0.15 }),
  );
  face.material.userData.envScale = 0.5;
  face.position.z = z + 0.01 * MM;
  front.add(face);
  // mm on the photo → local position
  const at = (xmm, ymm) => new THREE.Vector2((xmm - wmm / 2) * MM, (hmm / 2 - ymm) * MM);

  const e = emblem(4.0 * MM, 0.4 * MM, 1);
  const ep = at(24.5, 4.3);
  e.position.set(ep.x, ep.y, z + 0.2 * MM); // sits only ~0.4 mm proud of the face
  front.add(e);

  // navigation ring: domed chrome ring, dark centre key with a thin bright rim, four arrow ticks
  const np = at(24.5, 72.2);
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, rr = 3.9 + t * 4.1;
    prof.push(new THREE.Vector2(rr * MM, (0.35 * Math.sin(Math.PI * (0.15 + 0.7 * t)) * MM)));
  }
  prof.push(new THREE.Vector2(8.0 * MM, 0), new THREE.Vector2(3.9 * MM, 0));
  const ringMat = chrome(); ringMat.side = THREE.DoubleSide;
  const ring = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(np.x, np.y, z);
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(3.25 * MM, 3.25 * MM, 0.3 * MM, 48),
    new THREE.MeshPhysicalMaterial({ color: '#0c1024', roughness: 0.15, clearcoat: 0.8 }));
  centre.rotation.x = Math.PI / 2; centre.position.set(np.x, np.y, z + 0.15 * MM);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.55 * MM, 0.22 * MM, 12, 64), chrome());
  rim.position.set(np.x, np.y, z + 0.22 * MM);
  front.add(ring, centre, rim);
  const tick = new THREE.MeshStandardMaterial({ color: '#8d93a6', metalness: 0.8, roughness: 0.3 });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.45 * MM, 3), tick);
    tri.position.set(np.x + Math.cos(a) * 6.1 * MM, np.y + Math.sin(a) * 6.1 * MM, z + 0.37 * MM);
    tri.rotation.z = a;
    front.add(tri);
  }
  void bezels;
}

/** Back of the phone (added to the back cover group, facing -z). */
export function slvrBack(g, W, H, backMat) {
  const wmm = W / MM, hmm = H / MM;
  const face = new THREE.Mesh(
    flatShape(archedShape(W - 2.2 * MM, H - 2.2 * MM, SLVR_OUTLINE), W, H),
    new THREE.MeshPhysicalMaterial({ map: backTexture(wmm, hmm), roughness: 0.42, metalness: 0.35 }),
  );
  face.rotation.y = Math.PI; // reads correctly from behind
  face.position.z = -0.02 * MM;
  g.add(face);
  // mm measured on the back photo (x from the left as seen from behind) → local coords
  const at = (xmm, ymm) => new THREE.Vector2((wmm / 2 - xmm) * MM, (hmm / 2 - ymm) * MM);

  // camera window: a glossy black trapezoid with the lens and "MEGA PIXEL" under it
  const tz = new THREE.Shape();
  tz.moveTo(-7.1 * MM, 5.4 * MM); tz.lineTo(7.1 * MM, 5.4 * MM); tz.lineTo(6.2 * MM, -5.4 * MM); tz.lineTo(-6.2 * MM, -5.4 * MM); tz.lineTo(-7.1 * MM, 5.4 * MM);
  const win = new THREE.Mesh(new THREE.ExtrudeGeometry(tz, { depth: 0.15 * MM, bevelEnabled: true, bevelThickness: 0.08 * MM, bevelSize: 0.2 * MM, bevelSegments: 2 }),
    new THREE.MeshPhysicalMaterial({ color: '#0d0f13', roughness: 0.1, clearcoat: 1 }));
  const wp = at(24.5, 7.2);
  win.position.set(wp.x, wp.y, -0.25 * MM); // near-flush window
  g.add(win);
  const lp = at(24.5, 6.6);
  const l = lens(2.2 * MM, 0.3 * MM); l.position.set(lp.x, lp.y, -0.3 * MM); g.add(l);
  const lr = new THREE.Mesh(new THREE.TorusGeometry(2.55 * MM, 0.18 * MM, 12, 48), chrome());
  lr.position.set(lp.x, lp.y, -0.3 * MM); g.add(lr);
  const label = document.createElement('canvas'); label.width = 256; label.height = 32;
  const lg = label.getContext('2d'); lg.fillStyle = '#e6e8ee'; lg.font = '700 22px Arial'; lg.textAlign = 'center'; lg.fillText('MEGA PIXEL', 128, 24);
  const lt = new THREE.CanvasTexture(label); lt.colorSpace = THREE.SRGBColorSpace;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(7 * MM, 0.9 * MM), new THREE.MeshBasicMaterial({ map: lt, transparent: true }));
  const labp = at(24.5, 10.9);
  lab.rotation.y = Math.PI; lab.position.set(labp.x, labp.y, -0.36 * MM); g.add(lab);

  // chrome Motorola disc
  const e = emblem(5.1 * MM, 0.25 * MM, -1);
  const ep = at(24.5, 42);
  e.position.set(ep.x, ep.y, -0.12 * MM);
  g.add(e);
  void backMat;
}
