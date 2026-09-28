// Detailed procedural phone interiors, laid out after the iFixit teardown photos
// (the photos are only a reference for where things sit; everything here is modelled).
//
// Everything is built in "viewer space": looking at the opened side, top of the phone up,
// +x to the viewer's right, +z towards the viewer. u runs 0→1 left→right, v 0→1 bottom→top,
// both across the usable interior. The whole group is turned round when the phone opens
// from the back.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MM, slab, lens, logoMesh, mats } from './phone.js';

// ---------- small helpers ----------

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const PX = 14; // canvas pixels per millimetre for decals

const M = {
  shield: new THREE.MeshStandardMaterial({ color: '#8E9297', metalness: 1, roughness: 0.66 }),
  shieldDark: new THREE.MeshStandardMaterial({ color: '#6F7378', metalness: 1, roughness: 0.45 }),
  chassis: new THREE.MeshStandardMaterial({ color: '#A9ADB2', metalness: 1, roughness: 0.5 }),
  screw: new THREE.MeshStandardMaterial({ color: '#5E6268', metalness: 1, roughness: 0.3 }),
  screwLight: new THREE.MeshStandardMaterial({ color: '#C4C7CC', metalness: 1, roughness: 0.25 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#151618', roughness: 0.55, metalness: 0.05 }),
  pouch: new THREE.MeshStandardMaterial({ color: '#101113', roughness: 0.62, metalness: 0.05 }),
  pcbEdge: new THREE.MeshStandardMaterial({ color: '#0E1411', roughness: 0.7 }),
  chip: new THREE.MeshStandardMaterial({ color: '#232427', roughness: 0.35, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#D2A64E', metalness: 1, roughness: 0.25 }),
  flexOrange: new THREE.MeshStandardMaterial({ color: '#C9731C', roughness: 0.35, metalness: 0.1 }),
  flexBlack: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.4, metalness: 0.05 }),
  coax: new THREE.MeshStandardMaterial({ color: '#0B0B0C', roughness: 0.5 }),
  adhesive: new THREE.MeshStandardMaterial({ color: '#BDBBB4', roughness: 0.85 }),
  connector: new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.5, metalness: 0.2 }),
  foam: new THREE.MeshStandardMaterial({ color: '#0C0C0D', roughness: 0.95 }),
};

// interior metals catch much less light than the outside of the phone
for (const k of ['shield', 'shieldDark', 'chassis', 'screw', 'screwLight', 'gold']) M[k].userData.envScale = 0.5;

// ---------- procedural textures ----------

function pcbTexture(wmm, hmm, seed) {
  const r = rng(seed);
  return canvasTex(Math.round(wmm * PX), Math.round(hmm * PX), (g, W, H) => {
    g.fillStyle = '#0F1512'; g.fillRect(0, 0, W, H);
    // copper traces under solder mask
    g.strokeStyle = 'rgba(46,72,58,0.55)'; g.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
      let x = r() * W, y = r() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (r() < 0.5) x += (r() - 0.5) * W * 0.25; else y += (r() - 0.5) * H * 0.25;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // passive parts and pads
    const cols = ['#20211F', '#8E7E5E', '#6E7174', '#2A2A28', '#4A3E2C', '#1A1A19'];
    for (let i = 0; i < (W * H) / 260; i++) {
      const x = r() * W, y = r() * H;
      const big = r() < 0.08;
      const w = big ? 10 + r() * 22 : 2 + r() * 6, h = big ? 8 + r() * 18 : 1.5 + r() * 3;
      const rot = r() < 0.5;
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(x, y, rot ? h : w, rot ? w : h);
      if (!big && r() < 0.6) {
        g.fillStyle = 'rgba(190,160,90,0.7)';
        rot ? (g.fillRect(x, y - 1, h, 1.2), g.fillRect(x, y + w, h, 1.2)) : (g.fillRect(x - 1, y, 1.2, h), g.fillRect(x + w, y, 1.2, h));
      }
    }
    // gold test points and via rings
    for (let i = 0; i < (W * H) / 16000; i++) {
      g.fillStyle = '#B8964E';
      g.beginPath(); g.arc(r() * W, r() * H, 1 + r() * 1.6, 0, Math.PI * 2); g.fill();
    }
    // a few square gold grounding pads
    for (let i = 0; i < 6; i++) {
      g.fillStyle = '#A88A48';
      g.fillRect(r() * W, r() * H, 10 + r() * 14, 8 + r() * 10);
    }
  });
}

/** Transparent decal for a shield can: vent holes, dimples, an optional printed marking. */
function shieldDecal(wmm, hmm, { holes = 0, seed = 1, mark = null } = {}) {
  const r = rng(seed);
  return canvasTex(Math.round(wmm * PX), Math.round(hmm * PX), (g, W, H) => {
    // soft stamping marks
    g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 2;
    g.strokeRect(6, 6, W - 12, H - 12);
    for (let i = 0; i < holes; i++) {
      const x = W * (0.12 + r() * 0.76), y = H * (0.12 + r() * 0.76);
      g.fillStyle = 'rgba(12,12,14,0.95)';
      g.beginPath(); g.arc(x, y, 0.55 * PX, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, 0.62 * PX, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
    }
    if (mark) {
      g.fillStyle = 'rgba(40,42,46,0.55)';
      g.font = `600 ${Math.round(PX * 1.1)}px ui-monospace, monospace`;
      g.fillText(mark, W * 0.12, H * 0.85);
    }
  });
}

function barcodeTexture(wmm, hmm, seed, lines) {
  const r = rng(seed);
  return canvasTex(Math.round(wmm * PX * 1.5), Math.round(hmm * PX * 1.5), (g, W, H) => {
    g.fillStyle = '#F2F2EE'; g.fillRect(0, 0, W, H);
    const rows = lines.length;
    for (let k = 0; k < rows; k++) {
      const y0 = H * (0.08 + k * (0.84 / rows)), bh = H * (0.84 / rows) * 0.55;
      let x = W * 0.06;
      g.fillStyle = '#111';
      while (x < W * 0.94) { const bw = 1 + Math.floor(r() * 4); if (r() < 0.55) g.fillRect(x, y0, bw, bh); x += bw + 1; }
      g.font = `${Math.round(bh * 0.42)}px ui-monospace, monospace`;
      g.fillText(lines[k], W * 0.06, y0 + bh + bh * 0.42);
    }
  });
}

function grilleTexture(wmm, hmm) {
  return canvasTex(Math.round(wmm * PX), Math.round(hmm * PX), (g, W, H) => {
    g.fillStyle = '#2C2D30'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#060607';
    const s = 0.7 * PX;
    for (let y = s; y < H - s / 2; y += s) for (let x = s + ((y / s) % 2) * s / 2; x < W - s / 2; x += s) {
      g.beginPath(); g.arc(x, y, s * 0.28, 0, Math.PI * 2); g.fill();
    }
  });
}

function textDecal(wmm, hmm, draw) {
  return canvasTex(Math.round(wmm * PX * 2), Math.round(hmm * PX * 2), draw);
}

/** Fine print is drawn as grey hairlines — reads as small text without inventing any. */
function finePrint(g, x, y, w, rows, lh, color, r) {
  g.fillStyle = color;
  for (let i = 0; i < rows; i++) {
    let cx = x;
    const end = x + w * (0.55 + r() * 0.45);
    while (cx < end) { const ww = 6 + r() * 26; g.fillRect(cx, y + i * lh, Math.min(ww, end - cx), lh * 0.42); cx += ww + 4 + r() * 5; }
  }
}

// ---------- builder ----------

export function buildDetailedInterior(phone, W, H, D, side) {
  const root = new THREE.Group();
  const g = new THREE.Group(); // viewer space
  if (side < 0) g.rotation.y = Math.PI;
  root.add(g);
  const anchors = new Map();

  const plate = new THREE.Mesh(slab(W - 2 * MM, H - 2 * MM, 5 * MM, 0.6 * MM), mats.plate);
  plate.receiveShadow = true;
  root.add(plate);

  const IW = W - 3.2 * MM, IH = H - 3.2 * MM;
  const Z0 = 0.3 * MM; // top of the mid-plate
  const room = D / 2 - 1.4 * MM;

  // u,v rectangle → centre/size in metres
  const R = (u0, v0, u1, v1) => ({ x: ((u0 + u1) / 2 - 0.5) * IW, y: ((v0 + v1) / 2 - 0.5) * IH, w: (u1 - u0) * IW, h: (v1 - v0) * IH });
  const P = (u, v) => new THREE.Vector2((u - 0.5) * IW, (v - 0.5) * IH);

  const add = (m, parent = g) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); parent.add(m); return m; };

  const box = (r, t, mat, z = Z0, rad = 0.35 * MM) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(r.w, r.h, t, 2, Math.min(rad, t / 2 - 1e-5, r.w / 2, r.h / 2)), mat);
    m.position.set(r.x, r.y, z + t / 2);
    return add(m);
  };
  const decal = (r, tex, z, { transparent = true, rough = 0.6, metal = 0 } = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: rough, metalness: metal, depthWrite: !transparent }));
    m.position.set(r.x, r.y, z + 0.02 * MM);
    m.castShadow = false;
    g.add(m);
    return m;
  };
  const screw = (u, v, z, light = false) => {
    const p = P(u, v);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.85 * MM, 0.9 * MM, 0.35 * MM, 20), light ? M.screwLight : M.screw);
    s.rotation.x = Math.PI / 2;
    s.position.set(p.x, p.y, z + 0.18 * MM);
    add(s);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * MM, 0.18 * MM), M.coax);
    slot.position.set(p.x, p.y, z + 0.37 * MM);
    slot.rotation.z = 0.6;
    g.add(slot);
    const slot2 = slot.clone(); slot2.rotation.z = 0.6 + Math.PI / 2; g.add(slot2);
  };
  const shield = (u0, v0, u1, v1, t, opts = {}) => {
    const r = R(u0, v0, u1, v1);
    box(r, t, opts.dark ? M.shieldDark : M.shield, opts.z ?? Z0 + 0.8 * MM, 0.5 * MM);
    decal(r, shieldDecal(r.w / MM, r.h / MM, opts), (opts.z ?? Z0 + 0.8 * MM) + t);
    return { r, top: (opts.z ?? Z0 + 0.8 * MM) + t };
  };
  const pcb = (u0, v0, u1, v1, seed) => {
    const r = R(u0, v0, u1, v1);
    const t = 0.8 * MM;
    const top = new THREE.MeshStandardMaterial({ map: pcbTexture(r.w / MM, r.h / MM, seed), roughness: 0.55, metalness: 0.15 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, t), [M.pcbEdge, M.pcbEdge, M.pcbEdge, M.pcbEdge, top, M.pcbEdge]);
    m.position.set(r.x, r.y, Z0 + t / 2);
    add(m);
    // raised passives so the board has real relief when light rakes across it
    const n = Math.round((r.w * r.h) / (MM * MM) / 9);
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }), n);
    const rr = rng(seed * 7 + 3);
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const palette = ['#1E1F21', '#B39A6C', '#8E9194', '#2B2B29'];
    for (let i = 0; i < n; i++) {
      const big = rr() < 0.06;
      const sx = (big ? 1.6 + rr() * 2.4 : 0.35 + rr() * 0.6) * MM, sy = (big ? 1.2 + rr() * 2 : 0.2 + rr() * 0.3) * MM, sz = (big ? 0.45 : 0.25 + rr() * 0.2) * MM;
      const rot = rr() < 0.5;
      mtx.compose(
        new THREE.Vector3(r.x + (rr() - 0.5) * (r.w - 1 * MM), r.y + (rr() - 0.5) * (r.h - 1 * MM), Z0 + t + sz / 2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot ? Math.PI / 2 : 0),
        new THREE.Vector3(sx, sy, sz),
      );
      inst.setMatrixAt(i, mtx);
      inst.setColorAt(i, col.set(palette[Math.floor(rr() * palette.length)]));
    }
    inst.castShadow = true;
    g.add(inst);
    return { r, top: Z0 + t };
  };
  const connector = (u0, v0, u1, v1, z) => {
    const r = R(u0, v0, u1, v1);
    box(r, 0.7 * MM, M.connector, z, 0.15 * MM);
    const pins = new THREE.Mesh(new THREE.PlaneGeometry(r.w * 0.86, r.h * 0.3), M.gold);
    pins.position.set(r.x, r.y, z + 0.72 * MM);
    g.add(pins);
  };
  /** Flat flex cable along a path of [u, v, zAbove] points. */
  const flex = (pts, widthMm, mat) => {
    const w = widthMm * MM, t = 0.12 * MM;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = P(pts[i][0], pts[i][1]), b = P(pts[i + 1][0], pts[i + 1][1]);
      const za = pts[i][2] * MM, zb = pts[i + 1][2] * MM;
      const len = Math.hypot(b.x - a.x, b.y - a.y) + w * 0.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, w, t), mat);
      m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (za + zb) / 2);
      m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      m.rotation.y = -Math.atan2(zb - za, len) * Math.cos(m.rotation.z);
      add(m);
    }
  };
  const coax = (pts, rMm = 0.45) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([u, v, z]) => { const p = P(u, v); return new THREE.Vector3(p.x, p.y, z * MM); }));
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, rMm * MM, 8), M.coax));
  };
  const camera = (u, v, sizeMm, zTop, { square = true, lenses = 1 } = {}) => {
    const p = P(u, v);
    const s = sizeMm * MM;
    const h = new THREE.Mesh(new RoundedBoxGeometry(s, s, zTop - Z0, 2, 0.6 * MM), M.plastic);
    h.position.set(p.x, p.y, Z0 + (zTop - Z0) / 2);
    add(h);
    for (let i = 0; i < lenses; i++) {
      const l = lens(s * (lenses > 1 ? 0.2 : 0.3), 0.5 * MM);
      const off = lenses > 1 ? (i - (lenses - 1) / 2) * s * 0.45 : 0;
      l.position.set(p.x + off, p.y, zTop + 0.1 * MM);
      add(l);
    }
    if (!square) h.scale.set(1, 0.8, 1);
  };
  const anchor = (id, x, y, z, parent = g) => {
    const part = (phone.teardown.parts ?? []).find((q) => q.id === id);
    if (!part || (!part.spec && !part.label)) return;
    const a = new THREE.Object3D();
    const [ox, oy] = part.hotspotOffset ?? [0, 0];
    a.position.set(x + ox * IW, y + oy * IH, z + 0.4 * MM);
    a.userData = { part };
    parent.add(a);
    anchors.set(id, a);
  };
  const partRect = (id) => {
    const p = (phone.teardown.parts ?? []).find((q) => q.id === id);
    return p ? R(p.u, p.v, p.u + p.w, p.v + p.h) : null;
  };

  // chassis rim so the plate reads as a machined mid-frame
  {
    const rim = 1.1 * MM, t = Math.min(room, 1.6 * MM);
    const edges = [R(0, 0, 1, 0.012), R(0, 0.988, 1, 1), R(0, 0, 0.018, 1), R(0.982, 0, 1, 1)];
    for (const e of edges) box(e, t, M.chassis, Z0, 0.2 * MM);
    void rim;
  }

  let battery = null;
  const layout = phone.look?.backLayout;
  const battTop = Z0 + Math.min(room, 3.2 * MM) - 0.1 * MM;

  const makeBattery = (r, drawLabel, extra) => {
    const b = new THREE.Group();
    const t = battTop - Z0 - 0.15 * MM;
    const body = new THREE.Mesh(slab(r.w, r.h, 1.6 * MM, t, 0.5 * MM), M.pouch);
    b.add(body);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 1.2 * MM, r.h - 1.2 * MM),
      new THREE.MeshStandardMaterial({ map: textDecal((r.w - 1.2 * MM) / MM, (r.h - 1.2 * MM) / MM, drawLabel), roughness: 0.7, metalness: 0, envMapIntensity: 0.3 }));
    label.position.z = t / 2 + 0.03 * MM;
    b.add(label);
    extra?.(b, t);
    b.position.set(r.x, r.y, Z0 + 0.15 * MM + t / 2);
    b.userData.liftDir = 1; // viewer space: +z is always towards the viewer
    add(b);
    // adhesive strips left behind on the mid-plate when the battery comes out
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(r.w * 0.16, r.h * 0.8), M.adhesive);
      s.position.set(r.x + (i ? 1 : -1) * r.w * 0.22, r.y, Z0 + 0.05 * MM);
      g.add(s);
    }
    battery = b;
    anchor('battery', 0, 0, t / 2, b);
    return b;
  };

  if (layout === 'redmi') {
    // --- Redmi Note 3, back cover off (viewed from behind) ---
    // top: black plastic antenna cover over the board
    box(R(0.03, 0.935, 0.97, 0.99), Math.min(room, 2.2 * MM), M.plastic, Z0, 0.4 * MM);
    screw(0.08, 0.962, Z0 + 2.2 * MM); screw(0.92, 0.962, Z0 + 2.2 * MM);
    // main board fills the top third
    const board = pcb(0.03, 0.62, 0.97, 0.935, 11);
    // rear camera module poking through
    camera(0.445, 0.885, 9.5, Math.min(Z0 + room, Z0 + 2.6 * MM));
    // shield cans
    shield(0.05, 0.69, 0.25, 0.8, 0.5 * MM, { holes: 6, seed: 4 });
    const soc = shield(0.53, 0.64, 0.77, 0.86, 0.55 * MM, { holes: 0, seed: 5 });
    shield(0.56, 0.865, 0.84, 0.925, 0.5 * MM, { holes: 3, seed: 6 });
    shield(0.79, 0.7, 0.94, 0.8, 0.5 * MM, { holes: 4, seed: 7 });
    shield(0.42, 0.635, 0.52, 0.71, 0.45 * MM, { holes: 2, seed: 8 });
    // serial sticker on the big can
    decal(R(0.57, 0.7, 0.75, 0.77), barcodeTexture(0.18 * IW / MM, 0.07 * IH / MM, 9, ['SN 1234 5678 90', 'IMEI 86 000000 000000']), soc.top + 0.01 * MM, { transparent: false, rough: 0.8 });
    // board-to-board connectors with orange flex
    connector(0.26, 0.64, 0.4, 0.675, board.top);
    connector(0.8, 0.64, 0.93, 0.675, board.top);
    flex([[0.33, 0.655, 1.9], [0.33, 0.61, 1.6], [0.27, 0.58, 3.1]], 4, M.flexOrange);
    flex([[0.86, 0.655, 1.9], [0.93, 0.6, 1.2], [0.94, 0.3, 0.6]], 3, M.flexOrange);
    // fingerprint sensor flex (black) snaking up from the cover
    flex([[0.1, 0.66, 1.8], [0.2, 0.64, 1.9], [0.24, 0.6, 2.4]], 2.4, M.flexBlack);
    // antenna coax down the right edge to the sub-board
    coax([[0.95, 0.66, 1.5], [0.955, 0.4, 1.0], [0.95, 0.12, 1.2]]);
    screw(0.08, 0.64, board.top, true); screw(0.94, 0.9, board.top, true); screw(0.5, 0.92, board.top, true);

    // battery: big black pouch with a printed label (our own label, not Xiaomi's artwork)
    const br = partRect('battery') ?? R(0.05, 0.11, 0.9, 0.61);
    makeBattery(br, (c, Wp, Hp) => {
      const rr = rng(21);
      c.fillStyle = '#131416'; c.fillRect(0, 0, Wp, Hp);
      const u = Wp / 100;
      c.fillStyle = '#E9E9E6';
      c.font = `700 ${7 * u}px system-ui, sans-serif`; c.fillText('mi', 6 * u, 13 * u);
      c.font = `700 ${9 * u}px system-ui, sans-serif`; c.fillText('BM46', 6 * u, 29 * u);
      c.font = `500 ${3.2 * u}px system-ui, sans-serif`;
      c.fillText('Li-ion Polymer Battery · 3.85 V', 6 * u, 35 * u);
      c.fillText('4050 mAh · 15.6 Wh', 6 * u, 40 * u);
      finePrint(c, 6 * u, 46 * u, 86 * u, 12, 4.2 * u, 'rgba(225,225,222,0.32)', rr);
      c.strokeStyle = 'rgba(230,230,226,0.8)'; c.lineWidth = 0.5 * u;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.arc((9 + i * 8) * u, Hp - 12 * u, 2.6 * u, 0, Math.PI * 2); c.stroke(); }
      c.strokeRect(72 * u, 8 * u, 20 * u, 20 * u);
    });
    // bottom speaker / antenna enclosure
    const spk = R(0.03, 0.012, 0.97, 0.095);
    box(spk, Math.min(room, 2.2 * MM), M.plastic, Z0, 0.5 * MM);
    decal(R(0.34, 0.03, 0.66, 0.08), grilleTexture(0.32 * IW / MM, 0.05 * IH / MM), Z0 + Math.min(room, 2.2 * MM), { transparent: false, rough: 0.8 });
    screw(0.07, 0.05, Z0 + 2.2 * MM); screw(0.93, 0.05, Z0 + 2.2 * MM);
    box(R(0.8, 0.035, 0.86, 0.07), 0.3 * MM, M.gold, Z0 + 2.2 * MM, 0.1 * MM); // spring contacts

    anchor('processor', soc.r.x, soc.r.y, soc.top);
    const pr = partRect('ram'); if (pr) anchor('ram', pr.x, pr.y, Z0 + 1.4 * MM);
    const sr = partRect('storage'); if (sr) anchor('storage', sr.x, sr.y, Z0 + 1.4 * MM);
    const cr = partRect('camera'); if (cr) anchor('camera', cr.x, cr.y, Z0 + 2.6 * MM);
  } else if (layout === 'iphone13' || layout === 'iphone11') {
    // --- iPhone 13 mini / 13 / 11, display off (viewed from the front) ---
    const [chipName, chipLine = ''] = (phone.specs?.processor?.chip ?? 'A15 Bionic').split(' ');
    const mah = phone.specs?.batteryMah ?? 2406;
    // logic board runs down the left side
    const board = pcb(0.035, 0.3, 0.32, 0.975, 31);
    // A15 package, exposed
    const a15 = R(0.07, 0.53, 0.29, 0.69);
    box(a15, 0.7 * MM, M.chip, board.top, 0.2 * MM);
    decal(a15, textDecal(a15.w / MM, a15.h / MM, (c, Wp, Hp) => {
      c.fillStyle = '#E4E4E1';
      c.font = `600 ${Wp * 0.2}px system-ui, sans-serif`;
      c.fillText(chipName, Wp * 0.2, Hp * 0.45);
      c.font = `500 ${Wp * 0.09}px system-ui, sans-serif`;
      c.fillText(chipLine.toUpperCase(), Wp * 0.22, Hp * 0.6);
      finePrint(c, Wp * 0.2, Hp * 0.72, Wp * 0.6, 2, Hp * 0.06, 'rgba(210,210,206,0.45)', rng(3));
    }), board.top + 0.7 * MM);
    // board shields and connectors
    shield(0.06, 0.72, 0.3, 0.8, 0.45 * MM, { holes: 0, seed: 32, dark: true });
    shield(0.06, 0.34, 0.3, 0.48, 0.45 * MM, { holes: 0, seed: 33 });
    for (let i = 0; i < 4; i++) connector(0.08 + (i % 2) * 0.12, 0.83 + Math.floor(i / 2) * 0.05, 0.18 + (i % 2) * 0.12, 0.865 + Math.floor(i / 2) * 0.05, board.top);
    connector(0.2, 0.49, 0.3, 0.52, board.top);
    screw(0.07, 0.95, board.top); screw(0.28, 0.95, board.top); screw(0.07, 0.31, board.top);

    // top: TrueDepth / front camera modules and the big rear-camera bracket
    camera(0.3, 0.955, 6, Z0 + 2.1 * MM);
    camera(0.55, 0.965, 7, Z0 + 2.1 * MM, { lenses: 2 });
    const camBracket = shield(0.44, 0.785, 0.9, 0.94, 0.5 * MM, { holes: 0, seed: 34, z: Z0 + 1.5 * MM });
    screw(0.8, 0.9, camBracket.top, true); screw(0.8, 0.83, camBracket.top, true);
    shield(0.2, 0.885, 0.38, 0.935, 0.4 * MM, { seed: 35, dark: true, z: Z0 + 1.2 * MM });
    // flex cables linking board to battery connector and cameras
    flex([[0.3, 0.81, 1.5], [0.4, 0.78, 1.6], [0.42, 0.765, 1.4]], 3, M.flexBlack);
    flex([[0.3, 0.87, 1.5], [0.45, 0.86, 2.0]], 2.5, M.flexBlack);
    connector(0.36, 0.73, 0.45, 0.76, Z0 + 0.8 * MM);

    // battery: black pouch, Apple mark and printed text (L-shaped pack approximated as a rectangle)
    const br = partRect('battery') ?? R(0.32, 0.16, 0.97, 0.76);
    makeBattery(br, (c, Wp, Hp) => {
      c.fillStyle = '#131416'; c.fillRect(0, 0, Wp, Hp);
      const u = Wp / 100;
      c.fillStyle = '#DCDCD9';
      c.font = `500 ${3.6 * u}px system-ui, sans-serif`;
      c.fillText('Rechargeable Li-ion Battery', 10 * u, Hp * 0.74);
      c.fillText(`${mah} mAh`, 10 * u, Hp * 0.74 + 5 * u);
      finePrint(c, 10 * u, Hp * 0.74 + 9 * u, 80 * u, 5, 4 * u, 'rgba(220,220,216,0.32)', rng(41));
    }, (b, t) => {
      const logo = logoMesh('apple', 5.5 * MM, new THREE.MeshStandardMaterial({ color: '#DCDCD9', roughness: 0.5 }));
      logo.scale.x *= -1; // read from the front, not from behind
      logo.position.set(-br.w * 0.3, -br.h * 0.12, t / 2 + 0.06 * MM);
      b.add(logo);
      // black pull tabs at the bottom edge
      for (const sx of [-0.25, 0.25]) {
        const tab = new THREE.Mesh(new THREE.PlaneGeometry(br.w * 0.18, 4 * MM), M.flexBlack);
        tab.position.set(sx * br.w, -br.h / 2 - 1.4 * MM, -t / 2 + 0.1 * MM);
        b.add(tab);
      }
    });

    // SIM reader
    const sim = R(0.05, 0.17, 0.32, 0.29);
    box(sim, 0.9 * MM, M.shield, Z0, 0.3 * MM);
    for (let i = 0; i < 6; i++) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * MM, 1.4 * MM), M.gold);
      pad.position.set(sim.x + ((i % 2) - 0.5) * sim.w * 0.4, sim.y + (Math.floor(i / 2) - 1) * 2.4 * MM, Z0 + 0.92 * MM);
      g.add(pad);
    }
    // Taptic Engine
    const tap = R(0.09, 0.055, 0.36, 0.14);
    box(tap, 2.0 * MM, M.plastic, Z0, 0.5 * MM);
    decal(tap, textDecal(tap.w / MM, tap.h / MM, (c, Wp, Hp) => {
      c.fillStyle = '#E8E8E4';
      c.font = `700 ${Hp * 0.24}px system-ui, sans-serif`;
      c.fillText('TAPTIC', Wp * 0.2, Hp * 0.46);
      c.fillText('ENGINE', Wp * 0.2, Hp * 0.76);
    }), Z0 + 2.0 * MM);
    // loudspeaker + Lightning port assembly
    const spk = R(0.66, 0.015, 0.97, 0.14);
    box(spk, 2.1 * MM, M.shieldDark, Z0, 0.5 * MM);
    decal(R(0.7, 0.03, 0.93, 0.12), grilleTexture(0.23 * IW / MM, 0.09 * IH / MM), Z0 + 2.1 * MM, { transparent: false, rough: 0.8 });
    box(R(0.38, 0.012, 0.64, 0.06), 1.3 * MM, M.shield, Z0, 0.4 * MM);
    flex([[0.38, 0.1, 1.0], [0.5, 0.14, 1.0], [0.64, 0.12, 1.0]], 2.5, M.flexBlack);
    screw(0.7, 0.13, Z0 + 2.1 * MM, true); screw(0.94, 0.13, Z0 + 2.1 * MM, true);

    anchor('processor', a15.x, a15.y, board.top + 0.7 * MM);
    anchor('ram', a15.x, a15.y, board.top + 0.7 * MM);
    const sr = partRect('storage'); if (sr) anchor('storage', sr.x, sr.y, board.top + 0.5 * MM);
    anchor('camera', camBracket.r.x, camBracket.r.y, camBracket.top);

  } else if (layout === 'iphone6p' || layout === 'iphone7p') {
    // --- iPhone 6 Plus / 7 Plus, display off (viewed from the front) ---
    // logic board down the right edge, big battery on the left, Lightning + speaker at the bottom
    const is7 = layout === 'iphone7p';
    const chip = phone.specs?.processor?.chip ?? 'A8';
    // these phones have a bare aluminium rear case inside
    box(R(0.005, 0.005, 0.995, 0.995), 0.12 * MM, M.chassis, Z0 - 0.1 * MM, 0.05 * MM);
    const mah = phone.specs?.batteryMah ?? 2915;
    const board = pcb(0.69, 0.28, 0.965, 0.975, is7 ? 71 : 61);
    const soc = shield(0.71, 0.58, 0.95, 0.76, 0.45 * MM, { holes: 0, seed: is7 ? 72 : 62, mark: chip.toUpperCase() });
    shield(0.71, 0.4, 0.95, 0.54, 0.4 * MM, { holes: 0, seed: is7 ? 73 : 63, dark: true });
    shield(0.71, 0.3, 0.95, 0.37, 0.35 * MM, { holes: 0, seed: is7 ? 74 : 64 });
    for (let i = 0; i < 3; i++) connector(0.72, 0.79 + i * 0.035, 0.83, 0.81 + i * 0.035, board.top);
    screw(0.71, 0.96, board.top, true); screw(0.94, 0.96, board.top, true); screw(0.71, 0.29, board.top, true);
    // rear camera(s) at the top right, front camera and earpiece bracket top centre
    camera(0.86, 0.915, is7 ? 11 : 8, Z0 + Math.min(room, 2.5 * MM), { lenses: is7 ? 2 : 1 });
    const bracket = shield(0.3, 0.9, 0.62, 0.97, 0.4 * MM, { holes: 3, seed: 65, z: Z0 + 1.1 * MM });
    camera(0.4, 0.935, 4, Z0 + 1.6 * MM);
    // battery with pull-tab adhesive
    const br = partRect('battery') ?? R(0.06, 0.14, 0.66, 0.86);
    makeBattery(br, (c, Wp, Hp) => {
      c.fillStyle = '#16171A'; c.fillRect(0, 0, Wp, Hp);
      const u = Wp / 100;
      c.fillStyle = '#DCDCD9';
      c.font = `500 ${4.2 * u}px system-ui, sans-serif`;
      c.fillText('Li-ion Battery', 10 * u, Hp * 0.62);
      c.fillText(`${mah} mAh · 3.8 V`, 10 * u, Hp * 0.62 + 6 * u);
      finePrint(c, 10 * u, Hp * 0.62 + 11 * u, 80 * u, 6, 4.4 * u, 'rgba(220,220,216,0.3)', rng(is7 ? 77 : 67));
    }, (b, t) => {
      for (const sx of [-0.25, 0.25]) {
        const tab = new THREE.Mesh(new THREE.PlaneGeometry(br.w * 0.16, 5 * MM), M.flexBlack);
        tab.position.set(sx * br.w, -br.h / 2 - 1.8 * MM, -t / 2 + 0.1 * MM);
        b.add(tab);
      }
    });
    // battery connector flex over to the board
    flex([[0.62, 0.8, 2.2], [0.68, 0.78, 1.8], [0.74, 0.7, 1.2]], 3, M.flexBlack);
    // bottom: Lightning port, loudspeaker, and on the 7 Plus a Taptic Engine
    box(R(0.36, 0.012, 0.64, 0.075), 1.4 * MM, M.shield, Z0, 0.4 * MM);
    const spk = R(0.68, 0.015, 0.965, 0.12);
    box(spk, 2.0 * MM, M.shieldDark, Z0, 0.5 * MM);
    decal(R(0.72, 0.03, 0.93, 0.1), grilleTexture(0.21 * IW / MM, 0.07 * IH / MM), Z0 + 2.0 * MM, { transparent: false, rough: 0.8 });
    if (is7) {
      const tap = R(0.06, 0.02, 0.3, 0.1);
      box(tap, 2.0 * MM, M.plastic, Z0, 0.5 * MM);
      decal(tap, textDecal(tap.w / MM, tap.h / MM, (c, Wp, Hp) => {
        c.fillStyle = '#E8E8E4'; c.font = `700 ${Hp * 0.26}px system-ui, sans-serif`;
        c.fillText('TAPTIC', Wp * 0.18, Hp * 0.46); c.fillText('ENGINE', Wp * 0.18, Hp * 0.78);
      }), Z0 + 2.0 * MM);
    } else {
      // vibration motor, top left
      const vib = R(0.06, 0.88, 0.22, 0.95);
      box(vib, 2.0 * MM, M.shieldDark, Z0, 0.6 * MM);
    }
    flex([[0.34, 0.06, 1.2], [0.5, 0.11, 1.2], [0.7, 0.14, 1.4]], 2.5, M.flexOrange);
    screw(0.7, 0.11, Z0 + 2.0 * MM, true); screw(0.94, 0.11, Z0 + 2.0 * MM, true);

    anchor('processor', soc.r.x, soc.r.y, soc.top);
    anchor('ram', soc.r.x, soc.r.y, soc.top);
    const sr = partRect('storage'); if (sr) anchor('storage', sr.x, sr.y, Z0 + 1.7 * MM);
    const cr = partRect('camera'); if (cr) anchor('camera', cr.x, cr.y, Z0 + 2.5 * MM);
    void bracket;
  }


  // shared bits for the removable-battery phones
  const bay = (u0, v0, u1, v1, wall = 1.8) => {
    const t = Math.min(room, 3 * MM), w = 0.012;
    for (const e of [R(u0 - w, v0 - w, u1 + w, v0), R(u0 - w, v1, u1 + w, v1 + w), R(u0 - w, v0, u0, v1), R(u1, v0, u1 + w, v1)]) box(e, t, M.plastic, Z0, 0.2 * MM);
    void wall;
  };
  const simHolder = (u0, v0, u1, v1, label) => {
    const r = R(u0, v0, u1, v1);
    box(r, 0.7 * MM, M.shield, Z0, 0.2 * MM);
    const tex = textDecal(r.w / MM, r.h / MM, (c, Wp, Hp) => {
      c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, Wp, Hp);
      c.fillStyle = '#C9A04C';
      for (let i = 0; i < 6; i++) c.fillRect(Wp * (0.2 + (i % 3) * 0.22), Hp * (0.25 + Math.floor(i / 3) * 0.3), Wp * 0.13, Hp * 0.18);
      if (label) { c.fillStyle = 'rgba(30,30,32,0.8)'; c.font = `700 ${Hp * 0.16}px system-ui`; c.fillText(label, Wp * 0.06, Hp * 0.93); }
      c.strokeStyle = 'rgba(40,40,44,0.5)'; c.lineWidth = 3; c.strokeRect(3, 3, Wp - 6, Hp - 6);
    });
    decal(r, tex, Z0 + 0.7 * MM);
    return r;
  };
  const cardSlot = (u0, v0, u1, v1) => {
    const r = R(u0, v0, u1, v1);
    box(r, 0.6 * MM, M.shieldDark, Z0, 0.15 * MM);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(r.w * 0.8, 0.5 * MM), M.coax);
    mouth.position.set(r.x, r.y - r.h / 2 + 0.6 * MM, Z0 + 0.62 * MM);
    g.add(mouth);
    return r;
  };
  const contacts = (u, v, n = 4) => {
    for (let i = 0; i < n; i++) {
      const p = P(u, v);
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.2 * MM, 2.2 * MM, 0.6 * MM), M.gold);
      c.position.set(p.x + (i - (n - 1) / 2) * 2.4 * MM, p.y, Z0 + 0.3 * MM);
      add(c);
    }
  };
  const flashLed = (u, v) => {
    const p = P(u, v);
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.2 * MM, 2.2 * MM, 0.8 * MM), mats.flash);
    f.position.set(p.x, p.y, Z0 + 1.6 * MM);
    add(f);
  };
  const batteryLabel = ({ code, lines, logo, bg = '#131416', ink = '#E4E4E1', band = null }) => (c, Wp, Hp) => {
    c.fillStyle = bg; c.fillRect(0, 0, Wp, Hp);
    const u = Wp / 100;
    if (band) { c.fillStyle = band; c.fillRect(0, Hp * 0.1, Wp, Hp * 0.08); }
    c.fillStyle = ink;
    if (logo) { c.font = `800 ${7 * u}px system-ui, sans-serif`; c.fillText(logo, 8 * u, Hp * 0.3); }
    c.font = `800 ${11 * u}px system-ui, sans-serif`; c.fillText(code, 8 * u, Hp * 0.3 + 14 * u);
    c.font = `500 ${4.6 * u}px system-ui, sans-serif`;
    lines.forEach((l, i) => c.fillText(l, 8 * u, Hp * 0.3 + 23 * u + i * 6.5 * u));
    finePrint(c, 8 * u, Hp * 0.3 + 26 * u + lines.length * 6.5 * u, 84 * u, 6, 4.4 * u, 'rgba(220,220,216,0.3)', rng(code.length * 13));
  };
  const motoMark = (b, t, x, y, size, color = '#9A9DA3') => {
    const logo = logoMesh('motorola', size, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    logo.scale.x *= -1;
    logo.position.set(x, y, t / 2 + 0.06 * MM);
    b.add(logo);
  };

  if (layout === 'slvr') {
    // --- Motorola SLVR L7e, battery door off ---
    box(R(0.03, 0.8, 0.97, 0.99), Math.min(room, 2.2 * MM), M.plastic, Z0, 0.4 * MM);
    camera(0.5, 0.89, 8, Z0 + Math.min(room, 2.6 * MM));
    decal(R(0.12, 0.82, 0.3, 0.96), grilleTexture(0.18 * IW / MM, 0.14 * IH / MM), Z0 + Math.min(room, 2.2 * MM), { transparent: false, rough: 0.8 });
    screw(0.85, 0.95, Z0 + 2.2 * MM); screw(0.85, 0.84, Z0 + 2.2 * MM);
    bay(0.07, 0.17, 0.93, 0.78);
    contacts(0.5, 0.765, 4);
    const sim = simHolder(0.22, 0.5, 0.78, 0.68, 'SIM');
    const sd = cardSlot(0.3, 0.3, 0.7, 0.42);
    box(R(0.03, 0.01, 0.97, 0.15), Math.min(room, 2.2 * MM), M.plastic, Z0, 0.4 * MM);
    screw(0.12, 0.08, Z0 + 2.2 * MM); screw(0.88, 0.08, Z0 + 2.2 * MM);
    const br = partRect('battery') ?? R(0.08, 0.2, 0.92, 0.75);
    makeBattery(br, batteryLabel({ code: 'BK60', lines: ['Li-ion · 3.7 V', '880 mAh'], bg: '#2A2C30', band: '#8E9298' }), (b, t) => motoMark(b, t, br.w * 0.28, br.h * 0.3, 5 * MM));
    const cr = partRect('camera'); if (cr) anchor('camera', cr.x, cr.y, Z0 + 2.6 * MM);
    anchor('storage', sd.x, sd.y, Z0 + 0.6 * MM);
    void sim;
  } else if (layout === 'karbonn') {
    // --- Karbonn A7, back cover off ---
    box(R(0.03, 0.8, 0.97, 0.99), Math.min(room, 2.4 * MM), M.plastic, Z0, 0.4 * MM);
    camera(0.5, 0.9, 9, Z0 + Math.min(room, 2.8 * MM));
    flashLed(0.68, 0.915); flashLed(0.68, 0.875);
    screw(0.08, 0.96, Z0 + 2.4 * MM); screw(0.92, 0.96, Z0 + 2.4 * MM); screw(0.08, 0.83, Z0 + 2.4 * MM); screw(0.92, 0.83, Z0 + 2.4 * MM);
    bay(0.06, 0.13, 0.94, 0.79);
    contacts(0.82, 0.77, 3);
    simHolder(0.1, 0.45, 0.47, 0.68, 'SIM 1');
    simHolder(0.53, 0.45, 0.9, 0.68, 'SIM 2');
    const sd = cardSlot(0.1, 0.24, 0.45, 0.36);
    box(R(0.03, 0.01, 0.97, 0.11), Math.min(room, 2.4 * MM), M.plastic, Z0, 0.4 * MM);
    decal(R(0.35, 0.03, 0.65, 0.09), grilleTexture(0.3 * IW / MM, 0.06 * IH / MM), Z0 + Math.min(room, 2.4 * MM), { transparent: false, rough: 0.8 });
    screw(0.1, 0.06, Z0 + 2.4 * MM); screw(0.9, 0.06, Z0 + 2.4 * MM);
    const br = partRect('battery') ?? R(0.07, 0.2, 0.93, 0.75);
    makeBattery(br, batteryLabel({ code: 'Li-ion', lines: ['Rechargeable battery · 3.7 V', '1420 mAh'], logo: 'KARBONN', bg: '#EDEBE6', ink: '#2A2A2C', band: '#1F5FA8' }));
    const cr = partRect('camera'); if (cr) anchor('camera', cr.x, cr.y, Z0 + 2.8 * MM);
    anchor('storage', sd.x, sd.y, Z0 + 0.6 * MM);
    const sr = R(0.1, 0.45, 0.9, 0.68); anchor('sim', sr.x, sr.y, Z0 + 0.7 * MM);
  } else if (layout === 'motoe') {
    // --- Moto E (1st gen), back shell off: inner housing over the board, battery below ---
    const top = R(0.03, 0.66, 0.97, 0.985);
    box(top, Math.min(room, 1.8 * MM), M.plastic, Z0, 0.5 * MM);
    const housingTop = Z0 + Math.min(room, 1.8 * MM);
    camera(0.5, 0.9, 8.5, housingTop + 0.5 * MM);
    // window in the housing shows a shield can
    const can = shield(0.6, 0.8, 0.9, 0.92, 0.3 * MM, { holes: 4, seed: 51, z: housingTop - 0.1 * MM });
    // micro-SIM and microSD slots, side by side
    const simR = R(0.55, 0.69, 0.9, 0.78);
    box(simR, 0.6 * MM, M.shieldDark, housingTop, 0.15 * MM);
    decal(R(0.07, 0.8, 0.36, 0.93), barcodeTexture(0.29 * IW / MM, 0.13 * IH / MM, 52, ['XT1022', 'MOTO E']), housingTop + 0.01 * MM, { transparent: false, rough: 0.8 });
    // lift the microSD slot above the housing surface
    const sdBox = R(0.1, 0.69, 0.4, 0.78); box(sdBox, 0.6 * MM, M.shieldDark, housingTop, 0.15 * MM);
    for (const [u, v] of [[0.06, 0.7], [0.94, 0.7], [0.06, 0.96], [0.94, 0.96], [0.5, 0.68]]) screw(u, v, housingTop);
    contacts(0.2, 0.975, 3); contacts(0.8, 0.975, 2);
    const br = partRect('battery') ?? R(0.07, 0.08, 0.93, 0.63);
    makeBattery(br, batteryLabel({ code: 'Li-ion', lines: ['3.8 V · 1980 mAh · 7.5 Wh', 'Non-removable'] }), (b, t) => motoMark(b, t, br.w * 0.28, br.h * 0.3, 6 * MM));
    box(R(0.03, 0.012, 0.97, 0.06), Math.min(room, 1.8 * MM), M.plastic, Z0, 0.4 * MM);
    const cr = partRect('camera'); if (cr) anchor('camera', cr.x, cr.y, housingTop + 0.5 * MM);
    anchor('processor', can.r.x, can.r.y, can.top);
    anchor('ram', can.r.x, can.r.y, can.top);
    anchor('storage', sdBox.x, sdBox.y, housingTop + 0.6 * MM);
  }

  return { group: root, anchors, battery };
}
