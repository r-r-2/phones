import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import data from './data/phones.json';
import { buildPhone } from './scene/phone.js';
import { buildShowroom, makeStand, placeOnTable, TABLE, WORK_TABLE } from './scene/showroom.js';
import { specRowsHtml } from './specs.js';
import { logoSvg } from './logos.js';
import { initAnalytics, track, trackOnce } from './analytics.js';

initAnalytics();

// Keep animations on schedule even when frames are slow (older phones, background tabs).
gsap.ticker.lagSmoothing(0);

// Lock screens are drawn onto canvases, so wait (briefly) for the web fonts first.
await Promise.race([
  Promise.all([document.fonts.load('700 64px "Instrument Sans"'), document.fonts.load('600 30px "Instrument Sans"')]),
  new Promise((r) => setTimeout(r, 1500)),
]).catch(() => {});

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = (s) => (reduceMotion ? Math.min(s, 0.25) : s);
const DEG = Math.PI / 180;

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps product colours true (ACES washes saturated reds to pink)
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40); // tight near/far: steadier depth, no flicker
buildShowroom(scene);

// Reflections come from the showroom itself: render the empty room (wood walls, ceiling
// light strips, marble) into an environment map from just above the table. Glass and
// metal then reflect the actual room instead of a generic studio.
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(scene, 0.015, 0.05, 30, { size: 256, position: new THREE.Vector3(0, 1.25, 0.35) }).texture;
  scene.environmentIntensity = 1.0;
  // Bare metal (aluminium frames, the Redmi's back) takes its colour almost entirely from
  // reflections; against wood walls silver turns brown. Give metals a neutral studio map.
  var metalEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}
function neutralMetals(root, allMaterials = false) {
  root.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      if (m.envMap || m.isMeshBasicMaterial || m.userData.keepEnv) continue;
      if (m.metalness > 0.5) { m.envMap = metalEnv; m.envMapIntensity = 1.1 * (m.userData.envScale ?? 1); m.needsUpdate = true; }
      // Phones: coloured glass must keep its own colour, so it reflects a neutral studio
      // (soft white highlights) rather than the warm wood room.
      else if (allMaterials) { m.envMap = metalEnv; m.envMapIntensity = 0.55 * (m.userData.envScale ?? 1); m.needsUpdate = true; }
    }
  });
}

// Inside parts only cast shadows while the phone is open; closed, their shadow-map edges
// leaked through the back glass as thin dark lines.
function interiorShadows(model, on) {
  model.interior?.traverse((o) => { if (o.isMesh) o.castShadow = on; });
}

// ---------- phones on stands ----------
const personal = data.personal;
const SLOTS = personal.length + 1; // one extra, empty stand for the next phone
const SLOT = (i) => (i - (personal.length - 1)) * (360 / SLOTS) * DEG; // newest phone faces the start view
const items = personal.map((p, i) => {
  const stand = makeStand(p.dimensionsMm.h / 1000);
  placeOnTable(stand, new THREE.Vector3(), TABLE.height, TABLE.standRadius, SLOT(i));
  neutralMetals(stand);
  scene.add(stand);
  let model = null;
  if (p.enabled) {
    model = buildPhone(p);
    neutralMetals(model.root, true);
  interiorShadows(model, false);
    interiorShadows(model, false);
    model.root.userData.item = i;
    stand.userData.mount.add(model.root);
  }
  return { phone: p, stand, model, angle: SLOT(i), table: 'main' };
});
// the empty stand, waiting for whatever comes after the newest phone
{
  const nx = data.next ?? { id: 'next', name: 'Next phone', label: 'Next', standHeightMm: 150 };
  const i = personal.length;
  const stand = makeStand(nx.standHeightMm / 1000);
  placeOnTable(stand, new THREE.Vector3(), TABLE.height, TABLE.standRadius, SLOT(i));
  neutralMetals(stand);
  stand.userData.item = i;
  scene.add(stand);
  items.push({ phone: { id: nx.id, name: nx.name, owned: { label: nx.label }, color: { hex: 'transparent' } }, stand, model: null, placeholder: true, angle: SLOT(i), table: 'main' });
}
const enabled = items.filter((it) => it.model || it.placeholder);
const newest = enabled.findLastIndex((it) => it.model);

const workBase = -22 * DEG;
const workItems = data.work.map((p, k) => {
  const stand = makeStand(p.dimensionsMm.h / 1000);
  const angle = workBase + (-67.5 + k * 45) * DEG;
  placeOnTable(stand, WORK_TABLE.center, WORK_TABLE.height, WORK_TABLE.standRadius, angle);
  neutralMetals(stand);
  scene.add(stand);
  const model = buildPhone(p);
  model.root.userData.work = k;
  neutralMetals(model.root, true);
  stand.userData.mount.add(model.root);
  return { phone: p, stand, model, angle, table: 'work' };
});

// ---------- camera rig ----------
const RIGS = {
  main: { cx: 0, cz: 0, rc: 1.32, camH: 1.12, tr: 0.28, th: 0.99 },
  work: { cx: WORK_TABLE.center.x, cz: WORK_TABLE.center.z, rc: 1.1, camH: 1.12, tr: 0.18, th: 0.99 },
};
const OVERHEAD = { pos: new THREE.Vector3(0, 2.4, 1.8), target: new THREE.Vector3(0, TABLE.height, 0.05) };
const view = { ...RIGS.main, angle: enabled[newest].angle, over: 0 };

function updateCamera() {
  const { cx, cz, rc, camH, tr, th, angle, over } = view;
  const pos = new THREE.Vector3(cx + Math.sin(angle) * rc, camH, cz + Math.cos(angle) * rc);
  const target = new THREE.Vector3(cx + Math.sin(angle) * tr, th, cz + Math.cos(angle) * tr);
  if (over > 0) {
    pos.lerp(OVERHEAD.pos, over);
    target.lerp(OVERHEAD.target, over);
  }
  camera.position.copy(pos);
  camera.lookAt(target);
}

function shortest(from, to) {
  let d = to - from;
  d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return from + d;
}

// ---------- state ----------
const state = {
  mode: 'browse', // browse | moving | held | open | overhead | work
  table: 'main',
  cur: newest, // index into `enabled` (start on the newest phone)
  workCur: 1,
  step: 0, // teardown step: 1 cover off, 2 battery out
  held: null, // { item, model }
};

function currentItem() {
  return state.table === 'work' ? workItems[state.workCur] : enabled[state.cur];
}

// ---------- UI ----------
const $ = (s) => document.querySelector(s);
const dirPersonal = $('#dir-personal');
const dirWork = $('#dir-work');
const specsEl = $('#specs');
const controlsEl = $('#controls');
const hintEl = $('#hint');
const stepsEl = $('#steps');
const hotspotsEl = $('#hotspots');

const ICON = {
  left: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2L4 6l4 4"/></svg>',
  right: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>',
  up: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 11V3M3.5 6.5L7 3l3.5 3.5"/></svg>',
  reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5v2.5h2.5"/></svg>',
};

function renderDirectory() {
  dirPersonal.innerHTML = items.map((it, i) => {
    const en = enabled.indexOf(it);
    const active = state.table === 'main' && en === state.cur && state.mode !== 'overhead';
    if (it.placeholder) {
      return `<li class="next ${active ? 'active' : ''}"><button type="button" data-go="${en}" ${active ? 'aria-current="true"' : ''}>
      <span class="yr">${it.phone.owned.label}</span>
      <span class="pip"><i class="empty"></i></span>
      <span class="nm">${it.phone.name}<span class="soon">empty stand</span></span>
    </button></li>`;
    }
    return `<li class="${active ? 'active' : ''}"><button type="button" data-go="${en}" ${en < 0 ? 'disabled' : ''} ${active ? 'aria-current="true"' : ''}>
      <span class="yr">${it.phone.owned.label}</span>
      <span class="pip"><i style="--c:${it.phone.color.hex}"></i></span>
      <span class="nm">${it.phone.name}${en < 0 ? '<span class="soon">soon</span>' : ''}</span>
    </button></li>`;
  }).join('');
  // on phones the list is one horizontal strip, so the work table gets a chip at its end
  const workActive = state.table === 'work';
  dirPersonal.insertAdjacentHTML('beforeend', `<li class="work-chip ${workActive ? 'active' : ''}"><button type="button" data-work="${state.workCur}">Work phones</button></li>`);
  dirWork.innerHTML = workItems.map((w, k) => {
    const active = state.table === 'work' && k === state.workCur;
    return `<li class="${active ? 'active' : ''}"><button type="button" data-work="${k}" ${active ? 'aria-current="true"' : ''}>${w.phone.name}</button></li>`;
  }).join('');
  // on phones the list is a horizontal strip: keep the current phone in view
  if (matchMedia('(max-width: 900px)').matches) {
    const a = dirPersonal.querySelector('.active');
    if (a) dirPersonal.scrollTo({ left: a.offsetLeft - dirPersonal.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
  }
}

let specsCollapsed = matchMedia('(max-width: 900px)').matches;
specsEl.addEventListener('click', (e) => {
  if (!e.target.closest('[data-toggle]')) return;
  specsCollapsed = !specsCollapsed;
  specsEl.classList.toggle('collapsed', specsCollapsed);
  const t = specsEl.querySelector('[data-toggle]');
  t.textContent = specsCollapsed ? 'Specs' : 'Hide';
  t.setAttribute('aria-expanded', String(!specsCollapsed));
  if (!specsCollapsed) track('open_specs_mobile');
});

function renderCredit() {
  const el = document.getElementById('credit-text');
  const p = currentItem()?.phone;
  const c = p?.teardown?.photoCredit;
  el.innerHTML = c
    ? `Interior modelled on iFixit's <a href="${c.url}" target="_blank" rel="noopener">${c.title}</a>`
    : '';
}

function renderSpecs() {
  renderCredit();
  specsEl.classList.toggle('collapsed', specsCollapsed && matchMedia('(max-width: 900px)').matches);
  specsEl.classList.add('swap');
  setTimeout(() => {
    if (state.mode === 'overhead') {
      specsEl.innerHTML = `
        <div class="eyebrow">From above</div>
        <h2 class="spec-name">The whole table</h2>
        <p class="spec-note">${personal.length} phones at true relative size, plus an empty stand for the next one.</p>`;
    } else if (state.table === 'work') {
      specsEl.innerHTML = phoneSpecsHtml(workItems[state.workCur].phone, data.work, 'Company phone');
      animateBars();
      bindSpecHover();
    } else if (enabled[state.cur].placeholder) {
      specsEl.innerHTML = `
        <div class="eyebrow">Empty stand</div>
        <h2 class="spec-name">Next phone</h2>
        <p class="spec-note">Kept free for whatever comes after the ${enabled[newest].phone.name}.</p>`;
    } else {
      specsEl.innerHTML = phoneSpecsHtml(enabled[state.cur].phone, personal);
      animateBars();
      bindSpecHover();
    }
    specsEl.classList.remove('swap');
  }, reduceMotion ? 0 : 180);
}

function phoneSpecsHtml(p, list, eyebrow = '') {
  return `
    <div class="spec-top">
      <span class="maker">${p.logos ? logoSvg(p.logos.maker, { size: 22, label: p.maker }) : ''}<span>${p.maker}</span></span>
      <span class="os">${p.logos ? logoSvg(p.logos.os, { size: 22, label: p.os.name }) : ''}<span>${p.logos?.os === 'ios' ? `<b>${p.os.version}</b>` : `<b>${p.os.name}</b>${p.os.version}`}</span></span>
    </div>
    <div>
      ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
      <h2 class="spec-name">${p.name} <button type="button" class="spec-toggle" data-toggle aria-expanded="${!specsCollapsed}">${specsCollapsed ? 'Specs' : 'Hide'}</button></h2>
      <div class="spec-sub"><span class="swatch" style="--c:${p.color.hex}"></span>${p.color.name}${p.owned ? ` · ${p.owned.range ?? p.owned.label}` : ''} · ${p.screenInches}″</div>
      ${p.tags?.length ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
    </div>
    <div class="spec-rows">${specRowsHtml(p, list)}</div>
    <div class="spec-foot">Compared with the ${eyebrow ? 'company phone' : 'phone'} before it · bars to scale</div>
    ${p.details ? `<details class="more"><summary>Full specs${p.source ? ` <span>from ${p.source.name}</span>` : ''}</summary>
      <dl>${p.details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${p.source ? `<a href="${p.source.url}" target="_blank" rel="noopener">View on ${p.source.name} ↗</a>` : ''}
    </details>` : ''}`;
}

// animate spec bars from zero
function animateBars() {
  const bars = specsEl.querySelectorAll('.track b');
  const widths = [...bars].map((b) => b.style.width);
  bars.forEach((b) => { b.style.transition = 'none'; b.style.width = '0'; });
  requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((b, i) => { b.style.transition = ''; b.style.width = widths[i]; })));
}

function btn(label, attrs = '', cls = '', icon = '', iconAfter = false) {
  return `<button type="button" class="btn ${cls}" ${attrs}>${iconAfter ? '' : icon}<span class="lbl">${label}</span>${iconAfter ? icon : ''}</button>`;
}

function renderControls() {
  const m = state.mode;
  let html = '';
  if (m === 'browse' && state.table === 'main' && enabled[state.cur].placeholder) {
    const prev = enabled[state.cur - 1];
    html += btn(prev.phone.name, 'data-act="prev" aria-label="Previous phone"', 'nav', ICON.left);
    html += btn('View from above', 'data-act="overhead"', 'primary', ICON.right, true);
    hint('');
  } else if (m === 'browse' && state.table === 'main') {
    const prev = enabled[state.cur - 1];
    const next = enabled[state.cur + 1];
    html += prev ? btn(prev.phone.name, 'data-act="prev" aria-label="Previous phone"', 'nav', ICON.left) : '';
    html += btn('Pick it up', 'data-act="pick"', 'primary', ICON.up, true);
    html += next ? btn(next.phone.name, 'data-act="next" aria-label="Next phone"', 'nav', ICON.right, true) : btn('View from above', 'data-act="overhead"', '', ICON.right, true);
    hint('');
  } else if (m === 'browse' && state.table === 'work') {
    html += btn('', 'data-act="wprev" aria-label="Previous work phone"', 'icon', ICON.left);
    html += btn('Pick it up', 'data-act="pick"', 'primary', ICON.up, true);
    html += btn('', 'data-act="wnext" aria-label="Next work phone"', 'icon', ICON.right);
    html += btn('My phones', 'data-act="home"', 'ghost');
    hint('');
  } else if (m === 'held') {
    html += btn('Put it back', 'data-act="putback"');
    html += btn('Open it up', 'data-act="open"', 'primary', ICON.up, true);
    html += btn('', 'data-act="reset" aria-label="Reset view"', 'icon', ICON.reset);
    hint('Drag to turn it around');
  } else if (m === 'open') {
    html += btn('Close it up', 'data-act="close"');
    if (canLiftBattery()) html += state.step === 1 ? btn('Lift the battery', 'data-act="battery"', 'primary') : btn('Put the battery back', 'data-act="battery"', 'primary');
    html += btn('', 'data-act="reset" aria-label="Face me again"', 'icon', ICON.reset);
    hint('Drag to turn it · tap a dot to see the part');
  } else if (m === 'overhead') {
    html += btn('Back to the table', 'data-act="down"', 'primary');
    html += btn('Work table', 'data-act="work"', '', ICON.right, true);
    hint('');
  }
  controlsEl.innerHTML = html;
  stepsEl.hidden = m !== 'open' || !canLiftBattery();
  stepsEl.querySelectorAll('li').forEach((li) => {
    const s = +li.dataset.step;
    li.className = s < state.step ? 'done' : s === state.step ? 'now' : '';
  });
}

function canLiftBattery() {
  const model = state.held?.model;
  return !!(model && (model.setBatteryOut || model.battery));
}

function hint(text) {
  hintEl.hidden = !text;
  hintEl.textContent = text;
}

function refreshUI({ specs = true } = {}) {
  renderDirectory();
  renderControls();
  if (specs) renderSpecs();
}

// ---------- navigation ----------
function goTo(idx, source = 'nav') {
  if (state.mode === 'moving') return;
  if (state.mode === 'held' || state.mode === 'open') return;
  idx = Math.max(0, Math.min(enabled.length - 1, idx));
  const fromWork = state.table === 'work' || view.over > 0.01;
  if (idx === state.cur && !fromWork) return;
  state.cur = idx;
  state.table = 'main';
  const it = enabled[idx];
  state.mode = 'moving';
  refreshUI();
  const to = { ...RIGS.main, angle: shortest(view.angle, it.angle), over: 0 };
  gsap.to(view, { ...to, duration: D(fromWork ? 2.0 : 1.6), ease: 'power2.inOut', onComplete: () => { state.mode = 'browse'; renderControls(); } });
  track('view_phone', { phone_id: it.phone.id, phone_name: it.phone.name, source });
}

function goWork(k = state.workCur, source = 'nav') {
  if (state.mode === 'held' || state.mode === 'open' || state.mode === 'moving') return;
  const first = state.table !== 'work';
  state.table = 'work';
  state.workCur = (k + workItems.length) % workItems.length;
  state.mode = 'moving';
  refreshUI();
  const it = workItems[state.workCur];
  gsap.to(view, { ...RIGS.work, angle: shortest(view.angle, it.angle), over: 0, duration: D(first ? 2.2 : 1.2), ease: 'power2.inOut', onComplete: () => { state.mode = 'browse'; renderControls(); } });
  if (first) track('work_table_view', { source });
  track('view_work_phone', { phone_id: it.phone.id, phone_name: it.phone.name });
}

function goOverhead() {
  if (state.mode !== 'browse') return;
  state.mode = 'moving';
  gsap.to(view, { ...RIGS.main, over: 1, duration: D(2.0), ease: 'power2.inOut', onComplete: () => { state.mode = 'overhead'; refreshUI(); } });
  track('overhead_view');
}

function leaveOverhead() {
  state.mode = 'moving';
  gsap.to(view, { over: 0, duration: D(1.6), ease: 'power2.inOut', onComplete: () => { state.mode = 'browse'; refreshUI(); } });
}

// ---------- pick up / rotate / teardown ----------
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const HELD_DIST = 0.42;

function heldPose(open = false, model = state.held?.model) {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const pos = camera.position.clone().addScaledVector(dir, HELD_DIST);
  const q = camera.quaternion.clone();
  if (open && model?.openSide === -1) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  return { pos, q };
}

function tweenPose(obj, pos, q, duration, onComplete) {
  const p0 = obj.position.clone();
  const q0 = obj.quaternion.clone();
  const o = { t: 0 };
  return gsap.to(o, {
    t: 1, duration, ease: 'power3.inOut',
    onUpdate: () => { obj.position.lerpVectors(p0, pos, o.t); obj.quaternion.slerpQuaternions(q0, q, o.t); },
    onComplete,
  });
}

function pickUp() {
  if (state.mode !== 'browse') return;
  const it = currentItem();
  if (!it?.model) return;
  const { root } = it.model;
  scene.attach(root);
  state.held = { item: it, model: it.model };
  state.mode = 'moving';
  const { pos, q } = heldPose(false);
  tweenPose(root, pos, q, D(1.1), () => { state.mode = 'held'; renderControls(); });
  track('pick_up_phone', { phone_id: it.phone.id, phone_name: it.phone.name });
}

function putBack(done) {
  if (state.mode !== 'held' || !state.held) return;
  const { item, model } = state.held;
  const mount = item.stand.userData.mount;
  mount.updateWorldMatrix(true, false);
  const pos = new THREE.Vector3(); const q = new THREE.Quaternion();
  mount.getWorldPosition(pos); mount.getWorldQuaternion(q);
  state.mode = 'moving';
  tweenPose(model.root, pos, q, D(1.0), () => {
    mount.attach(model.root);
    model.root.position.set(0, 0, 0);
    model.root.quaternion.identity();
    state.held = null;
    state.mode = 'browse';
    renderControls();
    done?.();
  });
}

function openUp() {
  if (state.mode !== 'held') return;
  const { model, item } = state.held;
  state.mode = 'moving';
  const { pos, q } = heldPose(true);
  tweenPose(model.root, pos, q, D(0.8), () => {
    const { W } = model.dims;
    const c = model.cover;
    c.userData.home ??= c.position.clone();
    gsap.to(c.position, {
      // always slide the cover to the viewer's right; the battery lifts out to the left
      x: c.userData.home.x + model.openSide * W * 1.12, z: c.userData.home.z + model.openSide * 0.02,
      duration: D(1.0), ease: 'power2.inOut',
      onComplete: () => { state.mode = 'open'; state.step = 1; interiorShadows(model, true); renderControls(); buildHotspots(); },
    });
    gsap.to(c.rotation, { y: model.openSide * 0.35, duration: D(1.0), ease: 'power2.inOut' });
  });
  track('open_teardown', { phone_id: item.phone.id, phone_name: item.phone.name });
}

function toggleBattery() {
  if (state.mode !== 'open') return;
  const { model, item } = state.held;
  if (model.setBatteryOut) {
    const out = state.step === 1;
    state.step = out ? 2 : 1;
    model.setBatteryOut(out);
    renderControls();
    track('teardown_step', { phone_id: item.phone.id, step: out ? 'battery_out' : 'battery_in' });
    return;
  }
  const b = model.battery;
  if (!b) return;
  b.userData.home ??= b.position.clone();
  const out = state.step === 1;
  const { W } = model.dims;
  state.step = out ? 2 : 1;
  renderControls();
  gsap.to(b.position, {
    x: out ? b.userData.home.x - W * 1.2 : b.userData.home.x,
    z: out ? b.userData.home.z + (b.userData.liftDir ?? model.openSide) * 0.015 : b.userData.home.z,
    duration: D(0.9), ease: 'power2.inOut',
  });
  gsap.to(b.rotation, { z: out ? 0.2 : 0, duration: D(0.9), ease: 'power2.inOut' });
  track('teardown_step', { phone_id: item.phone.id, step: out ? 'battery_out' : 'battery_in' });
}

function closeUp(done) {
  if (state.mode !== 'open') return;
  const { model } = state.held;
  state.mode = 'moving';
  clearHotspots();
  interiorShadows(model, false);
  model.setBatteryOut?.(false);
  const b = model.battery;
  if (b?.userData.home) {
    gsap.to(b.position, { x: b.userData.home.x, z: b.userData.home.z, duration: D(0.6) });
    gsap.to(b.rotation, { z: 0, duration: D(0.6) });
  }
  const c = model.cover;
  gsap.to(c.rotation, { y: 0, duration: D(0.9), ease: 'power2.inOut' });
  gsap.to(c.position, {
    x: c.userData.home.x, z: c.userData.home.z, duration: D(0.9), ease: 'power2.inOut', delay: b ? D(0.3) : 0,
    onComplete: () => { state.step = 0; state.mode = 'held'; renderControls(); done?.(); },
  });
}

function resetOrientation() {
  if (!state.held) return;
  const { pos, q } = heldPose(state.mode === 'open');
  const prev = state.mode;
  state.mode = 'moving';
  tweenPose(state.held.model.root, pos, q, D(0.6), () => { state.mode = prev; });
}

// ---------- hotspots ----------
let hotspots = [];
function buildHotspots() {
  clearHotspots();
  const { model } = state.held;
  for (const [id, anchor] of model.anchors) {
    const part = anchor.userData.part;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hs';
    b.dataset.spec = part.spec ?? '';
    b.setAttribute('aria-label', part.label ?? id);
    b.innerHTML = `<span class="tip">${part.label ?? id}</span>`;
    const on = () => highlight(part.spec, b, part);
    b.addEventListener('mouseenter', on);
    b.addEventListener('focus', on);
    b.addEventListener('click', on);
    b.addEventListener('mouseleave', () => highlight(null));
    b.addEventListener('blur', () => highlight(null));
    hotspotsEl.appendChild(b);
    hotspots.push({ el: b, anchor });
  }
}
function clearHotspots() { hotspotsEl.innerHTML = ''; hotspots = []; }

const isNarrow = () => matchMedia('(max-width: 900px)').matches;

function highlight(spec, el = null, part = null) {
  specsEl.querySelectorAll('.spec-row').forEach((r) => r.classList.toggle('hl', !!spec && r.dataset.spec === spec));
  hotspots.forEach((h) => h.el.classList.toggle('active', !!el ? h.el === el : (!!spec && h.el.dataset.spec === spec)));
  if (part && el && isNarrow()) toast(part.label ?? part.id, 2500);
  if (part && state.held) trackOnce(`hs:${state.held.item.phone.id}:${part.id}`, 'view_part', { phone_id: state.held.item.phone.id, part: part.id });
}

function bindSpecHover() {
  specsEl.querySelectorAll('.spec-row').forEach((r) => {
    r.addEventListener('mouseenter', () => state.mode === 'open' && highlight(r.dataset.spec));
    r.addEventListener('mouseleave', () => state.mode === 'open' && highlight(null));
  });
}

const normal = new THREE.Vector3();
function updateHotspots() {
  if (!hotspots.length || !state.held) return;
  const { model } = state.held;
  normal.set(0, 0, model.openSide).applyQuaternion(model.root.quaternion);
  const toCam = camera.position.clone().sub(model.root.position).normalize();
  const facing = normal.dot(toCam) > 0.55 && !drag.active && state.mode === 'open';
  const w = innerWidth, h = innerHeight;
  for (const hs of hotspots) {
    hs.anchor.getWorldPosition(tmpV);
    tmpV.project(camera);
    hs.el.style.left = `${(tmpV.x * 0.5 + 0.5) * w}px`;
    hs.el.style.top = `${(-tmpV.y * 0.5 + 0.5) * h}px`;
    // the battery hotspot leaves with the battery
    const part = hs.anchor.userData.part;
    const gone = (part.kind === 'battery' && state.step === 2) || (part.underBattery && state.step !== 2);
    hs.el.classList.toggle('hidden', !facing || gone);
  }
}

// ---------- pointer: drag to rotate, click to select ----------
const drag = { active: false, down: false, x: 0, y: 0, vx: 0, vy: 0, moved: 0 };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function rotateHeld(dx, dy) {
  const root = state.held.model.root;
  const k = 0.008;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  tmpQ.setFromAxisAngle(up, dx * k);
  root.quaternion.premultiply(tmpQ);
  tmpQ.setFromAxisAngle(right, dy * k);
  root.quaternion.premultiply(tmpQ);
}

canvas.addEventListener('pointerdown', (e) => {
  drag.down = true; drag.moved = 0; drag.x = e.clientX; drag.y = e.clientY; drag.vx = drag.vy = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (drag.down) {
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if ((state.mode === 'held' || state.mode === 'open') && drag.moved > 3) {
      drag.active = true;
      canvas.classList.add('dragging');
      rotateHeld(dx, dy);
      drag.vx = dx; drag.vy = dy;
      trackOnce(`rot:${state.held.item.phone.id}:${state.mode}`, 'rotate_phone', { phone_id: state.held.item.phone.id, view: state.mode });
    }
    drag.x = e.clientX; drag.y = e.clientY;
  } else {
    canvas.classList.toggle('pointer', !!pickAt(e.clientX, e.clientY));
  }
});
function endDrag(e) {
  if (!drag.down) return;
  drag.down = false;
  canvas.classList.remove('dragging');
  const wasDrag = drag.active;
  drag.active = false;
  if (!wasDrag && drag.moved < 6) onClick(e.clientX, e.clientY);
  if (wasDrag && state.mode === 'open') {
    // ease back to facing so the parts line up with their dots again
    setTimeout(() => state.mode === 'open' && !drag.down && resetOrientation(), 900);
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function pickAt(x, y) {
  if (state.mode !== 'browse' && state.mode !== 'overhead') return null;
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = [...enabled.map((it) => it.model?.root ?? it.stand), ...workItems.map((w) => w.model.root)];
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && o.userData.item == null && o.userData.work == null) o = o.parent;
  return o;
}

function onClick(x, y) {
  const o = pickAt(x, y);
  if (!o) return;
  if (o.userData.work != null) {
    if (state.mode === 'overhead') state.mode = 'browse';
    if (state.table === 'work' && o.userData.work === state.workCur && state.mode === 'browse') pickUp();
    else goWork(o.userData.work, 'click');
    return;
  }
  const idx = enabled.findIndex((it) => (it.model?.root ?? it.stand) === o);
  if (state.mode === 'overhead') { state.mode = 'browse'; goTo(idx, 'click'); return; }
  if (state.table === 'work') { goTo(idx, 'click'); return; }
  if (idx === state.cur) pickUp();
  else goTo(idx, 'click');
}

// wheel / swipe / keys to orbit
let wheelAcc = 0, wheelLock = 0;
addEventListener('wheel', (e) => {
  if (e.target.closest?.('.panel')) return;
  if (state.mode !== 'browse' || state.table !== 'main') return;
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += e.deltaY + e.deltaX;
  if (Math.abs(wheelAcc) > 60) {
    const dir = Math.sign(wheelAcc);
    wheelAcc = 0; wheelLock = now + 1200;
    if (dir > 0 && state.cur === enabled.length - 1) goOverhead();
    else goTo(state.cur + dir, 'scroll');
  }
}, { passive: true });

let touchX = null;
canvas.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (touchX == null || state.mode !== 'browse') return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 50) return;
  if (state.table === 'work') goWork(state.workCur + (dx < 0 ? 1 : -1), 'swipe');
  else goTo(state.cur + (dx < 0 ? 1 : -1), 'swipe');
});

// Arrow keys: in the browse view they move straight on. While a phone is in your hand,
// the first press only explains itself; a second press (same direction, within 3 s)
// closes it, puts it back and moves on.
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(text, ms = 3000) {
  toastEl.classList.remove('intro');
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}
let armed = null; // { dir, until }

function step(dir, source) {
  if (state.table === 'work') return goWork(state.workCur + dir, source);
  if (dir > 0 && state.cur === enabled.length - 1) return goOverhead();
  goTo(state.cur + dir, source);
}

function leaveAndStep(dir) {
  const next = () => putBack(() => step(dir, 'key'));
  if (state.mode === 'open') closeUp(next);
  else next();
}

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const m = state.mode;
  const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (dir && m === 'browse') { e.preventDefault(); step(dir, 'key'); }
  else if (dir && m === 'overhead' && dir < 0) { e.preventDefault(); leaveOverhead(); }
  else if (dir && (m === 'held' || m === 'open')) {
    e.preventDefault();
    const now = performance.now();
    if (armed && armed.dir === dir && now < armed.until) {
      armed = null;
      toastEl.hidden = true;
      leaveAndStep(dir);
      track('arrow_leave_phone', { phone_id: state.held.item.phone.id, direction: dir > 0 ? 'next' : 'previous' });
    } else {
      armed = { dir, until: now + 3000 };
      const target = state.table === 'work'
        ? workItems[(state.workCur + dir + workItems.length) % workItems.length].phone.name
        : dir > 0 ? enabled[state.cur + 1]?.phone.name ?? 'the view from above' : enabled[state.cur - 1]?.phone.name;
      if (!target) { toast('This is the first phone on the table.'); armed = null; return; }
      toast(`Press ${dir > 0 ? '→' : '←'} again to put this phone back and go to ${target}`);
    }
  }
  else if (e.key === 'Escape') { if (m === 'open') closeUp(); else if (m === 'held') putBack(); else if (m === 'overhead') leaveOverhead(); }
});

// control buttons
controlsEl.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (!a) return;
  ({
    prev: () => step(-1, 'button'),
    next: () => step(1, 'button'),
    pick: pickUp,
    putback: putBack,
    open: openUp,
    close: closeUp,
    battery: toggleBattery,
    reset: resetOrientation,
    overhead: goOverhead,
    down: leaveOverhead,
    work: () => { state.mode = 'browse'; goWork(state.workCur, 'button'); },
    home: () => goTo(state.cur, 'button'),
    wprev: () => goWork(state.workCur - 1, 'button'),
    wnext: () => goWork(state.workCur + 1, 'button'),
  })[a]?.();
});

document.getElementById('directory').addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  const w = e.target.closest('[data-work]');
  if (state.mode === 'held' || state.mode === 'open') return;
  if (state.mode === 'overhead') state.mode = 'browse';
  if (g && !g.disabled) goTo(+g.dataset.go, 'directory');
  if (w) goWork(+w.dataset.work, 'directory');
});

// ---------- loop ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the phone a similar size on narrow screens
  camera.fov = w / h < 0.8 ? 50 : 34;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateCamera();
  // gentle inertia after a flick
  if (state.held && !drag.down && state.mode === 'held' && (Math.abs(drag.vx) > 0.05 || Math.abs(drag.vy) > 0.05)) {
    rotateHeld(drag.vx, drag.vy);
    const f = Math.pow(0.02, dt);
    drag.vx *= f; drag.vy *= f;
  }
  renderer.render(scene, camera);
  updateHotspots();
  requestAnimationFrame(frame);
}

refreshUI();
updateCamera();
requestAnimationFrame(() => {
  frame();
  setTimeout(() => document.getElementById('loading').classList.add('done'), 300);
  setTimeout(showIntro, 900);
});

// A short "how to get around" note on first load; it leaves by itself or on the first interaction.
function showIntro() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const lines = touch
    ? ['Swipe to move between phones', 'Tap a phone to pick it up', 'Drag to turn it · open it to look inside']
    : ['← → or scroll to move between phones', 'Click a phone to pick it up', 'Drag to turn it · open it to look inside'];
  toastEl.classList.add('intro');
  toastEl.innerHTML = `<b>Welcome to the showroom</b>${lines.map((l) => `<span>${l}</span>`).join('')}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  const hide = () => {
    toastEl.hidden = true;
    toastEl.classList.remove('intro');
    removeEventListener('pointerdown', hide, true);
    removeEventListener('keydown', hide, true);
  };
  toastTimer = setTimeout(hide, 9000);
  addEventListener('pointerdown', hide, true);
  addEventListener('keydown', hide, true);
  track('intro_shown', { input: touch ? 'touch' : 'pointer' });
}
track('view_phone', { phone_id: enabled[state.cur].phone.id, phone_name: enabled[state.cur].phone.name, source: 'start' });

// handy for debugging in the console
window.__showroom = { THREE, items, workItems, state, view, camera, scene, goTo, pickUp, openUp, toggleBattery, goOverhead, goWork, putBack, closeUp };
