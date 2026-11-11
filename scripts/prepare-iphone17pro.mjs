// Prepares the iPhone 17 Pro model (PikkmeStudios, CC-BY 4.0) for the showroom:
// keep one copy, real size in metres (150 x 71.9 x 8.75 mm body), screen +z, up +y,
// and split the display face off so it can lift away in the teardown view.
//
// Run (deps are not in package.json on purpose; install them in a scratch folder):
//   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions
//   node prepare-iphone17pro.mjs reference/iphone17pro/source/iphone17pro.glb public/models/iphone17pro.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const [n0, n1] = root.listNodes();
n0.dispose();

// measured on the model (world units): body box and centre
const BODY = { x: [-0.1372, 0.3506], y: [-0.4995, 0.4995], z: [-0.0272, 0.0272] };
const REAL = { w: 0.0719, h: 0.150, d: 0.00875 };
const c = ['x', 'y', 'z'].map((k) => (BODY[k][0] + BODY[k][1]) / 2);
const s = [REAL.w / (BODY.x[1] - BODY.x[0]), REAL.h / (BODY.y[1] - BODY.y[0]), REAL.d / (BODY.z[1] - BODY.z[0])];
const m = n1.getWorldMatrix();
const tp = (v) => [0, 1, 2].map((r) => (m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] - c[r]) * s[r]);
const tn = (v) => { const w = [0, 1, 2].map((r) => (m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2]) / s[r]); const l = Math.hypot(...w) || 1; return w.map((x) => x / l); };
const done = new Set();
const mesh = n1.getMesh();
for (const p of mesh.listPrimitives()) {
  for (const [sem, f] of [['POSITION', tp], ['NORMAL', tn]]) {
    const a = p.getAttribute(sem); if (done.has(a)) continue; done.add(a);
    const arr = a.getArray(); for (let i = 0; i < arr.length; i += 3) arr.set(f([arr[i], arr[i + 1], arr[i + 2]]), i);
    a.setArray(arr);
  }
}
n1.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setName('body');
mesh.setName('body');

// display: flat front-facing triangles of the textured shell
const shell = mesh.listPrimitives()[0];
const P = shell.getAttribute('POSITION').getArray(), N = shell.getAttribute('NORMAL').getArray();
const idx = shell.getIndices().getArray();
const front = [], rest = [];
const zf = REAL.d / 2;
for (let t = 0; t < idx.length; t += 3) {
  const vs = [idx[t], idx[t + 1], idx[t + 2]];
  const isFront = vs.every((v) => P[v * 3 + 2] > zf - 0.0004 && N[v * 3 + 2] > 0.9);
  (isFront ? front : rest).push(...vs);
}
const I = idx.constructor;
shell.getIndices().setArray(new I(rest));
const dispPrim = shell.clone();
dispPrim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new I(front)).setBuffer(root.listBuffers()[0]));
const dispMesh = doc.createMesh('display').addPrimitive(dispPrim);
n1.addChild(doc.createNode('display').setMesh(dispMesh));
console.log('display tris', front.length / 3, 'body shell tris', rest.length / 3);

// drop the model's photo texture: the showroom paints its own finish onto these UVs (src/scene/iphone17pro.js)
for (const mat of root.listMaterials()) {
  if (mat.getName() !== 'iphone17pro-textures') continue;
  mat.setBaseColorTexture(null).setBaseColorFactor([0.23, 0.29, 0.41, 1]).setAlphaMode('OPAQUE');
}
await doc.transform(dedup(), prune({ keepAttributes: true })); // keep UVs: the painted finish uses them
await io.write(out, doc);
