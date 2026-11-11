// Phones whose exterior comes from a downloaded 3D model (.glb) rather than code.
// The file is prepared offline (see devlog): one copy, real size in metres, screen +z, up +y,
// with two nodes: `body` (frame, back, cameras) and `display` (the screen face, lifted off in the teardown).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

/**
 * Fill `frame` and `front` with the model's body and display. Resolves once they are in place.
 * Each phone gets its own clone so materials can be adjusted per scene without touching the cache.
 */
export async function attachModel(url, { frame, front }) {
  const gltf = await load(url);
  const src = gltf.scene.clone(true);
  const body = src.getObjectByName('body');
  const display = body.getObjectByName('display');
  body.remove(display);
  for (const o of [body, display]) {
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.material = m.material.clone();
    });
  }
  // the display face is a single sheet: give its underside a dark backing so it reads as glass when lifted
  const sheets = [];
  display.traverse((m) => { if (m.isMesh) sheets.push(m); });
  for (const m of sheets) {
    m.material.side = THREE.FrontSide;
    const under = new THREE.Mesh(m.geometry, new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.6, side: THREE.BackSide }));
    under.position.z = -0.05 * 0.001;
    m.add(under);
  }
  frame.add(body);
  front.add(display);
}
